import json
import uuid
import logging
from typing import Any, Dict, List, Optional

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

from tenant.models.ChatbotModel import ChatConversation, ChatMessage, ChatbotConfig
from tenant.services.ai.context_builder import ContextBuilder
from tenant.services.ai.gemini_client import GeminiClient
from tenant.services.ai.conversation_state import ConversationStateManager
from tenant.services.ai.tools import (
    get_tool_schemas,
    get_tool_dispatcher,
    get_agentic_limits,
)
from tenant.services.ai.support_guard import SUPPORT_REDIRECT_MESSAGE, classify_support_relevance
from tenant.services.ai.kb_search import KBSearchService
from tenant.services.ai.ticket_extractor import TicketExtractor
from tenant.services.tickets.creation import create_ticket_from_payload
from asgiref.sync import async_to_sync, sync_to_async


logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    state_manager = ConversationStateManager()

    async def connect(self):
        self.business_id = self.scope['url_route']['kwargs'].get('business_id')
        self.mode = self.scope['url_route']['kwargs'].get('mode', 'customer')
        self.session_group_name = None

        # In staff mode, require authenticated user (JWT middleware should set scope['user'])
        if self.mode == 'staff':
            user = self.scope.get('user')
            if not user or isinstance(user, AnonymousUser) or not user.is_authenticated:
                await self.close(code=4401)
                return
            self.session_group_name = f'user_session_{user.id}'
            await self.channel_layer.group_add(self.session_group_name, self.channel_name)

        # Reject connection if chatbot is disabled
        config = await self._get_config()
        if config and not config.is_enabled:
            await self.close(code=4403)
            return

        # Create a conversation on connect
        self.conversation = await self._get_or_create_conversation()
        await self.accept()

        # Optional greeting from config
        if config and config.greeting_message:
            await self.send_json({
                'type': 'message',
                'role': 'assistant',
                'content': config.greeting_message,
            })

    async def disconnect(self, close_code):
        if self.session_group_name:
            await self.channel_layer.group_discard(self.session_group_name, self.channel_name)

    async def receive(self, text_data: str | None = None, bytes_data: bytes | None = None):
        try:
            payload = json.loads(text_data) if text_data else {}
        except Exception:
            payload = {'type': 'message', 'content': text_data or ''}

        if not isinstance(payload, dict):
            payload = {'type': 'message', 'content': str(payload)}

        msg_type = payload.get('type', 'message')

        if msg_type == 'message':
            content = str(payload.get('content', '')).strip()
            if not content:
                return

            logger.info(f"[AI] Incoming message business={self.business_id} conversation={getattr(self, 'conversation', None)} content={content}")

            # Persist user message
            await self._store_message(role='user', content=content)
            await self._append_history('user', content)

            # Typing indicator on
            await self.send_json({'type': 'typing', 'status': True})

            state = await self._get_conversation_state()
            support_relevance = await sync_to_async(classify_support_relevance, thread_sensitive=True)(content, state=state)
            if not support_relevance.support_related:
                logger.info(
                    "AI support guard redirected message business=%s conversation=%s confidence=%s reason=%s",
                    self.business_id,
                    self.conversation.conversation_id,
                    support_relevance.confidence,
                    support_relevance.reason,
                )
                await self._store_message(role='assistant', content=SUPPORT_REDIRECT_MESSAGE)
                await self._append_history('assistant', SUPPORT_REDIRECT_MESSAGE)
                await self.send_json({'type': 'message', 'role': 'assistant', 'content': SUPPORT_REDIRECT_MESSAGE})
                await self.send_json({'type': 'typing', 'status': False})
                return

            history: List[Dict[str, str]] = state.get('history', [])
            kb_context = self._get_kb_context(state)

            config = await self._get_config()
            business_name = await self._get_business_name()
            builder = ContextBuilder()
            system_prompt = builder.build_system_prompt(config, business_name=business_name)
            messages = builder.build_messages(
                history=history,
                user_message=content,
                kb_results=kb_context,
                include_few_shots=False,
            )

            # Run KB search upfront to inject context (in addition to tool calls)
            try:
                kb_service = KBSearchService()
                kb_results = await sync_to_async(kb_service.search, thread_sensitive=True)(
                    int(self.business_id), content, top_k=3
                )
                if kb_results:
                    logger.info(f"[AI] Pre-agentic KB search returned {len(kb_results)} results business={self.business_id} conversation={self.conversation.conversation_id}")
                    # Prepend KB snippets to messages
                    kb_snippets = self._format_kb_snippets(kb_results)
                    messages.insert(0, {"role": "assistant", "content": kb_snippets})
                    logger.debug(
                        "[AI] Injected KB snippets into prompt business=%s conversation=%s snippet_preview=%s",
                        self.business_id,
                        self.conversation.conversation_id,
                        kb_snippets[:200],
                    )
                else:
                    logger.info(f"[AI] Pre-agentic KB search returned 0 results business={self.business_id} conversation={self.conversation.conversation_id}")
            except Exception as e:
                logger.warning(f"Pre-agentic KB search failed: {e}")

            tools = get_tool_schemas()
            dispatcher = self._build_tool_dispatcher()
            limits = get_agentic_limits()

            reply = "I had trouble processing that request."
            tool_calls: List[Dict[str, Any]] = []
            try:
                client = GeminiClient()
                result = await sync_to_async(client.generate_agentic_response, thread_sensitive=True)(
                    messages=messages,
                    tools=tools,
                    tool_dispatcher=dispatcher,
                    system_instruction=system_prompt,
                    temperature=config.temperature if config else 0.7,
                    max_tokens=config.max_tokens if config and config.max_tokens else None,
                    max_iterations=limits.get("max_tool_calls_per_turn", 4),
                )
                reply = result.get('content') or reply
                tool_calls = result.get('tool_calls', []) or []
            except Exception as e:
                logger.exception(f"Agentic flow failed for business={self.business_id}, conversation={self.conversation.conversation_id}: {e}")


            # Sanitize simple markdown artifacts that the UI does not render well
            reply_clean = (reply or "").replace("**", "")

            # Store the clean reply WITHOUT signature (to avoid duplication in history)
            await self._store_message(role='assistant', content=reply_clean)
            await self._append_history('assistant', reply_clean)

            # Add signature only for display to user (not stored in DB/history)
            reply_to_send = reply_clean
            if config and config.agent_signature:
                reply_to_send = f"{reply_clean} {config.agent_signature}"

            # Send reply FIRST so it always appears before any follow-up form
            await self.send_json({'type': 'message', 'role': 'assistant', 'content': reply_to_send})

            # Process tool side-effects (ticket linking, contact form) AFTER reply is visible
            await self._process_tool_traces(tool_calls)

            # If the user signaled escalation and no tool calls happened, trigger the contact form
            if not tool_calls:
                await self._maybe_trigger_contact_form(user_message=content, assistant_reply=reply_clean)

            # Typing indicator off
            await self.send_json({'type': 'typing', 'status': False})

        else:
            # Unknown message types: ignore gracefully
            pass

    async def session_revoked(self, event):
        await self.send_json({
            'type': 'session_revoked',
            'reason': event.get('reason', 'session_revoked'),
        })
        await self.close(code=event.get('close_code', 4005))

    async def send_json(self, data: Dict[str, Any]):
        await self.send(text_data=json.dumps(data))

    # --- DB helpers (sync wrapped) ---
    @database_sync_to_async
    def _get_or_create_conversation(self) -> ChatConversation:
        user = self.scope.get('user') if self.mode == 'staff' else None
        conv_id = str(uuid.uuid4())
        conversation = ChatConversation.objects.create(
            business_id=self.business_id,
            conversation_id=conv_id,
            mode=self.mode,
            status='active',
            user=(user if user and user.is_authenticated else None),
        )
        return conversation

    @database_sync_to_async
    def _get_config(self) -> ChatbotConfig | None:
        try:
            return ChatbotConfig.objects.filter(business_id=self.business_id).first()
        except Exception:
            return None

    @database_sync_to_async
    def _get_business_name(self) -> str:
        """Fetch business name for tenant-aware AI prompts."""
        try:
            from users.models.BusinessModel import Business
            business = Business.objects.filter(id=self.business_id).first()
            return business.name if business else "your organization"
        except Exception:
            return "your organization"

    @database_sync_to_async
    def _store_message(self, role: str, content: str, intent: str | None = None, confidence: float | None = None) -> ChatMessage:
        msg = ChatMessage.objects.create(
            business_id=self.business_id,
            conversation=self.conversation,
            role=role,
            content=content,
            intent=intent,
            confidence_score=confidence,
        )
        self.conversation.update_last_message()
        return msg

    async def _respond(self, content: str, analysis: Optional[Dict[str, Any]] = None):
        intent = analysis.get('intent') if analysis else None
        confidence = analysis.get('confidence') if analysis else None
        await self._store_message(role='assistant', content=content, intent=intent, confidence=confidence)
        await self._append_history('assistant', content)
        await self.send_json({'type': 'message', 'role': 'assistant', 'content': content})

    async def _handle_ticket_flow(self, user_message: str) -> str | None:
        extractor = TicketExtractor()
        try:
            data = extractor.extract(int(self.business_id), user_message)
        except Exception as exc:
            logger.warning(f"Ticket extraction failed: {exc}")
            return "I ran into an issue extracting ticket info. Please provide the ticket title, description, category, department, and priority."

        await self._set_state_extracted(data)

        required = {
            'title': 'title',
            'description': 'description',
            'priority': 'priority',
            'category_id': 'category',
            'department_id': 'department',
        }
        missing = [label for key, label in required.items() if not data.get(key)]
        if missing:
            formatted = ", ".join(missing)
            return f"I need a bit more info before creating the ticket. Please provide: {formatted}."

        try:
            ticket_result = await self._create_ticket(data)
        except Exception as exc:
            logger.error(f"Ticket creation failed: {exc}")
            return "I couldn't create the ticket due to a server error. Please try again or contact support."

        await self._link_ticket(ticket_result["active_ticket_id"])
        await self._clear_state()
        if ticket_result["is_merged"]:
            return f"I found an existing matching ticket and merged this request into #{ticket_result['active_ticket_ref']}."
        return f"Ticket #{ticket_result['created_ticket_ref']} has been created and linked to this conversation."

    @database_sync_to_async
    def _create_ticket(self, data: Dict[str, Any]):
        ticket = create_ticket_from_payload(
            business_id=int(self.business_id),
            data=data,
            source='chatbot',
        )
        active_ticket = ticket.merged_into if ticket.is_merged and ticket.merged_into else ticket
        return {
            "created_ticket_id": ticket.id,
            "created_ticket_ref": ticket.ticket_id,
            "active_ticket_id": active_ticket.id,
            "active_ticket_ref": active_ticket.ticket_id,
            "is_merged": ticket.is_merged,
            "duplicate_detection": getattr(ticket, "_duplicate_detection", None),
        }

    @database_sync_to_async
    def _link_ticket(self, ticket_id: int):
        self.conversation.ticket_id = ticket_id
        self.conversation.status = 'completed'
        self.conversation.save(update_fields=['ticket', 'status'])

    async def _append_history(self, role: str, content: str):
        await database_sync_to_async(self.state_manager.append_message)(
            self.business_id,
            self.conversation.conversation_id,
            role,
            content,
        )

    async def _get_conversation_state(self) -> Dict[str, Any]:
        return await database_sync_to_async(self.state_manager.get_state)(
            self.business_id,
            self.conversation.conversation_id,
        )

    async def _set_state_intent(self, analysis: Dict[str, Any]):
        if not analysis:
            return
        await database_sync_to_async(self.state_manager.set_intent)(
            self.business_id,
            self.conversation.conversation_id,
            analysis.get('intent'),
            analysis.get('confidence', 0.0),
        )

    async def _set_state_extracted(self, data: Dict[str, Any]):
        await database_sync_to_async(self.state_manager.set_extracted)(
            self.business_id,
            self.conversation.conversation_id,
            data,
        )

    async def _clear_state(self):
        await database_sync_to_async(self.state_manager.clear)(
            self.business_id,
            self.conversation.conversation_id,
        )

    @database_sync_to_async
    def _update_conversation_intent(self, intent: str | None):
        if not intent:
            return
        self.conversation.intent = intent
        self.conversation.save(update_fields=['intent'])

    def _build_tool_dispatcher(self):
        base = get_tool_dispatcher()
        b_id = int(self.business_id)

        def kb_wrapper(query: str, top_k: Optional[int] = None):
            return base["kb_search"](business_id=b_id, query=query, top_k=top_k)

        def ticket_options_wrapper():
            return base["ticket_options"](business_id=b_id)

        def create_ticket_wrapper(
            contact: Dict[str, Any],
            context_text: str,
            title: Optional[str] = None,
            description: Optional[str] = None,
            category_id: Optional[int] = None,
            department_id: Optional[int] = None,
            label_ids: Optional[List[int]] = None,
            assignee_id: Optional[int] = None,
            priority: Optional[str] = None,
        ):
            # Guard: don't create a duplicate ticket for the same conversation
            from tenant.models.ChatbotModel import ChatConversation as _CC
            latest = _CC.objects.filter(id=self.conversation.id).values("ticket_id").first()
            if latest and latest.get("ticket_id"):
                existing_ticket = latest["ticket_id"]
                logger.info(f"Skipping duplicate ticket creation for conversation {self.conversation.conversation_id}, ticket {existing_ticket} already exists")
                return {"status": "already_exists", "message": "A ticket has already been created for this conversation.", "ticket_id": existing_ticket}

            # If no context_text provided, fall back to recent conversation history summary
            fallback_context = ""
            try:
                state = self.state_manager.get_state(self.business_id, self.conversation.conversation_id)
                history = state.get("history", [])
                user_lines = [m.get("content", "") for m in history if m.get("role") == "user"]
                if user_lines:
                    fallback_context = " ".join(user_lines[-5:])[:500]
            except Exception:
                fallback_context = context_text
            context_final = context_text or fallback_context
            return base["create_ticket"](
                business_id=b_id,
                contact=contact,
                context_text=context_final,
                title=title,
                description=description,
                category_id=category_id,
                department_id=department_id,
                label_ids=label_ids,
                assignee_id=assignee_id,
                priority=priority,
            )

        dispatch = {
            "kb_search": kb_wrapper,
            "validate_contact_fields": base["validate_contact_fields"],
            "ticket_options": ticket_options_wrapper,
            "create_ticket": create_ticket_wrapper,
            "resolution_status": base["resolution_status"],
        }
        return dispatch

    def _get_kb_context(self, state: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract the latest KB search results from tool call traces."""
        tool_calls = state.get("tool_calls", [])
        for call in reversed(tool_calls):
            if call.get("tool") == "kb_search":
                res = call.get("result") or {}
                results = res.get("results") or []
                # Apply a simple score threshold if present
                filtered = [r for r in results if r.get("score", 1) >= 0.25]
                return filtered or results
        return []

    def _format_kb_snippets(self, results: List[Dict[str, Any]]) -> str:
        lines = ["Relevant knowledge base snippets:"]
        for r in results[:5]:
            title = r.get("title")
            content_raw = r.get("content") or ""
            snippet = self._clean_text(content_raw)[:300]
            if logger.isEnabledFor(logging.DEBUG) and not content_raw:
                logger.debug(
                    "[AI] KB snippet missing content business=%s conversation=%s article_id=%s title=%s score=%s",
                    self.business_id,
                    getattr(self.conversation, "conversation_id", None),
                    r.get("article_id"),
                    title,
                    r.get("score"),
                )
            score = r.get("score")
            if score is not None:
                lines.append(f"- {title} (score {score:.2f}): {snippet}")
            else:
                lines.append(f"- {title}: {snippet}")
        return "\n".join(lines)

    def _clean_text(self, text: str) -> str:
        """Very lightweight HTML tag stripper and whitespace normalizer."""
        import re
        without_tags = re.sub(r"<[^>]+>", " ", text)
        return " ".join(without_tags.split())

    async def _send_contact_form(self, invalid: Optional[Dict[str, str]] = None):
        # Skip if already complete
        state = await self._get_conversation_state()
        contact = state.get("contact", {})
        if all(contact.get(f) for f in ("name", "email", "phone")):
            return
        # Skip duplicate form requests
        if await database_sync_to_async(self.state_manager.contact_requested)(self.business_id, self.conversation.conversation_id):
            return
        await self.send_json({
            "type": "contact_request",
            "fields": ["name", "email", "phone"],
            "invalid": invalid or {},
        })
        await database_sync_to_async(self.state_manager.set_contact_requested)(self.business_id, self.conversation.conversation_id, True)

    async def _process_tool_traces(self, traces: List[Dict[str, Any]]):
        """
        Persist tool calls/results and handle ticket linking or contact updates.
        """
        if not traces:
            return

        for trace in traces:
            tool = trace.get("tool")
            args = trace.get("args") or {}
            result = trace.get("result") or {}
            error = trace.get("error")

            await database_sync_to_async(self.state_manager.append_tool_call)(
                self.business_id,
                self.conversation.conversation_id,
                {
                    "tool": tool,
                    "args": args,
                    "result": result,
                    "error": error,
                },
            )

            if tool == "validate_contact_fields":
                normalized = result.get("normalized") or {}
                missing = result.get("missing") or []
                invalid = result.get("invalid") or {}
                await database_sync_to_async(self.state_manager.set_contact_fields)(
                    self.business_id,
                    self.conversation.conversation_id,
                    normalized,
                )
                await database_sync_to_async(self.state_manager.set_validation_status)(
                    self.business_id,
                    self.conversation.conversation_id,
                    missing,
                    invalid,
                )
                # Reset contact_requested if now complete
                if not missing and not invalid and all(normalized.get(f) for f in ("name", "email", "phone")):
                    await database_sync_to_async(self.state_manager.set_contact_requested)(self.business_id, self.conversation.conversation_id, False)
                if error or missing or invalid:
                    logger.warning(
                        f"Contact validation result tool={tool} missing={missing} invalid={invalid} error={error} "
                        f"business={self.business_id} conversation={self.conversation.conversation_id}"
                    )
                # Prompt frontend to collect missing/invalid fields via inline input
                if missing or invalid:
                    await self._send_contact_form(invalid=invalid)

            if tool == "create_ticket" and not error:
                ticket_id = result.get("ticket_id")
                if ticket_id:
                    await self._link_ticket(ticket_id)
                    await database_sync_to_async(self.state_manager.set_contact_requested)(self.business_id, self.conversation.conversation_id, False)
                    logger.info(
                        f"Ticket created via agentic tool ticket_id={ticket_id} "
                        f"business={self.business_id} conversation={self.conversation.conversation_id}"
                    )
            elif tool == "create_ticket" and error:
                logger.warning(
                    f"Create_ticket tool error business={self.business_id} conversation={self.conversation.conversation_id} "
                    f"args={args} error={error}"
                )

            # If the model is entering ticket flow (validate or create) and contact info is incomplete, trigger the form.
            if tool in ("validate_contact_fields", "create_ticket"):
                state = await self._get_conversation_state()
                contact = state.get("contact", {})
                missing_contact = [f for f in ("name", "email", "phone") if not contact.get(f)]
                validation = state.get("validation", {})
                invalid = validation.get("invalid") if isinstance(validation, dict) else {}
                # Also handle explicit missing contact error from the tool call
                if (missing_contact or invalid) or (error and "Missing contact field" in str(error)):
                    await self._send_contact_form(invalid=invalid if isinstance(invalid, dict) else {})

            if tool == "resolution_status":
                resolved = result.get("resolved")
                if resolved is True:
                    await self._respond(
                        "Glad that worked! Let me know if you need anything else.",
                        analysis=None,
                    )
                else:
                    await self._send_contact_form()

    async def _maybe_trigger_contact_form(self, user_message: str, assistant_reply: str | None = None):
        """
        Trigger the contact form only when the user signals escalation/failure.
        """
        text = (user_message or "").lower()
        assistant_text = (assistant_reply or "").lower()
        triggers = (
            "still not working",
            "didn't work",
            "doesn't work",
            "need support",
            "contact support",
            "create a ticket",
            "open a ticket",
            "escalate",
            "ticket",
        )
        assistant_triggers = (
            "full name",
            "email address",
            "phone number",
            "contact information",
            "support ticket",
            "create a ticket",
            "open a ticket",
        )
        if not any(t in text for t in triggers) and not any(t in assistant_text for t in assistant_triggers):
            return
        state = await self._get_conversation_state()
        contact = state.get("contact", {})
        missing_contact = [f for f in ("name", "email", "phone") if not contact.get(f)]
        if missing_contact:
            await self._send_contact_form()
