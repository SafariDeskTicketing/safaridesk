from django.db import models
from .BaseModel import BaseEntity


class SlackIntegration(BaseEntity):
    # Business reference - this allows multi-tenant support
    business = models.ForeignKey('users.Business', on_delete=models.CASCADE, related_name='slack_integrations')
    
    # Slack OAuth data
    access_token = models.TextField()
    team_id = models.CharField(max_length=50)
    team_name = models.CharField(max_length=255)
    workspace_url = models.URLField()
    
    # Bot user info
    bot_user_id = models.CharField(max_length=50)
    
    # App installation info
    app_id = models.CharField(max_length=50)
    scope = models.TextField()
    
    # Configuration
    default_channel = models.CharField(max_length=50, blank=True, null=True)  # Channel ID
    default_channel_name = models.CharField(max_length=255, blank=True, null=True)  # Channel name for display
    
    # Notification preferences
    notify_new_tickets = models.BooleanField(default=True)
    notify_assignments = models.BooleanField(default=True)
    notify_status_updates = models.BooleanField(default=True)
    notify_sla_breaches = models.BooleanField(default=True)
    notify_comments = models.BooleanField(default=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    
    # Event subscription and webhook fields for two-way integration
    webhook_url = models.URLField(blank=True, null=True)
    event_subscriptions = models.JSONField(default=dict, blank=True)
    last_event_received = models.DateTimeField(blank=True, null=True)
    subscription_status = models.CharField(max_length=50, default='pending')
    
    class Meta:
        unique_together = ['business', 'team_id']
        constraints = [
            models.UniqueConstraint(
                fields=['team_id'],
                condition=models.Q(is_active=True),
                name='unique_active_slack_team_id',
            )
        ]
        db_table = 'slack_integrations'
        
    def __str__(self):
        return f"Slack integration for {self.business.name} - {self.team_name}"
