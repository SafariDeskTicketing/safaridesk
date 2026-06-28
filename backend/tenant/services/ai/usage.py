from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from decouple import config
from django.db.models import Sum
from django.utils import timezone

from tenant.models.AIUsageModel import AIUsageEvent, AIUsagePolicy


class AIUsageLimitExceeded(Exception):
    """Raised when a business has exhausted its included AI allowance."""

    def __init__(self, message: str, *, used_tokens: int, cap_tokens: int, requested_tokens: int = 0) -> None:
        super().__init__(message)
        self.used_tokens = used_tokens
        self.cap_tokens = cap_tokens
        self.requested_tokens = requested_tokens


@dataclass(frozen=True)
class AIUsageSnapshot:
    used_tokens: int
    cap_tokens: int
    remaining_tokens: int
    overage_enabled: bool
    hard_cap_enabled: bool


# Provider list prices are intentionally conservative defaults. They should be
# updated from vendor pricing config/env without a migration when prices change.
DEFAULT_PRICING_PER_1M = {
    # Gemini 2.5 Flash-Lite
    "gemini-2.5-flash-lite": (Decimal("0.10"), Decimal("0.40")),
    "gemini-2.5-flash-lite-preview-06-17": (Decimal("0.10"), Decimal("0.40")),
    # Gemini 2.5 Flash
    "gemini-2.5-flash": (Decimal("0.30"), Decimal("2.50")),
    "gemini-2.5-flash-preview-05-20": (Decimal("0.30"), Decimal("2.50")),
    # Legacy/default in this repo. Keep a default for accounting continuity.
    "gemini-2.0-flash": (Decimal("0.10"), Decimal("0.40")),
    # Embeddings are input-only.
    "gemini-embedding-001": (Decimal("0.15"), Decimal("0.00")),
}


def current_period_start(now=None) -> date:
    now = now or timezone.now()
    return date(now.year, now.month, 1)


def estimate_tokens_from_text(text: str | None) -> int:
    """Cheap estimate for preflight checks when provider usage is unknown."""
    if not text:
        return 0
    return max(1, math.ceil(len(text) / 4))


def get_or_create_policy(business) -> AIUsagePolicy:
    policy, _ = AIUsagePolicy.objects.get_or_create(
        business=business,
        defaults={
            "monthly_token_cap": config("AI_DEFAULT_MONTHLY_TOKEN_CAP", default=1_000_000, cast=int),
            "hard_cap_enabled": config("AI_DEFAULT_HARD_CAP_ENABLED", default=True, cast=bool),
            "overage_enabled": config("AI_DEFAULT_OVERAGE_ENABLED", default=False, cast=bool),
            "overage_price_per_1k_tokens_usd": Decimal(str(config("AI_DEFAULT_OVERAGE_PRICE_PER_1K_USD", default="0.002000"))),
        },
    )
    return policy


def get_monthly_usage_tokens(business, period_start: date | None = None) -> int:
    if business is None:
        return 0
    period_start = period_start or current_period_start()
    return int(
        AIUsageEvent.objects.filter(business=business, period_start=period_start)
        .aggregate(total=Sum("total_tokens"))["total"]
        or 0
    )


def get_usage_snapshot(business, *, period_start: date | None = None) -> AIUsageSnapshot:
    policy = get_or_create_policy(business)
    used = get_monthly_usage_tokens(business, period_start=period_start)
    cap = int(policy.monthly_token_cap or 0)
    return AIUsageSnapshot(
        used_tokens=used,
        cap_tokens=cap,
        remaining_tokens=max(0, cap - used),
        overage_enabled=bool(policy.overage_enabled),
        hard_cap_enabled=bool(policy.hard_cap_enabled),
    )


def assert_ai_usage_allowed(business, *, estimated_tokens: int = 0) -> AIUsageSnapshot:
    """Preflight cap check before an AI call."""
    if business is None:
        return AIUsageSnapshot(0, 0, 0, False, False)

    snapshot = get_usage_snapshot(business)
    if not snapshot.hard_cap_enabled or snapshot.overage_enabled:
        return snapshot

    if snapshot.used_tokens + max(0, int(estimated_tokens or 0)) > snapshot.cap_tokens:
        raise AIUsageLimitExceeded(
            "AI monthly token cap reached for this business.",
            used_tokens=snapshot.used_tokens,
            cap_tokens=snapshot.cap_tokens,
            requested_tokens=max(0, int(estimated_tokens or 0)),
        )
    return snapshot


def _pricing_for_model(model_name: str) -> tuple[Decimal, Decimal]:
    if not model_name:
        return (Decimal("0.00"), Decimal("0.00"))
    if model_name in DEFAULT_PRICING_PER_1M:
        return DEFAULT_PRICING_PER_1M[model_name]
    lowered = model_name.lower()
    if "embedding" in lowered:
        return DEFAULT_PRICING_PER_1M["gemini-embedding-001"]
    if "flash-lite" in lowered:
        return DEFAULT_PRICING_PER_1M["gemini-2.5-flash-lite"]
    if "flash" in lowered:
        return DEFAULT_PRICING_PER_1M["gemini-2.5-flash"]
    return (Decimal("0.00"), Decimal("0.00"))


def estimate_cost_usd(model_name: str, input_tokens: int, output_tokens: int) -> Decimal:
    input_per_1m, output_per_1m = _pricing_for_model(model_name)
    cost = (Decimal(int(input_tokens or 0)) / Decimal(1_000_000) * input_per_1m)
    cost += (Decimal(int(output_tokens or 0)) / Decimal(1_000_000) * output_per_1m)
    return cost.quantize(Decimal("0.000001"))


def record_ai_usage(
    *,
    business,
    feature: str,
    operation: str,
    provider: str = "gemini",
    model_name: str = "",
    input_tokens: int = 0,
    output_tokens: int = 0,
    source_object_type: str = "",
    source_object_id: str | int = "",
    metadata: dict[str, Any] | None = None,
) -> AIUsageEvent | None:
    """Record a usage event and mark tokens above the included cap as billable."""
    if business is None:
        return None

    input_tokens = max(0, int(input_tokens or 0))
    output_tokens = max(0, int(output_tokens or 0))
    total_tokens = input_tokens + output_tokens
    if total_tokens <= 0:
        return None

    period_start = current_period_start()
    policy = get_or_create_policy(business)
    used_before = get_monthly_usage_tokens(business, period_start=period_start)
    cap = int(policy.monthly_token_cap or 0)

    before_overage = max(0, used_before - cap)
    after_overage = max(0, used_before + total_tokens - cap)
    billable_overage_tokens = max(0, after_overage - before_overage)
    billable_overage_amount = (
        Decimal(billable_overage_tokens) / Decimal(1000) * policy.overage_price_per_1k_tokens_usd
        if policy.overage_enabled else Decimal("0.000000")
    ).quantize(Decimal("0.000001"))

    return AIUsageEvent.objects.create(
        business=business,
        period_start=period_start,
        feature=feature,
        operation=operation,
        provider=provider,
        model_name=model_name or "",
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        estimated_cost_usd=estimate_cost_usd(model_name, input_tokens, output_tokens),
        billable_overage_tokens=billable_overage_tokens if policy.overage_enabled else 0,
        billable_overage_amount_usd=billable_overage_amount,
        source_object_type=source_object_type or "",
        source_object_id=str(source_object_id or ""),
        metadata=metadata or {},
    )
