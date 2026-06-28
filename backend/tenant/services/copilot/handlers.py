from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from typing import Any

from django.db.models import Q

from tenant.models.DepartmentModel import Department
from tenant.models.TicketModel import TicketCategories
from tenant.models import CopilotPromptTemplate, Ticket
from tenant.services.tickets.reference_resolver import (
    get_ticket_reference_options,
    resolve_assignee,
    resolve_category,
    resolve_department,
    resolve_label_names,
)
from users.models import Users

from .context import ContextAssembler, CopilotContext
from .gateway import BlockedLLMResponseError, LLMGateway
from .prompts import DEFAULT_COPILOT_PROMPTS


@dataclass
class HandlerResult:
    suggestion_type: str
    payload: dict[str, Any]
    confidence_score: float | None = None
    metadata: dict[str, Any] | None = None


class BaseCopilotHandler:
    command = ""
    suggestion_type = "informational"

    def __init__(self, *, context_assembler: ContextAssembler, llm_gateway: LLMGateway) -> None:
        self.context_assembler = context_assembler
        self.llm_gateway = llm_gateway

    def run(
        self,
        *,
        ticket: Ticket,
        query: str,
        extra_input: str = "",
    ) -> HandlerResult:
        raise NotImplementedError

    def _load_prompt_template(self, ticket: Ticket) -> str:
        template = (
            CopilotPromptTemplate.objects.filter(
                command=self.command,
                is_active=True,
            )
            .filter(Q(business_id=ticket.business_id) | Q(business__isnull=True))
            .order_by("-business_id", "-version")
            .first()
        )
        return template.system_prompt if template else DEFAULT_COPILOT_PROMPTS[self.command]

    def _build_context_block(self, context: CopilotContext) -> str:
        thread_lines = "\n".join(
            f"- {item['author']} ({'internal' if item['is_internal'] else 'public'}): {item['content']}"
            for item in context.thread
        ) or "- No recent thread activity"
        history_lines = "\n".join(
            f"- {item['ticket_id']}: {item['title']} [{item['status']}]"
            for item in context.customer_history
        ) or "- No customer history"
        kb_lines = "\n".join(
            f"- {item['title']} (score {item['score']:.2f}): {item['excerpt']}"
            for item in context.kb_suggestions
        ) or "- No KB suggestions"
        similar_lines = "\n".join(
            f"- {item['ticket_id']}: {item['title']} [{item['status']}] because {item['reason']}"
            for item in context.similar_tickets
        ) or "- No similar tickets"
        return (
            f"{context.ticket_summary}\n\n"
            f"Recent thread:\n{thread_lines}\n\n"
            f"Customer history:\n{history_lines}\n\n"
            f"KB suggestions:\n{kb_lines}\n\n"
            f"Similar tickets:\n{similar_lines}"
        )

    def _build_option_block(self, ticket: Ticket) -> str:
        options = get_ticket_reference_options(ticket.business_id)
        categories = options["categories"][:12]
        departments = options["departments"][:10]
        agents = options["assignees"][:12]
        labels = options["labels"][:12]

        category_lines = "\n".join(f"- {item['id']}: {item['name']}" for item in categories) or "- None"
        department_lines = "\n".join(f"- {item['id']}: {item['name']}" for item in departments) or "- None"
        label_lines = "\n".join(f"- {item['id']}: {item['name']}" for item in labels) or "- None"
        agent_lines = (
            "\n".join(
                f"- {item['id']}: {item['name']}"
                for item in agents
            )
            or "- None"
        )

        return (
            "Valid routing options:\n"
            f"Categories:\n{category_lines}\n\n"
            f"Departments:\n{department_lines}\n\n"
            f"Labels:\n{label_lines}\n\n"
            f"Agents:\n{agent_lines}"
        )

    @staticmethod
    def _clean_text(value: Any) -> str:
        return str(value or "").strip()

    @staticmethod
    def _normalize_lines(value: Any, *, limit: int = 5) -> list[str]:
        if isinstance(value, list):
            items = [str(item).strip() for item in value if str(item).strip()]
            return items[:limit]

        if isinstance(value, str):
            lines = []
            for part in re.split(r"\n|(?:^|\s)[*-]\s+", value):
                cleaned = part.strip(" \t\r\n-*")
                if cleaned:
                    lines.append(cleaned)
            return lines[:limit]

        return []

    def _raise_if_blocked_response(self, raw_content: str) -> None:
        cleaned = (raw_content or "").strip()
        if cleaned and self.llm_gateway._looks_blocked_response(cleaned):
            raise BlockedLLMResponseError(raw_content=cleaned[:1000])

    def _confidence_label(self, score: float | None) -> str:
        if score is None:
            return "medium"
        if score >= 0.78:
            return "high"
        if score >= 0.58:
            return "medium"
        return "low"

    def _estimate_triage_confidence(self, *, context: CopilotContext, payload: dict[str, Any]) -> float:
        sources = self._base_sources(context)
        updates = dict(payload.get("suggested_updates") or {})
        recommended_actions = [item for item in (payload.get("recommended_actions") or []) if isinstance(item, dict)]
        rationale = [item for item in (payload.get("rationale") or []) if str(item).strip()]
        missing_info = [item for item in (payload.get("missing_info") or []) if str(item).strip()]

        update_count = 0
        for key, value in updates.items():
            if key.endswith("_label"):
                continue
            if isinstance(value, list):
                if value:
                    update_count += 1
            elif value:
                update_count += 1

        confidence = 0.36
        confidence += min(len(sources), 4) * 0.11
        confidence += min(len(rationale), 3) * 0.04

        if len(missing_info) >= 2:
            confidence -= 0.05
        if update_count + len(recommended_actions) >= 3:
            confidence -= 0.08
        if len(sources) <= 1 and (update_count > 0 or recommended_actions):
            confidence -= 0.08
        if not context.similar_tickets and not context.kb_suggestions and recommended_actions:
            confidence -= 0.05

        return max(0.28, min(confidence, 0.88))

    def _base_sources(self, context: CopilotContext) -> list[dict[str, Any]]:
        sources: list[dict[str, Any]] = []

        if context.thread:
            sources.append(
                {
                    "type": "current_thread",
                    "label": "Current thread",
                    "detail": f"{len(context.thread)} recent message{'s' if len(context.thread) != 1 else ''}",
                }
            )
        if context.kb_suggestions:
            first_kb = context.kb_suggestions[0]
            sources.append(
                {
                    "type": "kb_article",
                    "label": str(first_kb.get("title") or "KB article"),
                    "detail": "Knowledge base suggestion",
                }
            )
        if context.similar_tickets:
            first_ticket = context.similar_tickets[0]
            sources.append(
                {
                    "type": "similar_ticket",
                    "label": str(first_ticket.get("ticket_id") or "Similar ticket"),
                    "detail": str(first_ticket.get("title") or "Resolved case"),
                }
            )
        if context.customer_history:
            latest_history = context.customer_history[0]
            sources.append(
                {
                    "type": "customer_history_ticket",
                    "label": str(latest_history.get("ticket_id") or "Customer history"),
                    "detail": str(latest_history.get("title") or latest_history.get("status") or ""),
                }
            )

        return sources[:4]

    def _with_provenance(
        self,
        *,
        payload: dict[str, Any],
        context: CopilotContext | None = None,
        confidence_score: float | None = None,
        sources: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        next_payload = dict(payload)
        next_payload["sources"] = sources if sources is not None else self._base_sources(context) if context else []
        next_payload["confidence_label"] = self._confidence_label(confidence_score)
        return next_payload

    def _enrich_triage_payload(self, *, ticket: Ticket, payload: dict[str, Any]) -> dict[str, Any]:
        enriched = dict(payload)
        updates = dict(enriched.get("suggested_updates") or {})

        category_id = updates.get("category_id")
        if category_id and not updates.get("category_label"):
            category = TicketCategories.objects.filter(id=category_id, business=ticket.business).first()
            if category:
                updates["category_label"] = category.name

        assignee_id = updates.get("assignee_id")
        if assignee_id and not updates.get("assignee_label"):
            assignee = Users.objects.filter(id=assignee_id, business=ticket.business).first()
            if assignee:
                updates["assignee_label"] = assignee.full_name().strip() or assignee.email

        department_id = updates.get("department_id")
        if department_id and not updates.get("department_label"):
            department = Department.objects.filter(id=department_id, business=ticket.business).first()
            if department:
                updates["department_label"] = department.name

        enriched["suggested_updates"] = updates

        normalized_actions: list[dict[str, Any]] = []
        for raw_action in enriched.get("recommended_actions") or []:
            if not isinstance(raw_action, dict):
                continue

            action_type = str(raw_action.get("type") or "").strip()
            if action_type not in {"create_follow_up_task", "close_ticket", "reopen_ticket"}:
                continue

            normalized_action = {
                "type": action_type,
                "label": str(raw_action.get("label") or action_type.replace("_", " ").title()).strip(),
                "reason": str(raw_action.get("reason") or "").strip(),
                "requires_confirmation": True,
            }

            if action_type == "create_follow_up_task":
                task_payload = dict(raw_action.get("task") or {})
                task_department_id = task_payload.get("department_id") or updates.get("department_id") or ticket.department_id
                task_assignee_id = task_payload.get("assignee_id") or updates.get("assignee_id")

                if task_department_id and not task_payload.get("department_label"):
                    department = Department.objects.filter(id=task_department_id, business=ticket.business).first()
                    if department:
                        task_payload["department_label"] = department.name
                if task_assignee_id and not task_payload.get("assignee_label"):
                    assignee = Users.objects.filter(id=task_assignee_id, business=ticket.business).first()
                    if assignee:
                        task_payload["assignee_label"] = assignee.full_name().strip() or assignee.email

                task_payload["department_id"] = task_department_id
                task_payload["assignee_id"] = task_assignee_id
                task_payload["priority"] = task_payload.get("priority") or updates.get("priority") or ticket.priority or "medium"
                task_payload["title"] = str(task_payload.get("title") or f"Follow up on {ticket.ticket_id}").strip()
                task_payload["description"] = str(task_payload.get("description") or normalized_action["reason"]).strip()
                task_payload["link_to_ticket"] = True
                normalized_action["task"] = task_payload

            normalized_actions.append(normalized_action)

        enriched["recommended_actions"] = normalized_actions
        return enriched


def _coerce_html_fragment(raw_content: str) -> str:
    cleaned = (raw_content or "").strip()
    if not cleaned:
        return ""
    if "<" in cleaned and ">" in cleaned:
        return cleaned

    paragraphs = [chunk.strip() for chunk in re.split(r"\n\s*\n", cleaned) if chunk.strip()]
    if not paragraphs:
        return ""

    rendered: list[str] = []
    for paragraph in paragraphs:
        lines = [html.escape(line.strip()) for line in paragraph.splitlines() if line.strip()]
        if not lines:
            continue
        rendered.append(f"<p>{'<br>'.join(lines)}</p>")
    return "".join(rendered)


def _parse_email_draft_payload(raw_content: str, fallback_subject: str = "") -> dict[str, Any]:
    cleaned = (raw_content or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            payload = json.loads(cleaned[start:end + 1])
            return {
                "subject": str(payload.get("subject") or fallback_subject).strip(),
                "content": _coerce_html_fragment(str(payload.get("content") or "")),
            }
        except json.JSONDecodeError:
            pass

    subject_match = re.search(r"^subject:\s*(.+)$", cleaned, flags=re.IGNORECASE | re.MULTILINE)
    if subject_match:
        subject = subject_match.group(1).strip()
        cleaned = re.sub(r"^subject:\s*.+$\n?", "", cleaned, count=1, flags=re.IGNORECASE | re.MULTILINE).strip()
    else:
        subject = fallback_subject

    return {
        "subject": subject.strip(),
        "content": _coerce_html_fragment(cleaned),
    }


def _extract_json_object(raw_content: str) -> dict[str, Any] | None:
    cleaned = (raw_content or "").strip()
    if not cleaned:
        return None

    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.IGNORECASE).strip()

    try:
        payload = json.loads(cleaned)
        if isinstance(payload, dict):
            return payload
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if not match:
        return None

    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


class SummarizeHandler(BaseCopilotHandler):
    command = "summarize"
    suggestion_type = "informational"

    def run(self, *, ticket: Ticket, query: str, extra_input: str = "") -> HandlerResult:
        context = self.context_assembler.build(ticket=ticket, query=query or ticket.title)
        result = self.llm_gateway.generate_content(
            system_instruction=self._load_prompt_template(ticket),
            prompt=f"{self._build_context_block(context)}\n\nAgent ask: {query or 'Summarize this ticket.'}",
            max_tokens=600,
        )
        raw_content = result.get("content") or ""
        self._raise_if_blocked_response(raw_content)
        payload, used_fallback = self._parse_summary_payload(context=context, raw_content=raw_content)
        meta = self.llm_gateway.build_meta(result)
        if used_fallback:
            meta["fallback"] = "summary_normalized"
        confidence = 0.66 if used_fallback else 0.72
        payload = self._with_provenance(payload=payload, context=context, confidence_score=confidence)
        return HandlerResult(self.suggestion_type, payload, confidence_score=confidence, metadata=meta)

    def _parse_summary_payload(self, *, context: CopilotContext, raw_content: str) -> tuple[dict[str, Any], bool]:
        parsed = _extract_json_object(raw_content) or {}
        summary = self._clean_text(parsed.get("summary"))
        key_facts = self._normalize_lines(parsed.get("key_facts"), limit=4)
        thread_recap = self._clean_text(parsed.get("thread_recap"))
        used_fallback = False

        if not summary or not thread_recap:
            paragraphs = [
                item.strip()
                for item in re.split(r"\n\s*\n", re.sub(r"```(?:json)?|```", "", raw_content or "", flags=re.IGNORECASE))
                if item.strip()
            ]
            bullets = re.findall(r"^[\-\*\u2022]\s+(.+)$", raw_content or "", flags=re.MULTILINE)

            if not summary and paragraphs:
                summary = paragraphs[0][:280]
                used_fallback = True
            if not thread_recap:
                if len(paragraphs) > 1:
                    thread_recap = paragraphs[1][:280]
                elif context.thread:
                    latest = context.thread[-1]
                    thread_recap = f"Latest update from {latest['author']}: {str(latest['content'])[:220]}"
                used_fallback = True
            if not key_facts and bullets:
                key_facts = [item.strip() for item in bullets if item.strip()][:4]
                used_fallback = True

        if not summary:
            ticket = context.ticket
            requester = ticket.creator_name or ticket.creator_email or "the requester"
            summary = f"{requester} needs help with '{ticket.title or 'this ticket'}' while the ticket remains {ticket.status}."
            used_fallback = True

        if not key_facts:
            ticket = context.ticket
            key_facts = [
                f"Status: {ticket.status}",
                f"Priority: {ticket.priority}",
            ]
            if context.thread:
                key_facts.append(f"Latest thread update from {context.thread[-1]['author']}")
            used_fallback = True

        if not thread_recap:
            thread_recap = "Review the recent thread for the latest customer and agent updates."
            used_fallback = True

        return {
            "summary": summary,
            "key_facts": key_facts[:4],
            "thread_recap": thread_recap,
        }, used_fallback


class DraftReplyHandler(BaseCopilotHandler):
    command = "draft-reply"
    suggestion_type = "draft"

    def run(self, *, ticket: Ticket, query: str, extra_input: str = "") -> HandlerResult:
        context = self.context_assembler.build(ticket=ticket, query=query or ticket.title)
        input_block = f"\n\nExisting draft to rewrite:\n{extra_input}" if extra_input else ""
        result = self.llm_gateway.generate_content(
            system_instruction=self._load_prompt_template(ticket),
            prompt=(
                f"{self._build_context_block(context)}{input_block}\n\n"
                f"Agent instruction: {query or 'Draft a concise reply for the customer.'}"
            ),
            max_tokens=900,
        )
        raw_content = result.get("content") or ""
        self._raise_if_blocked_response(raw_content)
        payload = _parse_email_draft_payload(
            raw_content,
            fallback_subject=f"Re: {ticket.title}" if ticket.title else "",
        )
        meta = self.llm_gateway.build_meta(result)
        if not payload.get("content"):
            payload["content"] = self._build_reply_fallback(ticket=ticket, context=context)
            meta["fallback"] = "reply_template"
        confidence = 0.68 if meta.get("fallback") else 0.76
        payload = self._with_provenance(payload=payload, context=context, confidence_score=confidence)
        return HandlerResult(self.suggestion_type, payload, confidence_score=confidence, metadata=meta)

    def _build_reply_fallback(self, *, ticket: Ticket, context: CopilotContext) -> str:
        latest_thread = context.thread[-1]["content"] if context.thread else ""
        summary = html.escape((latest_thread or ticket.description or ticket.title or "the issue")[:220])
        return (
            "<p>Thanks for the update. We are reviewing your request and the current ticket context.</p>"
            f"<p>Current issue summary: {summary}</p>"
            "<p>We will follow up with the next step shortly.</p>"
        )


class DraftNoteHandler(BaseCopilotHandler):
    command = "draft-note"
    suggestion_type = "draft"

    def run(self, *, ticket: Ticket, query: str, extra_input: str = "") -> HandlerResult:
        context = self.context_assembler.build(ticket=ticket, query=query or ticket.title)
        input_block = f"\n\nExisting note to rewrite:\n{extra_input}" if extra_input else ""
        result = self.llm_gateway.generate_content(
            system_instruction=self._load_prompt_template(ticket),
            prompt=(
                f"{self._build_context_block(context)}{input_block}\n\n"
                f"Agent instruction: {query or 'Draft an internal note for handoff.'}"
            ),
            max_tokens=700,
        )
        raw_content = result.get("content") or ""
        self._raise_if_blocked_response(raw_content)
        payload = self._parse_note_payload(context=context, raw_content=raw_content)
        meta = self.llm_gateway.build_meta(result)
        confidence = 0.69 if payload.get("_fallback_used") else 0.74
        if payload.pop("_fallback_used", False):
            meta["fallback"] = "note_normalized"
        payload = self._with_provenance(payload=payload, context=context, confidence_score=confidence)
        return HandlerResult(self.suggestion_type, payload, confidence_score=confidence, metadata=meta)

    def _parse_note_payload(self, *, context: CopilotContext, raw_content: str) -> dict[str, Any]:
        parsed = _extract_json_object(raw_content) or {}
        content = _coerce_html_fragment(str(parsed.get("content") or ""))
        if content:
            return {"content": content}

        text = (raw_content or "").strip()
        if text:
            return {"content": _coerce_html_fragment(text), "_fallback_used": True}

        ticket = context.ticket
        fallback = (
            f"<p>Ticket {html.escape(ticket.ticket_id or '')} remains {html.escape(ticket.status or 'open')} "
            f"with priority {html.escape(ticket.priority or 'medium')}.</p>"
        )
        if context.thread:
            latest = context.thread[-1]
            fallback += (
                f"<p>Latest thread update from {html.escape(str(latest['author']))}: "
                f"{html.escape(str(latest['content'])[:220])}</p>"
            )
        fallback += "<p>Review the full thread before handing this off.</p>"
        return {"content": fallback, "_fallback_used": True}


class DraftCallLogHandler(BaseCopilotHandler):
    command = "draft-call-log"
    suggestion_type = "draft"

    def run(self, *, ticket: Ticket, query: str, extra_input: str = "") -> HandlerResult:
        context = self.context_assembler.build(ticket=ticket, query=query or ticket.title)
        input_block = f"\n\nExisting call notes to rewrite:\n{extra_input}" if extra_input else ""
        result = self.llm_gateway.generate_content(
            system_instruction=self._load_prompt_template(ticket),
            prompt=(
                f"{self._build_context_block(context)}{input_block}\n\n"
                f"Agent call draft/instruction: {query or 'Draft concise call log notes for this ticket.'}"
            ),
            max_tokens=700,
        )
        raw_content = result.get("content") or ""
        self._raise_if_blocked_response(raw_content)
        payload = self._parse_call_log_payload(ticket=ticket, raw_content=raw_content)
        meta = self.llm_gateway.build_meta(result)
        confidence = 0.69 if payload.get("_fallback_used") else 0.74
        if payload.pop("_fallback_used", False):
            meta["fallback"] = "call_log_normalized"
        payload = self._with_provenance(payload=payload, context=context, confidence_score=confidence)
        return HandlerResult(self.suggestion_type, payload, confidence_score=confidence, metadata=meta)

    def _parse_call_log_payload(self, *, ticket: Ticket, raw_content: str) -> dict[str, Any]:
        parsed = _extract_json_object(raw_content) or {}
        subject = str(parsed.get("subject") or "").strip()
        content = _coerce_html_fragment(str(parsed.get("content") or parsed.get("comments") or ""))
        if subject and content:
            return {"subject": subject[:200], "content": content}

        text = (raw_content or "").strip()
        if text:
            return {
                "subject": subject or "Call",
                "content": _coerce_html_fragment(text),
                "_fallback_used": True,
            }

        return {
            "subject": "Call",
            "content": f"<p>Logged a call related to {html.escape(ticket.title or ticket.ticket_id or 'this ticket')}.</p>",
            "_fallback_used": True,
        }


class SimilarHandler(BaseCopilotHandler):
    command = "similar"
    suggestion_type = "informational"

    def run(self, *, ticket: Ticket, query: str, extra_input: str = "") -> HandlerResult:
        metadata: dict[str, Any] = {"source": "search"}
        items = self.context_assembler.find_similar_tickets(ticket=ticket, query=query or ticket.title, top_k=3)
        confidence = 0.7
        sources = [
            {
                "type": "similar_ticket",
                "label": str(item.get("ticket_id") or "Similar ticket"),
                "detail": str(item.get("title") or item.get("reason") or ""),
            }
            for item in items[:3]
        ]
        payload = self._with_provenance(
            payload={"items": items},
            confidence_score=confidence,
            sources=sources,
        )
        return HandlerResult(self.suggestion_type, payload, confidence_score=confidence, metadata=metadata)


class SuggestKBHandler(BaseCopilotHandler):
    command = "suggest-kb"
    suggestion_type = "informational"

    def run(self, *, ticket: Ticket, query: str, extra_input: str = "") -> HandlerResult:
        metadata: dict[str, Any] = {"source": "kb_search"}
        items = self.context_assembler.search_kb(ticket.business_id, query or ticket.title, top_k=3)
        confidence = 0.71
        sources = [
            {
                "type": "kb_article",
                "label": str(item.get("title") or "KB article"),
                "detail": f"{int(round(float(item.get('score') or 0.0) * 100))}% match",
            }
            for item in items[:3]
        ]
        payload = self._with_provenance(
            payload={"items": items},
            confidence_score=confidence,
            sources=sources,
        )
        return HandlerResult(self.suggestion_type, payload, confidence_score=confidence, metadata=metadata)


class TriageHandler(BaseCopilotHandler):
    command = "triage"
    suggestion_type = "suggested_action"

    def run(self, *, ticket: Ticket, query: str, extra_input: str = "") -> HandlerResult:
        context = self.context_assembler.build(ticket=ticket, query=query or ticket.title)
        result = self.llm_gateway.generate_content(
            system_instruction=self._load_prompt_template(ticket),
            prompt=(
                f"{self._build_context_block(context)}\n\n"
                f"{self._build_option_block(ticket)}\n\n"
                f"Agent ask: {query or 'Suggest the next best triage action.'}"
            ),
            max_tokens=800,
        )
        raw_content = result.get("content") or ""
        self._raise_if_blocked_response(raw_content)
        payload = self._parse_triage_payload(ticket=ticket, context=context, raw_content=raw_content)
        meta = self.llm_gateway.build_meta(result)
        if payload.pop("_fallback_used", False):
            meta["fallback"] = "triage_normalized"
        confidence = self._estimate_triage_confidence(context=context, payload=payload)
        payload = self._with_provenance(payload=payload, context=context, confidence_score=confidence)
        if not payload.get("sources"):
            payload["confidence_label"] = "low"
        return HandlerResult(self.suggestion_type, payload, confidence_score=confidence, metadata=meta)

    def _parse_triage_payload(self, *, ticket: Ticket, context: CopilotContext, raw_content: str) -> dict[str, Any]:
        parsed = _extract_json_object(raw_content) or {}
        suggested_updates, implied_actions = self._resolve_triage_updates(ticket=ticket, raw_updates=parsed.get("suggested_updates"))
        recommended_actions = self._resolve_triage_actions(
            ticket=ticket,
            raw_actions=parsed.get("recommended_actions"),
            suggested_updates=suggested_updates,
            implied_actions=implied_actions,
        )

        summary = self._clean_text(parsed.get("summary"))
        next_step = self._clean_text(parsed.get("next_step"))
        missing_info = self._normalize_lines(parsed.get("missing_info"), limit=4)
        rationale = self._normalize_lines(parsed.get("rationale"), limit=4)
        used_fallback = False

        if not summary:
            latest_thread = context.thread[-1]["content"] if context.thread else context.ticket.description
            summary = f"Review ticket {ticket.ticket_id} and the latest customer context before applying updates."
            if latest_thread:
                summary = f"{summary} Latest issue detail: {str(latest_thread)[:180]}"
            used_fallback = True

        if not next_step:
            if recommended_actions:
                next_step = str(recommended_actions[0].get("label") or "Review the suggested action")
            elif suggested_updates:
                next_step = "Review the suggested ticket updates and confirm the ones supported by the evidence."
            elif missing_info:
                next_step = "Request the missing details before changing ticket routing or status."
            else:
                next_step = "Review the ticket context and decide the next routing step."
            used_fallback = True

        return {
            "summary": summary,
            "next_step": next_step,
            "missing_info": missing_info,
            "suggested_updates": suggested_updates,
            "rationale": rationale,
            "recommended_actions": recommended_actions,
            "_fallback_used": used_fallback or not bool(parsed),
        }

    def _resolve_triage_updates(
        self,
        *,
        ticket: Ticket,
        raw_updates: Any,
    ) -> tuple[dict[str, Any], set[str]]:
        updates = dict(raw_updates or {})
        resolved: dict[str, Any] = {}
        implied_actions: set[str] = set()

        priority = self._normalize_priority(updates.get("priority"))
        if priority:
            resolved["priority"] = priority

        status = self._normalize_status(updates.get("status"))
        if status:
            if status == "closed":
                implied_actions.add("close_ticket")
            elif status == "open" and ticket.status in {"closed", "resolved"}:
                implied_actions.add("reopen_ticket")
            else:
                resolved["status"] = status

        category = self._resolve_category(ticket=ticket, raw_value=updates.get("category_id") or updates.get("category_name") or updates.get("category"))
        if category:
            resolved["category_id"] = category["id"]
            resolved["category_label"] = category["label"]

        department = self._resolve_department(ticket=ticket, raw_value=updates.get("department_id") or updates.get("department_name") or updates.get("department"))
        if department:
            resolved["department_id"] = department["id"]
            resolved["department_label"] = department["label"]

        assignee = self._resolve_assignee(ticket=ticket, raw_value=updates.get("assignee_id") or updates.get("assignee_email") or updates.get("assignee_name") or updates.get("assignee"))
        if assignee:
            resolved["assignee_id"] = assignee["id"]
            resolved["assignee_label"] = assignee["label"]

        label_resolution = resolve_label_names(ticket.business_id, updates.get("tags") or [])
        if label_resolution["names"]:
            resolved["tags"] = label_resolution["names"][:8]

        return resolved, implied_actions

    def _resolve_triage_actions(
        self,
        *,
        ticket: Ticket,
        raw_actions: Any,
        suggested_updates: dict[str, Any],
        implied_actions: set[str],
    ) -> list[dict[str, Any]]:
        normalized_actions: list[dict[str, Any]] = []
        seen_types: set[str] = set()

        for raw_action in raw_actions or []:
            if not isinstance(raw_action, dict):
                continue

            action_type = self._clean_text(raw_action.get("type")).lower()
            if action_type not in {"create_follow_up_task", "close_ticket", "reopen_ticket"} or action_type in seen_types:
                continue

            normalized_action: dict[str, Any] = {
                "type": action_type,
                "label": self._clean_text(raw_action.get("label")) or action_type.replace("_", " ").title(),
                "reason": self._clean_text(raw_action.get("reason")),
                "requires_confirmation": True,
            }

            if action_type == "create_follow_up_task":
                task_payload = dict(raw_action.get("task") or {})
                task_department = self._resolve_department(
                    ticket=ticket,
                    raw_value=task_payload.get("department_id") or task_payload.get("department_name") or task_payload.get("department"),
                )
                task_assignee = self._resolve_assignee(
                    ticket=ticket,
                    raw_value=task_payload.get("assignee_id") or task_payload.get("assignee_email") or task_payload.get("assignee_name") or task_payload.get("assignee"),
                )
                normalized_task = {
                    "title": self._clean_text(task_payload.get("title")) or f"Follow up on {ticket.ticket_id}",
                    "description": self._clean_text(task_payload.get("description")) or normalized_action["reason"],
                    "priority": self._normalize_priority(task_payload.get("priority")) or suggested_updates.get("priority") or ticket.priority or "medium",
                    "assignee_id": task_assignee["id"] if task_assignee else suggested_updates.get("assignee_id"),
                    "assignee_label": task_assignee["label"] if task_assignee else suggested_updates.get("assignee_label"),
                    "department_id": task_department["id"] if task_department else suggested_updates.get("department_id") or ticket.department_id,
                    "department_label": task_department["label"] if task_department else suggested_updates.get("department_label"),
                    "due_date": self._clean_text(task_payload.get("due_date")) or None,
                    "link_to_ticket": bool(task_payload.get("link_to_ticket", True)),
                }
                normalized_action["task"] = normalized_task

            normalized_actions.append(normalized_action)
            seen_types.add(action_type)

        for action_type in sorted(implied_actions):
            if action_type in seen_types:
                continue
            normalized_actions.append(
                {
                    "type": action_type,
                    "label": "Close ticket" if action_type == "close_ticket" else "Reopen ticket",
                    "reason": "Derived from the recommended ticket status change.",
                    "requires_confirmation": True,
                }
            )

        return normalized_actions

    @staticmethod
    def _normalize_priority(raw_value: Any) -> str | None:
        normalized = str(raw_value or "").strip().lower().replace(" ", "_")
        return normalized if normalized in {"low", "medium", "high", "critical"} else None

    @staticmethod
    def _normalize_status(raw_value: Any) -> str | None:
        normalized = str(raw_value or "").strip().lower().replace(" ", "_")
        aliases = {
            "inprogress": "in_progress",
            "in-progress": "in_progress",
            "onhold": "on_hold",
            "hold": "on_hold",
        }
        normalized = aliases.get(normalized, normalized)
        return normalized if normalized in {"open", "in_progress", "pending", "on_hold", "resolved", "closed"} else None

    def _resolve_category(self, *, ticket: Ticket, raw_value: Any) -> dict[str, Any] | None:
        value = self._clean_text(raw_value)
        if not value:
            return None

        return resolve_category(ticket.business_id, value)

    def _resolve_department(self, *, ticket: Ticket, raw_value: Any) -> dict[str, Any] | None:
        value = self._clean_text(raw_value)
        if not value:
            return None

        return resolve_department(ticket.business_id, value)

    def _resolve_assignee(self, *, ticket: Ticket, raw_value: Any) -> dict[str, Any] | None:
        value = self._clean_text(raw_value)
        if not value:
            return None

        return resolve_assignee(ticket.business_id, value)
