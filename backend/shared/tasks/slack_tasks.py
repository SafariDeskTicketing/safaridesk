import logging
from celery import shared_task
from shared.models import SlackIntegration, SlackTicketMapping
from shared.services import SlackService

logger = logging.getLogger(__name__)

@shared_task
def process_slack_event(event_payload, integration_id):
    """
    Celery task to process Slack events asynchronously.
    
    Args:
        event_payload (dict): The raw Slack event payload
        integration_id (int): ID of the SlackIntegration instance
    """
    try:
        # Get the Slack integration by ID
        integration = SlackIntegration.objects.get(id=integration_id)
        
        # Create SlackService instance with the integration
        slack_service = SlackService(integration=integration)
        
        # Process the event
        slack_service.process_event(event_payload)
        
        logger.info(f"Successfully processed Slack event for integration {integration_id}")
        return True
        
    except SlackIntegration.DoesNotExist:
        logger.error(f"SlackIntegration with ID {integration_id} not found")
        return False
    except Exception as e:
        logger.error(f"Error processing Slack event: {str(e)}")
        # Consider adding retry logic here if needed
        return False


@shared_task
def notify_slack_ticket_update(ticket_id, update_type, user_id=None):
    """
    Notify Slack of a ticket update (status, assignee, priority, comment).
    
    Args:
        ticket_id (int): ID of the ticket that was updated
        update_type (str): Type of update - 'status', 'assignee', 'priority', 'comment'
        user_id (int, optional): ID of the user who made the update
    """
    try:
        from tenant.models import Ticket
        from users.models import Users
        
        ticket = Ticket.objects.select_related('business').get(id=ticket_id)
        
        # Check if this ticket has a Slack mapping
        if not SlackTicketMapping.objects.filter(ticket=ticket).exists():
            return False  # Not a Slack-originated ticket
        
        slack_service = SlackService(integration=None)
        user = Users.objects.get(id=user_id) if user_id else None
        
        return slack_service.post_ticket_update_to_slack(ticket, update_type, user)
        
    except Ticket.DoesNotExist:
        logger.error(f"Ticket with id {ticket_id} not found.")
        return False
    except Exception as e:
        logger.error(f"Error notifying Slack of ticket update: {str(e)}")
        return False