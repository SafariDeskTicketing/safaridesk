import logging
import uuid
from datetime import timedelta

from django.db import models

logger = logging.getLogger(__name__)
from django.db.models import F, Q
from django.db.models.functions import Lower, Trim
from django.urls import reverse
from django.utils import timezone
import os

from shared.models.BaseModel import BaseEntity
from tenant.models import Department
from tenant.models.SlaXModel import SLA, SLATarget, BusinessHoursx, Holidays # Updated import
from tenant.services.labels import get_label_text_color, normalize_label_color, pick_label_color
from util.Constants import TICKET_ACTIVITY_CHOICES, PRIORITY_CHOICES


class Label(BaseEntity):
    name = models.CharField(max_length=50)
    description = models.TextField(blank=True, default="")
    color = models.CharField(max_length=7, default="#B60205")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Label"
        verbose_name_plural = "Labels"
        db_table = "labels"
        ordering = ["name", "-id"]
        constraints = [
            models.UniqueConstraint(
                F("business"),
                Lower(Trim("name")),
                condition=Q(business__isnull=False),
                name="uniq_label_business_name",
            )
        ]

    def save(self, *args, **kwargs):
        if self.name:
            self.name = self.name.strip()
        if self.description:
            self.description = self.description.strip()
        self.color = normalize_label_color(self.color or pick_label_color(self.name))
        super().save(*args, **kwargs)

    @property
    def text_color(self) -> str:
        return get_label_text_color(self.color)


class TicketCategories(BaseEntity):
    name = models.CharField(max_length=50)
    description = models.TextField()
    is_active = models.BooleanField(default=True)
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='ticket_categories'
    )
    
    class Meta:
        verbose_name = "Ticket Category"
        verbose_name_plural = "Ticket Categories"
        db_table = "ticket_categories"
        ordering = ['-id']
        constraints = [
            models.UniqueConstraint(
                F('business'),
                Lower(Trim('name')),
                condition=Q(business__isnull=False),
                name='uniq_ticket_category_business_name',
            )
        ]

    def save(self, *args, **kwargs):
        if self.name:
            self.name = self.name.strip()
        if self.description:
            self.description = self.description.strip()
        super().save(*args, **kwargs)

