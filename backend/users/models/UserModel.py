from django.contrib.auth.models import Group
from django.db import models
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
import hashlib
import secrets

from shared.models.BaseUser import BaseUser
from tenant.models.DepartmentModel import Department
from users.models.BusinessModel import Business
from util.Constants import STATUS_CHOICES


class Users(BaseUser):
    email = models.EmailField(unique=False)
    role = models.ForeignKey(Group, on_delete=models.CASCADE)
    department = models.ManyToManyField(Department, blank=True)
    status = models.CharField(max_length=2, choices=STATUS_CHOICES, default="A")
    avatar_url = models.URLField(null=True, blank=True)
    is_superuser = models.BooleanField(default=False)
    business = models.ForeignKey(
        Business,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='user_members'
    )
    category = models.CharField(
        max_length=100,
        choices=[('BUSINESS', 'BUSINESS'), ('CUSTOMER', 'CUSTOMER')],
        default="CUSTOMER"
    )
    mfa_method = models.CharField(
        max_length=20,
        choices=[('none', 'None'), ('email', 'Email OTP'), ('totp', 'Authenticator App')],
        default='none',
        db_default='none',
    )
    totp_secret = models.CharField(max_length=32, null=True, blank=True)
    onboarding_skipped = models.BooleanField(default=False)
    ui_preferences = models.JSONField(default=dict, blank=True)
    auth_revoked_at = models.DateTimeField(null=True, blank=True)
    auth_session_version = models.PositiveIntegerField(default=0)

    groups = models.ManyToManyField(
        "auth.Group",
        related_name="user_group",
        blank=True,
        help_text="The groups this user belongs to.",
        verbose_name="usergroups",
    )
    user_permissions = models.ManyToManyField(
        "auth.Permission",
        related_name="user_permissions",
        blank=True,
        help_text="Specific permissions for this user.",
        verbose_name="user permissions",
    )

    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    class Meta:
        verbose_name = "Users"
        db_table = "users"
        verbose_name_plural = "Users"


class Customer(BaseUser):
    email = models.EmailField(unique=True)
    status = models.CharField(max_length=2, choices=STATUS_CHOICES, default="A")
    is_superuser = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    allow_login = models.BooleanField(default=False)
    is_active = models.BooleanField(default=False)
    first_name = models.CharField(max_length=100, null=True, blank=True)
    last_name = models.CharField(max_length=100, null=True, blank=True)
    business = models.ForeignKey(
        Business,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_members'
    )
    category = models.CharField(
        max_length=100,
        choices=[('BUSINESS', 'BUSINESS'), ('CUSTOMER', 'CUSTOMER'), ('ANONYMOUS', 'ANONYMOUS')],
        default="CUSTOMER"
    )

    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    class Meta:
        verbose_name = "Customers"
        db_table = "customers"
        verbose_name_plural = "Customers"


class CustomerMagicLinkToken(models.Model):
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='magic_link_tokens',
    )
    email = models.EmailField()
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    business = models.ForeignKey(
        Business,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_magic_link_tokens',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Customer Magic Link Token"
        verbose_name_plural = "Customer Magic Link Tokens"
        db_table = "customer_magic_link_tokens"
        ordering = ['-created_at']

    @staticmethod
    def hash_token(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

    @classmethod
    def issue_for_customer(cls, customer: Customer, *, request=None, expires_minutes: int = 15):
        raw_token = secrets.token_urlsafe(32)
        token_hash = cls.hash_token(raw_token)
        now = timezone.now()
        expires_at = now + timedelta(minutes=expires_minutes)

        ip_address = None
        user_agent = ''
        if request is not None:
            xff = request.META.get('HTTP_X_FORWARDED_FOR')
            if xff:
                ip_address = xff.split(',')[0].strip()
            else:
                ip_address = request.META.get('REMOTE_ADDR')
            user_agent = (request.META.get('HTTP_USER_AGENT') or '')[:1000]

        with transaction.atomic():
            cls.objects.filter(customer=customer, is_used=False).update(is_used=True, used_at=now)
            token = cls.objects.create(
                customer=customer,
                email=customer.email,
                token_hash=token_hash,
                expires_at=expires_at,
                ip_address=ip_address,
                user_agent=user_agent,
                business=customer.business,
            )

        return raw_token, token

    @classmethod
    def consume_token(cls, raw_token: str):
        token_hash = cls.hash_token(raw_token)
        token = cls.objects.select_related('customer', 'business').filter(token_hash=token_hash).first()
        if not token:
            return None, 'invalid'

        now = timezone.now()
        if token.is_used:
            return None, 'used'
        if token.expires_at <= now:
            return None, 'expired'

        token.is_used = True
        token.used_at = now
        token.save(update_fields=['is_used', 'used_at'])
        return token, None

