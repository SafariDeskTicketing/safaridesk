import logging
from typing import Any

from django.db import transaction

from tenant.models import TenantAuditLog

logger = logging.getLogger(__name__)

SENSITIVE_METADATA_KEYS = {
    "access",
    "access_token",
    "api_key",
    "authorization",
    "code",
    "credential",
    "credentials",
    "key",
    "new_password",
    "old_password",
    "password",
    "refresh",
    "refresh_token",
    "secret",
    "smtp_password",
    "token",
    "uid",
}
SENSITIVE_METADATA_FRAGMENTS = ("password", "secret", "token", "authorization", "credential")
MAX_METADATA_DEPTH = 4
MAX_METADATA_ITEMS = 50
MAX_METADATA_STRING_LENGTH = 500

AUDIT_EVENT_TYPE_GROUPS = {
    "Tickets": [
        "TICKET_CREATED",
        "TICKET_UPDATED",
        "TICKET_TRANSFERRED",
        "TICKET_ASSIGNED",
        "TICKET_REOPENED",
    ],
    "Tasks": ["TASK_CREATED", "TASK_UPDATED", "TASK_ASSIGNED"],
    "Contacts": [
        "CONTACT_CREATED",
        "CONTACT_UPDATED",
        "CONTACT_ARCHIVED",
        "CONTACT_RESTORED",
        "CONTACT_DELETED",
    ],
    "Users": [
        "USER_CREATED",
        "USER_UPDATED",
        "USER_DEACTIVATED",
        "USER_REACTIVATED",
        "USER_DELETED",
        "USER_LOGIN",
        "USER_LOGOUT",
        "ROLE_CHANGED",
        "PASSWORD_RESET_REQUESTED",
        "PASSWORD_RESET_COMPLETED",
        "PASSWORD_UPDATED",
        "OTP_SENT",
        "OTP_VERIFIED",
        "INVITE_SENT",
    ],
    "Organization": ["ORGANIZATION_CHANGED"],
    "Mailboxes": [
        "MAILBOX_CREATED",
        "MAILBOX_UPDATED",
        "MAILBOX_CONNECTED",
        "MAILBOX_DELETED",
    ],
    "Settings": [
        "SETTINGS_UPDATED",
        "DEPARTMENT_CREATED",
        "DEPARTMENT_UPDATED",
        "DEPARTMENT_DELETED",
        "CATEGORY_CREATED",
        "CATEGORY_UPDATED",
        "CATEGORY_DELETED",
    ],
    "Reports": [
        "REPORT_EXPORTED",
        "REPORT_EXPORT_QUEUED",
        "REPORT_EXPORT_COMPLETED",
        "REPORT_EXPORT_FAILED",
        "REPORT_EXPORT_DOWNLOADED",
    ],
    "Copilot": [
        "COPILOT_INVOKE",
        "COPILOT_CONFIRM",
        "COPILOT_EXECUTE",
        "COPILOT_REJECT",
        "COPILOT_ERROR",
    ],
    "SafariAdmin": [
        "SAFARI_ADMIN_ACTIVATED_BUSINESS",
        "SAFARI_ADMIN_SUSPEND_BUSINESS",
        "SAFARI_ADMIN_EDIT_BUSINESS_CONFIG",
        "SAFARI_ADMIN_ENABLE_USER",
        "SAFARI_ADMIN_DISABLE_USER",
        "SAFARI_ADMIN_FORCE_LOGOUT",
        "SAFARI_ADMIN_RESET_PASSWORD",
    ],
}


def _client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR") if request else None
    if forwarded:
        return forwarded.split(",", 1)[0].strip() or None
    return request.META.get("REMOTE_ADDR") if request else None


def _actor_display(user) -> str:
    if not user:
        return "System"
    is_authenticated = getattr(user, "is_authenticated", None)
    if is_authenticated is False:
        return "System"
    full_name = ""
    if hasattr(user, "full_name"):
        try:
            full_name = user.full_name()
        except TypeError:
            full_name = ""
    if not full_name and hasattr(user, "get_full_name"):
        full_name = user.get_full_name()
    return full_name or getattr(user, "email", "") or getattr(user, "username", "") or "User"


