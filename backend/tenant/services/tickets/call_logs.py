from __future__ import annotations

import logging
import re
from typing import Any, Dict

from django.shortcuts import get_object_or_404

from tenant.models import Contact, Ticket
from tenant.models.TicketModel import TicketCallLog
from tenant.services.audit import actor_name, log_audit_event
from tenant.services.tickets.activity_stream import _serialize_call_log_activity
from tenant.services.tickets.errors import TicketActionError
from tenant.services.tickets.shared import resolve_staff_user, sanitize_text_for_mysql

logger = logging.getLogger(__name__)


def log_call(*, request, ticket_id) -> Dict[str, Any]:
    user = request.user
    actor = resolve_staff_user(user)
    if not actor:
        raise TicketActionError({"message": "Only staff users can log calls."}, 403)
    if not ticket_id:
        raise TicketActionError({"message": "Ticket ID is required"}, 400)

    data = request.data
    subject = (data.get("subject") or "").strip()
    content = data.get("content") or data.get("comments") or ""
    content = sanitize_text_for_mysql(content) if content else content
    duration = (data.get("duration") or "").strip()
    contact_name = (data.get("contact_name") or "").strip()
    contact_email = (data.get("contact_email") or "").strip().lower()
    contact_id = data.get("contact_id")

    plain_content = re.sub(r"<[^>]+>", "", content or "").replace("&nbsp;", " ").strip()
    if not subject:
        raise TicketActionError({"message": "Subject is required"}, 400)
    if not plain_content:
        raise TicketActionError({"message": "Comments are required"}, 400)

    ticket = get_object_or_404(Ticket, id=ticket_id, business=user.business)

    contact = None
    if contact_id not in [None, "", "null", "undefined"]:
        try:
            contact = Contact.objects.get(
                id=int(contact_id),
                business=user.business,
                is_deleted=False,
            )
        except (TypeError, ValueError, Contact.DoesNotExist):
            raise TicketActionError({"message": "Selected contact was not found."}, 400)
    elif ticket.contact_id:
        contact = ticket.contact

    if contact:
        contact_name = contact_name or contact.name
        contact_email = contact_email or (contact.email or "")
    else:
        contact_name = contact_name or ticket.creator_name or ""
        contact_email = contact_email or ticket.creator_email or ""

    call_log = TicketCallLog.objects.create(
        business=ticket.business,
        ticket=ticket,
        contact=contact,
        logged_by=actor,
        subject=subject,
        content=content,
        contact_name=contact_name,
        contact_email=contact_email,
        duration=duration,
        is_internal=True,
        created_by=actor,
        updated_by=actor,
    )

    log_audit_event(
        request,
        event_type="TICKET_CALL_LOGGED",
        entity_type="ticket",
        entity=ticket,
        activity=f"{actor_name(actor)} logged a call on ticket #{ticket.ticket_id}",
        metadata={"call_log_id": call_log.id, "subject": call_log.subject},
    )

    try:
        from shared.services.ticket_broadcast import broadcast_ticket_event
        broadcast_ticket_event(
            ticket.business_id,
            {
                "ticket_id": ticket.id,
                "event": "call_logged",
                "call_log_id": call_log.id,
            },
        )
    except Exception:
        logger.exception("Failed to broadcast call log event for ticket %s", ticket.id)

    return _serialize_call_log_activity(call_log, ticket)
