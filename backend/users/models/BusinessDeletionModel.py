from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

GRACE_PERIOD_DAYS = 30


class BusinessDeletionRequest(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_PURGED = 'purged'
    STATUS_CANCELLED = 'cancelled'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PURGED, 'Purged'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    business = models.OneToOneField(
        'users.Business',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deletion_request',
    )
    business_name = models.CharField(max_length=255)
    business_domain = models.CharField(max_length=200, blank=True)

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='initiated_business_deletions',
    )
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cancelled_business_deletions',
    )
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    grace_period_end = models.DateTimeField()
    purged_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'business_deletion_requests'
        ordering = ['-created_at']

    @classmethod
    def create_for_business(cls, business, requested_by, reason=''):
        return cls.objects.create(
            business=business,
            business_name=business.name,
            business_domain=business.domain or '',
            requested_by=requested_by,
            reason=reason,
            grace_period_end=timezone.now() + timedelta(days=GRACE_PERIOD_DAYS),
        )

    @property
    def is_expired(self):
        return self.status == self.STATUS_PENDING and timezone.now() >= self.grace_period_end
