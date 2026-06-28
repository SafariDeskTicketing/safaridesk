from django.db import models


class FailedLoginAttempt(models.Model):
    """Tracks failed login attempts for security monitoring in SafariAdmin."""

    REASON_CHOICES = [
        ('wrong_password', 'Wrong Password'),
        ('account_not_found', 'Account Not Found'),
        ('account_disabled', 'Account Disabled'),
        ('otp_expired', 'OTP Expired'),
        ('mfa_failed', 'MFA Failed'),
        ('unknown', 'Unknown'),
    ]

    email = models.EmailField(db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    business = models.ForeignKey(
        'users.Business',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='failed_login_attempts',
    )
    reason = models.CharField(max_length=30, choices=REASON_CHOICES, default='unknown')
    attempted_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-attempted_at']
        indexes = [
            models.Index(fields=['-attempted_at']),
            models.Index(fields=['ip_address']),
            models.Index(fields=['email']),
        ]

    def __str__(self):
        return f"FailedLogin: {self.email} from {self.ip_address} [{self.reason}]"

    @classmethod
    def log(cls, email: str, request, reason: str, business=None):
        """Log a failed login attempt. Never raises — safe to call from auth views."""
        try:
            forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
            ip = forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')
            cls.objects.create(
                email=email,
                ip_address=ip or None,
                business=business,
                reason=reason,
            )
        except Exception:
            pass  # Never block the auth flow
