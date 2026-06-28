import json
import logging
from typing import Optional, Dict, Any, Tuple, List
from django.conf import settings
from django.utils import timezone
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

logger = logging.getLogger(__name__)


class TwilioWhatsAppService:
    """Service for handling Twilio WhatsApp API interactions"""
    
    _client = None
    WHATSAPP_PREFIX = 'whatsapp:'
    
    @classmethod
    def get_client(cls) -> Optional[Client]:
        """Get or create Twilio client instance"""
        if cls._client is None:
            account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
            auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
            
            if not account_sid or not auth_token:
                logger.error("Twilio credentials not configured")
                return None
            
            cls._client = Client(account_sid, auth_token)
        
        return cls._client
    
    @classmethod
    def is_configured(cls) -> bool:
        """Check if Twilio WhatsApp is properly configured"""
        return bool(
            getattr(settings, 'TWILIO_ACCOUNT_SID', '') and
            getattr(settings, 'TWILIO_AUTH_TOKEN', '') and
            getattr(settings, 'TWILIO_WHATSAPP_NUMBER', '')
        )
    
    @classmethod
    def get_default_from_number(cls) -> str:
        """Get the default Twilio WhatsApp number"""
        number = getattr(settings, 'TWILIO_WHATSAPP_NUMBER', '')
        return cls.format_whatsapp_number(number)
    
    @classmethod
    def format_whatsapp_number(cls, phone: str) -> str:
        """
        Format phone number for WhatsApp
        Ensures the number has the whatsapp: prefix
        
        Args:
            phone: Phone number (with or without prefix)
            
        Returns:
            Formatted WhatsApp number (whatsapp:+1234567890)
        """
        if not phone:
            return ''
        
        phone = phone.strip()
        
        # Already has prefix
        if phone.startswith(cls.WHATSAPP_PREFIX):
            return phone
        
        # Normalize the phone number
        phone = cls.normalize_phone_number(phone)
        
        return f"{cls.WHATSAPP_PREFIX}{phone}"
    
    @classmethod
    def normalize_phone_number(cls, phone: str) -> str:
        """
        Normalize phone number to E.164 format
        
        Args:
            phone: Phone number string
            
        Returns:
            Normalized phone number
        """
        # Remove whatsapp: prefix if present
        if phone.startswith(cls.WHATSAPP_PREFIX):
            phone = phone[len(cls.WHATSAPP_PREFIX):]
        
        # Remove any non-digit characters except leading +
        if phone.startswith('+'):
            cleaned = '+' + ''.join(filter(str.isdigit, phone[1:]))
        else:
            cleaned = ''.join(filter(str.isdigit, phone))
            # Add + if not present
            if not cleaned.startswith('+'):
                cleaned = '+' + cleaned
        
        return cleaned
    
    @classmethod
    def send_message(
        cls,
        to: str,
        body: str,
        from_number: Optional[str] = None,
        media_url: Optional[str] = None,
        status_callback: Optional[str] = None
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Send a WhatsApp message via Twilio
        
        Args:
            to: Recipient WhatsApp number
            body: Message content
            from_number: Sender WhatsApp number (defaults to TWILIO_WHATSAPP_NUMBER)
            media_url: URL of media to attach (image, document, etc.)
            status_callback: URL to receive status callbacks
            
        Returns:
            Tuple of (success, message_data, error_message)
        """
        client = cls.get_client()
        if not client:
            return False, None, "Twilio client not configured"
        
        sender = from_number or cls.get_default_from_number()
        if not sender:
            return False, None, "No 'from' WhatsApp number configured"
        
        try:
            # Format numbers for WhatsApp
            to_formatted = cls.format_whatsapp_number(to)
            from_formatted = cls.format_whatsapp_number(sender)
            
            # Build message parameters
            message_params = {
                'to': to_formatted,
                'from_': from_formatted,
                'body': body,
            }
            
            if status_callback:
                message_params['status_callback'] = status_callback
            
            if media_url:
                message_params['media_url'] = [media_url]
            
            # Send the message
            message = client.messages.create(**message_params)
            
            message_data = {
                'sid': message.sid,
                'status': message.status,
                'to': message.to,
                'from_': message.from_,
                'body': message.body,
                'date_sent': message.date_sent,
                'date_created': message.date_created,
                'price': message.price,
                'price_unit': message.price_unit,
                'error_code': message.error_code,
                'error_message': message.error_message,
            }
            
            logger.info(f"WhatsApp message sent successfully to {to_formatted}, SID: {message.sid}")
            return True, message_data, None
            
        except TwilioRestException as e:
            logger.error(f"Twilio error sending WhatsApp to {to}: {e.msg}")
            return False, None, f"Twilio error: {e.msg}"
        except Exception as e:
            logger.error(f"Unexpected error sending WhatsApp to {to}: {str(e)}")
            return False, None, str(e)
    
    @classmethod
    def send_template_message(
        cls,
        to: str,
        template_sid: str,
        template_variables: Optional[Dict[str, str]] = None,
        from_number: Optional[str] = None,
        status_callback: Optional[str] = None
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Send a WhatsApp template message (for business-initiated conversations)
        
        Note: Templates must be pre-approved by WhatsApp/Meta
        
        Args:
            to: Recipient WhatsApp number
            template_sid: Content SID of the approved template
            template_variables: Variables to fill in the template
            from_number: Sender WhatsApp number
            status_callback: URL to receive status callbacks
            
        Returns:
            Tuple of (success, message_data, error_message)
        """
        client = cls.get_client()
        if not client:
            return False, None, "Twilio client not configured"
        
        sender = from_number or cls.get_default_from_number()
        if not sender:
            return False, None, "No 'from' WhatsApp number configured"
        
        try:
            to_formatted = cls.format_whatsapp_number(to)
            from_formatted = cls.format_whatsapp_number(sender)
            
            message_params = {
                'to': to_formatted,
                'from_': from_formatted,
                'content_sid': template_sid,
            }
            
            if template_variables:
                message_params['content_variables'] = json.dumps(template_variables)
            
            if status_callback:
                message_params['status_callback'] = status_callback
            
            message = client.messages.create(**message_params)
            
            message_data = {
                'sid': message.sid,
                'status': message.status,
                'to': message.to,
                'from_': message.from_,
                'body': message.body,
                'date_sent': message.date_sent,
                'date_created': message.date_created,
                'price': message.price,
                'price_unit': message.price_unit,
                'error_code': message.error_code,
                'error_message': message.error_message,
            }
            
            logger.info(f"WhatsApp template message sent to {to_formatted}, SID: {message.sid}")
            return True, message_data, None
            
        except TwilioRestException as e:
            logger.error(f"Twilio error sending WhatsApp template to {to}: {e.msg}")
            return False, None, f"Twilio error: {e.msg}"
        except Exception as e:
            logger.error(f"Unexpected error sending WhatsApp template to {to}: {str(e)}")
            return False, None, str(e)
    
    @classmethod
    def send_media_message(
        cls,
        to: str,
        media_url: str,
        caption: Optional[str] = None,
        from_number: Optional[str] = None,
        status_callback: Optional[str] = None
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Send a WhatsApp media message (image, document, audio, video)
        
        Args:
            to: Recipient WhatsApp number
            media_url: Public URL of the media file
            caption: Optional caption for the media
            from_number: Sender WhatsApp number
            status_callback: URL to receive status callbacks
            
        Returns:
            Tuple of (success, message_data, error_message)
        """
        return cls.send_message(
            to=to,
            body=caption or '',
            from_number=from_number,
            media_url=media_url,
            status_callback=status_callback
        )
    
    @classmethod
    def send_bulk_messages(
        cls,
        recipients: List[str],
        body: str,
        from_number: Optional[str] = None,
        media_url: Optional[str] = None,
        status_callback: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Send WhatsApp message to multiple recipients
        
        Args:
            recipients: List of WhatsApp numbers
            body: Message content
            from_number: Sender WhatsApp number
            media_url: Optional media URL
            status_callback: URL to receive status callbacks
            
        Returns:
            List of results for each recipient
        """
        results = []
        
        for recipient in recipients:
            success, message_data, error = cls.send_message(
                to=recipient,
                body=body,
                from_number=from_number,
                media_url=media_url,
                status_callback=status_callback
            )
            
            results.append({
                'to': recipient,
                'success': success,
                'message_data': message_data,
                'error': error
            })
        
        return results
    
    @classmethod
    def get_message(cls, message_sid: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a message by SID
        
        Args:
            message_sid: Twilio message SID
            
        Returns:
            Message data dictionary or None
        """
        client = cls.get_client()
        if not client:
            return None
        
        try:
            message = client.messages(message_sid).fetch()
            
            return {
                'sid': message.sid,
                'status': message.status,
                'to': message.to,
                'from_': message.from_,
                'body': message.body,
                'date_sent': message.date_sent,
                'date_created': message.date_created,
                'date_updated': message.date_updated,
                'price': message.price,
                'price_unit': message.price_unit,
                'error_code': message.error_code,
                'error_message': message.error_message,
                'num_segments': message.num_segments,
                'direction': message.direction,
            }
            
        except TwilioRestException as e:
            logger.error(f"Error fetching message {message_sid}: {e.msg}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching message {message_sid}: {str(e)}")
            return None
    
    @classmethod
    def list_messages(
        cls,
        to: Optional[str] = None,
        from_: Optional[str] = None,
        date_sent_after: Optional[str] = None,
        date_sent_before: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        List WhatsApp messages with optional filters
        
        Args:
            to: Filter by recipient
            from_: Filter by sender
            date_sent_after: Filter by date (YYYY-MM-DD)
            date_sent_before: Filter by date (YYYY-MM-DD)
            limit: Maximum number of messages to return
            
        Returns:
            List of message dictionaries
        """
        client = cls.get_client()
        if not client:
            return []
        
        try:
            filters = {'limit': limit}
            
            if to:
                filters['to'] = cls.format_whatsapp_number(to)
            if from_:
                filters['from_'] = cls.format_whatsapp_number(from_)
            if date_sent_after:
                filters['date_sent_after'] = date_sent_after
            if date_sent_before:
                filters['date_sent_before'] = date_sent_before
            
            messages = client.messages.list(**filters)
            
            # Filter only WhatsApp messages
            whatsapp_messages = [
                msg for msg in messages 
                if msg.to.startswith(cls.WHATSAPP_PREFIX) or msg.from_.startswith(cls.WHATSAPP_PREFIX)
            ]
            
            return [
                {
                    'sid': msg.sid,
                    'status': msg.status,
                    'to': msg.to,
                    'from_': msg.from_,
                    'body': msg.body,
                    'date_sent': msg.date_sent,
                    'direction': msg.direction,
                    'price': msg.price,
                }
                for msg in whatsapp_messages
            ]
            
        except TwilioRestException as e:
            logger.error(f"Error listing messages: {e.msg}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error listing messages: {str(e)}")
            return []
    
    @classmethod
    def get_account_info(cls) -> Optional[Dict[str, Any]]:
        """
        Get Twilio account information
        
        Returns:
            Account info dictionary or None
        """
        client = cls.get_client()
        if not client:
            return None
        
        try:
            account = client.api.accounts(settings.TWILIO_ACCOUNT_SID).fetch()
            
            return {
                'sid': account.sid,
                'friendly_name': account.friendly_name,
                'status': account.status,
                'type': account.type,
                'date_created': account.date_created,
            }
            
        except TwilioRestException as e:
            logger.error(f"Error fetching account info: {e.msg}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching account info: {str(e)}")
            return None
    
    @classmethod
    def format_ticket_notification(
        cls,
        ticket_id: str,
        ticket_title: str,
        notification_type: str,
        business_name: str
    ) -> str:
        """
        Format a ticket notification message for WhatsApp
        
        Args:
            ticket_id: Ticket identifier
            ticket_title: Ticket title/subject
            notification_type: Type of notification
            business_name: Name of the business
            
        Returns:
            Formatted WhatsApp message
        """
        templates = {
            'new': f"🎫 *{business_name}*\n\nNew ticket created!\n\n*Ticket:* #{ticket_id}\n*Subject:* {ticket_title[:100]}",
            'update': f"📝 *{business_name}*\n\nTicket #{ticket_id} has been updated.",
            'resolved': f"✅ *{business_name}*\n\nTicket #{ticket_id} has been resolved.\n\nThank you for contacting us!",
            'assigned': f"👤 *{business_name}*\n\nTicket #{ticket_id} has been assigned to you.",
            'comment': f"💬 *{business_name}*\n\nNew comment on ticket #{ticket_id}.",
            'sla_warning': f"⚠️ *{business_name}*\n\n*SLA Warning*\nTicket #{ticket_id} requires immediate attention.",
            'sla_breach': f"🚨 *{business_name}*\n\n*SLA Breach*\nTicket #{ticket_id} has exceeded SLA limits.",
        }
        
        return templates.get(
            notification_type,
            f"📢 *{business_name}*\n\nNotification for ticket #{ticket_id}"
        )
