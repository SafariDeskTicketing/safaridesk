from django.db import models
from django.contrib.auth.models import User, Group
from django.core.validators import MinValueValidator
from django.utils import timezone
import uuid

from shared.models.BaseModel import BaseEntity


class SLAConfiguration(BaseEntity):
    """
    Per-business SLA configuration settings with business hours
    """
    sla_enabled = models.BooleanField(
        default=False,
        help_text="Enable or disable SLA tracking for this business"
    )
    
    # Business Hours - Weekly Schedule
    monday_enabled = models.BooleanField(default=True, null=True, blank=True)
    monday_start = models.TimeField(default='09:00', null=True, blank=True)
    monday_end = models.TimeField(default='17:00', null=True, blank=True)
    
    tuesday_enabled = models.BooleanField(default=True, null=True, blank=True)
    tuesday_start = models.TimeField(default='09:00', null=True, blank=True)
    tuesday_end = models.TimeField(default='17:00', null=True, blank=True)
    
    wednesday_enabled = models.BooleanField(default=True, null=True, blank=True)
    wednesday_start = models.TimeField(default='09:00', null=True, blank=True)
    wednesday_end = models.TimeField(default='17:00', null=True, blank=True)
    
    thursday_enabled = models.BooleanField(default=True, null=True, blank=True)
    thursday_start = models.TimeField(default='09:00', null=True, blank=True)
    thursday_end = models.TimeField(default='17:00', null=True, blank=True)
    
    friday_enabled = models.BooleanField(default=True, null=True, blank=True)
    friday_start = models.TimeField(default='09:00', null=True, blank=True)
    friday_end = models.TimeField(default='17:00', null=True, blank=True)
    
    saturday_enabled = models.BooleanField(default=False, null=True, blank=True)
    saturday_start = models.TimeField(default='09:00', null=True, blank=True)
    saturday_end = models.TimeField(default='17:00', null=True, blank=True)
    
    sunday_enabled = models.BooleanField(default=False, null=True, blank=True)
    sunday_start = models.TimeField(default='09:00', null=True, blank=True)
    sunday_end = models.TimeField(default='17:00', null=True, blank=True)
    
    # Additional Options
    pause_outside_hours = models.BooleanField(
        default=False,
        null=True,
        blank=True,
        help_text="Pause SLA timer outside business hours"
    )
    exclude_holidays = models.BooleanField(
        default=True,
        null=True,
        blank=True,
        help_text="Exclude holidays from SLA calculations"
    )
    
    class Meta:
        db_table = 'sla_configuration'
        verbose_name = "SLA Configuration"
        verbose_name_plural = "SLA Configurations"
        
    def __str__(self):
        return f"SLA Config for {self.business.name if self.business else 'Unknown'} - {'Enabled' if self.sla_enabled else 'Disabled'}"


class SLA(BaseEntity):
    """Main SLA configuration model"""

    OPERATIONAL_HOURS_CHOICES = [
        ('calendar', 'Calendar Hours (24 hrs x 7 days)'),
        ('business', 'Business Hours'),
        ('custom', 'Custom Hours'),
    ]

    EVALUATION_CHOICES = [
        ('ticket_creation', 'Ticket creation time'),
        ('conditions_met', 'Time when conditions are met'),
    ]

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    operational_hours = models.CharField(
        max_length=20,
        choices=OPERATIONAL_HOURS_CHOICES,
        default='calendar',
        blank=True,
        null=True
    )
    evaluation_method = models.CharField(
        max_length=20,
        choices=EVALUATION_CHOICES,
        default='ticket_creation',
        blank=True,
        null=True
    )
    is_active = models.BooleanField(default=True)
    auto_apply = models.BooleanField(
        default=False,
        help_text="Automatically apply this policy to new tickets with matching priority"
    )

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "SLA"
        verbose_name_plural = "SLAs"


