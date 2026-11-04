from __future__ import annotations

from typing import Any, Dict

from tenant.models.ConfigModel import TicketConfig
from tenant.services.audit import actor_name, log_audit_event
from tenant.services.tickets.errors import TicketActionError
from tenant.services.tickets.naming import (
    DEFAULT_TICKET_TITLE_FORMAT,
    SUPPORTED_TITLE_TOKENS,
    validate_title_format,
)


def _require_admin(user) -> None:
    user_role = user.role.name if user.role else None
    if user_role not in ['admin', 'super_admin']:
        raise TicketActionError(
            {'error': 'Permission denied. Only admins can access settings.'}, 403
        )


def get_config(*, user) -> Dict[str, Any]:
    """
    Get ticket configuration for the current business.
    Admin-only endpoint.
    """
    user_role = user.role.name if user.role else None
    if user_role not in ['admin', 'super_admin']:
        raise TicketActionError(
            {'error': 'Permission denied. Only admins can access settings.'}, 403
        )

    config = TicketConfig.objects.for_business().first()

    if not config:
        # Return default configuration
        return {
            "id_format": "ITK-{YYYY}-{####}",
            "title_format": DEFAULT_TICKET_TITLE_FORMAT,
        }

    return {
        "id_format": config.id_format,
        "title_format": config.title_format or DEFAULT_TICKET_TITLE_FORMAT,
    }


def update_config(*, request) -> Dict[str, Any]:
    """
    Create or update ticket configuration for the current business.
    Admin-only endpoint.
    """
    user = request.user
    user_role = user.role.name if user.role else None
    if user_role not in ['admin', 'super_admin']:
        raise TicketActionError(
            {'error': 'Permission denied. Only admins can modify settings.'}, 403
        )

    title_format = request.data.get("title_format", DEFAULT_TICKET_TITLE_FORMAT)
    if not isinstance(title_format, str) or not title_format.strip():
        title_format = DEFAULT_TICKET_TITLE_FORMAT
    title_format = title_format.strip()

    is_valid, invalid_tokens = validate_title_format(title_format)
    if not is_valid:
        raise TicketActionError(
            {
                "error": "Invalid title format tokens",
                "invalid_tokens": invalid_tokens,
                "supported_tokens": sorted(list(SUPPORTED_TITLE_TOKENS)),
            },
            400,
        )

    config, created = TicketConfig.objects.update_or_create(
        business=user.business,
        defaults={
            "id_format": request.data.get("id_format", "ITK-{YYYY}-{####}"),
            "title_format": title_format,
            "updated_by": user,
        }
    )
    log_audit_event(
        request,
        event_type="SETTINGS_UPDATED",
        entity_type="settings",
        entity=config,
        activity=f"{actor_name(user)} updated ticket settings",
        metadata={"area": "ticket", "created": created},
    )

    return {
        "message": "Ticket settings saved successfully",
        "created": created
    }
