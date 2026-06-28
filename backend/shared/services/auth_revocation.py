from __future__ import annotations

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken


logger = logging.getLogger(__name__)


def is_user_active(user) -> bool:
    return bool(user and getattr(user, "is_active", False) and getattr(user, "status", None) == "A")


def ensure_user_token_is_current(user, raw_issued_at, token_session_version=None) -> None:
    if not is_user_active(user):
        raise InvalidToken("User account is disabled.")

    _ = raw_issued_at
    if token_session_version is None:
        raise InvalidToken("Session is invalid. Please sign in again.")

    try:
        token_version = int(token_session_version)
        user_version = int(getattr(user, "auth_session_version", 0))
    except (TypeError, ValueError):
        raise InvalidToken("Session is invalid. Please sign in again.")

    if token_version != user_version:
        raise InvalidToken("Session has been revoked. Please sign in again.")


def blacklist_outstanding_tokens(user) -> int:
    blacklisted = 0
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
        blacklisted += 1
    return blacklisted


def broadcast_session_revoked(user, *, reason: str = "session_revoked", close_code: int = 4005) -> None:
    user_id = getattr(user, "id", None)
    if not user_id:
        return

    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    try:
        async_to_sync(channel_layer.group_send)(
            f"user_session_{user_id}",
            {
                "type": "session_revoked",
                "reason": reason,
                "close_code": close_code,
            },
        )
    except Exception:
        logger.exception(
            "Failed to broadcast session revocation for user_id=%s",
            user_id,
        )


def invalidate_user_sessions(user, *, reason: str = "session_revoked", close_code: int = 4005) -> int:
    blacklisted = blacklist_outstanding_tokens(user)
    broadcast_session_revoked(user, reason=reason, close_code=close_code)
    return blacklisted
