import datetime
from django.db import models
from django.utils import timezone
from tenant.models.TicketModel import Ticket


class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('ticket_assigned', 'Ticket Assigned'),
        ('ticket_status_changed', 'Ticket Status Changed'),
        ('ticket_comment', 'Ticket Comment'),
        ('ticket_mention', 'Ticket Mention'),
        ('sla_breach', 'SLA Breach'),
        ('ticket_escalated', 'Ticket Escalated'),
        ('ticket_reopened', 'Ticket Reopened'),
        ('task_assigned', 'Task Assigned'),
        ('task_status_changed', 'Task Status Changed'),
        ('task_comment', 'Task Comment'),
        ('task_mention', 'Task Mention'),
        ('system_login_alert', 'System Login Alert'),
        ('system_announcement', 'System Announcement'),
        ('system_maintenance', 'System Maintenance'),
    ]
    
    user = models.ForeignKey(
        "users.Users", 
        on_delete=models.CASCADE, 
        related_name="notifications"
    )
    ticket = models.ForeignKey(
        Ticket, 
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True
    )
    message = models.TextField()
    notification_type = models.CharField(
        max_length=50,
        choices=NOTIFICATION_TYPES,
        default='ticket_assigned'
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    
    # Additional metadata
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['user', 'created_at']),
        ]

    def __str__(self):
        """Human-readable representation safe for custom user model.

        Prefer email, then full_name(), and finally fall back to user_id.
        """
        identifier = getattr(self.user, "email", None)

        # Fall back to full_name() or attribute if available
        if not identifier:
            name_attr = getattr(self.user, "full_name", None)
            if callable(name_attr):
                identifier = name_attr()
            elif name_attr:
                identifier = name_attr

        if not identifier:
            identifier = str(self.user_id)

        return f"To {identifier}: {self.message}"
    
    def mark_as_read(self):
        """Mark notification as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save()
    
    def to_dict(self):
        """Convert notification to dictionary for WebSocket transmission"""
        notification_dict = {
            'id': self.id,
            'message': self.message,
            'notification_type': self.notification_type,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat(),
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'metadata': self.metadata
        }
        
        # Handle task notifications (stored in metadata)
        if 'task_id' in self.metadata and self.notification_type in ['task_assigned', 'task_comment', 'task_mention', 'task_status_changed']:
            try:
                from tenant.models.TaskModel import Task
                task = Task.objects.select_related('linked_ticket').get(id=self.metadata['task_id'])
                notification_dict['task'] = {
                    'id': task.id,
                    'task_trackid': task.task_trackid,  # Use task_trackid instead of id
                    'title': task.title,
                    'task_status': task.task_status,
                    'priority': task.priority,
                }
                # If task is linked to a ticket, include ticket info too
                if task.linked_ticket:
                    notification_dict['ticket'] = {
                        'id': task.linked_ticket.id,
                        'ticket_id': task.linked_ticket.ticket_id,
                        'title': task.linked_ticket.title,
                        'status': task.linked_ticket.status,
                        'priority': task.linked_ticket.priority,
                    }
                else:
                    notification_dict['ticket'] = None
            except Exception:
                # If task not found, set task to None
                notification_dict['task'] = None
                notification_dict['ticket'] = None
        # Handle ticket notifications
        elif self.ticket:
            notification_dict['ticket'] = {
                'id': self.ticket.id,
                'ticket_id': self.ticket.ticket_id,
                'title': self.ticket.title,
                'status': self.ticket.status,
                'priority': self.ticket.priority,
            }
            notification_dict['task'] = None
        else:
            notification_dict['ticket'] = None
            notification_dict['task'] = None
        
        return notification_dict


def notification_channel_defaults():
    """
    Default delivery channel configuration shared by user and business settings.
    """
    return {
        'in_app': True,
        'email': True,
    }


def default_notification_matrix():
    """
    Generates a default matrix for all notification types so each channel can be toggled independently.
    """
    matrix = {}
    for notif_key, _ in Notification.NOTIFICATION_TYPES:
        matrix[notif_key] = {
            'in_app': True,
            'email': notif_key not in ['system_login_alert', 'system_maintenance'],  # quieter defaults
        }
    return matrix


def default_quiet_hours():
    return {'enabled': False, 'start': '22:00', 'end': '06:00'}


def default_escalation_policy():
    return {
        'enabled': False,
        'threshold_minutes': 30,
        'notify_roles': ['admin'],
        'additional_emails': [],
    }


# Expose helper defaults on the Notification class for backwards-compatible
# references from older migrations (e.g., tenant.models.Notification.notification_channel_defaults).
# This keeps the module-level helpers as the single source of truth while
# satisfying MigrationLoader imports.
setattr(Notification, "notification_channel_defaults", staticmethod(notification_channel_defaults))
setattr(Notification, "default_notification_matrix", staticmethod(default_notification_matrix))
setattr(Notification, "default_quiet_hours", staticmethod(default_quiet_hours))
setattr(Notification, "default_escalation_policy", staticmethod(default_escalation_policy))


class OrganizationNotificationSetting(models.Model):
    """
    Stores workspace-wide notification defaults and escalation policies.
    Provides the first level of control for all users inside the business.
    """
    business = models.OneToOneField(
        "users.Business",
        on_delete=models.CASCADE,
        related_name="notification_settings"
    )
    delivery_channels = models.JSONField(default=notification_channel_defaults, blank=True)
    notification_matrix = models.JSONField(default=default_notification_matrix, blank=True)
    digest_enabled = models.BooleanField(default=True)
    digest_frequency = models.CharField(
        max_length=20,
        choices=[('daily', 'Daily'), ('weekly', 'Weekly'), ('off', 'Off')],
        default='daily'
    )
    escalation_policy = models.JSONField(default=default_escalation_policy, blank=True)
    webhook_url = models.URLField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Organization Notification Setting"
        db_table = "notification_settings"

    def is_channel_enabled(self, channel: str) -> bool:
        return self.delivery_channels.get(channel, True)

    def is_notification_enabled(self, notification_type: str, channel: str) -> bool:
        matrix = self.notification_matrix or {}
        per_type = matrix.get(notification_type, {})
        return per_type.get(channel, True)


class UserNotificationPreference(models.Model):
    """
    Stores per-user overrides for notifications.
    Merged with OrganizationNotificationSetting to determine final delivery behaviour.
    """
    user = models.OneToOneField(
        "users.Users",
        on_delete=models.CASCADE,
        related_name="notification_preferences"
    )
    business = models.ForeignKey(
        "users.Business",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="user_notification_preferences"
    )
    delivery_channels = models.JSONField(default=notification_channel_defaults, blank=True)
    notification_matrix = models.JSONField(default=default_notification_matrix, blank=True)
    quiet_hours = models.JSONField(default=default_quiet_hours, blank=True)
    mute_until = models.DateTimeField(null=True, blank=True)
    browser_push_enabled = models.BooleanField(default=False)
    email_digest_enabled = models.BooleanField(default=True)
    digest_frequency = models.CharField(
        max_length=20,
        choices=[('daily', 'Daily'), ('weekly', 'Weekly'), ('off', 'Off')],
        default='daily'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Notification Preference"
        db_table = "notification_preferences"

    def is_channel_enabled(self, channel: str) -> bool:
        return self.delivery_channels.get(channel, True)

    def is_notification_enabled(self, notification_type: str, channel: str) -> bool:
        matrix = self.notification_matrix or {}
        per_type = matrix.get(notification_type, {})
        return per_type.get(channel, True)

    def quiet_hours_active(self) -> bool:
        quiet = self.quiet_hours or {}
        if not quiet.get('enabled'):
            return False

        start = quiet.get('start')
        end = quiet.get('end')
        if not start or not end:
            return False

        try:
            start_time = datetime.time.fromisoformat(start)
            end_time = datetime.time.fromisoformat(end)
        except ValueError:
            return False

        now_local = timezone.localtime()
        now_time = now_local.time()

        if start_time < end_time:
            return start_time <= now_time < end_time
        return now_time >= start_time or now_time < end_time

    def is_muted(self) -> bool:
        return bool(self.mute_until and self.mute_until > timezone.now())
