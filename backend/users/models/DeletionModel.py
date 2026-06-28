from datetime import timedelta

from django.db import models
from django.utils import timezone

GRACE_PERIOD_DAYS = 30


class AccountDeletionRequest(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_PURGED = 'purged'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PURGED, 'Purged'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    user = models.OneToOneField(
        'users.Users',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deletion_request',
    )
    # Preserved after the user row is hard-deleted
    user_email = models.EmailField()
    user_name = models.CharField(max_length=255, blank=True)
    business = models.ForeignKey(
        'users.Business',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deletion_requests',
    )
    requested_by = models.ForeignKey(
        'users.Users',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='initiated_deletion_requests',
    )
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    grace_period_end = models.DateTimeField()
    purged_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        'users.Users',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cancelled_deletion_requests',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'account_deletion_requests'
        ordering = ['-created_at']

    def __str__(self):
        return f"Deletion request for {self.user_email} [{self.status}]"

    @property
    def is_expired(self):
        return self.status == self.STATUS_PENDING and timezone.now() >= self.grace_period_end

    @classmethod
    def create_for_user(cls, user, requested_by, reason=''):
        name = ''
        if hasattr(user, 'get_full_name'):
            name = user.get_full_name() or user.email
        return cls.objects.create(
            user=user,
            user_email=user.email,
            user_name=name,
            business=getattr(user, 'business', None),
            requested_by=requested_by,
            reason=reason,
            grace_period_end=timezone.now() + timedelta(days=GRACE_PERIOD_DAYS),
        )
