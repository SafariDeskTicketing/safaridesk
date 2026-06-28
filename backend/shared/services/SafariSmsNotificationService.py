"""
Safari SMS Notification Service

This service handles sending SMS and WhatsApp notifications for ticket events.
It uses the Twilio SMS and WhatsApp services to deliver messages.
"""

import logging
import re
from typing import Optional, Dict, Any, List
from django.conf import settings

from shared.models.SafariSmsConfigModel import SafariSmsConfig
from shared.services.TwilioService import TwilioService
from shared.services.TwilioWhatsAppService import TwilioWhatsAppService

logger = logging.getLogger(__name__)

# Map notification types to user-friendly titles
NOTIFICATION_TITLES = {
    'new_ticket': 'A new ticket has been created',
    'status_update': 'Ticket status has been updated',
    'ticket_assigned': 'You have been assigned a ticket',
    'mention': 'You were mentioned in a ticket',
    'comment_added': 'A new comment has been added to your ticket',
    'sla_breach': 'SLA breach warning',
    'ticket_resolved': 'Your ticket has been resolved',
}


def _strip_html(text: str) -> str:
    """Strip HTML tags from text and clean up whitespace"""
    if not text:
        return ''
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    # Decode common HTML entities
    text = text.replace('&nbsp;', ' ')
    text = text.replace('&amp;', '&')
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = text.replace('&quot;', '"')
    text = text.replace('&#39;', "'")
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


