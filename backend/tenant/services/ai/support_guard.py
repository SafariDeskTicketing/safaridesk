from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictStr, field_validator

from tenant.services.ai.gemini_client import GeminiClient

logger = logging.getLogger(__name__)

SUPPORT_REDIRECT_MESSAGE = "I'm here to help with SafariDesk support. Tell me what issue you're running into and I'll help."
OFF_TOPIC_CONFIDENCE_THRESHOLD = 0.75


@dataclass(frozen=True)
class SupportRelevanceResult:
    support_related: bool
    confidence: float
    allow_ticket_creation: bool
    reason: str
    source: str = "ai"


class SupportRelevanceSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    support_related: StrictBool
    confidence: float = Field(ge=0.0, le=1.0)
    allow_ticket_creation: StrictBool
    reason: StrictStr

    @field_validator("confidence", mode="before")
    @classmethod
    def reject_non_numeric_confidence(cls, value: Any) -> Any:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("confidence must be a JSON number between 0 and 1")
        return value


def is_active_support_flow(state: dict[str, Any] | None) -> bool:
    if not state:
        return False
    if state.get("contact_requested"):
        return True
    validation = state.get("validation")
    if isinstance(validation, dict) and (validation.get("missing") or validation.get("invalid")):
        return True
    for call in state.get("tool_calls") or []:
        if call.get("tool") in {"validate_contact_fields", "create_ticket", "resolution_status"}:
            return True
    return False


def classify_support_relevance(message: str, *, state: dict[str, Any] | None = None) -> SupportRelevanceResult:
    text = " ".join((message or "").strip().split())
    if not text:
        return SupportRelevanceResult(True, 1.0, False, "Empty message.", source="local")
    if is_active_support_flow(state):
        return SupportRelevanceResult(True, 1.0, True, "Conversation is already in an active support flow.", source="local")

    try:
        payload = _classify_with_ai(text, state=state)
    except Exception as exc:
        logger.warning("Support relevance classifier failed; allowing message. error=%s", exc)
        return SupportRelevanceResult(True, 0.0, False, "Classifier unavailable; defaulted to allow.", source="fallback")

    raw_support_related = payload.support_related
    confidence = payload.confidence
    allow_ticket_creation = payload.allow_ticket_creation
    reason = payload.reason.strip()[:200]

    if not raw_support_related and confidence >= OFF_TOPIC_CONFIDENCE_THRESHOLD:
        return SupportRelevanceResult(False, confidence, False, reason or "Clearly outside SafariDesk support.", source="ai")

    if not raw_support_related:
        return SupportRelevanceResult(
            True,
            confidence,
            False,
            reason or "Ambiguous support relevance; defaulted to allow.",
            source="ai_ambiguous_allow",
        )

    return SupportRelevanceResult(True, confidence, allow_ticket_creation, reason or "Support-related request.", source="ai")


def is_support_relevant(message: str, *, state: dict[str, Any] | None = None) -> bool:
    return classify_support_relevance(message, state=state).support_related


def _classify_with_ai(message: str, *, state: dict[str, Any] | None = None) -> SupportRelevanceSchema:
    recent_history = []
    if state and isinstance(state.get("history"), list):
        recent_history = state["history"][-6:]

    system_instruction = (
        "You are a strict support-domain classifier for SafariDesk help-center chat. "
        "Do not answer the user. "
        "Classify whether the message is related to SafariDesk support, including account, login, billing, setup, "
        "workflow, bug, integration, email, ticketing, dashboard, support requests, greetings, clarifications, "
        "and follow-ups. Clearly unrelated general knowledge, science, astronomy, homework, creative writing, "
        "trivia, politics, recipes, and entertainment are not support-related. "
        "If ambiguous, mark support_related true."
    )
    prompt = json.dumps(
        {
            "message": message,
            "recent_history": recent_history,
            "state": _classifier_state(state),
        },
        ensure_ascii=True,
        default=str,
    )

    result = GeminiClient().generate_structured_content(
        prompt=prompt,
        response_schema=SupportRelevanceSchema,
        system_instruction=system_instruction,
        temperature=0.0,
        max_tokens=120,
        retry_on_error=False,
    )
    parsed = result.get("parsed")
    if not isinstance(parsed, SupportRelevanceSchema):
        return SupportRelevanceSchema.model_validate(parsed)
    return parsed


def _classifier_state(state: dict[str, Any] | None) -> dict[str, Any]:
    if not state:
        return {}

    validation = state.get("validation") if isinstance(state.get("validation"), dict) else {}
    recent_tool_calls = []
    for call in state.get("tool_calls") or []:
        tool_name = call.get("tool") if isinstance(call, dict) else None
        if tool_name in {"validate_contact_fields", "create_ticket", "resolution_status"}:
            recent_tool_calls.append(tool_name)

    return {
        "contact_requested": bool(state.get("contact_requested")),
        "validation_missing": bool(validation.get("missing")),
        "validation_invalid": bool(validation.get("invalid")),
        "recent_support_tool_calls": recent_tool_calls[-5:],
    }
