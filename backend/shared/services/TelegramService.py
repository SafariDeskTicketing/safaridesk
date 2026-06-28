import requests
import logging
import secrets
from typing import Optional, Dict, Any, Tuple
from django.conf import settings

logger = logging.getLogger(__name__)

TELEGRAM_API_BASE = "https://api.telegram.org/bot"


class TelegramService:
    """Service for interacting with Telegram Bot API"""
    
    @staticmethod
    def validate_bot_token(token: str) -> Tuple[bool, Optional[Dict]]:
        """
        Validate a bot token by calling getMe API
        Returns: (is_valid, bot_info)
        """
        try:
            response = requests.get(
                f"{TELEGRAM_API_BASE}{token}/getMe",
                timeout=10
            )
            data = response.json()
            
            if data.get('ok'):
                return True, data.get('result')
            else:
                logger.error(f"Telegram token validation failed: {data.get('description')}")
                return False, None
                
        except requests.RequestException as e:
            logger.error(f"Error validating Telegram token: {str(e)}")
            return False, None
    
    @staticmethod
    def set_webhook(token: str, webhook_url: str, secret_token: Optional[str] = None) -> bool:
        """
        Set the webhook URL for the bot
        """
        try:
            payload = {
                'url': webhook_url,
                'allowed_updates': ['message', 'edited_message', 'callback_query']
            }
            
            if secret_token:
                payload['secret_token'] = secret_token
            
            response = requests.post(
                f"{TELEGRAM_API_BASE}{token}/setWebhook",
                json=payload,
                timeout=10
            )
            data = response.json()
            
            if data.get('ok'):
                logger.info(f"Webhook set successfully: {webhook_url}")
                return True
            else:
                logger.error(f"Failed to set webhook: {data.get('description')}")
                return False
                
        except requests.RequestException as e:
            logger.error(f"Error setting webhook: {str(e)}")
            return False
    
    @staticmethod
    def delete_webhook(token: str) -> bool:
        """
        Delete the webhook (useful for cleanup)
        """
        try:
            response = requests.post(
                f"{TELEGRAM_API_BASE}{token}/deleteWebhook",
                timeout=10
            )
            data = response.json()
            return data.get('ok', False)
            
        except requests.RequestException as e:
            logger.error(f"Error deleting webhook: {str(e)}")
            return False
    
    @staticmethod
    def get_webhook_info(token: str) -> Optional[Dict]:
        """
        Get current webhook info
        """
        try:
            response = requests.get(
                f"{TELEGRAM_API_BASE}{token}/getWebhookInfo",
                timeout=10
            )
            data = response.json()
            
            if data.get('ok'):
                return data.get('result')
            return None
            
        except requests.RequestException as e:
            logger.error(f"Error getting webhook info: {str(e)}")
            return None
    
    @staticmethod
    def send_message(
        token: str, 
        chat_id: int, 
        text: str, 
        parse_mode: str = 'HTML',
        reply_to_message_id: Optional[int] = None
    ) -> Optional[Dict]:
        """
        Send a message to a chat
        """
        try:
            payload = {
                'chat_id': chat_id,
                'text': text,
                'parse_mode': parse_mode
            }
            
            if reply_to_message_id:
                payload['reply_to_message_id'] = reply_to_message_id
            
            response = requests.post(
                f"{TELEGRAM_API_BASE}{token}/sendMessage",
                json=payload,
                timeout=10
            )
            data = response.json()
            
            if data.get('ok'):
                return data.get('result')
            else:
                logger.error(f"Failed to send message: {data.get('description')}")
                return None
                
        except requests.RequestException as e:
            logger.error(f"Error sending message: {str(e)}")
            return None
    
    @staticmethod
    def generate_webhook_secret() -> str:
        """
        Generate a secure random secret for webhook verification
        """
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def get_updates(token: str, offset: int = None, limit: int = 100) -> Optional[list]:
        """
        Get recent updates using long polling (alternative to webhook).
        Useful for development when webhook URL is not accessible.
        """
        try:
            params = {'limit': limit}
            if offset:
                params['offset'] = offset
            
            response = requests.get(
                f"{TELEGRAM_API_BASE}{token}/getUpdates",
                params=params,
                timeout=30
            )
            data = response.json()
            
            if data.get('ok'):
                return data.get('result', [])
            else:
                logger.error(f"Failed to get updates: {data.get('description')}")
                return None
                
        except requests.RequestException as e:
            logger.error(f"Error getting updates: {str(e)}")
            return None
    
    @staticmethod
    def verify_webhook_secret(request_secret: str, stored_secret: str) -> bool:
        """
        Verify the webhook secret token
        """
        return secrets.compare_digest(request_secret, stored_secret)
    
    @staticmethod
    def parse_message(update: Dict) -> Optional[Dict]:
        """
        Parse incoming update and extract message info
        """
        message = update.get('message') or update.get('edited_message')
        
        if not message:
            return None
        
        chat = message.get('chat', {})
        from_user = message.get('from', {})
        
        return {
            'message_id': message.get('message_id'),
            'text': message.get('text', ''),
            'chat_id': chat.get('id'),
            'chat_type': chat.get('type', 'private'),
            'user_id': from_user.get('id'),
            'username': from_user.get('username'),
            'first_name': from_user.get('first_name'),
            'last_name': from_user.get('last_name'),
            'date': message.get('date'),
            'is_command': message.get('text', '').startswith('/') if message.get('text') else False
        }
    
    @staticmethod
    def format_ticket_notification(
        ticket_id: str,
        title: str,
        status: str,
        priority: str,
        requester: str
    ) -> str:
        """
        Format a ticket notification message
        """
        return f"""🎫 <b>Ticket Update</b>

<b>ID:</b> {ticket_id}
<b>Title:</b> {title}
<b>Status:</b> {status}
<b>Priority:</b> {priority}
<b>Requester:</b> {requester}"""

    @staticmethod
    def format_agent_reply(agent_name: str, message: str) -> str:
        """
        Format an agent reply message
        """
        return f"""💬 <b>Reply from {agent_name}:</b>

{message}"""