class SLACondition(BaseEntity):
    """SLA conditions that determine when SLA applies"""

    CONDITION_TYPES = [
        ('priority', 'Priority'),
        ('category', 'Category'),
        ('department', 'Department'),
        ('customer_type', 'Customer Type'),
        ('tag', 'Tag'),
        ('custom_field', 'Custom Field'),
    ]

    OPERATORS = [
        ('equals', 'Equals'),
        ('not_equals', 'Not Equals'),
        ('contains', 'Contains'),
        ('not_contains', 'Does Not Contain'),
        ('starts_with', 'Starts With'),
        ('ends_with', 'Ends With'),
    ]

    sla = models.ForeignKey(SLA, on_delete=models.CASCADE, related_name='conditions')
    condition_type = models.CharField(max_length=50, choices=CONDITION_TYPES, blank=True, null=True)
    operator = models.CharField(max_length=20, choices=OPERATORS, default='equals', blank=True, null=True)
    value = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.sla.name} - {self.condition_type} {self.operator} {self.value}"

    class Meta:
        verbose_name = "SLA Condition"
        verbose_name_plural = "SLA Conditions"


class SLATarget(BaseEntity):
    """SLA targets for different priority levels"""

    PRIORITY_CHOICES = [
        ('urgent', 'Urgent'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]

    TIME_UNITS = [
        ('minutes', 'Minutes'),
        ('hours', 'Hours'),
        ('days', 'Days'),
        ('weeks', 'Weeks'),
    ]

    sla = models.ForeignKey(SLA, on_delete=models.CASCADE, related_name='targets')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES)

    # Time to first response
    first_response_time = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    first_response_unit = models.CharField(max_length=10, choices=TIME_UNITS, default='hours')

    # Time to next response (optional)
    next_response_time = models.PositiveIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    next_response_unit = models.CharField(max_length=10, choices=TIME_UNITS, default='hours', blank=True)

    # Time to resolution
    resolution_time = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    resolution_unit = models.CharField(max_length=10, choices=TIME_UNITS, default='days')

    # Operational hours for this target
    operational_hours = models.CharField(
        max_length=20,
        choices=SLA.OPERATIONAL_HOURS_CHOICES,
        default='calendar'
    )

    # Reminder and escalation toggles
    reminder_enabled = models.BooleanField(default=False)
    escalation_enabled = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.sla.name} - {self.priority}"

    class Meta:
        verbose_name = "SLA Target"
        verbose_name_plural = "SLA Targets"


class SLAReminder(BaseEntity):
    """SLA reminder configurations"""

    REMINDER_TYPES = [
        ('first_response', 'First Response Reminder'),
        ('next_response', 'Next Response Reminder'),
        ('resolution', 'Resolution Reminder'),
    ]

    TIME_UNITS = [
        ('minutes', 'Minutes'),
        ('hours', 'Hours'),
        ('days', 'Days'),
    ]

    sla_target = models.ForeignKey(SLATarget, on_delete=models.CASCADE, related_name='reminders')
    reminder_type = models.CharField(max_length=20, choices=REMINDER_TYPES)

    # When to send reminder (before target breach)
    time_before = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    time_unit = models.CharField(max_length=10, choices=TIME_UNITS, default='minutes')

    # Who to notify
    notify_groups = models.ManyToManyField(Group, blank=True, related_name='sla_reminders')
    notify_agents = models.ManyToManyField("users.Users", blank=True, related_name='sla_reminders')

    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.sla_target} - {self.reminder_type} ({self.time_before} {self.time_unit})"

    class Meta:
        verbose_name = "SLA Reminder"
        verbose_name_plural = "SLA Reminders"


