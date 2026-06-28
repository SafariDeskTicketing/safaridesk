"""
KBLearningService — turns resolved tickets / completed tasks into KB article suggestions.

Flow, per business:
  1. Read KB settings (enable_ai_learning, what to learn from, minimum volume, scope).
  2. Pull recent resolved tickets and/or completed tasks that haven't been "learned from" yet.
  3. Cluster them in a lightweight way (by ticket category / task department, with a
     fallback bucket for uncategorised items).
  4. For each cluster above the minimum-volume threshold, ask Gemini to either:
        - propose a brand-new article, or
        - propose an update to the closest existing article (via KBSearchService).
  5. Persist the result as a `KBAISuggestion` row in `review_status='pending'`.
  6. Stamp the source ticket/task metadata so we don't re-learn from the same items
     in the next run.

All LLM calls are best-effort — failures are logged and don't abort the pass.
"""
from __future__ import annotations

import json
import logging
import re
from collections import defaultdict
from datetime import timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from tenant.models.KnowledgeBase import (
    KBArticle, KBCategory, KBAISuggestion, get_kb_setting,
)
from tenant.services.ai.usage import (
    AIUsageLimitExceeded,
    assert_ai_usage_allowed,
    estimate_tokens_from_text,
    record_ai_usage,
)

logger = logging.getLogger(__name__)


# Prompt version — bump whenever the prompt / schema materially changes so we can
# filter by `prompt_version` in analytics later.
PROMPT_VERSION = 'kb-learning-v1'

# How far back to look when pulling source items. Kept modest so each run stays
# bounded; the "already learned from" stamp prevents double counting across runs.
DEFAULT_LOOKBACK_DAYS = 30

# Hard ceiling on how many source items we feed into a single prompt, to keep
# token usage bounded. Anything beyond this is truncated (most-recent wins).
MAX_SOURCES_PER_PROMPT = 12

# Minimum character count for a ticket/task to be worth learning from.
MIN_SOURCE_LENGTH = 80

# Metadata key used to mark a ticket/task as "processed by KB learning".
LEARNED_META_KEY = 'kb_learning_seen_at'


def _bool_setting(business, key: str, default: bool) -> bool:
    """Coerce a setting to bool. `get_kb_setting` already returns a parsed value,
    but older seeds may have stored strings — normalise here."""
    raw = get_kb_setting(key, default=default, business=business)
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return bool(raw)
    if isinstance(raw, str):
        return raw.strip().lower() in ('1', 'true', 'yes', 'on')
    return default


def _int_setting(business, key: str, default: int) -> int:
    raw = get_kb_setting(key, default=default, business=business)
    try:
        return int(raw)
    except (TypeError, ValueError):
        return default


def _str_setting(business, key: str, default: str) -> str:
    raw = get_kb_setting(key, default=default, business=business)
    return str(raw) if raw is not None else default


def _strip_html(text: str) -> str:
    """Very light HTML strip — the rich editor stores HTML, but LLM prompts are
    cleaner without the markup."""
    if not text:
        return ''
    no_tags = re.sub(r'<[^>]+>', ' ', text)
    return re.sub(r'\s+', ' ', no_tags).strip()


