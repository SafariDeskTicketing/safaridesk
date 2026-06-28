import logging
import hashlib
import hmac
import base64
from typing import Optional, Dict, Any, Tuple, List
from django.conf import settings
from django.utils import timezone
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from twilio.request_validator import RequestValidator

logger = logging.getLogger(__name__)


class TwilioService:
    """Service for handling Twilio SMS API interactions"""
    
    _client = None
    
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
        """Check if Twilio is properly configured"""
        has_credentials = bool(
            getattr(settings, 'TWILIO_ACCOUNT_SID', '') and
            getattr(settings, 'TWILIO_AUTH_TOKEN', '')
        )
        has_sender = bool(
            getattr(settings, 'TWILIO_MESSAGING_SERVICE_SID', '') or
            getattr(settings, 'TWILIO_SENDER_ID', '') or
            getattr(settings, 'TWILIO_PHONE_NUMBER', '')
        )
        return has_credentials and has_sender
    
    @classmethod
    def get_messaging_service_sid(cls) -> str:
        """Get the Twilio Messaging Service SID if configured"""
        return getattr(settings, 'TWILIO_MESSAGING_SERVICE_SID', '')
    
    @classmethod
    def get_sender_id(cls) -> str:
        """Get the Twilio Alpha Sender ID if configured"""
        return getattr(settings, 'TWILIO_SENDER_ID', '')
    
    @classmethod
    def get_default_from_number(cls) -> str:
        """
        Get the default sender for SMS.
        Prefers Alpha Sender ID over phone number if configured.
        """
        # Prefer Sender ID (alphanumeric) over phone number
        sender_id = getattr(settings, 'TWILIO_SENDER_ID', '')
        if sender_id:
            return sender_id
        return getattr(settings, 'TWILIO_PHONE_NUMBER', '')
    
    @classmethod
    def send_sms(
        cls,
        to: str,
        body: str,
        from_number: Optional[str] = None,
        status_callback: Optional[str] = None,
        media_urls: Optional[List[str]] = None
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Send an SMS message via Twilio
        
        Args:
            to: Recipient phone number (E.164 format)
            body: Message content
            from_number: Sender phone number (defaults to TWILIO_PHONE_NUMBER)
            status_callback: URL to receive status callbacks
            media_urls: List of media URLs for MMS
            
        Returns:
            Tuple of (success, message_data, error_message)
        """
        client = cls.get_client()
        if not client:
            return False, None, "Twilio client not configured"
        
        # Check for Messaging Service SID first (preferred for international SMS)
        messaging_service_sid = cls.get_messaging_service_sid()
        sender = from_number or cls.get_default_from_number()
        
        if not messaging_service_sid and not sender:
            return False, None, "No sender configured (Messaging Service SID, Sender ID, or phone number)"
        
        try:
            # Normalize phone number
            to_normalized = cls.normalize_phone_number(to)
            
            # Build message parameters
            message_params = {
                'to': to_normalized,
                'body': body,
            }
            
            # Use Messaging Service SID if available (handles sender selection automatically)
            # Otherwise fall back to direct from_ parameter
            if messaging_service_sid:
                message_params['messaging_service_sid'] = messaging_service_sid
            elif sender:
                message_params['from_'] = sender
            
            if status_callback:
                message_params['status_callback'] = status_callback
            
            if media_urls:
                message_params['media_url'] = media_urls
            
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
            
            logger.info(f"SMS sent successfully to {to_normalized}, SID: {message.sid}")
            return True, message_data, None
            
        except TwilioRestException as e:
            logger.error(f"Twilio error sending SMS to {to}: {e.msg}")
            return False, None, f"Twilio error: {e.msg}"
        except Exception as e:
            logger.error(f"Unexpected error sending SMS to {to}: {str(e)}")
            return False, None, str(e)
    
    @classmethod
    def send_bulk_sms(
        cls,
        recipients: List[str],
        body: str,
        from_number: Optional[str] = None,
        status_callback: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Send SMS to multiple recipients
        
        Args:
            recipients: List of phone numbers
            body: Message content
            from_number: Sender phone number
            status_callback: URL to receive status callbacks
            
        Returns:
            List of results for each recipient
        """
        results = []
        
        for recipient in recipients:
            success, message_data, error = cls.send_sms(
                to=recipient,
                body=body,
                from_number=from_number,
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
        List messages with optional filters
        
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
                filters['to'] = cls.normalize_phone_number(to)
            if from_:
                filters['from_'] = from_
            if date_sent_after:
                filters['date_sent_after'] = date_sent_after
            if date_sent_before:
                filters['date_sent_before'] = date_sent_before
            
            messages = client.messages.list(**filters)
            
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
                for msg in messages
            ]
            
        except TwilioRestException as e:
            logger.error(f"Error listing messages: {e.msg}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error listing messages: {str(e)}")
            return []
    
    @classmethod
    def validate_webhook_signature(
        cls,
        request_url: str,
        post_params: Dict[str, str],
        signature: str
    ) -> bool:
        """
        Validate Twilio webhook signature
        
        Args:
            request_url: Full URL of the request
            post_params: POST parameters from the request
            signature: X-Twilio-Signature header value
            
        Returns:
            True if signature is valid
        """
        auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
        if not auth_token:
            logger.error("Cannot validate webhook: auth token not configured")
            return False
        
        validator = RequestValidator(auth_token)
        return validator.validate(request_url, post_params, signature)
    
    @classmethod
    def normalize_phone_number(cls, phone: str) -> str:
        """
        Normalize phone number to E.164 format
        
        Args:
            phone: Phone number string
            
        Returns:
            Normalized phone number
        """
        # Remove any non-digit characters except leading +
        if phone.startswith('+'):
            cleaned = '+' + ''.join(filter(str.isdigit, phone[1:]))
        else:
            cleaned = ''.join(filter(str.isdigit, phone))
            # Add + if not present (assume it's missing)
            if not cleaned.startswith('+'):
                cleaned = '+' + cleaned
        
        return cleaned
    
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
    def lookup_phone_number(cls, phone: str) -> Optional[Dict[str, Any]]:
        """
        Lookup phone number information using Twilio Lookup API
        
        Args:
            phone: Phone number to lookup
            
        Returns:
            Phone number info or None
        """
        client = cls.get_client()
        if not client:
            return None
        
        try:
            phone_number = client.lookups.v2.phone_numbers(phone).fetch()
            
            return {
                'phone_number': phone_number.phone_number,
                'country_code': phone_number.country_code,
                'national_format': phone_number.national_format,
                'valid': phone_number.valid,
                'validation_errors': phone_number.validation_errors,
            }
            
        except TwilioRestException as e:
            logger.error(f"Error looking up phone number {phone}: {e.msg}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error looking up phone number: {str(e)}")
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
        Format a ticket notification message for SMS
        
        Args:
            ticket_id: Ticket identifier
            ticket_title: Ticket title/subject
            notification_type: Type of notification (new, update, resolved, etc.)
            business_name: Name of the business
            
        Returns:
            Formatted SMS message
        """
        templates = {
            'new': f"[{business_name}] New ticket #{ticket_id}: {ticket_title[:50]}...",
            'update': f"[{business_name}] Ticket #{ticket_id} has been updated.",
            'resolved': f"[{business_name}] Ticket #{ticket_id} has been resolved.",
            'assigned': f"[{business_name}] Ticket #{ticket_id} has been assigned to you.",
            'sla_warning': f"[{business_name}] SLA Warning: Ticket #{ticket_id} requires attention.",
            'sla_breach': f"[{business_name}] SLA Breach: Ticket #{ticket_id} has exceeded SLA.",
        }
        
        return templates.get(
            notification_type,
            f"[{business_name}] Notification for ticket #{ticket_id}"
        )
