from django.conf import settings
from django.db import models

from shared.models.BaseModel import BaseEntity


class CopilotPromptTemplate(BaseEntity):
    COMMAND_CHOICES = [
        ("summarize", "Summarize"),
        ("draft-reply", "Draft Reply"),
        ("draft-note", "Draft Note"),
        ("draft-call-log", "Draft Call Log"),
        ("similar", "Similar"),
        ("suggest-kb", "Suggest KB"),
        ("triage", "Triage"),
    ]

    command = models.CharField(max_length=32, choices=COMMAND_CHOICES, db_index=True)
    version = models.PositiveIntegerField(default=1)
    name = models.CharField(max_length=120)
    system_prompt = models.TextField()
    output_schema = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = "copilot_prompt_templates"
        ordering = ["command", "-version", "-created_at"]
        unique_together = [("business", "command", "version")]

    def __str__(self) -> str:
        return f"{self.command} v{self.version}"


class CopilotSuggestion(BaseEntity):
    SUGGESTION_TYPE_CHOICES = [
        ("informational", "Informational"),
        ("draft", "Draft"),
        ("suggested_action", "Suggested Action"),
    ]
    STATUS_CHOICES = [
        ("queued", "Queued"),
        ("pending_review", "Pending Review"),
        ("approved", "Approved"),
        ("executed", "Executed"),
        ("rejected", "Rejected"),
        ("failed", "Failed"),
    ]
    SURFACE_CHOICES = [
        ("rail", "Docked Rail"),
        ("activity_stream", "Activity Stream"),
    ]

    ticket = models.ForeignKey(
        "tenant.Ticket",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="copilot_suggestions",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="copilot_requested_suggestions",
    )
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="copilot_confirmed_suggestions",
    )
    command = models.CharField(max_length=32, db_index=True)
    request_text = models.TextField(blank=True)
    suggestion_type = models.CharField(max_length=24, choices=SUGGESTION_TYPE_CHOICES)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default="pending_review", db_index=True)
    surface = models.CharField(max_length=24, choices=SURFACE_CHOICES, default="rail", db_index=True)
    payload = models.JSONField(default=dict)
    metadata = models.JSONField(default=dict, blank=True)
    confidence_score = models.FloatField(null=True, blank=True)
    idempotency_key = models.CharField(max_length=64, db_index=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "copilot_suggestions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "ticket", "command"]),
            models.Index(fields=["business", "requested_by", "created_at"]),
        ]

    def __str__(self) -> str:
        ticket_ref = self.ticket.ticket_id if self.ticket else "global"
        return f"{self.command} on {ticket_ref}"


class CopilotAuditLog(BaseEntity):
    EVENT_CHOICES = [
        ("invoke", "Invoke"),
        ("confirm", "Confirm"),
        ("reject", "Reject"),
        ("execute", "Execute"),
        ("error", "Error"),
    ]

    suggestion = models.ForeignKey(
        CopilotSuggestion,
        on_delete=models.CASCADE,
        related_name="audit_logs",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="copilot_audit_logs",
    )
    event_type = models.CharField(max_length=24, choices=EVENT_CHOICES, db_index=True)
    payload = models.JSONField(default=dict, blank=True)
    note = models.TextField(blank=True, default="")

    class Meta:
        db_table = "copilot_audit_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["suggestion", "event_type", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} for suggestion {self.suggestion_id}"
