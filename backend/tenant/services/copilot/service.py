from __future__ import annotations

import hashlib
import logging
from datetime import timedelta
from typing import Any

from django.core.cache import cache
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from tenant.models import (
    CopilotAuditLog,
    CopilotSuggestion,
    Ticket,
)
from tenant.services.audit import actor_name, log_audit_event

from .executor import CopilotToolExecutor
from .gateway import CopilotGatewayError
from .notifier import CopilotNotifier
from .router import CopilotCommandRouter
from .schemas import OutputValidator


logger = logging.getLogger(__name__)


class CopilotService:
    RATE_LIMIT_PER_MINUTE = 24
    IDEMPOTENCY_WINDOW_SECONDS = 90
    LOW_CONFIDENCE_LABELS = {"low"}
    ASYNC_COMMANDS = {"summarize", "draft-reply", "draft-note", "draft-call-log", "triage"}

    def __init__(self) -> None:
        self.router = CopilotCommandRouter()
        self.validator = OutputValidator()
        self.tool_executor = CopilotToolExecutor()
        self.notifier = CopilotNotifier()

    def invoke(
        self,
        *,
        user,
        ticket_id: int,
        command: str | None,
        query: str,
        surface: str = "rail",
        extra_input: str = "",
    ) -> CopilotSuggestion:
        ticket = get_object_or_404(Ticket, id=ticket_id, business=user.business)
        self._enforce_rate_limit(user)

        resolved_command = self.router.resolve_command(command, query)
        idempotency_key = self._build_idempotency_key(
            business_id=user.business_id,
            user_id=user.id,
            ticket_id=ticket.id,
            command=resolved_command,
            query=query,
            extra_input=extra_input,
        )
        existing = self._get_existing_suggestion(user, ticket, idempotency_key)
        if existing:
            return existing

        if resolved_command in self.ASYNC_COMMANDS:
            suggestion = self._create_queued_suggestion(
                user=user,
                ticket=ticket,
                resolved_command=resolved_command,
                query=query,
                surface=surface,
                extra_input=extra_input,
                idempotency_key=idempotency_key,
            )
            self._audit(
                suggestion=suggestion,
                user=user,
                event_type="invoke",
                payload={"query": query, "surface": surface, "command": resolved_command, "mode": "async"},
            )
            self._enqueue_suggestion_processing(suggestion.id)
            return suggestion

        return self._invoke_sync(
            user=user,
            ticket=ticket,
            resolved_command=resolved_command,
            query=query,
            surface=surface,
            extra_input=extra_input,
            idempotency_key=idempotency_key,
        )

    def _invoke_sync(
        self,
        *,
        user,
        ticket: Ticket,
        resolved_command: str,
        query: str,
        surface: str,
        extra_input: str,
        idempotency_key: str,
    ) -> CopilotSuggestion:
        try:
            _, result = self.router.invoke(
                ticket=ticket,
                command=resolved_command,
                query=query,
                extra_input=extra_input,
            )
            payload = self._validate_payload(command=resolved_command, payload=result.payload)
            suggestion = CopilotSuggestion.objects.create(
                business=user.business,
                ticket=ticket,
                requested_by=user,
                command=resolved_command,
                request_text=query,
                suggestion_type=result.suggestion_type,
                payload=payload,
                metadata=self._build_runtime_metadata(
                    resolved_command=resolved_command,
                    surface=surface,
                    extra_input=extra_input,
                    mode="sync",
                    handler_metadata=result.metadata,
                ),
                confidence_score=result.confidence_score,
                idempotency_key=idempotency_key,
                surface=surface,
                expires_at=timezone.now() + timedelta(hours=8),
            )
            self._audit(
                suggestion=suggestion,
                user=user,
                event_type="invoke",
                payload={"query": query, "surface": surface, "command": resolved_command, "mode": "sync"},
            )
            self.notifier.broadcast_suggestion(suggestion, event="copilot_suggestion_ready")
            return suggestion
        except CopilotGatewayError as exc:
            logger.exception("copilot_invoke_failed")
            return self._create_failed_suggestion(
                user=user,
                ticket=ticket,
                resolved_command=resolved_command,
                query=query,
                surface=surface,
                idempotency_key=idempotency_key,
                error=exc,
            )
        except Exception as exc:
            logger.exception("copilot_invoke_unexpected_failure")
            return self._create_failed_suggestion(
                user=user,
                ticket=ticket,
                resolved_command=resolved_command,
                query=query,
                surface=surface,
                idempotency_key=idempotency_key,
                error=CopilotGatewayError(
                    "provider_error",
                    str(exc),
                    user_message="Copilot could not complete that request.",
                ),
            )

    @transaction.atomic
    def process_queued_suggestion(self, *, suggestion_id: int) -> CopilotSuggestion | None:
        suggestion = (
            CopilotSuggestion.objects.select_for_update(of=("self",))
            .select_related("ticket", "requested_by", "requested_by__business")
            .filter(id=suggestion_id)
            .first()
        )
        if not suggestion or suggestion.status != "queued" or not suggestion.ticket_id:
            return suggestion

        try:
            _, result = self.router.invoke(
                ticket=suggestion.ticket,
                command=suggestion.command,
                query=suggestion.request_text,
                extra_input=str((suggestion.metadata or {}).get("extra_input") or ""),
            )
            payload = self._validate_payload(command=suggestion.command, payload=result.payload)
            suggestion.payload = payload
            suggestion.metadata = self._mark_runtime_processed(
                metadata=suggestion.metadata or {},
                handler_metadata=result.metadata,
            )
            suggestion.suggestion_type = result.suggestion_type
            suggestion.status = "pending_review"
            suggestion.confidence_score = result.confidence_score
            suggestion.expires_at = timezone.now() + timedelta(hours=8)
            suggestion.save(
                update_fields=[
                    "payload",
                    "metadata",
                    "suggestion_type",
                    "status",
                    "confidence_score",
                    "expires_at",
                    "updated_at",
                    "updated_by",
                ]
            )
            self.notifier.broadcast_suggestion(suggestion, event="copilot_suggestion_ready")
            return suggestion
        except CopilotGatewayError as exc:
            logger.exception("copilot_async_invoke_failed")
            self._mark_suggestion_failed(
                suggestion=suggestion,
                error=exc,
                query=suggestion.request_text,
            )
            return suggestion
        except Exception as exc:
            logger.exception("copilot_async_invoke_unexpected_failure")
            self._mark_suggestion_failed(
                suggestion=suggestion,
                error=CopilotGatewayError(
                    "provider_error",
                    str(exc),
                    user_message="Copilot could not complete that request.",
                ),
                query=suggestion.request_text,
            )
            return suggestion

    def _create_queued_suggestion(
        self,
        *,
        user,
        ticket: Ticket,
        resolved_command: str,
        query: str,
        surface: str,
        extra_input: str,
        idempotency_key: str,
    ) -> CopilotSuggestion:
        return CopilotSuggestion.objects.create(
            business=user.business,
            ticket=ticket,
            requested_by=user,
            command=resolved_command,
            request_text=query,
            suggestion_type=self._default_suggestion_type(resolved_command),
            status="queued",
            payload={"message": "Copilot is preparing a response."},
            metadata=self._build_runtime_metadata(
                resolved_command=resolved_command,
                surface=surface,
                extra_input=extra_input,
                mode="async",
            ),
            confidence_score=None,
            idempotency_key=idempotency_key,
            surface=surface,
            expires_at=timezone.now() + timedelta(hours=8),
        )

    def _create_failed_suggestion(
        self,
        *,
        user,
        ticket: Ticket,
        resolved_command: str,
        query: str,
        surface: str,
        idempotency_key: str,
        error: CopilotGatewayError,
    ) -> CopilotSuggestion:
        suggestion = CopilotSuggestion.objects.create(
            business=user.business,
            ticket=ticket,
            requested_by=user,
            command=resolved_command,
            request_text=query,
            suggestion_type=self._default_suggestion_type(resolved_command),
            payload=self._build_failure_payload(command=resolved_command, error=error),
            metadata=self._mark_failure_metadata(
                metadata=self._build_runtime_metadata(
                    resolved_command=resolved_command,
                    surface=surface,
                    extra_input="",
                    mode="sync" if resolved_command not in self.ASYNC_COMMANDS else "async",
                ),
                error=error,
            ),
            status="failed",
            confidence_score=0.0,
            idempotency_key=idempotency_key,
            surface=surface,
            expires_at=timezone.now() + timedelta(hours=1),
        )
        self._audit(
            suggestion=suggestion,
            user=user,
            event_type="error",
            payload={
                "query": query,
                "surface": surface,
                "command": resolved_command,
                "error": str(error),
                "error_type": error.error_type,
            },
        )
        self.notifier.broadcast_suggestion(suggestion, event="copilot_suggestion_failed")
        return suggestion

    def _validate_payload(self, *, command: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            return self.validator.validate(command, payload)
        except Exception as exc:
            raise CopilotGatewayError(
                "invalid_json",
                f"Payload validation failed: {exc}",
                user_message="Copilot returned an incomplete structured response. Please try again.",
            ) from exc

    def _build_failure_payload(self, *, command: str, error: CopilotGatewayError) -> dict[str, Any]:
        generic_copy = {
            "summarize": {
                "title": "Summary unavailable",
                "message": "Copilot could not summarize this ticket right now. Try again.",
            },
            "draft-reply": {
                "title": "Reply draft unavailable",
                "message": "Copilot could not draft a reply right now. Try again.",
            },
            "draft-note": {
                "title": "Note draft unavailable",
                "message": "Copilot could not draft a note right now. Try again.",
            },
            "draft-call-log": {
                "title": "Call log draft unavailable",
                "message": "Copilot could not draft a call log right now. Try again.",
            },
            "similar": {
                "title": "Similar tickets unavailable",
                "message": "Copilot could not find similar tickets right now. Try again.",
            },
            "suggest-kb": {
                "title": "Knowledge suggestions unavailable",
                "message": "Copilot could not find knowledge suggestions right now. Try again.",
            },
            "triage": {
                "title": "Triage recommendation unavailable",
                "message": "Copilot could not prepare a triage recommendation right now. Try again.",
            },
        }
        retryable = error.error_type not in {"blocked_response"}
        if error.error_type == "blocked_response":
            title = "Request needs a safer prompt"
            message = "Copilot could not safely complete that request. Try narrowing or rephrasing it."
        else:
            copy = generic_copy.get(
                command,
                {"title": "Request unavailable", "message": "Copilot could not complete that request right now. Try again."},
            )
            title = copy["title"]
            message = copy["message"]
        return {
            "title": title,
            "message": message,
            "retryable": retryable,
            "error_type": error.error_type,
        }

    @staticmethod
    def _default_suggestion_type(command: str) -> str:
        if command in {"draft-reply", "draft-note", "draft-call-log"}:
            return "draft"
        if command == "triage":
            return "suggested_action"
        return "informational"

    def _mark_suggestion_failed(
        self,
        *,
        suggestion: CopilotSuggestion,
        error: CopilotGatewayError,
        query: str,
    ) -> None:
        suggestion.payload = self._build_failure_payload(command=suggestion.command, error=error)
        suggestion.metadata = self._mark_failure_metadata(metadata=suggestion.metadata or {}, error=error)
        suggestion.status = "failed"
        suggestion.confidence_score = 0.0
        suggestion.save(update_fields=["payload", "metadata", "status", "confidence_score", "updated_at", "updated_by"])
        self._audit(
            suggestion=suggestion,
            user=suggestion.requested_by,
            event_type="error",
            payload={
                "query": query,
                "surface": suggestion.surface,
                "command": suggestion.command,
                "error": str(error),
                "error_type": error.error_type,
            },
        )
        self.notifier.broadcast_suggestion(suggestion, event="copilot_suggestion_failed")

    @staticmethod
    def _enqueue_suggestion_processing(suggestion_id: int) -> None:
        from tenant.tasks import process_copilot_suggestion

        transaction.on_commit(lambda: process_copilot_suggestion.delay(suggestion_id))

    @transaction.atomic
    def confirm(self, *, user, suggestion_id: int, edited_payload: dict[str, Any] | None = None) -> CopilotSuggestion:
        suggestion = get_object_or_404(
            CopilotSuggestion.objects.select_for_update(of=("self",)).select_related("ticket"),
            id=suggestion_id,
            business=user.business,
        )
        if suggestion.status != "pending_review":
            return suggestion

        payload = edited_payload or suggestion.payload
        payload = self.validator.validate(suggestion.command, payload)
        self._enforce_confirmation_guardrails(suggestion=suggestion, payload=payload)
        suggestion.payload = payload

        applied_changes = {}
        if suggestion.suggestion_type == "suggested_action" and suggestion.ticket_id:
            try:
                with transaction.atomic():
                    applied_changes = self._apply_ticket_updates(user=user, suggestion=suggestion)
            except ValueError as exc:
                suggestion.metadata = self._mark_execution_failure(
                    metadata=suggestion.metadata or {},
                    error_message=str(exc),
                    error_type="validation_error",
                )
                suggestion.save(update_fields=["payload", "metadata", "updated_at", "updated_by"])
                self._audit(
                    suggestion=suggestion,
                    user=user,
                    event_type="error",
                    payload={"command": suggestion.command, "error": str(exc), "error_type": "validation_error"},
                )
                raise
            except Exception as exc:
                logger.exception("copilot_execution_failed")
                suggestion.metadata = self._mark_execution_failure(
                    metadata=suggestion.metadata or {},
                    error_message=str(exc),
                    error_type="execution_error",
                )
                suggestion.save(update_fields=["payload", "metadata", "updated_at", "updated_by"])
                self._audit(
                    suggestion=suggestion,
                    user=user,
                    event_type="error",
                    payload={"command": suggestion.command, "error": str(exc), "error_type": "execution_error"},
                )
                raise ValueError("Copilot could not apply that suggestion right now. Try again.")

            suggestion.confirmed_by = user
            suggestion.confirmed_at = timezone.now()
            suggestion.status = "executed"
            suggestion.metadata = self._mark_execution_succeeded(
                metadata=suggestion.metadata or {},
                applied_changes=applied_changes,
                user_id=user.id,
            )
        else:
            suggestion.confirmed_by = user
            suggestion.confirmed_at = timezone.now()
            suggestion.status = "approved"
            suggestion.metadata = self._mark_execution_approved(metadata=suggestion.metadata or {}, user_id=user.id)

        suggestion.save(update_fields=["payload", "metadata", "status", "confirmed_by", "confirmed_at", "updated_at", "updated_by"])

        self._audit(
            suggestion=suggestion,
            user=user,
            event_type="confirm",
            payload={"edited": bool(edited_payload), "applied_changes": applied_changes},
        )
        self.notifier.broadcast_suggestion(
            suggestion,
            event="copilot_suggestion_executed" if suggestion.status == "executed" else "copilot_suggestion_approved",
            payload={"applied_changes": applied_changes},
        )
        return suggestion

    @transaction.atomic
    def reject(self, *, user, suggestion_id: int) -> CopilotSuggestion:
        suggestion = get_object_or_404(
            CopilotSuggestion.objects.select_for_update(),
            id=suggestion_id,
            business=user.business,
        )
        if suggestion.status != "pending_review":
            return suggestion

        suggestion.status = "rejected"
        suggestion.rejected_at = timezone.now()
        suggestion.save(update_fields=["status", "rejected_at", "updated_at", "updated_by"])
        self._audit(suggestion=suggestion, user=user, event_type="reject", payload={})
        self.notifier.broadcast_suggestion(suggestion, event="copilot_suggestion_rejected")
        return suggestion

    def _enforce_confirmation_guardrails(self, *, suggestion: CopilotSuggestion, payload: dict[str, Any]) -> None:
        if suggestion.suggestion_type != "suggested_action":
            return

        confidence_label = str(payload.get("confidence_label") or "").strip().lower()
        sources = payload.get("sources") or []

        if confidence_label in self.LOW_CONFIDENCE_LABELS:
            raise ValueError("This suggestion is marked low confidence. Regenerate it before confirming.")

        if not isinstance(sources, list) or not sources:
            raise ValueError("This suggestion needs evidence before it can be confirmed.")

    def _apply_ticket_updates(self, *, user, suggestion: CopilotSuggestion) -> dict[str, Any]:
        self.tool_executor.assert_execution_scope(user=user, suggestion=suggestion)
        applied = self.tool_executor.execute(user=user, suggestion=suggestion)
        ticket = suggestion.ticket
        if not ticket:
            return applied

        for result in applied.get("recommended_actions") or []:
            if isinstance(result, dict):
                self._audit(
                    suggestion=suggestion,
                    user=user,
                    event_type="execute",
                    payload=result,
                )

        self.notifier.broadcast_suggestion(
            suggestion,
            event="copilot_applied",
            payload={"applied_changes": applied},
        )
        return applied

    def _build_runtime_metadata(
        self,
        *,
        resolved_command: str,
        surface: str,
        extra_input: str,
        mode: str,
        handler_metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "runtime": {
                "resolved_command": resolved_command,
                "surface": surface,
                "mode": mode,
                "state": "queued" if mode == "async" else "pending_review",
            },
            "input": {
                "extra_input_present": bool(extra_input),
                "extra_input": extra_input,
            },
            "handler": handler_metadata or {},
            "failure": {},
            "execution": {},
        }

    def _mark_runtime_processed(self, *, metadata: dict[str, Any], handler_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        next_metadata = dict(metadata)
        runtime = dict(next_metadata.get("runtime") or {})
        runtime["state"] = "pending_review"
        runtime["processed_at"] = timezone.now().isoformat()
        next_metadata["runtime"] = runtime
        next_metadata["handler"] = handler_metadata or {}
        return next_metadata

    def _mark_failure_metadata(self, *, metadata: dict[str, Any], error: CopilotGatewayError) -> dict[str, Any]:
        next_metadata = dict(metadata)
        runtime = dict(next_metadata.get("runtime") or {})
        runtime["state"] = "failed"
        next_metadata["runtime"] = runtime
        next_metadata["failure"] = {
            "error": str(error),
            "error_type": error.error_type,
            "raw_content_preview": error.raw_content[:400],
            "failed_at": timezone.now().isoformat(),
        }
        next_metadata["error_type"] = error.error_type
        return next_metadata

    def _mark_execution_approved(self, *, metadata: dict[str, Any], user_id: int) -> dict[str, Any]:
        next_metadata = dict(metadata)
        next_metadata["execution"] = {
            "state": "approved",
            "approved_at": timezone.now().isoformat(),
            "approved_by_id": user_id,
        }
        return next_metadata

    def _mark_execution_succeeded(
        self,
        *,
        metadata: dict[str, Any],
        applied_changes: dict[str, Any],
        user_id: int,
    ) -> dict[str, Any]:
        next_metadata = dict(metadata)
        next_metadata["execution"] = {
            "state": "executed",
            "approved_at": timezone.now().isoformat(),
            "approved_by_id": user_id,
            "executed_at": timezone.now().isoformat(),
            "result": applied_changes,
        }
        return next_metadata

    def _mark_execution_failure(
        self,
        *,
        metadata: dict[str, Any],
        error_message: str,
        error_type: str,
    ) -> dict[str, Any]:
        next_metadata = dict(metadata)
        next_metadata["execution"] = {
            "state": "failed",
            "failed_at": timezone.now().isoformat(),
            "error": error_message,
            "error_type": error_type,
        }
        return next_metadata

    def _audit(self, *, suggestion: CopilotSuggestion, user, event_type: str, payload: dict[str, Any]) -> None:
        CopilotAuditLog.objects.create(
            business=user.business,
            suggestion=suggestion,
            user=user,
            event_type=event_type,
            payload=payload,
        )
        log_audit_event(
            None,
            event_type=f"COPILOT_{event_type.upper()}",
            entity_type="copilot",
            entity=suggestion,
            activity=f"{actor_name(user)} performed Copilot {event_type}",
            metadata=payload,
            actor_user=user,
            business=user.business,
        )

    def _build_idempotency_key(
        self,
        *,
        business_id: int | None,
        user_id: int,
        ticket_id: int,
        command: str,
        query: str,
        extra_input: str,
    ) -> str:
        raw = f"{business_id}:{user_id}:{ticket_id}:{command}:{query.strip()}:{extra_input.strip()[:500]}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def _get_existing_suggestion(self, user, ticket: Ticket, idempotency_key: str) -> CopilotSuggestion | None:
        cutoff = timezone.now() - timedelta(seconds=self.IDEMPOTENCY_WINDOW_SECONDS)
        return (
            CopilotSuggestion.objects.filter(
                business=user.business,
                ticket=ticket,
                idempotency_key=idempotency_key,
                created_at__gte=cutoff,
            )
            .exclude(status__in=["failed", "rejected"])
            .order_by("-created_at")
            .first()
        )

    def _enforce_rate_limit(self, user) -> None:
        cache_key = f"copilot_rate:{user.business_id}:{user.id}:{timezone.now().strftime('%Y%m%d%H%M')}"
        current = cache.get(cache_key, 0)
        if current >= self.RATE_LIMIT_PER_MINUTE:
            raise ValueError("Copilot rate limit reached. Please wait a moment and try again.")
        cache.set(cache_key, current + 1, timeout=90)
