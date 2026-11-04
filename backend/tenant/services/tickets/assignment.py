from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from django.shortcuts import get_object_or_404

from shared.services.notification_preferences import NotificationSettingsService
from shared.workers.Ticket import ticket_transfer_notification, ticket_claim_task
from tenant.models import Ticket
from tenant.services.audit import actor_name, log_audit_event
from tenant.services.tickets.errors import TicketActionError
from users.models import Users


def assign(*, request) -> Dict[str, Any]:
    data = request.data
    user = request.user
    ticket_id = data.get('ticket_id')
    agent_id = data.get('agent_id')

    if not ticket_id:
        raise TicketActionError({"message": "Ticket ID is required"}, 400)

    ticket = get_object_or_404(Ticket, id=ticket_id, business=user.business)
    if ticket.status == 'closed':
        raise TicketActionError({"message": "Cannot assign a closed ticket."}, 400)

    old_assignee = ticket.assigned_to

    # Handle unassignment when agent_id is None or null
    if agent_id is None:
        ticket.assigned_to = None
        ticket.updated_at = datetime.now()
        ticket.status = 'created'
        ticket.updated_by = user
        ticket.save()

        # Create TicketActivity for unassignment
        from tenant.models import TicketActivity

        TicketActivity.objects.create(
            ticket=ticket,
            user=user,
            activity_type='unassigned',
            description=f"Ticket Unassignment\nTicket was unassigned from {old_assignee.get_full_name() if old_assignee else 'agent'}",
            old_value=old_assignee.get_full_name() if old_assignee else '',
            new_value=''  # Empty string instead of None to avoid NULL constraint error
        )

        # Notify the old assignee
        if old_assignee:
            NotificationSettingsService.create_in_app_notification(
                user=old_assignee,
                ticket=ticket,
                message=f"Ticket #{ticket.ticket_id} was unassigned from you",
                notification_type="ticket_assigned",
                metadata={
                    "unassigned": True,
                    "priority": ticket.priority,
                    "activity_type": "unassigned"
                }
            )

        # Notify department members when ticket is unassigned
        if ticket.department:
            dept_members = NotificationSettingsService.active_department_members(ticket.department)
            if old_assignee:
                dept_members = dept_members.exclude(id=old_assignee.id)

            NotificationSettingsService.notify_many(
                users=list(dept_members),
                ticket=ticket,
                message=f"Ticket #{ticket.ticket_id} is now unassigned and needs attention",
                notification_type="ticket_assigned",
                metadata={
                    "unassigned": True,
                    "department": ticket.department.name,
                    "priority": ticket.priority,
                    "activity_type": "unassigned"
                }
            )

        log_audit_event(
            request,
            event_type="TICKET_ASSIGNED",
            entity_type="ticket",
            entity=ticket,
            activity=f"{actor_name(user)} unassigned Ticket #{ticket.ticket_id}",
            metadata={
                "field_name": "assignee",
                "old_value": old_assignee.get_full_name() if old_assignee else "",
                "new_value": "",
                "entity_identifier": ticket.ticket_id,
            },
        )

        return {"message": "Ticket unassigned successfully"}

    # Handle assignment to a specific agent
    if not agent_id:
        raise TicketActionError({"message": "Agent ID is required for assignment"}, 400)

    agent = get_object_or_404(
        Users,
        id=agent_id,
        business=user.business,
        is_active=True,
        status='A',
    )
    ticket.assigned_to = agent
    ticket.updated_at = datetime.now()
    ticket.status = 'assigned'
    ticket.updated_by = user
    ticket.save()

    # Create TicketActivity for assignment
    from tenant.models import TicketActivity

    TicketActivity.objects.create(
        ticket=ticket,
        user=user,
        activity_type='assigned',
        description=f"Ticket Assignment\nTicket was assigned to {agent.get_full_name()}",
        new_value=agent.get_full_name(),
        old_value=old_assignee.get_full_name() if old_assignee else ''  # Empty string instead of None
    )

    # Create in-app notifications for assignment
    # Notify new assignee
    if agent:
        NotificationSettingsService.create_in_app_notification(
            user=agent,
            ticket=ticket,
            message=f"Ticket #{ticket.ticket_id} has been assigned to you: {ticket.title}",
            notification_type="ticket_assigned",
            metadata={
                "reassigned": bool(old_assignee),
                "previous_assignee": old_assignee.get_full_name() if old_assignee else None,
                "priority": ticket.priority,
                "activity_type": "assigned",
                "assigned_by": user.get_full_name()
            }
        )

    # Notify previous assignee if they exist
    if old_assignee and old_assignee != agent:
        new_assignee_name = agent.get_full_name() if agent else "Unassigned"
        NotificationSettingsService.create_in_app_notification(
            user=old_assignee,
            ticket=ticket,
            message=f"Ticket #{ticket.ticket_id} was reassigned from you to {new_assignee_name}",
            notification_type="ticket_assigned",
            metadata={
                "reassigned_from": True,
                "new_assignee": new_assignee_name,
                "priority": ticket.priority,
                "activity_type": "reassigned"
            }
        )
        ticket_transfer_notification.delay(ticket.id, old_assignee.get_full_name())

    # Mark first response if not already marked
    if not ticket.first_response_at:
        ticket.mark_first_response()

    log_audit_event(
        request,
        event_type="TICKET_ASSIGNED",
        entity_type="ticket",
        entity=ticket,
        activity=f"{actor_name(user)} assigned Ticket #{ticket.ticket_id} to {agent.get_full_name()}",
        metadata={
            "field_name": "assignee",
            "old_value": old_assignee.get_full_name() if old_assignee else "",
            "new_value": agent.get_full_name(),
            "entity_identifier": ticket.ticket_id,
        },
    )

    return {"message": "Ticket assigned successfully"}


def assign_to_me(*, ticket_id, user: Users) -> Dict[str, Any]:
    if not ticket_id:
        raise TicketActionError({"message": "Ticket ID are required"}, 400)

    ticket = get_object_or_404(Ticket, id=ticket_id, business=user.business)

    ticket.assigned_to = user
    ticket.updated_at = datetime.now()
    ticket.status = 'assigned'
    ticket.updated_by = user
    ticket.save()

    # Create TicketActivity for claim
    from tenant.models import TicketActivity
    from django.db import transaction

    TicketActivity.objects.create(
        ticket=ticket,
        user=user,
        activity_type='assigned',
        description=f"Ticket Assignment\nTicket was claimed by {user.get_full_name()}",
        new_value=user.get_full_name()
    )

    # The claim task is specific and not easily handled by a generic signal
    transaction.on_commit(lambda: ticket_claim_task.delay(ticket.id))

    # Mark fisrt response if not already marked
    if not ticket.first_response_at:
        ticket.mark_first_response()

    return {"message": "Ticket claimed successfully"}
