from __future__ import annotations

from tenant.models import Ticket

from .context import ContextAssembler
from .gateway import LLMGateway
from .handlers import (
    DraftCallLogHandler,
    DraftNoteHandler,
    DraftReplyHandler,
    SimilarHandler,
    SummarizeHandler,
    SuggestKBHandler,
    TriageHandler,
)


class CopilotCommandRouter:
    COMMAND_REGISTRY = {
        "summarize": SummarizeHandler,
        "draft-call-log": DraftCallLogHandler,
        "draft-reply": DraftReplyHandler,
        "draft-note": DraftNoteHandler,
        "similar": SimilarHandler,
        "suggest-kb": SuggestKBHandler,
        "triage": TriageHandler,
    }

    def __init__(self) -> None:
        self.context_assembler = ContextAssembler()
        self.llm_gateway = LLMGateway()

    def resolve_command(self, command: str | None, query: str) -> str:
        normalized = (command or "").strip().lower()
        if normalized.startswith("/"):
            normalized = normalized[1:]
        if normalized in self.COMMAND_REGISTRY:
            return normalized

        text = (query or "").lower()
        if any(token in text for token in ["reply", "respond", "email back", "rewrite", "tone"]):
            return "draft-reply"
        if any(token in text for token in ["call log", "log call", "phone call", "voicemail"]):
            return "draft-call-log"
        if any(token in text for token in ["note", "handoff", "internal note"]):
            return "draft-note"
        if any(token in text for token in ["similar", "duplicate", "related case", "past case"]):
            return "similar"
        if any(token in text for token in ["kb", "knowledge", "article", "help doc", "documentation"]):
            return "suggest-kb"
        if any(token in text for token in ["triage", "assign", "priority", "status", "next step", "what should"]):
            return "triage"
        return "summarize"

    def invoke(self, *, ticket: Ticket, command: str | None, query: str, extra_input: str = ""):
        resolved_command = self.resolve_command(command, query)
        handler_cls = self.COMMAND_REGISTRY[resolved_command]
        handler = handler_cls(
            context_assembler=self.context_assembler,
            llm_gateway=self.llm_gateway,
        )
        result = handler.run(ticket=ticket, query=query, extra_input=extra_input)
        return resolved_command, result