def _entity_id(entity) -> str:
    for attr in ("ticket_id", "task_trackid", "id", "pk"):
        value = getattr(entity, attr, None)
        if value not in [None, ""]:
            return str(value)
    return ""


def _entity_label(entity) -> str:
    for attr in ("title", "name", "email", "username"):
        value = getattr(entity, attr, None)
        if value:
            return str(value)
    return str(entity) if entity is not None else ""


def _resolve_business(*, request, entity, business):
    if business:
        return business
    entity_business = getattr(entity, "business", None)
    if entity_business:
        return entity_business
    if entity is not None and entity.__class__.__name__ == "Business":
        return entity
    request_user = getattr(request, "user", None)
    return getattr(request_user, "business", None)


def _is_sensitive_metadata_key(key: str) -> bool:
    key_lower = key.lower()
    return (
        key_lower in SENSITIVE_METADATA_KEYS
        or key_lower.endswith("_key")
        or any(fragment in key_lower for fragment in SENSITIVE_METADATA_FRAGMENTS)
    )


def _sanitize_metadata(value: Any, *, depth: int = 0) -> Any:
    if depth >= MAX_METADATA_DEPTH:
        return "[truncated]"
    if isinstance(value, dict):
        sanitized = {}
        for index, (key, item) in enumerate(value.items()):
            if index >= MAX_METADATA_ITEMS:
                sanitized["__truncated__"] = True
                break
            key_text = str(key)
            if _is_sensitive_metadata_key(key_text):
                sanitized[key_text] = "[redacted]"
            else:
                sanitized[key_text] = _sanitize_metadata(item, depth=depth + 1)
        return sanitized
    if isinstance(value, (list, tuple, set)):
        items = list(value)
        sanitized_items = [
            _sanitize_metadata(item, depth=depth + 1)
            for item in items[:MAX_METADATA_ITEMS]
        ]
        if len(items) > MAX_METADATA_ITEMS:
            sanitized_items.append("[truncated]")
        return sanitized_items
    if isinstance(value, str):
        if len(value) > MAX_METADATA_STRING_LENGTH:
            return f"{value[:MAX_METADATA_STRING_LENGTH]}..."
        return value
    return value


def log_audit_event(
    request,
    *,
    event_type: str,
    entity_type: str,
    entity,
    activity: str,
    metadata: dict[str, Any] | None = None,
    actor_user=None,
    business=None,
) -> None:
    """Write an audit log after the current transaction commits."""
    try:
        resolved_business = _resolve_business(request=request, entity=entity, business=business)
        if not resolved_business:
            logger.warning("tenant_audit_missing_business", extra={"event_type": event_type})
            return

        user = actor_user if actor_user is not None else getattr(request, "user", None)
        authenticated_user = user if user and getattr(user, "is_authenticated", False) else None
        from users.models import Users

        actor = authenticated_user if isinstance(authenticated_user, Users) else None
        actor_snapshot = user if actor_user is not None else authenticated_user
        actor_name = _actor_display(actor_snapshot)
        actor_email = getattr(actor_snapshot, "email", "") if actor_snapshot else ""
        actor_avatar_url = getattr(actor_snapshot, "avatar_url", "") if actor_snapshot else ""
        payload = {
            "business": resolved_business,
            "actor": actor,
            "actor_name": actor_name,
            "actor_email": actor_email,
            "actor_avatar_url": actor_avatar_url or "",
            "event_type": event_type,
            "entity_type": entity_type,
            "entity_id": _entity_id(entity),
            "entity_label": _entity_label(entity)[:255],
            "activity": activity,
            "metadata": _sanitize_metadata(metadata or {}),
            "ip_address": _client_ip(request),
            "user_agent": (request.META.get("HTTP_USER_AGENT", "") if request else "")[:500],
            "request_path": (request.path if request else "")[:500],
            "request_method": (request.method if request else "")[:10],
        }

        def _create() -> None:
            try:
                TenantAuditLog.objects.create(**payload)
            except Exception as exc:
                logger.warning("tenant_audit_write_failed: %s", exc)

        transaction.on_commit(_create)
    except Exception as exc:
        logger.warning("tenant_audit_prepare_failed: %s", exc)


def actor_name(user) -> str:
    return _actor_display(user)
