from django.db import models
from .BaseModel import BaseEntity


class SafariSmsConfig(BaseEntity):
    """
    Model to store Safari SMS/WhatsApp notification configuration per business.
    This includes channel settings, notification preferences, and message templates.
    """
    
    # Activation status
    is_activated = models.BooleanField(
        default=False,
        help_text="Whether Safari SMS is activated for this business"
    )
    
    # Channel settings
    sms_enabled = models.BooleanField(
        default=False,
        help_text="Whether SMS notifications are enabled"
    )
    whatsapp_enabled = models.BooleanField(
        default=False,
        help_text="Whether WhatsApp notifications are enabled"
    )
    
    # Notification event toggles
    notify_new_ticket = models.BooleanField(
        default=True,
        help_text="Send notification when a new ticket is created"
    )
    notify_status_update = models.BooleanField(
        default=True,
        help_text="Send notification when ticket status changes"
    )
    notify_ticket_assigned = models.BooleanField(
        default=True,
        help_text="Send notification when ticket is assigned to an agent"
    )
    notify_mention = models.BooleanField(
        default=True,
        help_text="Send notification when someone is mentioned in a ticket"
    )
    notify_comment_added = models.BooleanField(
        default=False,
        help_text="Send notification when a new comment is added"
    )
    notify_sla_breach = models.BooleanField(
        default=True,
        help_text="Send notification when SLA is breached"
    )
    notify_ticket_resolved = models.BooleanField(
        default=True,
        help_text="Send notification when ticket is resolved"
    )
    
    # Message templates (JSON field for flexibility)
    template_new_ticket = models.TextField(
        default='New ticket #{{ticket_id}}: {{ticket_title}}. View at: {{ticket_url}}',
        help_text="Template for new ticket notification"
    )
    template_status_update = models.TextField(
        default='Ticket #{{ticket_id}} status changed to {{new_status}}. View at: {{ticket_url}}',
        help_text="Template for status update notification"
    )
    template_ticket_assigned = models.TextField(
        default='You have been assigned ticket #{{ticket_id}}: {{ticket_title}}. View at: {{ticket_url}}',
        help_text="Template for ticket assigned notification (sent to assignee)"
    )
    template_mention = models.TextField(
        default='You were mentioned in ticket #{{ticket_id}} by {{mentioned_by}}. View at: {{ticket_url}}',
        help_text="Template for mention notification"
    )
    template_comment_added = models.TextField(
        default='New comment on ticket #{{ticket_id}} by {{commenter_name}}. View at: {{ticket_url}}',
        help_text="Template for comment added notification"
    )
    template_sla_breach = models.TextField(
        default='⚠️ SLA breach alert! Ticket #{{ticket_id}} has exceeded the response time. Immediate action required.',
        help_text="Template for SLA breach notification"
    )
    template_ticket_resolved = models.TextField(
        default='Ticket #{{ticket_id}} has been resolved. Thank you for contacting support!',
        help_text="Template for ticket resolved notification"
    )

    class Meta:
        db_table = 'safari_sms_config'
        verbose_name = 'Safari SMS Configuration'
        verbose_name_plural = 'Safari SMS Configurations'
        constraints = [
            models.UniqueConstraint(
                fields=['business'],
                name='unique_safari_sms_config_per_business'
            )
        ]

    def __str__(self):
        return f"Safari SMS Config - {self.business.name if self.business else 'N/A'}"

    @property
    def has_any_channel_enabled(self):
        """Check if at least one channel is enabled"""
        return self.sms_enabled or self.whatsapp_enabled

    @property
    def has_any_notification_enabled(self):
        """Check if at least one notification type is enabled"""
        return any([
            self.notify_new_ticket,
            self.notify_status_update,
            self.notify_ticket_assigned,
            self.notify_mention,
            self.notify_comment_added,
            self.notify_sla_breach,
            self.notify_ticket_resolved,
        ])

    @classmethod
    def get_for_business(cls, business):
        """Get or create the config for a business"""
        config, created = cls.objects.get_or_create(business=business)
        return config

    def get_template(self, notification_type: str) -> str:
        """Get the template for a specific notification type"""
        template_map = {
            'new_ticket': self.template_new_ticket,
            'status_update': self.template_status_update,
            'ticket_assigned': self.template_ticket_assigned,
            'mention': self.template_mention,
            'comment_added': self.template_comment_added,
            'sla_breach': self.template_sla_breach,
            'ticket_resolved': self.template_ticket_resolved,
        }
        return template_map.get(notification_type, '')

    def is_notification_enabled(self, notification_type: str) -> bool:
        """Check if a specific notification type is enabled"""
        notification_map = {
            'new_ticket': self.notify_new_ticket,
            'status_update': self.notify_status_update,
            'ticket_assigned': self.notify_ticket_assigned,
            'mention': self.notify_mention,
            'comment_added': self.notify_comment_added,
            'sla_breach': self.notify_sla_breach,
            'ticket_resolved': self.notify_ticket_resolved,
        }
        return notification_map.get(notification_type, False)

    def render_template(self, notification_type: str, context: dict) -> str:
        """Render a notification template with context variables"""
        template = self.get_template(notification_type)
        for key, value in context.items():
            template = template.replace('{{' + key + '}}', str(value) if value else '')
        return template