class SLAEscalations(BaseEntity):
    """SLA escalation configurations with multiple levels"""

    ESCALATION_TYPES = [
        ('first_response', 'First Response Escalation'),
        ('next_response', 'Next Response Escalation'),
        ('resolution', 'Resolution Escalation'),
        ('overdue', 'Overdue Alert'),
    ]

    TIME_UNITS = [
        ('minutes', 'Minutes'),
        ('hours', 'Hours'),
        ('days', 'Days'),
    ]

    sla_target = models.ForeignKey(SLATarget, on_delete=models.CASCADE, related_name='escalations')
    escalation_type = models.CharField(max_length=20, choices=ESCALATION_TYPES)
    level = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])

    # When to trigger escalation
    trigger_time = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    trigger_unit = models.CharField(max_length=10, choices=TIME_UNITS, default='minutes')

    # Who to escalate to
    escalate_to_groups = models.ManyToManyField(Group, blank=True, related_name='sla_escalations')
    escalate_to_agents = models.ManyToManyField("users.Users", blank=True, related_name='sla_escalations')

    # Reminder settings
    reminder_time = models.PositiveIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    reminder_unit = models.CharField(max_length=10, choices=TIME_UNITS, default='minutes', blank=True)

    # Email settings
    email_subject = models.CharField(max_length=255, blank=True, null=True)
    email_body = models.TextField(blank=True, null=True)

    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.sla_target} - {self.escalation_type} Level {self.level}"

    class Meta:
        verbose_name = "SLA Escalation"
        verbose_name_plural = "SLA Escalations"
        ordering = ['escalation_type', 'level']


class SLAEscalationNotificationLog(BaseEntity):
    """Track SLA escalation notifications that were sent."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(
        "tenant.Ticket",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sla_escalation_logs'
    )
    task = models.ForeignKey(
        "tenant.Task",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sla_escalation_logs'
    )
    sla_target = models.ForeignKey(SLATarget, on_delete=models.SET_NULL, null=True, blank=True, related_name='escalation_logs')
    escalation = models.ForeignKey(
        SLAEscalations,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='logs'
    )
    violation_type = models.CharField(max_length=20, choices=SLAEscalations.ESCALATION_TYPES)
    target_time = models.DateTimeField()
    breach_time = models.DateTimeField()
    recipients = models.TextField(blank=True, default='')
    email_sent = models.BooleanField(default=False)

    class Meta:
        verbose_name = "SLA Escalation Notification Log"
        verbose_name_plural = "SLA Escalation Notification Logs"
        ordering = ['-breach_time']
        db_table = 'sla_escalation_notification_logs'

    def __str__(self):
        subject = self.ticket or self.task or self.sla_target
        return f"{subject} - {self.violation_type}"


class BusinessHoursx(BaseEntity):
    """Business hours configuration for SLA calculations"""

    DAYS_OF_WEEK = [
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    ]

    name = models.CharField(max_length=100)
    day_of_week = models.IntegerField(choices=DAYS_OF_WEEK)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_working_day = models.BooleanField(default=True)

    def __str__(self):
        day_name = dict(self.DAYS_OF_WEEK)[self.day_of_week]
        if self.is_working_day:
            return f"{self.name} - {day_name}: {self.start_time} to {self.end_time}"
        else:
            return f"{self.name} - {day_name}: Non-working day"

    class Meta:
        verbose_name = "Business Hours"
        verbose_name_plural = "Business Hours"


class Holidays(BaseEntity):
    """Holiday configuration for SLA calculations"""

    name = models.CharField(max_length=100)
    date = models.DateField()
    is_recurring = models.BooleanField(default=False)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} - {self.date}"

    class Meta:
        verbose_name = "Holiday"
        verbose_name_plural = "Holidays"


class SLAViolation(models.Model):
    """Track SLA violations"""

    VIOLATION_TYPES = [
        ('first_response', 'First Response Breach'),
        ('next_response', 'Next Response Breach'),
        ('resolution', 'Resolution Breach'),
    ]

    ticket = models.ForeignKey("tenant.Ticket", on_delete=models.CASCADE, related_name='sla_violations')
    sla_target = models.ForeignKey(SLATarget, on_delete=models.CASCADE)
    violation_type = models.CharField(max_length=20, choices=VIOLATION_TYPES)

    target_time = models.DateTimeField()  # When the SLA should have been met
    actual_time = models.DateTimeField(null=True, blank=True)  # When it was actually met (if at all)
    breach_time = models.DateTimeField()  # When the breach occurred

    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"SLA Violation - {self.ticket} - {self.violation_type}"

    class Meta:
        verbose_name = "SLA Violation"
        verbose_name_plural = "SLA Violations"
