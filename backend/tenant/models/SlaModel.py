from django.db import models
from django.utils import timezone
from datetime import timedelta
import uuid

from shared.models.BaseModel import BaseEntity
# from tenant.models.TicketModel import TicketCategories


class SLAPolicy(BaseEntity):
    """
    Defines SLA policies with response and resolution timeframes
    """
    PRIORITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]

    CUSTOMER_TIER_CHOICES = [
        ('premium', 'Premium'),
        ('standard', 'Standard'),
        ('basic', 'Basic'),
    ]
    
   
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    
    # SLA Criteria
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES)
    customer_tier = models.CharField(max_length=20, choices=CUSTOMER_TIER_CHOICES, default='standard')
    category = models.ForeignKey("tenant.TicketCategories", on_delete=models.CASCADE, null=True, blank=True)
    
    # Time Limits (in minutes)
    first_response_time = models.PositiveIntegerField(help_text="Minutes for first response")
    resolution_time = models.PositiveIntegerField(help_text="Minutes for resolution")
    
    # Business Hours
    business_hours_only = models.BooleanField(default=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'sla_policies'
        unique_together = ['priority', 'category']
        
    def __str__(self):
        return f"{self.name} - {self.priority}"


class BusinessHours(BaseEntity):
    """
    Defines business hours for SLA calculations
    """
    WEEKDAY_CHOICES = [
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, default="Default Business Hours")
    weekday = models.IntegerField(choices=WEEKDAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_working_day = models.BooleanField(default=True)
    timezone = models.CharField(max_length=50, default='UTC')
    
    class Meta:
        db_table = 'business_hours'
        unique_together = ['name', 'weekday']
        
    def __str__(self):
        return f"{self.get_weekday_display()}: {self.start_time}-{self.end_time}"


class Holiday(BaseEntity):
    """
    Defines holidays to exclude from SLA calculations
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    date = models.DateField()
    is_recurring = models.BooleanField(default=False)
    description = models.TextField(blank=True)
    
    class Meta:
        db_table = 'holidays'
        
    def __str__(self):
        return f"{self.name} - {self.date}"


class SLATracker(BaseEntity):
    """
    Tracks SLA compliance for each ticket
    """
    SLA_STATUS_CHOICES = [
        ('within_sla', 'Within SLA'),
        ('approaching_breach', 'Approaching Breach'),
        ('breached', 'Breached'),
        ('paused', 'Paused'),
        ('resolved', 'Resolved'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.OneToOneField('tenant.Ticket', on_delete=models.CASCADE, related_name='sla_tracker')
    sla_policy = models.ForeignKey(SLAPolicy, on_delete=models.CASCADE)
    
    # Response SLA
    first_response_due = models.DateTimeField()
    first_response_completed = models.DateTimeField(null=True, blank=True)
    first_response_status = models.CharField(max_length=20, choices=SLA_STATUS_CHOICES, default='within_sla')
    
    # Resolution SLA
    resolution_due = models.DateTimeField()
    resolution_completed = models.DateTimeField(null=True, blank=True)
    resolution_status = models.CharField(max_length=20, choices=SLA_STATUS_CHOICES, default='within_sla')
    
    # Pause/Resume functionality
    total_paused_time = models.DurationField(default=timedelta(0))
    is_paused = models.BooleanField(default=False)
    paused_at = models.DateTimeField(null=True, blank=True)
    pause_reason = models.TextField(blank=True)
    
    # Breach information
    first_response_breach_time = models.DateTimeField(null=True, blank=True)
    resolution_breach_time = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'sla_trackers'
        
    def __str__(self):
        return f"SLA Tracker for Ticket #{self.ticket.id}"
    
    def pause_sla(self, reason=""):
        """Pause SLA timer"""
        if not self.is_paused:
            self.is_paused = True
            self.paused_at = timezone.now()
            self.pause_reason = reason
            self.save()
    
    def resume_sla(self):
        """Resume SLA timer and add paused time"""
        if self.is_paused and self.paused_at:
            paused_duration = timezone.now() - self.paused_at
            self.total_paused_time += paused_duration
            self.is_paused = False
            self.paused_at = None
            
            # Extend due dates by paused time
            self.first_response_due += paused_duration
            self.resolution_due += paused_duration
            self.save()
    
    @property
    def effective_first_response_due(self):
        """Get first response due time accounting for pauses"""
        if self.is_paused and self.paused_at:
            current_pause = timezone.now() - self.paused_at
            return self.first_response_due + self.total_paused_time + current_pause
        return self.first_response_due + self.total_paused_time
    
    @property
    def effective_resolution_due(self):
        """Get resolution due time accounting for pauses"""
        if self.is_paused and self.paused_at:
            current_pause = timezone.now() - self.paused_at
            return self.resolution_due + self.total_paused_time + current_pause
        return self.resolution_due + self.total_paused_time


class SLAEscalation(BaseEntity):
    """
    Defines escalation rules for SLA breaches
    """

    ESCALATION_TYPE_CHOICES = [
        ('warning', 'Warning'),
        ('escalation', 'Escalation'),
        ('breach', 'Breach'),
    ]
    REMINDER_TYPES = [
        ('first_response', 'First Response Reminder'),
        ('next_response', 'Next Response Reminder'),
        ('resolution', 'Resolution Reminder'),
    ]
    ESCALATION_TYPES = [
        ('first_response', 'First Response Escalation'),
        ('next_response', 'Next Response Escalation'),
        ('resolution', 'Resolution Escalation'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sla_policy = models.ForeignKey(SLAPolicy, on_delete=models.CASCADE, related_name='escalations')
    escalation_type = models.CharField(max_length=20, choices=ESCALATION_TYPE_CHOICES)
    
    # Trigger timing (percentage of SLA time)
    trigger_percentage = models.PositiveIntegerField(
        help_text="Percentage of SLA time when escalation triggers (e.g., 80)"
    )
    
    # Escalation actions
    notify_agent = models.BooleanField(default=True)
    notify_supervisor = models.BooleanField(default=False)
    notify_manager = models.BooleanField(default=False)
    
    # Recipients
    escalation_users = models.ManyToManyField('users.Users', blank=True)
    escalation_emails = models.TextField(
        blank=True, 
        help_text="Comma-separated email addresses"
    )
    
    # Message templates
    email_subject = models.CharField(max_length=200)
    email_body = models.TextField()
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'sla_escalations'
        unique_together = ['sla_policy', 'escalation_type', 'trigger_percentage']
        
    def __str__(self):
        return f"{self.sla_policy.name} - {self.escalation_type} at {self.trigger_percentage}%"


class SLAEscalationLog(BaseEntity):
    """
    Logs escalation actions 
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sla_tracker = models.ForeignKey(SLATracker, on_delete=models.CASCADE)
    escalation = models.ForeignKey(SLAEscalation, on_delete=models.CASCADE)
    
    escalated_at = models.DateTimeField(auto_now_add=True)
    email_sent = models.BooleanField(default=False)
    recipients = models.TextField()  # Store actual recipients
    
    class Meta:
        db_table = 'sla_escalation_logs'
        
    def __str__(self):
        return f"Escalation for Ticket #{self.sla_tracker.ticket.id} at {self.escalated_at}"

