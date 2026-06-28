from __future__ import annotations

from django.db import models
from django.utils import timezone

from shared.models.BaseModel import BaseEntity
from util.security import decrypt_value, encrypt_value


class MailIntegration(BaseEntity):
    class Provider(models.TextChoices):
        GMAIL = "gmail", "Gmail"
        OFFICE365 = "office365", "Microsoft 365"
        CUSTOM = "custom", "Custom Server"
        SAFARIDESK = "safaridesk", "SafariDesk Forwarding"

    class Direction(models.TextChoices):
        INCOMING = "incoming", "Incoming Only"
        OUTGOING = "outgoing", "Outgoing Only"
        BOTH = "both", "Incoming & Outgoing"

    class ConnectionStatus(models.TextChoices):
        CONNECTING = "connecting", "Connecting"
        CONNECTED = "connected", "Connected"
        ERROR = "error", "Error"
        DISCONNECTED = "disconnected", "Disconnected"

    email_address = models.EmailField(null=True, blank=True)
    display_name = models.CharField(max_length=255, blank=True)
    provider = models.CharField(max_length=20, choices=Provider.choices)
    direction = models.CharField(
        max_length=20, choices=Direction.choices, default=Direction.BOTH
    )
    department = models.ForeignKey(
        "tenant.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mail_integrations",
    )
    default_assignee = models.ForeignKey(
        "users.Users",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mail_integration_defaults",
    )
    connection_status = models.CharField(
        max_length=20,
        choices=ConnectionStatus.choices,
        default=ConnectionStatus.CONNECTING,
    )
    connection_status_detail = models.CharField(max_length=500, blank=True)
    forwarding_address = models.EmailField(null=True, blank=True)
    forwarding_status = models.CharField(max_length=50, blank=True)
    provider_metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    last_success_at = models.DateTimeField(null=True, blank=True)
    last_error_at = models.DateTimeField(null=True, blank=True)
    last_error_message = models.TextField(blank=True)

    # OAuth tokens
    oauth_access_token_encrypted = models.TextField(blank=True)
    oauth_refresh_token_encrypted = models.TextField(blank=True)
    oauth_expires_at = models.DateTimeField(null=True, blank=True)

    # Incoming mail settings
    imap_host = models.CharField(max_length=255, blank=True)
    imap_port = models.PositiveIntegerField(null=True, blank=True)
    imap_use_ssl = models.BooleanField(null=True, blank=True)
    imap_username_encrypted = models.TextField(blank=True)
    imap_password_encrypted = models.TextField(blank=True)

    # Outgoing mail settings
    smtp_host = models.CharField(max_length=255, blank=True)
    smtp_port = models.PositiveIntegerField(null=True, blank=True)
    smtp_use_ssl = models.BooleanField(null=True, blank=True)
    smtp_use_tls = models.BooleanField(null=True, blank=True)
    smtp_username_encrypted = models.TextField(blank=True)
    smtp_password_encrypted = models.TextField(blank=True)

    class Meta:
        db_table = "mail_integrations"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email_address"], name="mail_int_email_idx"),
            models.Index(fields=["connection_status"], name="mail_int_status_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["business", "provider", "email_address", "direction"],
                condition=models.Q(connection_status="connected"),
                name="mail_int_business_provider_email_dir_connected",
            )
        ]
        verbose_name = "Mail Integration"
        verbose_name_plural = "Mail Integrations"

    def __str__(self) -> str:
        email = self.email_address or "Pending"
        return f"{email} ({self.provider})"

    # Convenience helpers -------------------------------------------------
    def set_secret(self, field_name: str, value: str | None) -> None:
        encrypted_field = f"{field_name}_encrypted"
        if not hasattr(self, encrypted_field):
            raise AttributeError(f"{encrypted_field} is not a valid encrypted field")
        setattr(self, encrypted_field, encrypt_value(value))

    def get_secret(self, field_name: str) -> str | None:
        encrypted_field = f"{field_name}_encrypted"
        if not hasattr(self, encrypted_field):
            raise AttributeError(f"{encrypted_field} is not a valid encrypted field")
        return decrypt_value(getattr(self, encrypted_field))

    def mark_success(self) -> None:
        self.connection_status = self.ConnectionStatus.CONNECTED
        self.connection_status_detail = ""
        self.is_active = True
        self.last_success_at = timezone.now()
        updated = self.__class__.objects.filter(pk=self.pk).update(
            connection_status=self.connection_status,
            connection_status_detail=self.connection_status_detail,
            is_active=self.is_active,
            last_success_at=self.last_success_at,
        )
        if not updated:
            return

    def mark_failure(self, message: str) -> None:
        self.connection_status = self.ConnectionStatus.ERROR
        self.connection_status_detail = message[:490]
        self.is_active = False
        self.last_error_at = timezone.now()
        self.last_error_message = message
        updated = self.__class__.objects.filter(pk=self.pk).update(
            connection_status=self.connection_status,
            connection_status_detail=self.connection_status_detail,
            is_active=self.is_active,
            last_error_at=self.last_error_at,
            last_error_message=self.last_error_message,
        )
        if not updated:
            return


