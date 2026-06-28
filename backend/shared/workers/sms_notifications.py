"""
SMS notification tasks for ticket events.
Sends SMS notifications to agents for new tickets, on-hold, and resolved status.
"""
import logging
from typing import Optional, Dict, Any, List
from celery import shared_task
from django.conf import settings

from shared.services.notification_preferences import NotificationSettingsService
from shared.services.TwilioService import TwilioService
from shared.models.TwilioSMSMessage import TwilioSMSMessage
from util.phone import (
    format_phone_international,
    validate_phone,
    get_agents_with_valid_phones,
)

logger = logging.getLogger(__name__)


# =============================================================================
# SMS TEMPLATES
# =============================================================================

SMS_TEMPLATES = {
    'new_ticket': """Hello {agent_name},

New Ticket Assigned
Ticket: #{ticket_id}
Title: {title}
Priority: {priority}
Customer: {customer_name}
Department: {department}

View ticket: {ticket_url}""",

    'ticket_on_hold': """Hello {agent_name},

Ticket On Hold
Ticket: #{ticket_id}
Title: {title}
Status changed to: On Hold

View ticket: {ticket_url}""",

    'ticket_resolved': """Hello {agent_name},

Ticket Resolved
Ticket: #{ticket_id}
Title: {title}
Resolved by: {resolved_by}

View ticket: {ticket_url}""",

    'ticket_assigned': """Hello {agent_name},

Ticket Assigned to You
Ticket: #{ticket_id}
Title: {title}
Priority: {priority}
Customer: {customer_name}

View ticket: {ticket_url}""",
}


def get_sms_template(template_name: str) -> str:
    """Get SMS template by name."""
    return SMS_TEMPLATES.get(template_name, '')


def format_sms_message(template_name: str, context: Dict[str, Any]) -> str:
    """
    Format an SMS message using a template and context.
    
    Args:
        template_name: Name of the template
        context: Dictionary of values to substitute
        
    Returns:
        Formatted message string
    """
    template = get_sms_template(template_name)
    if not template:
        logger.error(f"SMS template '{template_name}' not found")
        return ''
    
    try:
        return template.format(**context)
    except KeyError as e:
        logger.error(f"Missing context key for SMS template: {e}")
        return template


def _log_sms_sent(
    to_number: str,
    from_number: str,
    body: str,
    twilio_sid: str,
    status: str,
    agent_id: Optional[int] = None,
    ticket_id: Optional[int] = None,
    notification_type: str = 'ticket_notification'
) -> TwilioSMSMessage:
    """
    Log an SMS message to the database.
    
    Args:
        to_number: Recipient phone number
        from_number: Sender phone number
        body: Message content
        twilio_sid: Twilio message SID
        status: Message status
        agent_id: ID of the agent being notified
        ticket_id: ID of the related ticket
        notification_type: Type of notification
        
    Returns:
        TwilioSMSMessage instance
    """
    return TwilioSMSMessage.objects.create(
        twilio_sid=twilio_sid,
        from_number=from_number,
        to_number=to_number,
        body=body,
        direction='outbound',
        message_status=status,
    )


def _send_sms_to_agent(
    agent,
    formatted_phone: str,
    message: str,
    ticket_id: Optional[int] = None,
    notification_type: str = 'ticket_notification'
) -> bool:
    """
    Send SMS to a single agent and log the result.
    
    Args:
        agent: User/agent object
        formatted_phone: Phone number in E.164 format
        message: SMS message content
        ticket_id: Related ticket ID
        notification_type: Type of notification
        
    Returns:
        True if sent successfully, False otherwise
    """
    if not TwilioService.is_configured():
        logger.warning("Twilio not configured, skipping SMS notification")
        return False
    
    success, message_data, error = TwilioService.send_sms(
        to=formatted_phone,
        body=message
    )
    
    if success and message_data:
        # Log successful message
        # When using Messaging Service, from_ may be None - use fallback
        from_number = message_data.get('from_')
        if not from_number:
            # Fallback: use Messaging Service SID, Sender ID, or phone number
            from_number = (
                TwilioService.get_messaging_service_sid() or
                TwilioService.get_sender_id() or
                TwilioService.get_default_from_number() or
                'MessagingService'
            )
        
        _log_sms_sent(
            to_number=formatted_phone,
            from_number=from_number,
            body=message,
            twilio_sid=message_data.get('sid', ''),
            status=message_data.get('status', 'sent'),
            agent_id=agent.id if agent else None,
            ticket_id=ticket_id,
            notification_type=notification_type
        )
        logger.info(
            f"SMS sent successfully to agent {agent.email if agent else 'unknown'} "
            f"at {formatted_phone} for {notification_type}"
        )
        return True
    else:
        logger.error(
            f"Failed to send SMS to agent {agent.email if agent else 'unknown'} "
            f"at {formatted_phone}: {error}"
        )
        return False


