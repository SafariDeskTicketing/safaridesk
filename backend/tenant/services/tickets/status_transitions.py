from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict

from django.shortcuts import get_object_or_404
from django.utils import timezone

from shared.services.notification_preferences import NotificationSettingsService
from tenant.models import Task, Ticket
from tenant.models.TicketModel import TicketComment, TicketReopen
from tenant.services.audit import actor_name, log_audit_event
from tenant.services.tickets.errors import TicketActionError
from tenant.services.tickets.shared import resolve_staff_user


def update_status(*, request, ticket_id) -> Dict[str, Any]:
    user = request.user
    ticket = get_object_or_404(Ticket, id=ticket_id, business=user.business)
    if ticket.status == 'closed':
        raise TicketActionError(
            {"message": "Cannot update status of a closed ticket. Please reopen it first."}, 400
        )
    new_status = request.data.get("status")
    old_status = ticket.status
    notes = request.data.get('notes')
    actor_user = resolve_staff_user(user)

    if not new_status:
        raise TicketActionError({"message": "Status is required"}, 400)

    # Prevent closing ticket if there are incomplete tasks
    if new_status in ['closed', 'resolved']:
        incomplete_tasks = Task.objects.filter(
            linked_ticket=ticket,
            is_archived=False,
            is_deleted=False
        ).exclude(task_status__in=['completed', 'cancelled'])

        if incomplete_tasks.exists():
            incomplete_count = incomplete_tasks.count()
            raise TicketActionError(
                {
                    "message": f"Cannot close ticket. There {'is' if incomplete_count == 1 else 'are'} {incomplete_count} incomplete task{'s' if incomplete_count > 1 else ''} linked to this ticket. Please complete or cancel all tasks before closing the ticket."
                },
                400,
            )

    # Enforce ownership before any manual status transition for staff.
    # Determine if this is a customer session (no audit fields needed)
    is_customer_session = actor_user is None
    if not ticket.assigned_to and not is_customer_session:
        raise TicketActionError(
            {"message": "Please assign this ticket before changing its status. Use 'Assign to me' to take ownership."},
            403,
        )

    if new_status == 'on_hold':
        ticket.pause_sla(reason=notes)
    elif old_status == 'on_hold' and new_status != 'on_hold':
        ticket.resume_sla()

    # Note: 'resolved' is now a valid status, don't auto-close
    # Only set resolved_at when resolving
    if new_status == 'resolved' and old_status != 'resolved':
        ticket.resolved_at = timezone.now()

    # Update the ticket status
    ticket.status = new_status
    ticket.notes = notes
    ticket.updated_at = datetime.now()
    ticket.updated_by = actor_user
    ticket.save()

    # Create a TicketComment for notes if provided
    if notes:
        TicketComment.objects.create(
            ticket=ticket,
            author=actor_user,
            content=f"**Status Update Note**\n\n{notes}",
            is_internal=False
        )

    # Create a TicketActivity for the status update
    from tenant.models import TicketActivity

    # Get display name for the status
    status_display = dict(Ticket.STATUS_CHOICES).get(new_status, new_status.replace('_', ' ').title())
    user_name = user.get_full_name() or user.email

    TicketActivity.objects.create(
        ticket=ticket,
        user=actor_user,
        activity_type='status_changed',
        description=f"{user_name} changed the ticket status to {status_display}",
        old_value=old_status,
        new_value=new_status
    )

    audit_type = "TICKET_REOPENED" if old_status in ["resolved", "closed"] and new_status in ["open", "in_progress"] else "TICKET_UPDATED"
    log_audit_event(
        request,
        event_type=audit_type,
        entity_type="ticket",
        entity=ticket,
        activity=f"{actor_name(user)} changed Ticket #{ticket.ticket_id} status from {old_status} to {new_status}",
        metadata={
            "field_name": "status",
            "old_value": old_status,
            "new_value": new_status,
            "entity_identifier": ticket.ticket_id,
            "notes": notes or "",
        },
    )

    # Create in-app notification for status change
    if ticket.assigned_to:
        status_message = f"Ticket #{ticket.ticket_id} status changed from {old_status.title()} to {new_status.title()}"

        # Special handling for reopened tickets
        if old_status in ["resolved", "closed"] and new_status in ["open", "in_progress"]:
            notification_type = "ticket_reopened"
            status_message = f"Ticket #{ticket.ticket_id} has been reopened"
        else:
            notification_type = "ticket_status_changed"

        NotificationSettingsService.create_in_app_notification(
            user=ticket.assigned_to,
            ticket=ticket,
            message=status_message,
            notification_type=notification_type,
            metadata={
                "old_status": old_status,
                "new_status": new_status,
                "priority": ticket.priority,
                "activity_type": "status_changed",
                "changed_by": user.get_full_name()
            }
        )

    return {"message": "Ticket status updated successfully"}


def reopen(*, request, ticket_id, reason) -> Dict[str, Any]:
    user = request.user
    actor_user = resolve_staff_user(user)

    ticket = get_object_or_404(Ticket, id=ticket_id, business=user.business)

    if ticket.status not in ('closed', 'resolved'):
        raise TicketActionError(
            {"message": "Only closed or resolved tickets can be reopened."}, 400
        )

    last_closed_at = ticket.resolved_at or ticket.updated_at or ticket.created_at
    if last_closed_at and timezone.now() - last_closed_at > timedelta(days=7):
        raise TicketActionError(
            {"message": "This ticket can only be reopened within 7 days of being closed."}, 400
        )

    # Reopen ticket
    old_status = ticket.status
    ticket.status = 'open'
    ticket.resolved_at = None
    ticket.updated_at = timezone.now()
    ticket.updated_by = actor_user
    ticket.save()

    # Create a record of the reopen event
    if actor_user:
        TicketReopen.objects.create(
            ticket=ticket,
            reopened_by=actor_user,
            reason=reason
        )

    # Create a TicketComment for reopen action (so it appears in activity stream)
    TicketComment.objects.create(
        ticket=ticket,
        author=actor_user,
        content=f"**Ticket Reopened**\n\nReason: {reason}",
        is_internal=False
    )

    # Create TicketActivity for reopen action
    from tenant.models import TicketActivity

    TicketActivity.objects.create(
        ticket=ticket,
        user=actor_user,
        activity_type='status_changed',
        description=f"Ticket has been reopened by {user.get_full_name()}\nReason: {reason}",
        old_value=old_status,
        new_value='open'
    )

    log_audit_event(
        request,
        event_type="TICKET_REOPENED",
        entity_type="ticket",
        entity=ticket,
        activity=f"{actor_name(user)} reopened Ticket #{ticket.ticket_id}",
        metadata={
            "field_name": "status",
            "old_value": old_status,
            "new_value": "open",
            "reason": reason,
            "entity_identifier": ticket.ticket_id,
        },
    )

    # NOTIFICATIONS ARE NOW HANDLED BY SIGNAL HANDLER in shared/signals/notifications.py
    # The signal automatically creates notification for ticket reopened
    # DO NOT create notifications here - it will create duplicates!

    return {"message": "Ticket reopened successfully"}
