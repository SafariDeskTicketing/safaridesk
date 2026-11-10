"""Generic, cache-backed rate limiter for unauthenticated/public endpoints
(login, OTP verification, password-reset requests, etc).

Backed by Django's configured cache (Redis in every real deployment - see
RNSafarideskBack/settings/base.py's CACHES), so the counter is correctly
shared across every app-server worker process, not just the one that
happened to handle a given request.
"""
from django.core.cache import cache

_PREFIX = 'ratelimit'


def get_client_ip(request) -> str | None:
    """Best-effort client IP: the first hop of X-Forwarded-For if present
    (nginx is the only thing allowed to set it in this deployment), else
    the direct connecting address."""
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def is_rate_limited(scope: str, identifier: str | None, max_attempts: int, window_seconds: int) -> bool:
    """Fixed-window counter: returns True if `identifier` has already made
    `max_attempts` requests under `scope` within the last `window_seconds`.
    Records the current attempt as a side effect either way, so callers
    should call this at most once per request per scope."""
    key = f'{_PREFIX}:{scope}:{identifier or "unknown"}'
    current = cache.get(key, 0)
    if current >= max_attempts:
        return True
    cache.set(key, current + 1, window_seconds)
    return False