class SafariSmsNotificationService:
    """Service for sending Safari SMS/WhatsApp notifications"""
    
    @classmethod
    def is_enabled_for_business(cls, business) -> bool:
        """Check if Safari SMS is activated for a business"""
        try:
            config = SafariSmsConfig.get_for_business(business)
            return config.is_activated and config.has_any_channel_enabled
        except Exception as e:
            logger.error(f"Error checking Safari SMS status: {str(e)}")
            return False
    
    @classmethod
    def get_config(cls, business) -> Optional[SafariSmsConfig]:
        """Get Safari SMS config for a business"""
        try:
            return SafariSmsConfig.get_for_business(business)
        except Exception as e:
            logger.error(f"Error getting Safari SMS config: {str(e)}")
            return None
    
    @classmethod
    def build_ticket_url(cls, ticket) -> str:
        """Build the URL for a ticket"""
        base_url = getattr(settings, 'FRONTEND_URL', '')
        if base_url:
            return f"{base_url}/tickets/{ticket.ticket_id}"
        # Try to build from business domain
        if ticket.business and ticket.business.domain:
            return f"https://{ticket.business.domain}.safaridesk.io/ticket/{ticket.ticket_id}"
        return f"#/tickets/{ticket.ticket_id}"
    
    @classmethod
    def build_whatsapp_template_variables(
        cls,
        notification_type: str,
        ticket,
        recipient_name: str = None,
        summary: str = None
    ) -> Dict[str, str]:
        """
        Build template variables for WhatsApp template messages.
        
        Template variables (Card format):
        1: Title (e.g., "A new comment has been added to your ticket")
        2: Ticket Ref (e.g., ITK-2026-0002)
        3: Summary (the actual content - comment text, status, priority, etc.)
        4: Caller (who created the ticket)
        5: Link to ticket
        """
        title = NOTIFICATION_TITLES.get(notification_type, 'Ticket Update')
        caller_name = ticket.creator_name or ''
        if not caller_name and ticket.created_by:
            caller_name = ticket.created_by.get_full_name() or ticket.created_by.email
        
        # Clean summary from HTML tags
        clean_summary = _strip_html(summary) if summary else f"Ticket: {ticket.title[:80] if ticket.title else 'No title'}"
        
        return {
            "1": title,
            "2": ticket.ticket_id or "N/A",
            "3": clean_summary,
            "4": caller_name or "Unknown",
            "5": cls.build_ticket_url(ticket),
        }
    
    @classmethod
    def build_context(cls, ticket, **extra_context) -> Dict[str, Any]:
        """Build the context dictionary for template rendering"""
        context = {
            'ticket_id': ticket.ticket_id,
            'ticket_title': ticket.title[:100] if ticket.title else '',
            'ticket_url': cls.build_ticket_url(ticket),
            'customer_name': ticket.creator_name or (ticket.created_by.get_full_name() if ticket.created_by else ''),
            'agent_name': ticket.assigned_to.get_full_name() if ticket.assigned_to else 'Unassigned',
            'business_name': ticket.business.name if ticket.business else 'SafariDesk',
        }
        context.update(extra_context)
        return context
    
    @classmethod
    def send_notification(
        cls,
        business,
        notification_type: str,
        recipients: List[str],
        context: Dict[str, Any],
        ticket=None,
        recipient_name: str = None,
        summary: str = None
    ) -> Dict[str, Any]:
        """
        Send a notification to recipients via configured channels
        
        Args:
            business: Business instance
            notification_type: Type of notification (new_ticket, status_update, etc.)
            recipients: List of phone numbers to notify
            context: Context variables for template rendering
            ticket: Ticket instance (for WhatsApp template variables)
            recipient_name: Name of the recipient (for WhatsApp template)
            summary: Summary text for the notification (for WhatsApp template)
            
        Returns:
            Dict with results for each channel and recipient
        """
        results = {
            'sms': [],
            'whatsapp': [],
            'errors': [],
        }
        
        try:
            config = cls.get_config(business)
            if not config or not config.is_activated:
                logger.info(f"Safari SMS not activated for business {business.id} (config={config}, is_activated={config.is_activated if config else None})")
                return results
            
            # Check if this notification type is enabled
            is_enabled = config.is_notification_enabled(notification_type)
            logger.info(f"Safari SMS notification_type={notification_type}, is_enabled={is_enabled}, recipients={recipients}")
            if not is_enabled:
                logger.info(f"Notification type {notification_type} not enabled for business {business.id}")
                return results
            
            # Render the message template (for SMS)
            message = config.render_template(notification_type, context)
            if not message:
                logger.warning(f"Empty message template for {notification_type}")
                return results
            
            logger.info(f"Safari SMS sending to {recipients} via sms_enabled={config.sms_enabled}, whatsapp_enabled={config.whatsapp_enabled}")
            
            # Build WhatsApp template variables if ticket is provided
            template_sid = getattr(settings, 'TWILIO_WHATSAPP_TEMPLATE_SID', '')
            whatsapp_template_vars = None
            if ticket and template_sid:
                whatsapp_template_vars = cls.build_whatsapp_template_variables(
                    notification_type=notification_type,
                    ticket=ticket,
                    recipient_name=recipient_name,
                    summary=summary
                )
            
            # Send via enabled channels
            for phone in recipients:
                if not phone:
                    continue
                
                # Send SMS if enabled
                if config.sms_enabled and TwilioService.is_configured():
                    try:
                        success, msg_data, error = TwilioService.send_sms(
                            to=phone,
                            body=message
                        )
                        results['sms'].append({
                            'to': phone,
                            'success': success,
                            'error': error,
                            'sid': msg_data.get('sid') if msg_data else None
                        })
                    except Exception as e:
                        logger.error(f"Error sending SMS to {phone}: {str(e)}")
                        results['errors'].append({
                            'channel': 'sms',
                            'to': phone,
                            'error': str(e)
                        })
                
                # Send WhatsApp if enabled
                if config.whatsapp_enabled and TwilioWhatsAppService.is_configured():
                    try:
                        # Use template if available (required for business-initiated messages)
                        if whatsapp_template_vars and template_sid:
                            success, msg_data, error = TwilioWhatsAppService.send_template_message(
                                to=phone,
                                template_sid=template_sid,
                                template_variables=whatsapp_template_vars,
                            )
                        else:
                            # Fallback to freeform (only works within 24h session)
                            success, msg_data, error = TwilioWhatsAppService.send_message(
                                to=phone,
                                body=message
                            )
                        results['whatsapp'].append({
                            'to': phone,
                            'success': success,
                            'error': error,
                            'sid': msg_data.get('sid') if msg_data else None
                        })
                    except Exception as e:
                        logger.error(f"Error sending WhatsApp to {phone}: {str(e)}")
                        results['errors'].append({
                            'channel': 'whatsapp',
                            'to': phone,
                            'error': str(e)
                        })
            
            return results
            
        except Exception as e:
            logger.error(f"Error in send_notification: {str(e)}")
            results['errors'].append({'error': str(e)})
            return results
    
    @classmethod
    def notify_new_ticket(cls, ticket) -> Dict[str, Any]:
        """Send notification for new ticket creation"""
        business = ticket.business
        context = cls.build_context(ticket)
        
        # Get recipients - customer phone if available
        recipients = []
        recipient_name = None
        if ticket.creator_phone:
            recipients.append(ticket.creator_phone)
            recipient_name = ticket.creator_name or ''
        elif ticket.created_by and ticket.created_by.phone:
            recipients.append(ticket.created_by.phone)
            recipient_name = ticket.created_by.get_full_name()
        
        if not recipients:
            logger.debug(f"No phone number available for new ticket notification: {ticket.id}")
            return {'sms': [], 'whatsapp': [], 'errors': []}
        
        summary = f"Title: {ticket.title[:100] if ticket.title else 'No title'}"
        
        return cls.send_notification(
            business=business,
            notification_type='new_ticket',
            recipients=recipients,
            context=context,
            ticket=ticket,
            recipient_name=recipient_name,
            summary=summary
        )
    
    @classmethod
    def notify_status_update(cls, ticket, old_status: str, new_status: str) -> Dict[str, Any]:
        """Send notification for ticket status update"""
        business = ticket.business
        context = cls.build_context(ticket, old_status=old_status, new_status=new_status)
        
        recipients = []
        recipient_name = None
        if ticket.creator_phone:
            recipients.append(ticket.creator_phone)
            recipient_name = ticket.creator_name or ''
        elif ticket.created_by and ticket.created_by.phone:
            recipients.append(ticket.created_by.phone)
            recipient_name = ticket.created_by.get_full_name()
        
        if not recipients:
            return {'sms': [], 'whatsapp': [], 'errors': []}
        
        summary = f"Status: {old_status} → {new_status}"
        
        return cls.send_notification(
            business=business,
            notification_type='status_update',
            recipients=recipients,
            context=context,
            ticket=ticket,
            recipient_name=recipient_name,
            summary=summary
        )
    
    @classmethod
    def notify_ticket_assigned(cls, ticket, agent) -> Dict[str, Any]:
        """Send notification when ticket is assigned to an agent"""
        business = ticket.business
        context = cls.build_context(ticket, agent_name=agent.get_full_name() if agent else 'Unassigned')
        
        # Notify the agent if they have a phone
        recipients = []
        recipient_name = None
        if agent and agent.phone:
            recipients.append(agent.phone)
            recipient_name = agent.get_full_name()
        
        if not recipients:
            return {'sms': [], 'whatsapp': [], 'errors': []}
        
        summary = f"Assigned to: {agent.get_full_name() if agent else 'Unassigned'}"
        
        return cls.send_notification(
            business=business,
            notification_type='ticket_assigned',
            recipients=recipients,
            context=context,
            ticket=ticket,
            recipient_name=recipient_name,
            summary=summary
        )
    
    @classmethod
    def notify_mention(cls, ticket, mentioned_user, mentioned_by) -> Dict[str, Any]:
        """Send notification when a user is mentioned"""
        business = ticket.business
        context = cls.build_context(
            ticket,
            mentioned_by=mentioned_by.get_full_name() if mentioned_by else 'Someone'
        )
        
        recipients = []
        recipient_name = None
        if mentioned_user and mentioned_user.phone:
            recipients.append(mentioned_user.phone)
            recipient_name = mentioned_user.get_full_name()
        
        if not recipients:
            return {'sms': [], 'whatsapp': [], 'errors': []}
        
        summary = f"Mentioned by: {mentioned_by.get_full_name() if mentioned_by else 'Someone'}"
        
        return cls.send_notification(
            business=business,
            notification_type='mention',
            recipients=recipients,
            context=context,
            ticket=ticket,
            recipient_name=recipient_name,
            summary=summary
        )
    
    @classmethod
    def notify_comment_added(cls, ticket, commenter, comment_text: str = None) -> Dict[str, Any]:
        """Send notification when a comment is added"""
        business = ticket.business
        context = cls.build_context(
            ticket,
            commenter_name=commenter.get_full_name() if commenter else 'Someone'
        )
        
        # Notify the ticket creator
        recipients = []
        recipient_name = None
        if ticket.creator_phone:
            recipients.append(ticket.creator_phone)
            recipient_name = ticket.creator_name or ''
            logger.info(f"Safari SMS comment_added: will notify creator_phone={ticket.creator_phone}")
        elif ticket.created_by and ticket.created_by.phone:
            recipients.append(ticket.created_by.phone)
            recipient_name = ticket.created_by.get_full_name()
            logger.info(f"Safari SMS comment_added: will notify created_by.phone={ticket.created_by.phone}")
        
        if not recipients:
            logger.info(f"Safari SMS comment_added: no phone number found for ticket creator (ticket_id={ticket.id}, creator_phone={ticket.creator_phone}, created_by={ticket.created_by})")
            return {'sms': [], 'whatsapp': [], 'errors': []}
        
        commenter_name = commenter.get_full_name() if commenter else 'Someone'
        # Truncate comment text for summary (strip HTML first)
        if comment_text:
            clean_comment = _strip_html(comment_text)
            truncated_comment = clean_comment[:100] + ('...' if len(clean_comment) > 100 else '')
            summary = f"Comment by {commenter_name}: {truncated_comment}"
        else:
            summary = f"New comment by {commenter_name}"
        
        return cls.send_notification(
            business=business,
            notification_type='comment_added',
            recipients=recipients,
            context=context,
            ticket=ticket,
            recipient_name=recipient_name,
            summary=summary
        )
    
    @classmethod
    def notify_sla_breach(cls, ticket) -> Dict[str, Any]:
        """Send notification when SLA is breached"""
        business = ticket.business
        context = cls.build_context(ticket)
        
        # Notify the assigned agent
        recipients = []
        recipient_name = None
        if ticket.assigned_to and ticket.assigned_to.phone:
            recipients.append(ticket.assigned_to.phone)
            recipient_name = ticket.assigned_to.get_full_name()
        
        if not recipients:
            return {'sms': [], 'whatsapp': [], 'errors': []}
        
        summary = "SLA breach warning - immediate action required"
        
        return cls.send_notification(
            business=business,
            notification_type='sla_breach',
            recipients=recipients,
            context=context,
            ticket=ticket,
            recipient_name=recipient_name,
            summary=summary
        )
    
    @classmethod
    def notify_ticket_resolved(cls, ticket) -> Dict[str, Any]:
        """Send notification when ticket is resolved"""
        business = ticket.business
        context = cls.build_context(ticket)
        
        # Notify the customer
        recipients = []
        recipient_name = None
        if ticket.creator_phone:
            recipients.append(ticket.creator_phone)
            recipient_name = ticket.creator_name or ''
        elif ticket.created_by and ticket.created_by.phone:
            recipients.append(ticket.created_by.phone)
            recipient_name = ticket.created_by.get_full_name()
        
        if not recipients:
            return {'sms': [], 'whatsapp': [], 'errors': []}
        
        summary = "Your ticket has been resolved. Thank you for contacting support!"
        
        return cls.send_notification(
            business=business,
            notification_type='ticket_resolved',
            recipients=recipients,
            context=context,
            ticket=ticket,
            recipient_name=recipient_name,
            summary=summary
        )
