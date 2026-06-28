import uuid

from django.db import models

from tenant.models import Department
from users.models import Business


class Requests(models.Model):
    types = [
        ('technical', 'Technical Support'),
        ('billing', 'Billing Inquiry'),
        ('feature', 'Feature Request'),
        ('bug', 'Bug Report'),
        ('improvement', 'Improvement Suggestion'),
        ('account', 'Account Management'),
        ('other', 'Other'),
    ]

    status = [
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('closed', 'Closed'),
        ('on_hold', 'On Hold'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=20, choices=types, default='other')
    status = models.CharField(max_length=20, choices=status, default='open')
    creator_name = models.CharField(max_length=200)
    creator_email = models.CharField(max_length=200)
    creator_phone = models.CharField(max_length=200)
    ref_number = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    converted_to_ticket = models.BooleanField(default=False)
    converted_to_task = models.BooleanField(default=False)
    attached_to = models.CharField(max_length=100, blank=True, null=True, help_text="Display ID of converted ticket or task")
    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )


    class Meta:
        db_table = 'requests'
        ordering = ['-id']
