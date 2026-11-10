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
    """The real connecting address, as nginx sees it. `X-Real-IP` is set
    unconditionally to `$remote_addr` by every nginx config in front of
    this backend (deploy/nginx/*.conf, frontend/nginx.conf) and can't be
    overridden by the client. `X-Forwarded-For` is deliberately NOT used
    here: nginx appends to whatever the client already sent
    ($proxy_add_x_forwarded_for), so its leftmost hop is attacker-
    controlled and would make the IP-scoped limit trivially bypassable."""
    real_ip = request.META.get('HTTP_X_REAL_IP')
    if real_ip:
        return real_ip.strip()
    return request.META.get('REMOTE_ADDR')


def _incr(key: str, window_seconds: int) -> int:
    """Atomically increments the counter at `key`, creating it (TTL
    `window_seconds`) first if absent. `cache.add` + `cache.incr` are each
    atomic Redis operations (SETNX / INCR), avoiding the read-then-write
    race a plain get-then-set counter has under concurrent requests."""
    cache.add(key, 0, window_seconds)
    try:
        return cache.incr(key)
    except ValueError:
        # Key expired between add() and incr() - vanishingly rare with a
        # multi-minute window, but fail safe rather than raise.
        cache.add(key, 0, window_seconds)
        return cache.incr(key)


def is_rate_limited(scope: str, identifier: str | None, max_attempts: int, window_seconds: int) -> bool:
    """Fixed-window counter: returns True if `identifier` has already made
    `max_attempts` requests under `scope` within the last `window_seconds`.
    Records the current attempt as a side effect regardless of outcome -
    use this for request-volume limits (resend, reset-link requests)
    where even a "successful" request should still count. For a
    login-style flow where a successful attempt should never count
    against the limit, use `is_blocked`/`record_failure` instead."""
    key = f'{_PREFIX}:{scope}:{identifier or "unknown"}'
    return _incr(key, window_seconds) > max_attempts


def is_blocked(scope: str, identifier: str | None, max_attempts: int) -> bool:
    """Read-only check: True if `identifier` already has `max_attempts`
    recorded failures under `scope`. Pair with `record_failure`, called
    only when the attempt actually fails, so successful requests (e.g. a
    legitimate login) never erode the budget."""
    key = f'{_PREFIX}:{scope}:{identifier or "unknown"}'
    return cache.get(key, 0) >= max_attempts


def record_failure(scope: str, identifier: str | None, window_seconds: int) -> None:
    """Increments the failure counter `is_blocked` reads, creating it with
    `window_seconds` TTL on first use."""
    key = f'{_PREFIX}:{scope}:{identifier or "unknown"}'
    _incr(key, window_seconds)
