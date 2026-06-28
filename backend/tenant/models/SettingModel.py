from django.db import models
from shared.models.BaseModel import BaseEntity

class SettingSMTP(BaseEntity):
    host = models.CharField(max_length=255, verbose_name="SMTP Host")
    port = models.PositiveIntegerField(verbose_name="SMTP Port")
    username = models.CharField(max_length=255, verbose_name="SMTP Username")
    password = models.CharField(max_length=255, verbose_name="SMTP Password")
    use_tls = models.BooleanField(default=True, verbose_name="Use TLS")
    use_ssl = models.BooleanField(default=False, verbose_name="Use SSL")
    default_from_email = models.EmailField(verbose_name="Default From Email")
    sender_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Sender Name")
    reply_to_email = models.EmailField(blank=True, null=True, verbose_name="Reply-To Email")

    class Meta:
        verbose_name = "SMTP Setting"
        verbose_name_plural = "SMTP Settings"
        db_table = 'setting_smtp'


class EmailTemplateCategory(BaseEntity):
    name = models.CharField(max_length=200)

    class Meta:
        db_table = 'email_templates'
        unique_together = ('name', 'business')


    def __str__(self):
        return self.name


class EmailTemplate(BaseEntity):
    """
    Stores actual email templates with placeholders.
    """
    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    subject = models.CharField(max_length=255)
    body = models.TextField()
    category = models.ForeignKey(
        EmailTemplateCategory, on_delete=models.CASCADE, related_name="templates"
    )
    is_active = models.BooleanField(default=True)
    language = models.CharField(max_length=10, default="en")
    type = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = 'email_templates_items'
        unique_together = ('name', 'business')

    def __str__(self):
        return f"{self.name} ({self.category.name})"


class EmailConfig(BaseEntity):
    """
    Stores actual email templates with placeholders.
    """
    default_template = models.ForeignKey(
        EmailTemplateCategory, on_delete=models.CASCADE, related_name="default_template"
    )
    email_fetching = models.BooleanField(default=True)


class EmailSettings(BaseEntity):
    """
    Stores email signature and format settings for outgoing replies.
    """
    signature_greeting = models.CharField(
        max_length=100, 
        default="Regards,",
        help_text="Greeting text before signature name (e.g., 'Regards,', 'Best,', 'Thanks,')"
    )
    signature_name = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="Signature name (e.g., 'Support Team', 'Acme Inc Support'). Falls back to business name."
    )
    include_ticket_link = models.BooleanField(
        default=True,
        help_text="Include 'View Ticket' link in email replies"
    )
    use_plain_text = models.BooleanField(
        default=True,
        help_text="Send replies as plain text (recommended for threading)"
    )

    class Meta:
        db_table = 'email_settings'
        verbose_name = "Email Settings"
        verbose_name_plural = "Email Settings"

    def __str__(self):
        return f"Email Settings for {self.business.name if self.business else 'Unknown'}"

    def get_signature_name(self):
        """Return signature name, falling back to business name."""
        return self.signature_name or (self.business.name if self.business else "Support Team")