class Ticket(BaseEntity):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('pending', 'Pending'),
        ('on_hold', 'On Hold'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]

    TICKET_SOURCE_CHOICES = [
        ('email', 'Email'),
        ('web', 'Web/Portal'),
        ('phone', 'Phone'),
        ('chat', 'Live Chat'),
        ('chatbot', 'AI Chatbot'),
        ('api', 'API/Integrations'),
        ('internal', 'Internal/Staff-created'),
        ('customer_portal', 'Customer Portal'),
        ('whatsapp', 'WhatsApp'),
        ('slack', 'Slack'),
        ('telegram', 'Telegram'),
    ]


    # Basic ticket information
    title = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    category = models.ForeignKey(TicketCategories, on_delete=models.SET_NULL, null=True, blank=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, null=True, blank=True)

    creator_name = models.CharField(max_length=200, blank=True, null=True)
    creator_email = models.CharField(max_length=200, blank=True, null=True)
    creator_phone = models.CharField(max_length=200, blank=True, null=True)
    contact = models.ForeignKey(
        "tenant.Contact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets",
        help_text="Linked contact/customer for this ticket",
    )
    ticket_id = models.CharField(max_length=255, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    # ticket_ref = models.UUIDField(default=uuid.uuid4, editable=True, null=True, blank=True)

    # Status and priority
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium', null=True, blank=True,)

    # SLA
    sla = models.ForeignKey("tenant.SLA", on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    # sla_target = models.ForeignKey("tenant.SLATarget", on_delete=models.SET_NULL, null=True, blank=True)

    assigned_to = models.ForeignKey(
        "users.Users",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tickets'
    )

    # SLA related fields
    customer_tier = models.CharField(
        max_length=20,
        choices=[
            ('premium', 'Premium'),
            ('standard', 'Standard'),
            ('basic', 'Basic'),
        ],
        default='standard',
        help_text="Customer tier for SLA calculation"
    )

    # Source field
    source = models.CharField(
        max_length=20,
        choices=TICKET_SOURCE_CHOICES,
        default='web',
        help_text="How the ticket was created"
    )

    # Timestamps
    due_date = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    first_response_at = models.DateTimeField(null=True, blank=True)

    # Additional fields
    tags = models.CharField(max_length=200, blank=True, help_text="Comma-separated tags")
    labels = models.ManyToManyField("tenant.Label", blank=True, related_name="tickets")
    is_public = models.BooleanField(default=True)
    is_sla_paused = models.BooleanField(default=False, help_text="Indicates if SLA calculation is currently paused for this ticket")

    # Merge metadata
    is_merged = models.BooleanField(default=False, help_text="Indicates if this ticket was merged into another ticket")
    merged_into = models.ForeignKey(
        "tenant.Ticket",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="merged_children",
        help_text="Primary ticket this ticket was merged into"
    )
    merged_by = models.ForeignKey(
        "users.Users",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="merged_tickets",
        help_text="User who performed the merge"
    )
    merged_at = models.DateTimeField(null=True, blank=True, help_text="When the ticket was merged")
    merge_note = models.TextField(null=True, blank=True, help_text="Optional note about the merge")
    
    # Archive and delete flags
    is_archived = models.BooleanField(default=False, help_text="Indicates if ticket is archived")
    is_deleted = models.BooleanField(default=False, help_text="Indicates if ticket is soft deleted")

    # Unread status tracking
    is_opened = models.BooleanField(default=False, help_text="True once any agent has viewed this ticket")
    has_new_reply = models.BooleanField(default=False, help_text="True when customer reply received; cleared on view")

    # CSAT
    csat_score = models.IntegerField(null=True, blank=True, help_text="Customer satisfaction score (0–10) from CSAT survey")


    class Meta:
        ordering = ['-id']
        verbose_name = 'Ticket'
        db_table = "tickets"
        verbose_name_plural = 'Tickets'

    def __str__(self):
        return f"#{self.ticket_id} - {self.title}"

    @property
    def is_overdue(self):
        """Check if ticket is overdue"""
        if self.due_date and self.status not in ['closed']:
            return timezone.now() > self.due_date
        return False

    @property
    def time_since_created(self):
        """Get time since ticket was created"""
        return timezone.now() - self.created_at

    def get_tags_list(self):
        """Return tags as a list"""
        return [tag.strip() for tag in self.tags.split(',') if tag.strip()]

    def get_sla(self):
        """
        Fetch the SLA for the ticket.
        """
        return self.sla

    def get_applicable_sla_target(self):
        """
        Get the SLA target that applies to this ticket's priority.
        Requires the SLA to be set on the ticket.
        """
        if not self.sla:
            return None

        try:
            sla_target = self.sla.targets.filter(
                priority=self.priority
            ).first()

            # Fallback to 'normal' priority if current priority not found
            if not sla_target and self.priority != 'normal':
                sla_target = self.sla.targets.filter(priority='normal').first()

            return sla_target
        except Exception as e:
            logger.warning("sla_target_error", extra={"ticket_id": self.ticket_id, "error": str(e)})
            return None

    def calculate_sla_due_times(self):
        """
        Calculate SLA due times based on the applicable SLA target.
        """
        sla_target = self.get_applicable_sla_target()
        if not sla_target:
            return None

        # Use ticket creation time as base time
        base_time = self.created_at
        # If SLA evaluation method is 'conditions_met', you might need to track
        # when conditions were actually met. For simplicity, we'll use creation time.
        if sla_target.sla.evaluation_method == 'conditions_met':
            # Placeholder: In a real system, you'd have a field like `conditions_met_at`
            # For now, we'll stick to created_at or a more appropriate timestamp.
            pass

        # Calculate first response due time
        first_response_due = self._calculate_due_time(
            base_time,
            sla_target.first_response_time,
            sla_target.first_response_unit,
            sla_target.operational_hours
        )

        # Calculate resolution due time
        resolution_due = self._calculate_due_time(
            base_time,
            sla_target.resolution_time,
            sla_target.resolution_unit,
            sla_target.operational_hours
        )

        # Calculate next response due time if applicable
        next_response_due = None
        if sla_target.next_response_time:
            next_response_due = self._calculate_due_time(
                self.first_response_at or base_time, # Base on first response or creation
                sla_target.next_response_time,
                sla_target.next_response_unit,
                sla_target.operational_hours
            )

        return {
            'first_response_due': first_response_due,
            'next_response_due': next_response_due,
            'resolution_due': resolution_due,
            'sla_target': sla_target
        }

    def _calculate_due_time(self, start_time, duration, unit, operational_hours):
        """
        Calculate due time considering operational hours.
        """
        # Convert duration to minutes for easier calculation
        total_minutes = self._convert_to_minutes(duration, unit)

        # Simple calculation for calendar hours
        if operational_hours == 'calendar':
            return start_time + timedelta(minutes=total_minutes)

        # For business hours, calculate considering working hours only
        elif operational_hours == 'business':
            return self._add_business_time(start_time, total_minutes)

        # For custom hours, implement your custom logic
        else:
            return self._add_business_time(start_time, total_minutes)

    def _convert_to_minutes(self, duration, unit):
        """Convert duration to minutes and cap to a reasonable maximum to prevent OverflowError."""
        # Define a maximum reasonable SLA duration (e.g., 5 years in minutes)
        MAX_SLA_MINUTES = 5 * 365 * 24 * 60  # Approximately 2,628,000 minutes

        if unit == 'minutes':
            total_minutes = duration
        elif unit == 'hours':
            total_minutes = duration * 60
        elif unit == 'days':
            total_minutes = duration * 24 * 60
        elif unit == 'weeks':
            total_minutes = duration * 7 * 24 * 60
        else:
            total_minutes = duration * 60  # Default to hours

        # Cap the total_minutes to prevent OverflowError
        if total_minutes > MAX_SLA_MINUTES:
            return MAX_SLA_MINUTES
        return total_minutes

    def _add_business_time(self, start_time, minutes_to_add):
        """
        Add business minutes to a datetime, considering only business hours
        """
        from tenant.models import BusinessHoursx, Holidays

        current_time = start_time
        remaining_minutes = minutes_to_add

        # Get business hours configuration
        business_hours = self._get_business_hours_config()
        if not business_hours:
            # Fallback to calendar time if no business hours configured
            return start_time + timedelta(minutes=minutes_to_add)

        # Get holidays
        holidays = set(Holidays.objects.filter(is_active=True).values_list('date', flat=True))

        while remaining_minutes > 0:
            current_date = current_time.date()
            current_weekday = current_time.weekday()

            # Check if current day is a holiday
            if current_date in holidays:
                # Move to next day
                current_time = (current_time + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                continue

            # Get business hours for current day
            day_hours = business_hours.get(current_weekday)
            if not day_hours or not day_hours['is_working_day']:
                # Move to next day
                current_time = (current_time + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                continue

            # Check if current time is before business hours
            current_time_only = current_time.time()
            if current_time_only < day_hours['start_time']:
                current_time = current_time.replace(
                    hour=day_hours['start_time'].hour,
                    minute=day_hours['start_time'].minute,
                    second=0,
                    microsecond=0
                )

            # Check if current time is after business hours
            elif current_time_only >= day_hours['end_time']:
                # Move to next day
                current_time = (current_time + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                continue

            # Calculate remaining minutes in current business day
            end_of_business = current_time.replace(
                hour=day_hours['end_time'].hour,
                minute=day_hours['end_time'].minute,
                second=0,
                microsecond=0
            )

            minutes_until_end = int((end_of_business - current_time).total_seconds() / 60)

            if remaining_minutes <= minutes_until_end:
                # Can complete within current business day
                return current_time + timedelta(minutes=remaining_minutes)
            else:
                # Use all remaining time in current business day and continue to next
                remaining_minutes -= minutes_until_end
                current_time = (current_time + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )

        return current_time

    def _get_business_hours_config(self):
        """
        Get business hours configuration
        Returns dict with weekday as key and hours info as value
        """
        from tenant.models import BusinessHoursx

        try:
            # Filter business hours by the ticket's associated business
            # This assumes BusinessHoursx is linked to a business via BaseEntity
            if not self.business:
                return None # No business associated with ticket, cannot get business hours

            hours_config = {}
            business_hours = BusinessHoursx.objects.filter(business=self.business)

            for hour in business_hours:
                hours_config[hour.day_of_week] = {
                    'start_time': hour.start_time,
                    'end_time': hour.end_time,
                    'is_working_day': hour.is_working_day
                }

            return hours_config
        except Exception as e:
            logger.warning("business_hours_config_error", extra={"error": str(e)})
            return None

    def _format_duration(self, duration):
        """
        Format a timedelta into a human-readable string
        """
        total_seconds = int(duration.total_seconds())

        if total_seconds < 60:
            return f"{total_seconds} seconds"

        minutes = total_seconds // 60
        hours = minutes // 60
        days = hours // 24

        if days > 0:
            remaining_hours = hours % 24
            remaining_minutes = minutes % 60
            return f"{days}d {remaining_hours}h {remaining_minutes}m"
        elif hours > 0:
            remaining_minutes = minutes % 60
            return f"{hours}h {remaining_minutes}m"
        else:
            return f"{minutes}m"

    def get_system_hours_elapsed(self, end_time=None):
        """
        Calculate total system hours elapsed (calendar time), excluding paused time
        """
        end_time = end_time or timezone.now()

        # If SLA is paused, don't count time from pause onwards
        if self.is_sla_paused:
            # In a full implementation, you'd track pause start times
            # For now, return 0 if paused
            return {
                'total_seconds': 0,
                'total_minutes': 0,
                'total_hours': 0.0,
                'total_days': 0.0,
                'formatted': '0m'
            }

        total_elapsed = end_time - self.created_at

        return {
            'total_seconds': int(total_elapsed.total_seconds()),
            'total_minutes': int(total_elapsed.total_seconds() / 60),
            'total_hours': round(total_elapsed.total_seconds() / 3600, 2),
            'total_days': round(total_elapsed.total_seconds() / (24 * 3600), 2),
            'formatted': self._format_duration(total_elapsed)
        }

    def get_business_hours_elapsed(self, end_time=None):
        """
        Calculate business hours elapsed excluding weekends, holidays, non-business hours, and paused time
        """
        from tenant.models import BusinessHoursx, Holidays

        end_time = end_time or timezone.now()
        start_time = self.created_at

        # If SLA is paused, don't count time from pause onwards
        if self.is_sla_paused:
            # In a full implementation, you'd track pause start times
            # For now, return 0 if paused
            return {
                'total_seconds': 0,
                'total_minutes': 0,
                'total_hours': 0.0,
                'total_days': 0.0,
                'formatted': '0m'
            }

        # Get business hours configuration
        business_hours = self._get_business_hours_config()
        if not business_hours:
            # Fallback to system hours if no business hours configured
            return self.get_system_hours_elapsed(end_time)

        # Get holidays
        holidays = set(Holidays.objects.values_list('date', flat=True))

        total_business_minutes = 0
        current_time = start_time

        while current_time < end_time:
            current_date = current_time.date()
            current_weekday = current_time.weekday()

            # Check if current day is a holiday
            if current_date in holidays:
                # Move to next day
                current_time = (current_time + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                continue

            # Get business hours for current day
            day_hours = business_hours.get(current_weekday)
            if not day_hours or not day_hours['is_working_day']:
                # Move to next day
                current_time = (current_time + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                continue

            # Calculate business hours for this day
            day_start = current_time.replace(
                hour=day_hours['start_time'].hour,
                minute=day_hours['start_time'].minute,
                second=0,
                microsecond=0
            )
            day_end = current_time.replace(
                hour=day_hours['end_time'].hour,
                minute=day_hours['end_time'].minute,
                second=0,
                microsecond=0
            )

            # Determine the actual start and end times for calculation
            period_start = max(current_time, day_start)
            period_end = min(end_time, day_end)

            # Only count if period_start is before period_end
            if period_start < period_end:
                business_minutes = int((period_end - period_start).total_seconds() / 60)
                total_business_minutes += business_minutes

            # Move to next day
            current_time = (current_time + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )

        total_seconds = total_business_minutes * 60

        return {
            'total_seconds': total_seconds,
            'total_minutes': total_business_minutes,
            'total_hours': round(total_business_minutes / 60, 2),
            'total_days': round(total_business_minutes / (8 * 60), 2),  # Assuming 8-hour business day
            'formatted': self._format_duration(timedelta(seconds=total_seconds))
        }

    def escalate(self, reason=""):
        """
        Escalate the ticket. This is a placeholder for actual escalation logic.
        """
        logger.info("ticket_escalated", extra={"ticket_id": self.ticket_id, "reason": reason})
        # Here you would add logic for:
        # - Notifying higher-priority teams/users
        # - Changing ticket status (e.g., to 'escalated')
        # - Logging the escalation event
        # - Potentially creating a new task or sub-ticket

    def sla_analysis(self):
        """
        Perform a comprehensive SLA analysis for the ticket.
        This combines aspects of get_sla_status and get_sla_performance_metrics.
        """
        sla = self.get_sla()
        if not sla:
            return {
                'has_sla': False,
                'message': 'No applicable SLA found for this ticket.'
            }

        sla_due_times = self.calculate_sla_due_times()
        sla_target = sla_due_times.get('sla_target') if sla_due_times else None

        business_hours_elapsed_data = self.get_business_hours_elapsed()
        system_hours_elapsed_data = self.get_system_hours_elapsed()

        analysis_result = {
            'has_sla': True,
            'sla_name': sla.name,
            'sla_description': sla.description,
            'is_active': sla.is_active,
            'evaluation_method': sla.evaluation_method,
            'current_ticket_status': self.status,
            'is_overdue': self.is_overdue,
            'time_since_created': self.time_since_created.total_seconds() / 60, # in minutes
            'time_since_created_formatted': self._format_duration(self.time_since_created),
            'is_sla_paused': self.is_sla_paused,
            'business_hours_elapsed': business_hours_elapsed_data['total_hours'],
            'system_hours_elapsed': system_hours_elapsed_data['total_hours'],
        }

        if sla_target:
            # Calculate total business hours for resolution
            total_business_minutes_for_resolution = self._convert_to_minutes(
                sla_target.resolution_time,
                sla_target.resolution_unit
            )
            analysis_result['total_business_hours_for_resolution'] = round(total_business_minutes_for_resolution / 60, 2)

            # Calculate total system hours for resolution (assuming calendar for system hours)
            total_system_minutes_for_resolution = self._convert_to_minutes(
                sla_target.resolution_time,
                sla_target.resolution_unit
            )
            analysis_result['total_system_hours_for_resolution'] = round(total_system_minutes_for_resolution / 60, 2)

        return analysis_result

    def mark_first_response(self):
        """Mark when first response was provided"""
        if not self.first_response_at:
            self.first_response_at = timezone.now()
            self.save()
            logger.info("ticket_first_response", extra={"ticket_id": self.ticket_id})

    def mark_resolved(self):
        """Mark ticket as closed"""
        if self.status != 'closed':
            self.status = 'closed'
            self.resolved_at = timezone.now()
            self.save()
            logger.info("ticket_closed", extra={"ticket_id": self.ticket_id})

    def check_sla_violations(self):
        """
        Check for SLA violations and create violation records.
        """
        from tenant.models import SLAViolation

        sla_due_times = self.calculate_sla_due_times()
        if not sla_due_times:
            return []

        violations = []
        current_time = timezone.now()

        # Check first response violation
        if (not self.first_response_at and
                sla_due_times['first_response_due'] and
                current_time > sla_due_times['first_response_due']):

            violation, created = SLAViolation.objects.get_or_create(
                ticket=self,
                sla_target=sla_due_times['sla_target'],
                violation_type='first_response',
                defaults={
                    'target_time': sla_due_times['first_response_due'],
                    'breach_time': current_time,
                }
            )
            if created:
                violations.append(violation)

        # Check resolution violation
        if (self.status != 'closed' and
                sla_due_times['resolution_due'] and
                current_time > sla_due_times['resolution_due']):

            violation, created = SLAViolation.objects.get_or_create(
                ticket=self,
                sla_target=sla_due_times['sla_target'],
                violation_type='resolution',
                defaults={
                    'target_time': sla_due_times['resolution_due'],
                    'breach_time': current_time,
                }
            )
            if created:
                violations.append(violation)

        return violations

    def get_sla_status(self):
        """
        Get comprehensive SLA status for this ticket.
        """
        sla_due_times = self.calculate_sla_due_times()
        if not sla_due_times:
            return {
                'has_sla': False,
                'message': 'No applicable SLA found'
            }

        current_time = timezone.now()

        # First response status
        first_response_status = 'pending'
        if self.first_response_at:
            if self.first_response_at <= sla_due_times['first_response_due']:
                first_response_status = 'met'
            else:
                first_response_status = 'breached'
        elif sla_due_times['first_response_due'] and current_time > sla_due_times['first_response_due']:
            first_response_status = 'breached'

        # Resolution status
        resolution_status = 'pending'
        if self.resolved_at:
            if self.resolved_at <= sla_due_times['resolution_due']:
                resolution_status = 'met'
            else:
                resolution_status = 'breached'
        elif sla_due_times['resolution_due'] and current_time > sla_due_times['resolution_due']:
            resolution_status = 'breached'

        return {
            'has_sla': True,
            'sla_name': sla_due_times['sla_target'].sla.name,
            'priority': sla_due_times['sla_target'].priority,
            'first_response': {
                'status': first_response_status,
                'due_time': sla_due_times['first_response_due'],
                'completed_time': self.first_response_at,
            },
            'resolution': {
                'status': resolution_status,
                'due_time': sla_due_times['resolution_due'],
                'completed_time': self.resolved_at,
            },
            'next_response': {
                'due_time': sla_due_times['next_response_due'],
            } if sla_due_times['next_response_due'] else None
        }

    # @property
    # def is_sla_breached(self):
    #     """
    #     Quick check if any SLA is currently breached.
    #     """
    #     status = self.get_sla_status()
    #     if not status['has_sla']:
    #         return False

    #     return (status['first_response']['status'] == 'breached' or
    #             status['resolution']['status'] == 'breached')

    @property
    def is_sla_breached(self):
        """
        Quick check if any SLA is currently breached.
        Returns False if ticket is closed.
        """
        # ✅ If ticket is already closed, SLA breach no longer applies
        if self.status == "closed":
            return False

        status = self.get_sla_status()
        if not status['has_sla']:
            return False

        return (
            status['first_response']['status'] == 'breached'
            or status['resolution']['status'] == 'breached'
        )


    def pause_sla(self, reason=""):
        """
        Pause SLA for this ticket.
        """
        if not self.is_sla_paused:
            self.is_sla_paused = True
            # In a full implementation, you'd also store pause start time
            # and adjust due dates when resumed.
            self.save()
            logger.info("ticket_sla_paused", extra={"ticket_id": self.ticket_id, "reason": reason})

    def resume_sla(self):
        """
        Resume SLA for this ticket.
        """
        if self.is_sla_paused:
            self.is_sla_paused = False
            # In a full implementation, you'd calculate elapsed paused time
            # and extend due dates accordingly.
            self.save()
            logger.info("ticket_sla_resumed", extra={"ticket_id": self.ticket_id})


class TicketEmbedding(BaseEntity):
    """
    Stores vector embeddings for tickets for duplicate detection.
    The pgvector column is added by migration for indexed similarity search.
    """
    ticket = models.OneToOneField(
        Ticket,
        on_delete=models.CASCADE,
        related_name='embedding',
        db_index=True,
    )
    embedding = models.JSONField(help_text="Vector embedding stored as array [dim1, dim2, ...]")
    embedding_model = models.CharField(max_length=100, default='gemini-embedding-001')
    embedding_version = models.CharField(max_length=50, blank=True)
    generated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ticket_embeddings"
        verbose_name = "Ticket Embedding"
        verbose_name_plural = "Ticket Embeddings"
        indexes = [
            models.Index(fields=['business', 'ticket']),
        ]

    def __str__(self):
        return f"Embedding for Ticket #{self.ticket.ticket_id}"


class TicketComment(BaseEntity):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    # author = models.ForeignKey(
    #     "users.Users",
    #     on_delete=models.CASCADE,
    #     related_name='ticket_comments'
    # )
    author = models.ForeignKey(
        "users.Users",
        on_delete=models.CASCADE,
        related_name='ticket_comments',
        null=True,  # allow NULL in the database
        blank=True  # allow blank values in forms/admin
    )
    content = models.TextField()
    updated_at = models.DateTimeField(auto_now=True)
    is_internal = models.BooleanField(
        default=False,
        help_text="Internal comments are only visible to staff"
    )
    is_solution = models.BooleanField(
        default=False,
        help_text="Mark this comment as the solution"
    )
    flagged = models.BooleanField(
        default=False,
        help_text="Mark this comment as flagged"
    )
    likes_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of likes for this comment"
    )
    # Email recipient fields - stored when comment is an email reply
    email_to = models.JSONField(
        null=True,
        blank=True,
        help_text="List of TO recipients for email replies"
    )
    email_cc = models.JSONField(
        null=True,
        blank=True,
        help_text="List of CC recipients for email replies"
    )
    email_bcc = models.JSONField(
        null=True,
        blank=True,
        help_text="List of BCC recipients for email replies"
    )

    class Meta:
        ordering = ['created_at']
        db_table = "ticket_comments"
        verbose_name = 'Ticket Comment'
        verbose_name_plural = 'Ticket Comments'
        indexes = [
            models.Index(fields=['ticket', 'created_at']),
            models.Index(fields=['author']),
        ]


    def save(self, *args, **kwargs):
        # Update ticket's updated_at timestamp when comment is added
        super().save(*args, **kwargs)
        # Update ticket without triggering signals to avoid duplicate notifications
        self.ticket.updated_at = timezone.now()
        self.ticket.save(update_fields=['updated_at'])


class TicketCallLog(BaseEntity):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='call_logs',
    )
    contact = models.ForeignKey(
        "tenant.Contact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_call_logs',
    )
    logged_by = models.ForeignKey(
        "users.Users",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ticket_call_logs',
    )
    subject = models.CharField(max_length=200)
    content = models.TextField()
    contact_name = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)
    duration = models.CharField(max_length=50, blank=True)
    is_internal = models.BooleanField(default=True)

    class Meta:
        ordering = ['created_at']
        db_table = "ticket_call_logs"
        verbose_name = 'Ticket Call Log'
        verbose_name_plural = 'Ticket Call Logs'
        indexes = [
            models.Index(fields=['business', 'ticket', 'created_at']),
            models.Index(fields=['logged_by']),
            models.Index(fields=['contact']),
        ]

    def save(self, *args, **kwargs):
        if self.subject:
            self.subject = self.subject.strip()
        if self.contact_name:
            self.contact_name = self.contact_name.strip()
        if self.contact_email:
            self.contact_email = self.contact_email.strip().lower()
        if self.duration:
            self.duration = self.duration.strip()
        super().save(*args, **kwargs)
        self.ticket.updated_at = timezone.now()
        self.ticket.save(update_fields=['updated_at'])


class CommentLike(BaseEntity):
    """Model to track likes on comments"""
    comment = models.ForeignKey(
        TicketComment,
        on_delete=models.CASCADE,
        related_name='likes'
    )
    user = models.ForeignKey(
        "users.Users",
        on_delete=models.CASCADE,
        related_name='comment_likes'
    )

    class Meta:
        db_table = "comment_likes"
        verbose_name = 'Comment Like'
        verbose_name_plural = 'Comment Likes'
        unique_together = ['comment', 'user']  # One like per user per comment

    def __str__(self):
        return f"{self.user.full_name()} liked comment by {self.comment.author.full_name() if self.comment.author else 'Anonymous'}"


class CommentReply(BaseEntity):
    """Model to store replies to comments"""
    parent_comment = models.ForeignKey(
        TicketComment,
        on_delete=models.CASCADE,
        related_name='replies'
    )
    author = models.ForeignKey(
        "users.Users",
        on_delete=models.CASCADE,
        related_name='comment_replies'
    )
    content = models.TextField()
    updated_at = models.DateTimeField(auto_now=True)
    is_internal = models.BooleanField(
        default=False,
        help_text="Internal replies are only visible to staff"
    )
    likes_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of likes for this reply"
    )

    class Meta:
        ordering = ['created_at']
        db_table = "comment_replies"
        verbose_name = 'Comment Reply'
        verbose_name_plural = 'Comment Replies'
        indexes = [
            models.Index(fields=['parent_comment', 'created_at']),
            models.Index(fields=['author']),
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update parent comment's updated_at
        self.parent_comment.save()


class CommentReplyLike(BaseEntity):
    """Model to track likes on comment replies"""
    reply = models.ForeignKey(
        CommentReply,
        on_delete=models.CASCADE,
        related_name='likes'
    )
    user = models.ForeignKey(
        "users.Users",
        on_delete=models.CASCADE,
        related_name='comment_reply_likes'
    )

    class Meta:
        db_table = "comment_reply_likes"
        verbose_name = 'Comment Reply Like'
        verbose_name_plural = 'Comment Reply Likes'
        unique_together = ['reply', 'user']  # One like per user per reply


class TicketAttachment(BaseEntity):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file_url = models.URLField()
    filename = models.CharField(max_length=255, blank=True, help_text="Original filename")
    description = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ['-id']
        db_table = "ticket_attachments"
        verbose_name = 'Ticket Attachment'
        verbose_name_plural = 'Ticket Attachments'

class TicketReplayAttachment(BaseEntity):
    comment = models.ForeignKey(
        "tenant.TicketComment",
        on_delete=models.CASCADE,
        related_name='attachment'
    )
    file_url = models.URLField()
    filename = models.CharField(max_length=255, blank=True, help_text="Original filename")

    class Meta:
        ordering = ['-id']
        db_table = "ticket_comment_attachments"
        verbose_name = 'Ticket Replay Attachment'
        verbose_name_plural = 'Ticket Replay Attachments'


class EmailTicketMapping(BaseEntity):
    """Track which emails belong to which tickets"""
    message_id = models.CharField(max_length=255, unique=True)
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE)
    class Meta:
        db_table = "email_ticket_mappings"
        verbose_name = 'Email Ticket Mapping'
        verbose_name_plural = 'Email Ticket Mappings'



# Optional: Ticket Activity Log Model
class TicketActivity(BaseEntity):

    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='activities'
    )
    user = models.ForeignKey(
        "users.Users",
        on_delete=models.CASCADE,
        related_name='ticket_activities',
        null=True,
        blank=True,
    )
    activity_type = models.CharField(max_length=20, choices=TICKET_ACTIVITY_CHOICES)
    description = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    old_value = models.CharField(max_length=200, blank=True)
    new_value = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['-timestamp']
        db_table = "ticket_activities"
        verbose_name = 'Ticket Activity'
        verbose_name_plural = 'Ticket Activities'


class TicketWatchers(BaseEntity):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='watchers'
    )
    watcher = models.ForeignKey(
        "users.Users",
        on_delete=models.CASCADE,
        related_name='ticket_watchers'
    )

    class Meta:
        db_table = "ticket_watchers"
        verbose_name = 'Ticket Watchers'
        verbose_name_plural = 'Ticket Watchers'


class TicketReopen(BaseEntity):
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name='reopens'
    )
    reopened_by = models.ForeignKey(
        "users.Users",
        on_delete=models.CASCADE,
        related_name='reopened_tickets'
    )
    reason = models.TextField()

    class Meta:
        db_table = "ticket_reopens"
        verbose_name = 'Ticket Reopen'
        verbose_name_plural = 'Ticket Reopens'


class ActivityReadStatus(BaseEntity):
    """Track which users have read which ticket activities"""
    activity = models.ForeignKey(
        TicketActivity,
        on_delete=models.CASCADE,
        related_name='read_statuses'
    )
    user = models.ForeignKey(
        "users.Users",
        on_delete=models.CASCADE,
        related_name='activity_read_statuses'
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "activity_read_status"
        verbose_name = 'Activity Read Status'
        verbose_name_plural = 'Activity Read Statuses'
        unique_together = ('activity', 'user')