# =============================================================================
# CELERY TASKS
# =============================================================================

@shared_task
def send_new_ticket_sms_notification(ticket_id: int):
    """
    Send SMS notifications to all agents in the ticket's department for a new ticket.
    
    Args:
        ticket_id: ID of the newly created ticket
    """
    from tenant.models import Ticket
    
    try:
        ticket = Ticket.objects.select_related(
            'department', 'assigned_to', 'business'
        ).get(id=ticket_id)
    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found for SMS notification")
        return
    
    if not ticket.department:
        logger.warning(f"Ticket {ticket_id} has no department, skipping SMS")
        return
    
    # Get all agents in the department
    department_members = NotificationSettingsService.active_department_members(ticket.department)
    
    # Filter to agents with valid phone numbers
    valid_agents = get_agents_with_valid_phones(department_members)
    
    if not valid_agents:
        logger.info(f"No agents with valid phones in department {ticket.department.name}")
        return
    
    # Build ticket URL
    frontend_url = getattr(settings, 'FRONTEND_URL', '')
    ticket_url = f"{frontend_url}/tickets/{ticket.id}" if frontend_url else f"/tickets/{ticket.id}"
    
    # Send to all valid agents
    sent_count = 0
    for agent, formatted_phone in valid_agents:
        if not NotificationSettingsService.should_send(agent, 'ticket_assigned', 'sms'):
            logger.info("[SMS] Suppressed new_ticket SMS for %s by notification preferences", agent.email)
            continue

        # Prepare context for template with agent name
        context = {
            'agent_name': agent.first_name or agent.full_name() or 'Agent',
            'ticket_id': ticket.ticket_id or str(ticket.id),
            'title': (ticket.title[:50] + '...' if len(ticket.title or '') > 50 else ticket.title) or 'No title',
            'priority': (ticket.priority or 'medium').capitalize(),
            'customer_name': ticket.creator_name or ticket.creator_email or 'Unknown',
            'department': ticket.department.name,
            'ticket_url': ticket_url,
        }
        
        message = format_sms_message('new_ticket', context)
        
        if not message:
            logger.error("Failed to format new ticket SMS message")
            continue
        
        if _send_sms_to_agent(agent, formatted_phone, message, ticket.id, 'new_ticket'):
            sent_count += 1
    
    logger.info(f"New ticket SMS: sent {sent_count}/{len(valid_agents)} for ticket {ticket_id}")


@shared_task
def send_ticket_on_hold_sms_notification(ticket_id: int):
    """
    Send SMS notification to the assigned agent when ticket is put on hold.
    
    Args:
        ticket_id: ID of the ticket put on hold
    """
    from tenant.models import Ticket
    
    try:
        ticket = Ticket.objects.select_related('assigned_to', 'department').get(id=ticket_id)
    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found for on-hold SMS notification")
        return
    
    # Only notify the assigned agent
    if not ticket.assigned_to:
        logger.info(f"Ticket {ticket_id} has no assigned agent, skipping on-hold SMS")
        return
    
    agent = ticket.assigned_to
    phone = getattr(agent, 'phone_number', None)
    
    if not phone:
        logger.info(f"Agent {agent.email} has no phone number")
        return
    
    formatted_phone = format_phone_international(phone)
    if not formatted_phone:
        logger.warning(f"Agent {agent.email} has invalid phone: {phone}")
        return
    
    # Build ticket URL
    frontend_url = getattr(settings, 'FRONTEND_URL', '')
    ticket_url = f"{frontend_url}/tickets/{ticket.id}" if frontend_url else f"/tickets/{ticket.id}"
    
    if not NotificationSettingsService.should_send(agent, 'ticket_status_changed', 'sms'):
        logger.info("[SMS] Suppressed ticket_on_hold SMS for %s by notification preferences", agent.email)
        return

    context = {
        'agent_name': agent.first_name or agent.full_name() or 'Agent',
        'ticket_id': ticket.ticket_id or str(ticket.id),
        'title': (ticket.title[:50] + '...' if len(ticket.title or '') > 50 else ticket.title) or 'No title',
        'ticket_url': ticket_url,
    }

    message = format_sms_message('ticket_on_hold', context)
    
    if message:
        _send_sms_to_agent(agent, formatted_phone, message, ticket.id, 'ticket_on_hold')


