from __future__ import annotations

import logging
from typing import Any, Dict

from django.utils import timezone

from shared.services.notification_preferences import NotificationSettingsService
from tenant.models import Ticket
from tenant.serializers.TicketSerializer import TicketMergeRequestSerializer
from tenant.services.audit import actor_name, log_audit_event
from tenant.services.tickets.errors import TicketActionError

logger = logging.getLogger(__name__)


def merge(*, request, primary_id) -> Dict[str, Any]:
    """
    Merge one or more tickets into this ticket (primary).
    Soft-link strategy: mark source tickets as merged/closed without moving related records.
    """
    user = request.user
    serializer = TicketMergeRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    source_ids = serializer.validated_data.get('source_ids', [])
    note = serializer.validated_data.get('note', '')

    try:
        primary = Ticket.objects.select_for_update().get(id=primary_id, business=user.business)
    except Ticket.DoesNotExist:
        raise TicketActionError({"message": "Primary ticket not found"}, 404)

    # Prevent self-merge
    if primary.id in source_ids:
        raise TicketActionError({"message": "Cannot merge a ticket into itself"}, 400)

    # Fetch source tickets with lock
    sources = list(
        Ticket.objects.select_for_update()
        .filter(id__in=source_ids, business=user.business)
    )

    if len(sources) != len(set(source_ids)):
        raise TicketActionError({"message": "One or more source tickets were not found"}, 404)

    # Department visibility restriction for agents
    if user.role and user.role.name == 'agent':
        agent_departments = user.department.all()
        # primary must be in agent departments
        if primary.department not in agent_departments:
            raise TicketActionError({"message": "You do not have permission to merge into this ticket"}, 403)
        for src in sources:
            if src.department not in agent_departments:
                raise TicketActionError({"message": f"No permission to merge ticket {src.ticket_id}"}, 403)

    merged_ticket_ids = []

    for src in sources:
        old_status = src.status
        if src.is_merged:
            raise TicketActionError({"message": f"Ticket {src.ticket_id} is already merged"}, 400)
        # Mark as merged/closed
        src.is_merged = True
        src.merged_into = primary
        src.merged_by = user if user.is_authenticated else None
        src.merged_at = timezone.now()
        src.merge_note = note
        src.status = 'closed'
        src.resolved_at = timezone.now()
        src.is_sla_paused = True
        src.save()

        # Activity on source
        from tenant.models import TicketActivity
        # First, record a merge event with explicit target ticket info
        TicketActivity.objects.create(
            ticket=src,
            user=user,
            activity_type='merged',
            description=f"Merged into {primary.ticket_id}",
            old_value='',
            new_value=primary.ticket_id,
        )
        # Then, record the closure
        TicketActivity.objects.create(
            ticket=src,
            user=user,
            activity_type='closed',
            description=f"Ticket merged into {primary.ticket_id}",
            old_value=old_status,
            new_value='closed'
        )

        merged_ticket_ids.append(src.ticket_id)

    # Activity on primary
    if merged_ticket_ids:
        from tenant.models import TicketActivity, TicketComment
        merged_list = ", ".join(merged_ticket_ids)
        TicketActivity.objects.create(
            ticket=primary,
            user=user,
            activity_type='merged',
            description=f"Merged tickets: {merged_list}",
            old_value='',
            new_value=merged_list
        )
        TicketComment.objects.create(
            ticket=primary,
            author=user if user.is_authenticated else None,
            content=f"**Merged tickets**: {merged_list}\n\n{note}" if note else f"**Merged tickets**: {merged_list}",
            is_internal=True
        )

    def _collect_recipients(ticket_obj):
        recipients = []
        if NotificationSettingsService.is_delivery_eligible_user(ticket_obj.assigned_to):
            recipients.append(ticket_obj.assigned_to)
        if NotificationSettingsService.is_delivery_eligible_user(ticket_obj.created_by):
            recipients.append(ticket_obj.created_by)
        for watcher in NotificationSettingsService.active_ticket_watchers(ticket_obj):
            recipients.append(watcher)
        if ticket_obj.department:
            dept_members = NotificationSettingsService.active_department_members(ticket_obj.department)
            recipients.extend(list(dept_members))
        return recipients

    def _dedupe(users):
        seen = set()
        unique = []
        for u in users:
            if not u or not u.id:
                continue
            if u.id not in seen:
                seen.add(u.id)
                unique.append(u)
        return unique

    primary_recipients = []
    source_recipients = []

    # In-app notifications (deduped)
    try:
        merged_list_str = ", ".join(merged_ticket_ids)

        # Notify primary side
        primary_recipients = _dedupe([u for u in _collect_recipients(primary) if u != user])

        # Notify source side (aggregate)
        aggregate_source_recipients = []
        for src in sources:
            aggregate_source_recipients.extend(_collect_recipients(src))
        source_recipients = _dedupe([u for u in aggregate_source_recipients if u != user])

        if primary_recipients:
            NotificationSettingsService.notify_many(
                users=primary_recipients,
                ticket=primary,
                message=f"Tickets merged into #{primary.ticket_id}: {merged_list_str}",
                notification_type="ticket_status_changed",
                metadata={
                    "merged_tickets": merged_ticket_ids,
                    "activity_type": "merged",
                    "note": note,
                }
            )

        for src in sources:
            src_recipients = _dedupe([
                u for u in _collect_recipients(src)
                if u != user
            ])
            if not src_recipients:
                continue
            NotificationSettingsService.notify_many(
                users=src_recipients,
                ticket=src,
                message=f"Ticket #{src.ticket_id} was merged into #{primary.ticket_id}",
                notification_type="ticket_status_changed",
                metadata={
                    "merged_into": primary.ticket_id,
                    "activity_type": "merged",
                    "note": note,
                }
            )
    except Exception as notif_error:
        logger.error(f"Merge notifications failed: {notif_error}")

    # DISABLED: Activity email notifications are turned off
    # try:
    #     # Primary recipients: use NEW_ACTIVITY_NOTICE
    #     email_recipients = set()
    #     for user_obj in primary_recipients:
    #         if getattr(user_obj, "email", None):
    #             email_recipients.add(user_obj.email)
    #     for email in email_recipients:
    #         _send_ticket_notification(primary.id, "NEW_ACTIVITY_NOTICE", email)
    #
    #     for src in sources:
    #         src_email_recipients = set()
    #         for user_obj in _collect_recipients(src):
    #             if getattr(user_obj, "email", None) and user_obj != request.user:
    #                 src_email_recipients.add(user_obj.email)
    #         for email in src_email_recipients:
    #             _send_ticket_notification(src.id, "NEW_ACTIVITY_NOTICE", email)
    # except Exception as email_error:
    #     logger.error(f"Merge email notifications failed: {email_error}")

    if merged_ticket_ids:
        log_audit_event(
            request,
            event_type="TICKET_UPDATED",
            entity_type="ticket",
            entity=primary,
            activity=f"{actor_name(user)} merged tickets {', '.join(merged_ticket_ids)} into Ticket #{primary.ticket_id}",
            metadata={
                "field_name": "merged_tickets",
                "old_value": "",
                "new_value": ", ".join(merged_ticket_ids),
                "merged_tickets": merged_ticket_ids,
                "entity_identifier": primary.ticket_id,
                "note": note,
            },
        )

    return {
        "message": "Tickets merged successfully",
        "primary_ticket": primary.ticket_id,
        "merged_tickets": merged_ticket_ids
    }
