import logging

from django.db import models
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)

from shared.models.BaseModel import BaseEntity
from tenant.models import Department
from tenant.models.SlaXModel import SLA, SLATarget, BusinessHoursx, Holidays
from tenant.models.TicketModel import Ticket
from util.Constants import PRIORITY_CHOICES, TASK_ACTIVITY_CHOICES


from django.db import models
from django.utils import timezone
from tenant.models import Department
from shared.models.BaseModel import BaseEntity
from util.Constants import PRIORITY_CHOICES, TASK_ACTIVITY_CHOICES

class Task(BaseEntity):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('hold', 'Hold'),
        ('draft', 'Draft'),
        ('breached', 'Breached'),
    ]

    title = models.CharField(max_length=200)
    priority = models.CharField(choices=PRIORITY_CHOICES, max_length=200, null=True, blank=True)
    description = models.TextField(blank=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, null=True, blank=True)

    task_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    task_trackid = models.CharField(max_length=255, null=True, blank=True)

    assigned_to = models.ForeignKey(
        "users.Users",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tasks'
    )

    # Link to a ticket (nullable, to support standalone tasks)
    linked_ticket = models.ForeignKey(
        "tenant.Ticket",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='related_tasks'
    )

    is_converted_to_ticket = models.BooleanField(default=False)

    due_date = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    labels = models.ManyToManyField("tenant.Label", blank=True, related_name="tasks")

    # SLA
    sla = models.ForeignKey("tenant.SLA", on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks')
    is_sla_paused = models.BooleanField(default=False, help_text="Indicates if SLA calculation is currently paused for this task")
    
    # Archive and delete flags
    is_archived = models.BooleanField(default=False, help_text="Indicates if task is archived")
    is_deleted = models.BooleanField(default=False, help_text="Indicates if task is soft deleted")

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Task'
        db_table = "tasks"
        verbose_name_plural = 'Tasks'
        indexes = [
            models.Index(fields=['task_status']),
            models.Index(fields=['created_by']),
            models.Index(fields=['assigned_to']),
            models.Index(fields=['created_at']),
        ]

    def save(self, *args, **kwargs):
        now = timezone.now()

        # Set completed time if status is completed
        if self.task_status == 'completed' and not self.completed_at:
            self.completed_at = now
        elif self.task_status != 'completed':
            self.completed_at = None


        super().save(*args, **kwargs)

    @property
    def is_overdue(self):

        return self.due_date and self.task_status not in ['completed', 'cancelled'] and timezone.now() > self.due_date

    @property
    def time_since_created(self):
        return timezone.now() - self.created_at

    @property
    def is_completed(self):
        return self.task_status == 'completed'

    def get_sla(self):
        """
        Fetch the SLA for the task.
        """
        return self.sla

    def get_applicable_sla_target(self):
        """
        Get the SLA target that applies to this task's priority.
        Requires the SLA to be set on the task.
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
            logger.warning("sla_target_error", extra={"task_id": self.id, "error": str(e)})
            return None

    def calculate_sla_due_times(self):
        """
        Calculate SLA due times based on the applicable SLA target.
        """
        sla_target = self.get_applicable_sla_target()
        if not sla_target:
            return None

        base_time = self.created_at
        
        resolution_due = self._calculate_due_time(
            base_time,
            sla_target.resolution_time,
            sla_target.resolution_unit,
            sla_target.operational_hours
        )

        return {
            'resolution_due': resolution_due,
            'sla_target': sla_target
        }

    def _calculate_due_time(self, start_time, duration, unit, operational_hours):
        """
        Calculate due time considering operational hours.
        """
        total_minutes = self._convert_to_minutes(duration, unit)

        if operational_hours == 'calendar':
            return start_time + timedelta(minutes=total_minutes)
        elif operational_hours == 'business':
            return self._add_business_time(start_time, total_minutes)
        else:
            return self._add_business_time(start_time, total_minutes)

    def _convert_to_minutes(self, duration, unit):
        MAX_SLA_MINUTES = 5 * 365 * 24 * 60
        if unit == 'minutes':
            total_minutes = duration
        elif unit == 'hours':
            total_minutes = duration * 60
        elif unit == 'days':
            total_minutes = duration * 24 * 60
        elif unit == 'weeks':
            total_minutes = duration * 7 * 24 * 60
        else:
            total_minutes = duration * 60
        if total_minutes > MAX_SLA_MINUTES:
            return MAX_SLA_MINUTES
        return total_minutes

    def _add_business_time(self, start_time, minutes_to_add):
        current_time = start_time
        remaining_minutes = minutes_to_add
        business_hours = self._get_business_hours_config()
        if not business_hours:
            return start_time + timedelta(minutes=minutes_to_add)
        holidays = set(Holidays.objects.filter(is_active=True).values_list('date', flat=True))
        while remaining_minutes > 0:
            current_date = current_time.date()
            current_weekday = current_time.weekday()
            if current_date in holidays:
                current_time = (current_time + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                continue
            day_hours = business_hours.get(current_weekday)
            if not day_hours or not day_hours['is_working_day']:
                current_time = (current_time + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                continue
            current_time_only = current_time.time()
            if current_time_only < day_hours['start_time']:
                current_time = current_time.replace(
                    hour=day_hours['start_time'].hour,
                    minute=day_hours['start_time'].minute,
                    second=0,
                    microsecond=0
                )
            elif current_time_only >= day_hours['end_time']:
                current_time = (current_time + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                continue
            end_of_business = current_time.replace(
                hour=day_hours['end_time'].hour,
                minute=day_hours['end_time'].minute,
                second=0,
                microsecond=0
            )
            minutes_until_end = int((end_of_business - current_time).total_seconds() / 60)
            if remaining_minutes <= minutes_until_end:
                return current_time + timedelta(minutes=remaining_minutes)
            else:
                remaining_minutes -= minutes_until_end
                current_time = (current_time + timedelta(days=1)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
        return current_time

    def _get_business_hours_config(self):
        try:
            if not self.business:
                return None
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

    def get_sla_status(self):
        sla_due_times = self.calculate_sla_due_times()
        if not sla_due_times:
            return {
                'has_sla': False,
                'message': 'No applicable SLA found'
            }
        current_time = timezone.now()
        resolution_status = 'pending'
        if self.completed_at:
            if self.completed_at <= sla_due_times['resolution_due']:
                resolution_status = 'met'
            else:
                resolution_status = 'breached'
        elif sla_due_times['resolution_due'] and current_time > sla_due_times['resolution_due']:
            resolution_status = 'breached'
        return {
            'has_sla': True,
            'sla_name': sla_due_times['sla_target'].sla.name,
            'priority': sla_due_times['sla_target'].priority,
            'resolution': {
                'status': resolution_status,
                'due_time': sla_due_times['resolution_due'],
                'completed_time': self.completed_at,
            },
        }

    @property
    def is_sla_breached(self):
        if self.task_status == "completed":
            return False
        status = self.get_sla_status()
        if not status['has_sla']:
            return False
        return status['resolution']['status'] == 'breached'

    def pause_sla(self, reason=""):
        if not self.is_sla_paused:
            self.is_sla_paused = True
            self.save()
            logger.info("task_sla_paused", extra={"task_id": self.id, "reason": reason})

    def resume_sla(self):
        if self.is_sla_paused:
            self.is_sla_paused = False
            self.save()
            logger.info("task_sla_resumed", extra={"task_id": self.id})


class TaskAttachment(BaseEntity):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file_url = models.URLField()
    filename = models.CharField(max_length=255, blank=True, help_text="Original filename")
    description = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ['-id']
        db_table = "task_attachments"
        verbose_name = 'Task Attachment'
        verbose_name_plural = 'Task Attachments'

class TaskComment(BaseEntity):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    author = models.ForeignKey(
        "users.Users",
        on_delete=models.CASCADE,
        related_name='task_comments'
    )
    content = models.TextField()
    is_internal = models.BooleanField(
        default=False,
        null=True,
        blank=True,
        help_text="Internal comments are only visible to staff"
    )
    flagged = models.BooleanField(
        default=False,
        help_text="Mark this comment as flagged"
    )
    likes_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of likes for this comment"
    )

    class Meta:
        ordering = ['created_at']
        db_table = "task_comments"
        verbose_name = 'Task Comment'
        verbose_name_plural = 'Task Comments'
        indexes = [
            models.Index(fields=['task', 'created_at']),
            models.Index(fields=['author']),
        ]

class TaskReplayAttachment(BaseEntity):
    comment = models.ForeignKey(
        "tenant.TaskComment",
        on_delete=models.CASCADE,
        related_name='attachment'
    )
    file_url = models.URLField()
    filename = models.CharField(max_length=255, blank=True, help_text="Original filename")

    class Meta:
        ordering = ['-id']
        db_table = "task_comment_attachments"
        verbose_name = 'Task Replay Attachment'
        verbose_name_plural = 'Task Replay Attachments'

class TaskCommentLike(BaseEntity):
    comment = models.ForeignKey(
        TaskComment,
        on_delete=models.CASCADE,
        related_name='likes'
    )
    user = models.ForeignKey(
        "users.Users",
        on_delete=models.CASCADE,
        related_name='task_comment_likes'
    )

    class Meta:
        ordering = ['-created_at']
        db_table = "task_comment_likes"
        verbose_name = 'Task Comment Like'
        verbose_name_plural = 'Task Comment Likes'
        unique_together = ['comment', 'user']  # Prevent duplicate likes

class TaskCommentReply(BaseEntity):
    parent_comment = models.ForeignKey(
        TaskComment,
        on_delete=models.CASCADE,
        related_name='replies'
    )
    author = models.ForeignKey(
        "users.Users",
        on_delete=models.CASCADE,
        related_name='task_comment_replies'
    )
    content = models.TextField()
    is_internal = models.BooleanField(
        default=False,
        null=True,
        blank=True,
        help_text="Internal replies are only visible to staff"
    )
    likes_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of likes for this reply"
    )

    class Meta:
        ordering = ['created_at']
        db_table = "task_comment_replies"
        verbose_name = 'Task Comment Reply'
        verbose_name_plural = 'Task Comment Replies'
        indexes = [
            models.Index(fields=['parent_comment', 'created_at']),
            models.Index(fields=['author']),
        ]

    # def save(self, *args, **kwargs):
    #     # Update task's updated_at timestamp when comment is added
    #     super().save(*args, **kwargs)
    #     self.task.save()


class TaskActivity(BaseEntity):
    """
    Model to track all activities related to a task.
    """
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='activities'
    )
    user = models.ForeignKey(
        "users.Users",
        on_delete=models.CASCADE,
        related_name='task_activities'
    )
    activity_type = models.CharField(max_length=20, choices=TASK_ACTIVITY_CHOICES)
    description = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    old_value = models.CharField(max_length=200, blank=True)
    new_value = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['-timestamp']
        db_table = "task_activities"
        verbose_name = 'Task Activity'
        verbose_name_plural = 'Task Activities'
        indexes = [
            models.Index(fields=['task', 'timestamp']),
            models.Index(fields=['user']),
        ]
