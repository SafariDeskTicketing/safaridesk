from django.db import models
from .BaseModel import BaseEntity


class TeamsIntegration(BaseEntity):
    """Microsoft Teams integration model for multi-tenant support"""
    
    # Business reference - this allows multi-tenant support
    business = models.ForeignKey('users.Business', on_delete=models.CASCADE, related_name='teams_integrations')
    
    # Microsoft OAuth data
    access_token = models.TextField()
    refresh_token = models.TextField(blank=True, null=True)
    token_expires_at = models.DateTimeField(blank=True, null=True)
    
    # Tenant info (Microsoft organization)
    tenant_id = models.CharField(max_length=100)  # Microsoft tenant/directory ID
    tenant_name = models.CharField(max_length=255, blank=True, null=True)
    
    # User info
    user_id = models.CharField(max_length=100)  # Microsoft user ID
    user_email = models.EmailField(blank=True, null=True)
    user_display_name = models.CharField(max_length=255, blank=True, null=True)
    
    # Team info (selected team for notifications)
    team_id = models.CharField(max_length=100, blank=True, null=True)
    team_name = models.CharField(max_length=255, blank=True, null=True)
    team_url = models.URLField(blank=True, null=True)
    
    # Configuration - default channel for notifications
    default_channel_id = models.CharField(max_length=100, blank=True, null=True)
    default_channel_name = models.CharField(max_length=255, blank=True, null=True)
    
    # Notification preferences
    notify_new_tickets = models.BooleanField(default=True)
    notify_assignments = models.BooleanField(default=True)
    notify_status_updates = models.BooleanField(default=True)
    notify_sla_breaches = models.BooleanField(default=True)
    notify_comments = models.BooleanField(default=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ['business', 'tenant_id']
        db_table = 'teams_integrations'
        
    def __str__(self):
        return f"Teams integration for {self.business.name} - {self.tenant_name or self.tenant_id}"
    
    def is_token_expired(self):
        """Check if the access token has expired"""
        from django.utils import timezone
        if not self.token_expires_at:
            return True
        return timezone.now() >= self.token_expires_at
