"""
Email filter engine — tiered, cached matching for per-business blocklists.

Tier 0  Positive cache (Redis/Django cache) — repeat senders answered in O(1)
Tier 1  Exact email match — O(1) set lookup
Tier 2  Domain match     — O(1) set lookup after splitting '@'
Tier 3  Contains/substring match — O(n) over short pattern list

Rules are loaded from the database once per business and cached for RULES_TTL
seconds. Positive (blocked) results are cached separately for POSITIVE_TTL so
repeat automated senders never hit tiers 1-3 again.
"""
from __future__ import annotations

import logging
from typing import Tuple

from django.core.cache import cache

logger = logging.getLogger(__name__)

# Cache timeouts (seconds)
RULES_TTL = 600      # 10 min — rule set is rebuilt on every save anyway
POSITIVE_TTL = 3600  # 1 hour — blocked sender cache


def _rules_cache_key(business_id: int) -> str:
    return f"email_filter:rules:{business_id}"


def _positive_cache_key(business_id: int, sender: str) -> str:
    return f"email_filter:pos:{business_id}:{sender}"


def _classify_rules(rules: list) -> dict:
    """
    Split a flat list of rule strings into typed tier buckets.

    Returns:
        {
            'exact':    set of lowercase email strings,
            'domains':  set of lowercase domain strings (without leading @),
            'contains': list of lowercase substrings,
        }
    """
    exact: set = set()
    domains: set = set()
    contains: list = []

    for raw in rules:
        rule = raw.strip().lower()
        if not rule or rule.startswith("#"):
            continue

        if rule.startswith("@"):
            # @domain.com → block entire domain
            domains.add(rule[1:])
        elif "@" in rule:
            # user@domain.com → exact email
            exact.add(rule)
        else:
            # anything else → substring/contains match
            contains.append(rule)

    return {"exact": exact, "domains": domains, "contains": contains}


def _load_tiers(business_id: int) -> dict:
    """
    Return classified rule tiers from cache, or load from DB and cache them.
    If no EmailFilterList exists for the business, fall back to DEFAULT_FILTER_RULES.
    """
    key = _rules_cache_key(business_id)
    cached = cache.get(key)
    if cached is not None:
        return cached

    try:
        from tenant.models.MailIntegrationModel import EmailFilterList, DEFAULT_FILTER_RULES
        try:
            filter_list = EmailFilterList.objects.get(business_id=business_id)
            rules = filter_list.rules
        except EmailFilterList.DoesNotExist:
            rules = DEFAULT_FILTER_RULES
    except Exception as exc:
        logger.error("email_filter_engine_load_error", extra={"business_id": business_id, "error": str(exc)})
        rules = []

    tiers = _classify_rules(rules)
    cache.set(key, tiers, RULES_TTL)
    return tiers


def is_blocked(sender: str, business_id: int) -> Tuple[bool, str, str]:
    """
    Check whether a sender email should be blocked for a given business.

    Args:
        sender:      The incoming email address (raw, any case).
        business_id: The business to check rules against.

    Returns:
        (blocked: bool, rule_matched: str, tier: str)
        tier is one of: 'positive_cache', 'exact', 'domain', 'contains', ''
    """
    if not sender:
        return False, "", ""

    sender_norm = sender.lower().strip()

    # Tier 0 — positive cache (fastest path for repeat senders)
    pos_key = _positive_cache_key(business_id, sender_norm)
    cached_result = cache.get(pos_key)
    if cached_result:
        return True, cached_result["rule"], "positive_cache"

    tiers = _load_tiers(business_id)

    # Tier 1 — exact email
    if sender_norm in tiers["exact"]:
        _write_positive(business_id, sender_norm, sender_norm, "exact")
        return True, sender_norm, "exact"

    # Tier 2 — domain
    if "@" in sender_norm:
        domain = sender_norm.split("@", 1)[1]
        if domain in tiers["domains"]:
            matched = f"@{domain}"
            _write_positive(business_id, sender_norm, matched, "domain")
            return True, matched, "domain"

    # Tier 3 — contains / substring
    for pattern in tiers["contains"]:
        if pattern in sender_norm:
            _write_positive(business_id, sender_norm, pattern, "contains")
            return True, pattern, "contains"

    return False, "", ""


def _write_positive(business_id: int, sender: str, rule: str, tier: str) -> None:
    key = _positive_cache_key(business_id, sender)
    cache.set(key, {"rule": rule, "tier": tier}, POSITIVE_TTL)


def invalidate_cache(business_id: int) -> None:
    """
    Bust the rules cache for a business. Call this whenever rules are saved.
    Positive-cache entries expire via TTL — no need to enumerate them.
    """
    cache.delete(_rules_cache_key(business_id))
    logger.info("email_filter_cache_invalidated", extra={"business_id": business_id})