class MailFetchLog(BaseEntity):
    class Result(models.TextChoices):
        SUCCESS = "success", "Success"
        WARNING = "warning", "Warning"
        ERROR = "error", "Error"

    integration = models.ForeignKey(
        MailIntegration,
        on_delete=models.CASCADE,
        related_name="fetch_logs",
    )
    checked_at = models.DateTimeField(auto_now_add=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    result = models.CharField(max_length=20, choices=Result.choices)
    message_count = models.PositiveIntegerField(default=0)
    new_ticket_count = models.PositiveIntegerField(default=0)
    new_reply_count = models.PositiveIntegerField(default=0)
    last_message_uid = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = "mail_fetch_logs"
        ordering = ["-checked_at"]
        indexes = [
            models.Index(fields=["integration", "checked_at"], name="mail_fetch_checked_idx"),
        ]
        verbose_name = "Mail Fetch Log"
        verbose_name_plural = "Mail Fetch Logs"

    def save(self, *args, **kwargs):
        if self.integration and not self.business:
            self.business = self.integration.business
        super().save(*args, **kwargs)


DEFAULT_FILTER_RULES = [
    "# Automated senders — safe to delete if needed",
    "noreply",
    "no-reply",
    "donotreply",
    "do-not-reply",
    "mailer-daemon",
    "postmaster",
    "bounce",
    "newsletter",
    "notifications",
    "alerts",
    "marketing",
]


class EmailFilterList(models.Model):
    """
    Per-business email filter rules. One row per business.
    Rules are stored as a JSON list of strings. Each line is interpreted as:
      - '@domain.com'   → block entire domain
      - 'user@domain'   → exact email block
      - 'noreply'       → contains match (substring, case-insensitive)
      - '# comment'     → ignored
    """
    business = models.OneToOneField(
        "users.Business",
        on_delete=models.CASCADE,
        related_name="email_filter_list",
    )
    rules = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "email_filter_lists"
        verbose_name = "Email Filter List"

    def __str__(self):
        return f"EmailFilterList for {self.business_id}"


class EmailFilterLog(models.Model):
    """
    Audit trail for every blocked email. Used to investigate false positives.
    """
    business = models.ForeignKey(
        "users.Business",
        on_delete=models.CASCADE,
        related_name="email_filter_logs",
    )
    sender = models.CharField(max_length=320, db_index=True)
    subject = models.CharField(max_length=500, blank=True)
    rule_matched = models.CharField(max_length=500)
    rule_tier = models.CharField(max_length=20)  # exact | domain | contains
    blocked_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "email_filter_logs"
        ordering = ["-blocked_at"]
        indexes = [
            models.Index(fields=["business", "blocked_at"], name="filter_log_biz_time_idx"),
        ]
        verbose_name = "Email Filter Log"
        verbose_name_plural = "Email Filter Logs"

    def __str__(self):
        return f"Blocked {self.sender} via {self.rule_tier}:{self.rule_matched}"


class EmailMessageRecord(BaseEntity):
    class Direction(models.TextChoices):
        INCOMING = "incoming", "Incoming"
        OUTGOING = "outgoing", "Outgoing"

    integration = models.ForeignKey(
        MailIntegration,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    ticket = models.ForeignKey(
        "tenant.Ticket",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="email_messages",
    )
    comment = models.OneToOneField(
        "tenant.TicketComment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="email_message_record",
    )
    message_id = models.CharField(max_length=255, unique=True)
    direction = models.CharField(max_length=20, choices=Direction.choices)
    subject = models.CharField(max_length=512, blank=True)
    sender = models.CharField(max_length=255, blank=True)
    recipient = models.CharField(max_length=255, blank=True)
    raw_headers = models.JSONField(default=dict, blank=True)
    raw_body = models.TextField(blank=True)
    html_body = models.TextField(blank=True)
    received_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "email_message_records"
        ordering = ["-received_at"]
        indexes = [
            models.Index(fields=["direction"], name="email_msg_direction_idx"),
        ]
        verbose_name = "Email Message Record"
        verbose_name_plural = "Email Message Records"

    def save(self, *args, **kwargs):
        if self.integration and not self.business:
            self.business = self.integration.business
        super().save(*args, **kwargs)
