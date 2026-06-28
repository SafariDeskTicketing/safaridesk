"""
Safari SMS notification tasks for ticket events.
Sends SMS and WhatsApp notifications to customers and agents based on Safari SMS configuration.
"""
import logging
from celery import shared_task

from shared.services.SafariSmsNotificationService import SafariSmsNotificationService

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_safari_sms_new_ticket(self, ticket_id: int):
    """Send Safari SMS notification for new ticket creation"""
    try:
        from tenant.models import Ticket
        ticket = Ticket.objects.select_related('business', 'created_by', 'assigned_to').get(id=ticket_id)
        
        if not SafariSmsNotificationService.is_enabled_for_business(ticket.business):
            logger.debug(f"Safari SMS not enabled for business {ticket.business.id}")
            return
        
        result = SafariSmsNotificationService.notify_new_ticket(ticket)
        logger.info(f"Safari SMS new ticket notification sent for ticket {ticket_id}: {result}")
        
    except Exception as e:
        logger.error(f"Error sending Safari SMS new ticket notification: {str(e)}")
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_safari_sms_status_update(self, ticket_id: int, old_status: str, new_status: str):
    """Send Safari SMS notification for ticket status update"""
    try:
        from tenant.models import Ticket
        ticket = Ticket.objects.select_related('business', 'created_by', 'assigned_to').get(id=ticket_id)
        
        if not SafariSmsNotificationService.is_enabled_for_business(ticket.business):
            return
        
        # Special handling for resolved status
        if new_status in ['resolved', 'closed']:
            result = SafariSmsNotificationService.notify_ticket_resolved(ticket)
        else:
            result = SafariSmsNotificationService.notify_status_update(ticket, old_status, new_status)
        
        logger.info(f"Safari SMS status update notification sent for ticket {ticket_id}: {result}")
        
    except Exception as e:
        logger.error(f"Error sending Safari SMS status update notification: {str(e)}")
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_safari_sms_ticket_assigned(self, ticket_id: int, agent_id: int):
    """Send Safari SMS notification when ticket is assigned"""
    try:
        from tenant.models import Ticket
        from users.models import Users
        
        ticket = Ticket.objects.select_related('business', 'created_by', 'assigned_to').get(id=ticket_id)
        agent = Users.objects.get(id=agent_id)
        
        if not SafariSmsNotificationService.is_enabled_for_business(ticket.business):
            return
        
        result = SafariSmsNotificationService.notify_ticket_assigned(ticket, agent)
        logger.info(f"Safari SMS ticket assigned notification sent for ticket {ticket_id}: {result}")
        
    except Exception as e:
        logger.error(f"Error sending Safari SMS ticket assigned notification: {str(e)}")
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_safari_sms_mention(self, ticket_id: int, mentioned_user_id: int, mentioned_by_id: int):
    """Send Safari SMS notification when user is mentioned"""
    try:
        from tenant.models import Ticket
        from users.models import Users
        
        ticket = Ticket.objects.select_related('business', 'created_by', 'assigned_to').get(id=ticket_id)
        mentioned_user = Users.objects.get(id=mentioned_user_id)
        mentioned_by = Users.objects.get(id=mentioned_by_id) if mentioned_by_id else None
        
        if not SafariSmsNotificationService.is_enabled_for_business(ticket.business):
            return
        
        result = SafariSmsNotificationService.notify_mention(ticket, mentioned_user, mentioned_by)
        logger.info(f"Safari SMS mention notification sent for ticket {ticket_id}: {result}")
        
    except Exception as e:
        logger.error(f"Error sending Safari SMS mention notification: {str(e)}")
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_safari_sms_comment_added(self, ticket_id: int, commenter_id: int, comment_text: str = None):
    """Send Safari SMS notification when comment is added"""
    try:
        from tenant.models import Ticket
        from users.models import Users
        
        logger.info(f"Safari SMS comment added task triggered for ticket_id={ticket_id}, commenter_id={commenter_id}")
        
        ticket = Ticket.objects.select_related('business', 'created_by', 'assigned_to').get(id=ticket_id)
        commenter = Users.objects.get(id=commenter_id) if commenter_id else None
        
        logger.info(f"Safari SMS checking if enabled for business {ticket.business.id}")
        if not SafariSmsNotificationService.is_enabled_for_business(ticket.business):
            logger.info(f"Safari SMS NOT enabled for business {ticket.business.id}")
            return
        
        logger.info(f"Safari SMS is enabled, sending notification for ticket {ticket_id}")
        result = SafariSmsNotificationService.notify_comment_added(ticket, commenter, comment_text)
        logger.info(f"Safari SMS comment added notification sent for ticket {ticket_id}: {result}")
        
    except Exception as e:
        logger.error(f"Error sending Safari SMS comment added notification: {str(e)}")
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_safari_sms_sla_breach(self, ticket_id: int):
    """Send Safari SMS notification when SLA is breached"""
    try:
        from tenant.models import Ticket
        ticket = Ticket.objects.select_related('business', 'created_by', 'assigned_to').get(id=ticket_id)
        
        if not SafariSmsNotificationService.is_enabled_for_business(ticket.business):
            return
        
        result = SafariSmsNotificationService.notify_sla_breach(ticket)
        logger.info(f"Safari SMS SLA breach notification sent for ticket {ticket_id}: {result}")
        
    except Exception as e:
        logger.error(f"Error sending Safari SMS SLA breach notification: {str(e)}")
        raise self.retry(exc=e)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_safari_sms_ticket_resolved(self, ticket_id: int):
    """Send Safari SMS notification when ticket is resolved"""
    try:
        from tenant.models import Ticket
        ticket = Ticket.objects.select_related('business', 'created_by', 'assigned_to').get(id=ticket_id)
        
        if not SafariSmsNotificationService.is_enabled_for_business(ticket.business):
            return
        
        result = SafariSmsNotificationService.notify_ticket_resolved(ticket)
        logger.info(f"Safari SMS ticket resolved notification sent for ticket {ticket_id}: {result}")
        
    except Exception as e:
        logger.error(f"Error sending Safari SMS ticket resolved notification: {str(e)}")
        raise self.retry(exc=e)
