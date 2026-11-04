from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from django.shortcuts import get_object_or_404

from tenant.models import Department, Ticket, TicketCategories
from tenant.services.audit import actor_name, log_audit_event
from tenant.services.tickets.errors import TicketActionError


def update_department(*, request, ticket_id) -> Dict[str, Any]:
    user = request.user
    ticket = get_object_or_404(Ticket, id=ticket_id, business=user.business)

    # Prevent modification of closed tickets
    if ticket.status == 'closed':
        raise TicketActionError(
            {"message": "Cannot modify a closed ticket. Please reopen it first."}, 400
        )

    department_id = request.data.get("department_id")
    old_department = ticket.department

    if not department_id:
        raise TicketActionError({"message": "Department ID is required"}, 400)

    # Verify the department exists and belongs to the business
    try:
        department = Department.objects.get(id=department_id, business=user.business)
    except Department.DoesNotExist:
        raise TicketActionError({"message": "Department not found"}, 404)

    # Update the ticket department
    ticket.department = department
    ticket.updated_at = datetime.now()
    ticket.updated_by = user
    ticket.save()

    # Create a TicketActivity for the department change
    from tenant.models import TicketActivity

    TicketActivity.objects.create(
        ticket=ticket,
        user=user,
        activity_type='department_changed',
        description=f"Ticket department changed from {old_department.name if old_department else 'None'} to {department.name}",
        old_value=old_department.name if old_department else 'None',
        new_value=department.name
    )

    log_audit_event(
        request,
        event_type="TICKET_TRANSFERRED",
        entity_type="ticket",
        entity=ticket,
        activity=f"{actor_name(user)} transferred Ticket #{ticket.ticket_id} from {old_department.name if old_department else 'None'} to {department.name}",
        metadata={
            "field_name": "department",
            "old_value": old_department.name if old_department else "None",
            "new_value": department.name,
            "from_department": old_department.name if old_department else "",
            "to_department": department.name,
            "entity_identifier": ticket.ticket_id,
        },
    )

    return {"message": "Ticket department updated successfully"}


def update_category(*, request, ticket_id) -> Dict[str, Any]:
    user = request.user
    ticket = get_object_or_404(Ticket, id=ticket_id, business=user.business)

    # Prevent modification of closed tickets
    if ticket.status == 'closed':
        raise TicketActionError(
            {"message": "Cannot modify a closed ticket. Please reopen it first."}, 400
        )

    category_id = request.data.get("category_id")
    old_category = ticket.category

    if not category_id:
        raise TicketActionError({"message": "Category ID is required"}, 400)

    # Verify the category exists and belongs to the business context
    try:
        category = TicketCategories.objects.get(id=category_id, business=user.business)
    except TicketCategories.DoesNotExist:
        raise TicketActionError({"message": "Category not found"}, 404)

    # Update the ticket category
    ticket.category = category
    ticket.updated_at = datetime.now()
    ticket.updated_by = user
    ticket.save()

    # Create a TicketActivity for the category change
    from tenant.models import TicketActivity
    TicketActivity.objects.create(
        ticket=ticket,
        user=user,
        activity_type='category_changed',
        description=f"Ticket category changed from {old_category.name if old_category else 'None'} to {category.name}",
        old_value=old_category.name if old_category else 'None',
        new_value=category.name
    )

    log_audit_event(
        request,
        event_type="TICKET_UPDATED",
        entity_type="ticket",
        entity=ticket,
        activity=f"{actor_name(user)} changed Ticket #{ticket.ticket_id} category from {old_category.name if old_category else 'None'} to {category.name}",
        metadata={
            "field_name": "category",
            "old_value": old_category.name if old_category else "None",
            "new_value": category.name,
            "entity_identifier": ticket.ticket_id,
        },
    )

    return {"message": "Ticket category updated successfully"}


def update_priority(*, request, ticket_id) -> Dict[str, Any]:
    user = request.user
    ticket = get_object_or_404(Ticket, id=ticket_id, business=user.business)

    # Prevent modification of closed tickets
    if ticket.status == 'closed':
        raise TicketActionError(
            {"message": "Cannot modify a closed ticket. Please reopen it first."}, 400
        )

    new_priority = request.data.get('priority')
    old_priority = ticket.priority

    if not new_priority:
        raise TicketActionError({"message": "Priority is required"}, 400)

    # Validate priority value (optional: ensure it's one of allowed choices)
    ticket.priority = new_priority
    ticket.updated_at = datetime.now()
    ticket.updated_by = user
    ticket.save()

    # Create TicketActivity for priority change
    from tenant.models import TicketActivity
    TicketActivity.objects.create(
        ticket=ticket,
        user=user,
        activity_type='priority_changed',
        description=f"Ticket priority changed from {old_priority} to {new_priority}",
        old_value=old_priority,
        new_value=new_priority
    )

    log_audit_event(
        request,
        event_type="TICKET_UPDATED",
        entity_type="ticket",
        entity=ticket,
        activity=f"{actor_name(user)} changed Ticket #{ticket.ticket_id} priority from {old_priority} to {new_priority}",
        metadata={
            "field_name": "priority",
            "old_value": old_priority,
            "new_value": new_priority,
            "entity_identifier": ticket.ticket_id,
        },
    )

    return {"message": "Ticket priority updated successfully"}


def update_source(*, request, ticket_id) -> Dict[str, Any]:
    """Ticket source editing is disabled."""
    return {"message": "Editing ticket source is not allowed."}
