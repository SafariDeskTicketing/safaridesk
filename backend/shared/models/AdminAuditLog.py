from django.db import models


class AdminAuditLog(models.Model):
    """
    Audit trail for all SafariAdmin actions.
    Every write operation performed by a superadmin is logged here.
    """

    admin_user = models.ForeignKey(
        'users.Users',
        on_delete=models.CASCADE,
        related_name='audit_actions',
    )
    action = models.CharField(max_length=50)
    target_type = models.CharField(max_length=30)   # Business | User | EmailFilter
    target_id = models.IntegerField()
    target_label = models.CharField(max_length=255, blank=True)  # human-readable name
    detail = models.JSONField(default=dict)
    performed_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = 'admin_audit_logs'
        ordering = ['-performed_at']
        indexes = [
            models.Index(fields=['-performed_at'], name='audit_log_time_idx'),
            models.Index(fields=['admin_user'], name='audit_log_admin_idx'),
            models.Index(fields=['action'], name='audit_log_action_idx'),
        ]

    def __str__(self):
        return f"[{self.action}] by admin {self.admin_user_id} on {self.target_type}/{self.target_id}"
