from decimal import Decimal

from django.db import models

from shared.models.BaseModel import BaseEntity


class AIUsagePolicy(BaseEntity):
    """
    Per-business AI usage controls.

    This is intentionally separate from Stripe/payment records: it defines the
    entitlement and overage behavior. Billing can later consume AIUsageEvent
    overage rows and add them to invoices.
    """

    monthly_token_cap = models.PositiveIntegerField(
        default=1_000_000,
        help_text="Included AI tokens per calendar month for this business.",
    )
    hard_cap_enabled = models.BooleanField(
        default=True,
        help_text="Block AI calls once the monthly cap is reached unless overage is enabled.",
    )
    overage_enabled = models.BooleanField(
        default=False,
        help_text="Allow usage beyond the monthly cap and mark excess tokens as billable.",
    )
    overage_price_per_1k_tokens_usd = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        default=Decimal("0.002000"),
        help_text="Customer-facing overage price per 1,000 tokens.",
    )
    currency = models.CharField(max_length=3, default="usd")
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "ai_usage_policies"
        constraints = [
            models.UniqueConstraint(fields=["business"], name="uniq_ai_usage_policy_business"),
        ]
        indexes = [
            models.Index(fields=["business"]),
        ]

    def __str__(self):
        business_name = getattr(self.business, "name", None) or self.business_id
        return f"AI usage policy for {business_name}"


class AIUsageEvent(BaseEntity):
    """Append-only ledger for provider AI usage and estimated cost."""

    FEATURE_CHOICES = [
        ("kb_learning", "KB learning"),
        ("kb_ask", "KB Ask AI"),
        ("kb_embedding", "KB embeddings"),
        ("copilot", "Copilot"),
        ("chatbot", "Chatbot"),
        ("other", "Other"),
    ]

    OPERATION_CHOICES = [
        ("generate_content", "Generate content"),
        ("embed_content", "Embed content"),
        ("search", "Search"),
        ("other", "Other"),
    ]

    period_start = models.DateField(db_index=True)
    feature = models.CharField(max_length=32, choices=FEATURE_CHOICES, db_index=True)
    operation = models.CharField(max_length=32, choices=OPERATION_CHOICES, db_index=True)
    provider = models.CharField(max_length=32, default="gemini", db_index=True)
    model_name = models.CharField(max_length=100, blank=True, db_index=True)

    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    total_tokens = models.PositiveIntegerField(default=0)

    estimated_cost_usd = models.DecimalField(max_digits=12, decimal_places=6, default=Decimal("0.000000"))
    billable_overage_tokens = models.PositiveIntegerField(default=0)
    billable_overage_amount_usd = models.DecimalField(max_digits=12, decimal_places=6, default=Decimal("0.000000"))

    source_object_type = models.CharField(max_length=80, blank=True)
    source_object_id = models.CharField(max_length=80, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "ai_usage_events"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "period_start"]),
            models.Index(fields=["business", "feature", "period_start"]),
            models.Index(fields=["provider", "model_name"]),
            models.Index(fields=["source_object_type", "source_object_id"]),
        ]

    def save(self, *args, **kwargs):
        self.total_tokens = int(self.input_tokens or 0) + int(self.output_tokens or 0)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.feature} {self.total_tokens} tokens ({self.period_start})"
