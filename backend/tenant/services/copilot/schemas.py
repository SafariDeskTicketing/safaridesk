from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, ValidationError


class SourceReference(BaseModel):
    type: str
    label: str
    detail: str = ""


class BaseResultPayload(BaseModel):
    sources: list[SourceReference] = Field(default_factory=list)
    confidence_label: str | None = None


class SummaryPayload(BaseResultPayload):
    summary: str
    key_facts: list[str] = Field(default_factory=list)
    thread_recap: str = ""


class DraftReplyPayload(BaseResultPayload):
    subject: str = ""
    content: str


class DraftNotePayload(BaseResultPayload):
    content: str


class DraftCallLogPayload(BaseResultPayload):
    subject: str = ""
    content: str


class SimilarTicketItem(BaseModel):
    id: int
    ticket_id: str
    title: str
    status: str
    priority: str | None = None
    reason: str = ""


class SimilarPayload(BaseResultPayload):
    items: list[SimilarTicketItem] = Field(default_factory=list)


class KBSuggestionItem(BaseModel):
    article_id: int
    title: str
    score: float = 0.0
    excerpt: str = ""


class SuggestKBPayload(BaseResultPayload):
    items: list[KBSuggestionItem] = Field(default_factory=list)


class TriageSuggestedUpdates(BaseModel):
    priority: str | None = None
    status: str | None = None
    category_id: int | None = None
    category_label: str | None = None
    assignee_id: int | None = None
    assignee_label: str | None = None
    department_id: int | None = None
    department_label: str | None = None
    tags: list[str] = Field(default_factory=list)


class TaskDraft(BaseModel):
    title: str
    description: str = ""
    priority: str | None = None
    assignee_id: int | None = None
    assignee_label: str | None = None
    department_id: int | None = None
    department_label: str | None = None
    due_date: str | None = None
    link_to_ticket: bool = True


class RecommendedAction(BaseModel):
    type: str
    label: str
    reason: str = ""
    task: TaskDraft | None = None
    requires_confirmation: bool = True


class TriagePayload(BaseResultPayload):
    summary: str
    next_step: str
    missing_info: list[str] = Field(default_factory=list)
    suggested_updates: TriageSuggestedUpdates = Field(default_factory=TriageSuggestedUpdates)
    rationale: list[str] = Field(default_factory=list)
    recommended_actions: list[RecommendedAction] = Field(default_factory=list)


SCHEMA_MAP = {
    "summarize": SummaryPayload,
    "draft-reply": DraftReplyPayload,
    "draft-note": DraftNotePayload,
    "draft-call-log": DraftCallLogPayload,
    "similar": SimilarPayload,
    "suggest-kb": SuggestKBPayload,
    "triage": TriagePayload,
}


class OutputValidator:
    def validate(self, command: str, payload: dict[str, Any]) -> dict[str, Any]:
        schema = SCHEMA_MAP.get(command)
        if not schema:
            raise ValidationError.from_exception_data("Unknown command", [])
        validated = schema.model_validate(payload)
        return validated.model_dump()
