import logging

from celery import shared_task

from shared.models import TeamsIntegration
from shared.services.TeamsService import TeamsService

logger = logging.getLogger(__name__)


@shared_task
def notify_teams_ticket_update(ticket_id, update_type, user_id=None):
    """
    Notify Microsoft Teams about a ticket update.

    Args:
        ticket_id (int): ID of the ticket that was updated
        update_type (str): Type of update - 'new_ticket', 'assignment', 'status_update', 'comment', 'sla_breach'
        user_id (int, optional): ID of the user who made the update
    """
    try:
        from tenant.models import Ticket
        from users.models import Users

        ticket = Ticket.objects.select_related('business', 'assigned_to', 'created_by').get(id=ticket_id)

        integration = TeamsIntegration.objects.filter(
            business=ticket.business,
            is_active=True,
        ).first()

        if not integration:
            return False

        if not integration.default_channel_id:
            logger.info("teams_no_default_channel", extra={"integration_id": integration.id})
            return False

        notification_enabled = {
            'new_ticket': integration.notify_new_tickets,
            'assignment': integration.notify_assignments,
            'status_update': integration.notify_status_updates,
            'sla_breach': integration.notify_sla_breaches,
            'comment': integration.notify_comments,
        }.get(update_type, False)

        if not notification_enabled:
            logger.info("teams_notification_disabled", extra={"notification_type": update_type})
            return False

        ticket_data = {
            'id': ticket.ticket_id,
            'title': ticket.title,
            'priority': ticket.priority,
            'status': ticket.get_status_display(),
            'assignee': {
                'name': ticket.assigned_to.get_full_name() if ticket.assigned_to else 'Unassigned'
            },
            'creator': {
                'name': ticket.creator_name,
                'email': ticket.creator_email,
            },
        }

        if update_type == 'comment':
            from tenant.models import TicketComment

            if user_id:
                user = Users.objects.filter(id=user_id).first()
                if user:
                    ticket_data['comment'] = {
                        'author': user.get_full_name() or user.email or 'User',
                    }

        message, card = TeamsService.format_ticket_notification(ticket_data, update_type)

        access_token = TeamsService.ensure_valid_token(integration)
        success = TeamsService.send_channel_message(
            access_token,
            integration.team_id,
            integration.default_channel_id,
            message,
            card,
        )

        if success:
            logger.info(
                "teams_notification_sent",
                extra={"ticket_id": ticket.ticket_id, "notification_type": update_type},
            )
        else:
            logger.error(
                "teams_notification_failed",
                extra={"ticket_id": ticket.ticket_id, "notification_type": update_type},
            )

        return success

    except Ticket.DoesNotExist:
        logger.error(f"Ticket with id {ticket_id} not found for Teams notification.")
        return False
    except Exception as e:
        logger.exception("teams_notification_error", extra={"ticket_id": ticket_id, "error": str(e)})
        return False