@shared_task
def send_ticket_resolved_sms_notification(ticket_id: int, resolved_by_name: str = None):
    """
    Send SMS notification to the assigned agent when ticket is resolved.
    
    Args:
        ticket_id: ID of the resolved ticket
        resolved_by_name: Name of the user who resolved the ticket
    """
    from tenant.models import Ticket
    
    try:
        ticket = Ticket.objects.select_related('assigned_to', 'department').get(id=ticket_id)
    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found for resolved SMS notification")
        return
    
    # Notify the assigned agent
    if not ticket.assigned_to:
        logger.info(f"Ticket {ticket_id} has no assigned agent, skipping resolved SMS")
        return
    
    agent = ticket.assigned_to
    phone = getattr(agent, 'phone_number', None)
    
    if not phone:
        logger.info(f"Agent {agent.email} has no phone number")
        return
    
    formatted_phone = format_phone_international(phone)
    if not formatted_phone:
        logger.warning(f"Agent {agent.email} has invalid phone: {phone}")
        return
    
    # Build ticket URL
    frontend_url = getattr(settings, 'FRONTEND_URL', '')
    ticket_url = f"{frontend_url}/tickets/{ticket.id}" if frontend_url else f"/tickets/{ticket.id}"
    
    if not NotificationSettingsService.should_send(agent, 'ticket_status_changed', 'sms'):
        logger.info("[SMS] Suppressed ticket_resolved SMS for %s by notification preferences", agent.email)
        return

    context = {
        'agent_name': agent.first_name or agent.full_name() or 'Agent',
        'ticket_id': ticket.ticket_id or str(ticket.id),
        'title': (ticket.title[:50] + '...' if len(ticket.title or '') > 50 else ticket.title) or 'No title',
        'resolved_by': resolved_by_name or agent.full_name() or agent.email,
        'ticket_url': ticket_url,
    }

    message = format_sms_message('ticket_resolved', context)
    
    if message:
        _send_sms_to_agent(agent, formatted_phone, message, ticket.id, 'ticket_resolved')


@shared_task
def send_ticket_assigned_sms_notification(ticket_id: int):
    """
    Send SMS notification to an agent when a ticket is assigned to them.
    
    Args:
        ticket_id: ID of the assigned ticket
    """
    from tenant.models import Ticket
    
    try:
        ticket = Ticket.objects.select_related(
            'assigned_to', 'department', 'business'
        ).get(id=ticket_id)
    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found for assignment SMS notification")
        return
    
    if not ticket.assigned_to:
        logger.info(f"Ticket {ticket_id} has no assigned agent")
        return
    
    agent = ticket.assigned_to
    phone = getattr(agent, 'phone_number', None)
    
    if not phone:
        logger.info(f"Agent {agent.email} has no phone number")
        return
    
    formatted_phone = format_phone_international(phone)
    if not formatted_phone:
        logger.warning(f"Agent {agent.email} has invalid phone: {phone}")
        return
    
    # Build ticket URL
    frontend_url = getattr(settings, 'FRONTEND_URL', '')
    ticket_url = f"{frontend_url}/tickets/{ticket.id}" if frontend_url else f"/tickets/{ticket.id}"
    
    if not NotificationSettingsService.should_send(agent, 'ticket_assigned', 'sms'):
        logger.info("[SMS] Suppressed ticket_assigned SMS for %s by notification preferences", agent.email)
        return

    context = {
        'agent_name': agent.first_name or agent.full_name() or 'Agent',
        'ticket_id': ticket.ticket_id or str(ticket.id),
        'title': (ticket.title[:50] + '...' if len(ticket.title or '') > 50 else ticket.title) or 'No title',
        'priority': (ticket.priority or 'medium').capitalize(),
        'customer_name': ticket.creator_name or ticket.creator_email or 'Unknown',
        'ticket_url': ticket_url,
    }

    message = format_sms_message('ticket_assigned', context)
    
    if message:
        _send_sms_to_agent(agent, formatted_phone, message, ticket.id, 'ticket_assigned')
