from django.db import models


class TenantAuditLog(models.Model):
    """Tenant-scoped audit trail for workspace activity."""

    business = models.ForeignKey(
        "users.Business",
        on_delete=models.CASCADE,
        related_name="tenant_audit_logs",
    )
    actor = models.ForeignKey(
        "users.Users",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tenant_audit_logs",
    )
    actor_name = models.CharField(max_length=255, blank=True)
    actor_email = models.EmailField(blank=True)
    actor_avatar_url = models.URLField(max_length=1000, blank=True)
    event_type = models.CharField(max_length=80)
    entity_type = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=80)
    entity_label = models.CharField(max_length=255, blank=True)
    activity = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    request_path = models.CharField(max_length=500, blank=True)
    request_method = models.CharField(max_length=10, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tenant_audit_logs"
        ordering = ["-timestamp", "-id"]
        indexes = [
            models.Index(fields=["business", "-timestamp"], name="tenant_audit_biz_time_idx"),
            models.Index(fields=["business", "event_type"], name="tenant_audit_biz_event_idx"),
            models.Index(fields=["business", "entity_type"], name="tenant_audit_biz_entity_idx"),
            models.Index(fields=["business", "actor"], name="tenant_audit_biz_actor_idx"),
        ]

    def __str__(self):
        return f"{self.event_type} {self.entity_type}/{self.entity_id}"