class CsatConfiguration(BaseEntity):
    MODE_INTERNAL_ONLY = 'internal_only'
    MODE_EXTERNAL_ONLY = 'external_only'
    MODE_HYBRID = 'hybrid'
    MODE_CHOICES = (
        (MODE_INTERNAL_ONLY, 'Internal Only'),
        (MODE_EXTERNAL_ONLY, 'External Only'),
        (MODE_HYBRID, 'Hybrid'),
    )

    DISPATCH_SINGLE = 'single_provider_per_ticket'
    DISPATCH_DUAL_SHADOW = 'dual_send_shadow'
    DISPATCH_STRATEGY_CHOICES = (
        (DISPATCH_SINGLE, 'Single Provider Per Ticket'),
        (DISPATCH_DUAL_SHADOW, 'Dual Send Shadow'),
    )

    PROVIDER_INTERNAL = 'internal'
    PROVIDER_EXTERNAL = 'external'
    PROVIDER_CHOICES = (
        (PROVIDER_INTERNAL, 'Internal'),
        (PROVIDER_EXTERNAL, 'External'),
    )

    FALLBACK_NONE = 'none'
    FALLBACK_CHOICES = (
        (FALLBACK_NONE, 'None'),
        (PROVIDER_INTERNAL, 'Internal'),
        (PROVIDER_EXTERNAL, 'External'),
    )

    WEBHOOK_AUTH_BEARER = 'bearer_secret'
    WEBHOOK_AUTH_HMAC = 'hmac'
    WEBHOOK_AUTH_NONE = 'none'
    WEBHOOK_AUTH_CHOICES = (
        (WEBHOOK_AUTH_BEARER, 'Bearer Secret'),
        (WEBHOOK_AUTH_HMAC, 'HMAC'),
        (WEBHOOK_AUTH_NONE, 'None'),
    )

    OFFICIAL_FIRST_VALID = 'first_valid'
    OFFICIAL_PREFERRED_PROVIDER = 'preferred_provider'
    OFFICIAL_LATEST_VALID = 'latest_valid'
    OFFICIAL_RESULT_CHOICES = (
        (OFFICIAL_FIRST_VALID, 'First Valid'),
        (OFFICIAL_PREFERRED_PROVIDER, 'Preferred Provider'),
        (OFFICIAL_LATEST_VALID, 'Latest Valid'),
    )

    enabled = models.BooleanField(default=True)
    is_paused = models.BooleanField(default=False)
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default=MODE_HYBRID)
    dispatch_strategy = models.CharField(
        max_length=40,
        choices=DISPATCH_STRATEGY_CHOICES,
        default=DISPATCH_SINGLE,
    )
    default_provider = models.CharField(max_length=10, choices=PROVIDER_CHOICES, default=PROVIDER_EXTERNAL)
    fallback_provider = models.CharField(max_length=10, choices=FALLBACK_CHOICES, default=FALLBACK_NONE)
    send_on_status = models.JSONField(default=list)
    send_delay_minutes = models.PositiveIntegerField(default=10)

    # Internal survey settings
    star_rating_enabled = models.BooleanField(default=True)
    emotion_enabled = models.BooleanField(default=True)
    comment_enabled = models.BooleanField(default=True)
    star_required = models.BooleanField(default=True)
    emotion_required = models.BooleanField(default=False)
    comment_required = models.BooleanField(default=False)
    comment_min_length = models.PositiveIntegerField(default=0)
    comment_max_length = models.PositiveIntegerField(default=2000)
    survey_title = models.CharField(max_length=255, default="How did we do?")
    intro_text = models.TextField(
        default="Please rate your support experience and share any feedback."
    )
    thank_you_title = models.CharField(max_length=255, default="Thank you for your feedback")
    thank_you_message = models.TextField(default="We appreciate your time.")
    link_expiry_hours = models.PositiveIntegerField(default=336)
    allow_multiple_submissions = models.BooleanField(default=False)

    # Question labels (text is customisable; response format is fixed)
    star_label = models.CharField(max_length=255, default='How would you rate your experience?')
    emotion_label = models.CharField(max_length=255, default='How did our team make you feel?')
    comment_label = models.CharField(max_length=255, default='Tell us more (optional)')

    # External provider settings
    external_enabled = models.BooleanField(default=True)
    provider_name = models.CharField(max_length=120, blank=True, default="")
    external_survey_base_url = models.URLField(blank=True, default="")
    webhook_auth_mode = models.CharField(
        max_length=20,
        choices=WEBHOOK_AUTH_CHOICES,
        default=WEBHOOK_AUTH_BEARER,
    )
    webhook_secret = models.CharField(max_length=255, blank=True, default="")
    webhook_timeout_seconds = models.PositiveIntegerField(default=10)

    # Scoring and badge settings
    official_result_policy = models.CharField(
        max_length=30,
        choices=OFFICIAL_RESULT_CHOICES,
        default=OFFICIAL_FIRST_VALID,
    )
    positive_min = models.PositiveIntegerField(default=8)
    neutral_min = models.PositiveIntegerField(default=6)

    class Meta:
        db_table = 'csat_configuration'
        verbose_name = 'CSAT Configuration'
        verbose_name_plural = 'CSAT Configurations'

    def __str__(self):
        return f"CSAT Config for {self.business.name if self.business else 'Unknown Business'}"


class CsatSurveyDispatch(BaseEntity):
    PROVIDER_INTERNAL = 'internal'
    PROVIDER_EXTERNAL = 'external'
    PROVIDER_CHOICES = (
        (PROVIDER_INTERNAL, 'Internal'),
        (PROVIDER_EXTERNAL, 'External'),
    )

    EMOTION_HAPPY = 'happy'
    EMOTION_SAD = 'sad'
    EMOTION_CHOICES = (
        (EMOTION_HAPPY, 'Happy'),
        (EMOTION_SAD, 'Sad'),
    )

    ticket = models.ForeignKey(
        'tenant.Ticket',
        on_delete=models.CASCADE,
        related_name='csat_dispatches',
    )
    provider = models.CharField(max_length=10, choices=PROVIDER_CHOICES, default=PROVIDER_INTERNAL)
    trigger_status = models.CharField(max_length=20, default='closed')
    recipient_email = models.EmailField(blank=True, default='')
    token = models.CharField(max_length=64, unique=True, db_index=True)
    survey_url = models.URLField(blank=True, default='')
    expires_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    star_rating = models.PositiveSmallIntegerField(null=True, blank=True)
    emotion = models.CharField(max_length=10, choices=EMOTION_CHOICES, null=True, blank=True)
    comment = models.TextField(blank=True, default='')
    normalized_score = models.PositiveSmallIntegerField(null=True, blank=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'csat_survey_dispatch'
        verbose_name = 'CSAT Survey Dispatch'
        verbose_name_plural = 'CSAT Survey Dispatches'

    def __str__(self):
        return f"CSAT Dispatch {self.token} for ticket {self.ticket.ticket_id}"
