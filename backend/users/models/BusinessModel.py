from django.db import models



class Business(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255, unique=True, help_text="Name of the business")
    organization_size = models.CharField(max_length=255, blank=True, null=True, help_text="Number of employee in the business")
    owner = models.ForeignKey("users.Users", on_delete=models.SET_NULL, null=True, blank=True, related_name="owned_business", help_text="The owner of the business")
    created_at = models.DateTimeField(auto_now_add=True, help_text="The date and time the business was created")
    updated_at = models.DateTimeField(auto_now=True, help_text="The last updated date and time")
    is_active = models.BooleanField(default=True, help_text="Status of the business (active/inactive)")
    website = models.URLField(blank=True, null=True, help_text="Website URL of the business")
    domain = models.CharField(blank=True, null=True, max_length=200, help_text="Domain name of the business")
    domain_url = models.URLField(blank=True, null=True, max_length=255, help_text="Domain name of the business")
    support_url = models.URLField(blank=True, null=True, max_length=255, help_text="Support URL of the business")

    email = models.CharField(
        blank=True,
        null=True,
        max_length=200,
        help_text="Email address of the business"
    )

    logo_url = models.CharField(
        blank=True,
        null=True,
        max_length=200,
        help_text="URL to the business logo"
    )

    favicon_url = models.CharField(
        blank=True,
        null=True,
        max_length=200,
        help_text="URL to the business favicon"
    )

    auth_backdrop_url = models.CharField(
        blank=True,
        null=True,
        max_length=255,
        help_text="URL to the business auth backdrop image"
    )

    COLOR_THEME_CHOICES = [
        ('default', 'Default'),
        ('indigo', 'Indigo'),
        ('microsoft', 'Microsoft'),
        ('forest', 'Forest'),
        ('red', 'Red'),
        ('gray', 'Gray'),
    ]
    color_theme = models.CharField(
        max_length=20,
        choices=COLOR_THEME_CHOICES,
        default='default',
        help_text="Brand accent color theme for all users on this domain"
    )

    phone = models.CharField(
        blank=True,
        null=True,
        max_length=200,
        help_text="Phone number of the business"
    )
    timezone = models.CharField(
        blank=True,
        null=True,
        max_length=200,
        help_text="Time zone"
    )

    allow_idle_logout = models.BooleanField(
        default=False,
        help_text="Enable automatic logout after idle timeout"
    )
    idle_seconds = models.PositiveIntegerField(
        default=900,
        help_text="Seconds of inactivity before auto logout (default 15 minutes)"
    )

    class Meta:
        verbose_name = "Business"
        db_table = "businesses"
        ordering = ["-id"]
        verbose_name_plural = "Businesses"

    def get_email_template(self, template_name: str, language="en"):
        """
        Get business-specific template if exists,
        otherwise fall back to global template.
        """
        from tenant.models import EmailTemplate

        try:
            # First try business-specific template
            return EmailTemplate.objects.get(
                business=self,
                name=template_name,
                language=language,
                is_active=True
            )
        except EmailTemplate.DoesNotExist:
            try:
                # Fallback to global (business=None)
                return EmailTemplate.objects.get(
                    business__isnull=True,
                    name=template_name,
                    language=language,
                    is_active=True
                )
            except EmailTemplate.DoesNotExist:
                return None


class CustomDomains(models.Model):
    """
    Custom domain model for businesses to use their own domains.
    Only one verified custom domain is allowed per business.
    """
    VERIFICATION_METHODS = [
        ('dns_txt', 'DNS TXT Record'),
        ('dns_cname', 'DNS CNAME Record'),
    ]

    VERIFICATION_STATUS = [
        ('pending', 'Pending Verification'),
        ('verified', 'Verified'),
        ('failed', 'Verification Failed'),
    ]

    business = models.ForeignKey(
        Business,
        on_delete=models.CASCADE,
        related_name="domains"
    )
    domain = models.CharField(
        max_length=255,
        unique=True,
        help_text="Custom domain (e.g., support.company.com)"
    )
    is_primary = models.BooleanField(
        default=True,
        help_text="Primary domain for this business"
    )
    is_verified = models.BooleanField(
        default=False,
        help_text="Whether domain ownership has been verified"
    )
    verification_method = models.CharField(
        max_length=20,
        choices=VERIFICATION_METHODS,
        default='dns_txt',
        help_text="Method used to verify domain ownership"
    )
    verification_status = models.CharField(
        max_length=20,
        choices=VERIFICATION_STATUS,
        default='pending',
        help_text="Current verification status"
    )
    verification_token = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        help_text="Unique token for domain verification"
    )
    verification_record_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="DNS record name to create (e.g., _safaridesk-verify)"
    )
    verification_record_value = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="DNS record value to set"
    )
    last_verification_attempt = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time verification was attempted"
    )
    verified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the domain was successfully verified"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "custom_domains"
        verbose_name = "Custom Domain"
        verbose_name_plural = "Custom Domains"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=['business'],
                condition=models.Q(is_verified=True),
                name='one_verified_domain_per_business'
            )
        ]

    def __str__(self):
        return f"{self.domain} ({'Verified' if self.is_verified else 'Pending'})"

    def generate_verification_token(self):
        """Generate a unique verification token for this domain"""
        import secrets
        self.verification_token = secrets.token_urlsafe(32)

        if self.verification_method == 'dns_txt':
            self.verification_record_name = f"_safaridesk-verify"
            self.verification_record_value = f"safaridesk-verification={self.verification_token}"
        elif self.verification_method == 'dns_cname':
            self.verification_record_name = f"_safaridesk-verify"
            self.verification_record_value = f"verify.safaridesk.io"

        self.save()
        return self.verification_token