class KBLearningService:
    """Run a single learning pass for one business."""

    def __init__(self, gemini_client=None, search_service=None):
        # Lazy-construct to avoid pulling LLM deps on import.
        self._gemini = gemini_client
        self._search = search_service

    # ------------------------------------------------------------------ wiring
    def _gemini_client(self):
        if self._gemini is None:
            from tenant.services.ai.gemini_client import GeminiClient
            self._gemini = GeminiClient()
        return self._gemini

    def _search_service(self):
        if self._search is None:
            from tenant.services.ai.kb_search import KBSearchService
            self._search = KBSearchService()
        return self._search

    # -------------------------------------------------------------- public api
    def run(self, business, triggered_by=None) -> Dict[str, Any]:
        """
        Entry point called by the `generate` action.

        Returns a summary dict the view can pass straight to the client, e.g.
            {"generated_count": 3, "clusters_seen": 5, "sources_considered": 42,
             "skipped_reason": None, "prompt_version": "kb-learning-v1"}
        """
        if business is None:
            return {'generated_count': 0, 'skipped_reason': 'no_business'}

        if not _bool_setting(business, 'enable_ai_learning', default=False):
            return {'generated_count': 0, 'skipped_reason': 'learning_disabled'}

        learn_tickets = _bool_setting(business, 'ai_learn_from_tickets', default=True)
        learn_tasks = _bool_setting(business, 'ai_learn_from_tasks', default=False)
        min_items = max(1, _int_setting(business, 'ai_min_tickets_before_learning', default=3))
        allow_new = _bool_setting(business, 'ai_auto_draft_new_articles', default=True)
        allow_updates = _bool_setting(business, 'ai_auto_suggest_updates', default=True)

        if not (learn_tickets or learn_tasks):
            return {'generated_count': 0, 'skipped_reason': 'no_sources_enabled'}
        if not (allow_new or allow_updates):
            return {'generated_count': 0, 'skipped_reason': 'all_outputs_disabled'}

        sources = self._collect_sources(
            business=business,
            learn_tickets=learn_tickets,
            learn_tasks=learn_tasks,
        )
        if not sources:
            return {'generated_count': 0, 'skipped_reason': 'no_new_source_items',
                    'sources_considered': 0}

        clusters = self._cluster(sources)

        generated: List[KBAISuggestion] = []
        skipped_clusters = 0
        for cluster_key, items in clusters.items():
            if len(items) < min_items:
                skipped_clusters += 1
                continue

            items = items[:MAX_SOURCES_PER_PROMPT]

            suggestion = self._build_suggestion_for_cluster(
                business=business,
                cluster_key=cluster_key,
                items=items,
                allow_new=allow_new,
                allow_updates=allow_updates,
                triggered_by=triggered_by,
            )
            if suggestion:
                generated.append(suggestion)
                self._mark_sources_seen(items)

        return {
            'generated_count': len(generated),
            'sources_considered': len(sources),
            'clusters_seen': len(clusters),
            'clusters_below_threshold': skipped_clusters,
            'prompt_version': PROMPT_VERSION,
        }

    # ------------------------------------------------------------ data-gather
    def _collect_sources(
        self, business, learn_tickets: bool, learn_tasks: bool,
    ) -> List[Dict[str, Any]]:
        """
        Pull candidate tickets / tasks.

        We keep the coupling loose — importing inside the method means a business
        that doesn't have tickets/tasks installed doesn't break the service.

        Deduplication: we skip any ticket/task whose id already appears in the
        `source_refs` of a prior KBAISuggestion. This is cheaper and more robust
        than adding a `metadata` field to Ticket/Task (which those models don't
        have) and also survives suggestion deletion — if an admin wipes the
        suggestion queue and wants a fresh learning pass, they just need to run
        Generate again.
        """
        sources: List[Dict[str, Any]] = []
        cutoff = timezone.now() - timedelta(days=DEFAULT_LOOKBACK_DAYS)

        seen_ticket_ids, seen_task_ids = self._already_processed_ids(business)

        if learn_tickets:
            try:
                from tenant.models.TicketModel import Ticket
                qs = (
                    Ticket.objects
                    .filter(business=business, status__in=['resolved', 'closed'],
                            updated_at__gte=cutoff)
                )
                for t in qs.iterator():
                    if t.id in seen_ticket_ids:
                        continue
                    body = _strip_html(t.description or '')
                    if len(f"{t.title or ''} {body}") < MIN_SOURCE_LENGTH:
                        continue
                    sources.append({
                        'kind': 'ticket',
                        'id': t.id,
                        'title': t.title or '',
                        'body': body,
                        'category': getattr(getattr(t, 'category', None), 'name', None),
                        'department': getattr(getattr(t, 'department', None), 'name', None),
                    })
            except Exception as exc:  # pragma: no cover — defensive
                logger.warning('KB learning: ticket pull failed: %s', exc)

        if learn_tasks:
            try:
                from tenant.models.TaskModel import Task
                qs = (
                    Task.objects
                    .filter(business=business, task_status='completed',
                            updated_at__gte=cutoff)
                )
                for tk in qs.iterator():
                    if tk.id in seen_task_ids:
                        continue
                    body = _strip_html(tk.description or '')
                    if len(f"{tk.title or ''} {body}") < MIN_SOURCE_LENGTH:
                        continue
                    sources.append({
                        'kind': 'task',
                        'id': tk.id,
                        'title': tk.title or '',
                        'body': body,
                        'category': None,
                        'department': getattr(getattr(tk, 'department', None), 'name', None),
                    })
            except Exception as exc:  # pragma: no cover — defensive
                logger.warning('KB learning: task pull failed: %s', exc)

        return sources

    def _already_processed_ids(self, business) -> Tuple[set, set]:
        """
        Return (ticket_ids_already_used, task_ids_already_used) — items that
        appeared in the source_refs of any prior KBAISuggestion for this
        business, regardless of review_status. This prevents token waste on
        re-runs and avoids generating near-duplicate proposals from the same
        tickets.
        """
        seen_tickets: set = set()
        seen_tasks: set = set()
        for refs in KBAISuggestion.objects.filter(
            business=business,
        ).values_list('source_refs', flat=True):
            if not isinstance(refs, list):
                continue
            for ref in refs:
                if not isinstance(ref, dict):
                    continue
                ref_id = ref.get('id')
                if ref_id is None:
                    continue
                if ref.get('kind') == 'ticket':
                    seen_tickets.add(ref_id)
                elif ref.get('kind') == 'task':
                    seen_tasks.add(ref_id)
        return seen_tickets, seen_tasks

    def _mark_sources_seen(self, items: List[Dict[str, Any]]) -> None:
        """
        No-op kept for signature compatibility. The dedup stamp is now derived
        from KBAISuggestion.source_refs, not from per-item metadata.
        """
        return None

    # ------------------------------------------------------------- clustering
    def _cluster(self, sources: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Cheap bucket-by-label clustering. The LLM does the real grouping inside
        each prompt; this just keeps prompts topical.
        """
        clusters: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for s in sources:
            key = s.get('category') or s.get('department') or 'general'
            clusters[str(key).strip().lower()].append(s)
        return clusters

    # ---------------------------------------------------------- LLM proposal
    def _build_suggestion_for_cluster(
        self,
        business,
        cluster_key: str,
        items: List[Dict[str, Any]],
        allow_new: bool,
        allow_updates: bool,
        triggered_by,
    ) -> Optional[KBAISuggestion]:
        """
        Strategy:
          1. Search the KB for the strongest existing article match using the
             concatenated source titles as the query.
          2. If there's a high-confidence existing article (>= 0.6) and updates
             are allowed, ask Gemini to draft an *update*.
          3. Otherwise, if new articles are allowed, ask Gemini to draft a new
             one.
        """
        search = self._search_service()
        query_text = ' '.join(item['title'] for item in items if item.get('title'))[:500]

        existing_hits: List[Dict[str, Any]] = []
        if query_text:
            try:
                existing_hits = search.search(
                    business_id=business.id, query=query_text, top_k=3, min_score=0.4,
                ) or []
            except Exception as exc:
                logger.debug('KB learning: search failed for cluster %s: %s',
                             cluster_key, exc)
                existing_hits = []

        best_hit = existing_hits[0] if existing_hits else None
        do_update = bool(
            allow_updates and best_hit and (best_hit.get('score') or 0) >= 0.6
        )
        do_new = allow_new and not do_update

        if not (do_update or do_new):
            return None

        try:
            llm_output = self._call_gemini(
                business=business,
                items=items,
                cluster_key=cluster_key,
                update_target=best_hit if do_update else None,
            )
        except AIUsageLimitExceeded:
            raise
        except Exception as exc:
            logger.warning('KB learning: Gemini call failed for cluster %s: %s',
                           cluster_key, exc)
            return None

        payload = llm_output.get('parsed') or {}
        if not payload.get('title') and not payload.get('content'):
            return None

        source_refs = [
            {'kind': it['kind'], 'id': it['id'], 'title': it['title'][:160]}
            for it in items
        ]
        source_kind = 'mixed'
        kinds = {it['kind'] for it in items}
        if kinds == {'ticket'}:
            source_kind = 'ticket'
        elif kinds == {'task'}:
            source_kind = 'task'

        suggested_category = None
        if best_hit and best_hit.get('article_id'):
            try:
                suggested_category = KBArticle.objects.filter(
                    id=best_hit['article_id'], business=business,
                ).values_list('category_id', flat=True).first()
            except Exception:
                suggested_category = None

        with transaction.atomic():
            if do_update:
                target_article = KBArticle.objects.filter(
                    id=best_hit['article_id'], business=business,
                ).first()
                if not target_article:
                    return None

                suggestion = KBAISuggestion.objects.create(
                    business=business,
                    kind='update_article',
                    review_status='pending',
                    source_kind=source_kind,
                    target_article=target_article,
                    suggested_category_id=target_article.category_id,
                    proposed_title=payload.get('title', '').strip()[:500],
                    proposed_slug=(payload.get('slug') or slugify(payload.get('title', ''))[:519]),
                    proposed_content=payload.get('content', ''),
                    proposed_excerpt=payload.get('excerpt', '').strip()[:500],
                    proposed_tags=payload.get('tags') or [],
                    current_version=target_article.version,
                    proposed_version=(target_article.version or 1) + 1,
                    confidence=float(payload.get('confidence') or best_hit.get('score') or 0.7),
                    source_count=len(items),
                    source_refs=source_refs,
                    model_name=llm_output.get('model', ''),
                    input_tokens=llm_output.get('input_tokens', 0),
                    output_tokens=llm_output.get('output_tokens', 0),
                    prompt_version=PROMPT_VERSION,
                    metadata={
                        'cluster_key': cluster_key,
                        'existing_hits': [
                            {'id': h.get('article_id'), 'title': h.get('title'),
                             'score': h.get('score')}
                            for h in existing_hits[:3]
                        ],
                        'triggered_by': getattr(triggered_by, 'id', None),
                    },
                )
            else:
                # Try to attach to a category we found via search; otherwise
                # fall back to the business's default / first category.
                fallback_category = suggested_category
                if fallback_category is None:
                    fallback_category = (
                        KBCategory.objects.filter(business=business, status='A')
                        .order_by('sort_order', 'name')
                        .values_list('id', flat=True)
                        .first()
                    )

                suggestion = KBAISuggestion.objects.create(
                    business=business,
                    kind='new_article',
                    review_status='pending',
                    source_kind=source_kind,
                    target_article=None,
                    suggested_category_id=fallback_category,
                    proposed_title=payload.get('title', '').strip()[:500],
                    proposed_slug=(payload.get('slug') or slugify(payload.get('title', ''))[:519]),
                    proposed_content=payload.get('content', ''),
                    proposed_excerpt=payload.get('excerpt', '').strip()[:500],
                    proposed_tags=payload.get('tags') or [],
                    current_version=None,
                    proposed_version=1,
                    confidence=float(payload.get('confidence') or 0.6),
                    source_count=len(items),
                    source_refs=source_refs,
                    model_name=llm_output.get('model', ''),
                    input_tokens=llm_output.get('input_tokens', 0),
                    output_tokens=llm_output.get('output_tokens', 0),
                    prompt_version=PROMPT_VERSION,
                    metadata={
                        'cluster_key': cluster_key,
                        'triggered_by': getattr(triggered_by, 'id', None),
                    },
                )

        return suggestion

    # --------------------------------------------------------------- prompts
    def _call_gemini(
        self,
        business,
        items: List[Dict[str, Any]],
        cluster_key: str,
        update_target: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Build the prompt, call Gemini, parse the JSON body. Returns a dict with
        `parsed`, `model`, `input_tokens`, `output_tokens`.
        """
        client = self._gemini_client()

        system = (
            "You are a knowledge base editor. Given a set of support tickets or "
            "tasks from a company's helpdesk, produce a single high-quality "
            "knowledge-base article that helps future readers resolve the same "
            "issue without contacting support. "
            "Write in clear, direct prose with short paragraphs and, where "
            "appropriate, numbered steps. Never invent product names, SKUs, "
            "contact details, or policies not present in the sources. "
            "Respond ONLY with a single JSON object matching this schema:\n"
            "{\n"
            '  "title": string (<=120 chars),\n'
            '  "slug": string (lowercase, hyphenated, <=80 chars),\n'
            '  "excerpt": string (<=240 chars, summary suitable for search cards),\n'
            '  "content": string (article body in Markdown),\n'
            '  "tags": string[] (<=6 short tags),\n'
            '  "confidence": number between 0 and 1\n'
            "}"
        )

        mode_hint = (
            f"You are UPDATING the existing article titled \"{update_target['title']}\". "
            "Preserve what's still correct and merge in only what these new sources add "
            "or clarify. Do not remove accurate existing guidance. The 'content' field "
            "should be the full new article body, not a diff."
            if update_target else
            "Draft a BRAND-NEW article covering the recurring issue below. "
            "Assume the reader has not seen any previous article on this topic."
        )

        formatted_items = []
        for i, it in enumerate(items, start=1):
            formatted_items.append(
                f"--- Source {i} ({it['kind']} #{it['id']}) ---\n"
                f"Title: {it['title']}\n"
                f"Body: {it['body'][:1200]}"
            )
        sources_block = "\n\n".join(formatted_items)

        existing_block = ''
        if update_target:
            existing_block = (
                f"\n\nExisting article (current live version):\n"
                f"Title: {update_target.get('title', '')}\n"
                f"Content (truncated): {(_strip_html(update_target.get('content') or ''))[:2000]}"
            )

        user_prompt = (
            f"Cluster label: {cluster_key}\n"
            f"Mode: {mode_hint}\n"
            f"{existing_block}\n\n"
            f"Sources:\n{sources_block}\n\n"
            "Return the JSON object now. No prose outside the JSON."
        )

        assert_ai_usage_allowed(
            business,
            estimated_tokens=estimate_tokens_from_text(system) + estimate_tokens_from_text(user_prompt) + 1800,
        )
        result = client.generate_content(
            prompt=user_prompt,
            system_instruction=system,
            temperature=0.4,
            max_tokens=1800,
        )
        record_ai_usage(
            business=business,
            feature='kb_learning',
            operation='generate_content',
            model_name=result.get('model', ''),
            input_tokens=result.get('input_tokens', 0),
            output_tokens=result.get('output_tokens', 0),
            metadata={'prompt_version': PROMPT_VERSION, 'cluster_key': cluster_key},
        )

        parsed = self._parse_json_blob(result.get('content', ''))
        return {
            'parsed': parsed,
            'model': result.get('model', ''),
            'input_tokens': result.get('input_tokens', 0),
            'output_tokens': result.get('output_tokens', 0),
        }

    def _parse_json_blob(self, text: str) -> Dict[str, Any]:
        """Extract the first JSON object from the model's response."""
        if not text:
            return {}
        # Strip common code-fence wrappers the model sometimes adds.
        fenced = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
        candidate = fenced.group(1) if fenced else None
        if not candidate:
            # Fallback: grab the outermost {...} by bracket matching.
            start = text.find('{')
            end = text.rfind('}')
            if start == -1 or end == -1 or end <= start:
                return {}
            candidate = text[start:end + 1]
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError as exc:
            logger.debug('KB learning: JSON parse failed: %s', exc)
            return {}

        if not isinstance(data, dict):
            return {}
        # Coerce expected fields into safe shapes.
        data['title'] = str(data.get('title') or '')[:500]
        data['slug'] = slugify(str(data.get('slug') or data.get('title') or ''))[:519]
        data['excerpt'] = str(data.get('excerpt') or '')[:500]
        data['content'] = str(data.get('content') or '')
        tags = data.get('tags') or []
        if isinstance(tags, list):
            data['tags'] = [str(t)[:40] for t in tags if t][:6]
        else:
            data['tags'] = []
        try:
            data['confidence'] = max(0.0, min(1.0, float(data.get('confidence') or 0.5)))
        except (TypeError, ValueError):
            data['confidence'] = 0.5
        return data
