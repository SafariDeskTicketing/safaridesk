import requests
import logging
logger = logging.getLogger(__name__)
from django.conf import settings
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode
from tenant.models import Ticket
from shared.models import SlackIntegration

class SlackService:
    def __init__(self, integration=None):
        self.integration = integration
        if integration:
            self.business = integration.business
            self.bot_user_id = integration.bot_user_id
        else:
            self.business = None
            self.bot_user_id = None

    def process_event(self, event: dict) -> bool:
        """Process incoming Slack events and delegate to appropriate handler"""
        event_type = event.get('type')
        logger = logging.getLogger(__name__)
        logger.info(f"Processing Slack event: {event_type}")
        
        if event_type == 'message':
            return self._handle_message_event(event)
        elif event_type == 'app_mention':
            return self._handle_app_mention_event(event)
        else:
            logger.warning(f"Unhandled Slack event type: {event_type}")
            return True
    
    def _handle_message_event(self, event: dict) -> bool:
        """Handle new message events from Slack channels"""
        try:
            channel_id = event.get('channel')
            user_id = event.get('user')
            message_text = event.get('text', '')
            thread_ts = event.get('thread_ts')
            event_ts = event.get('event_ts', event.get('ts', ''))
            
            # Skip bot messages
            if event.get('subtype') == 'bot_message':
                return True
                
            # Skip messages from the bot itself
            if user_id == self.bot_user_id:
                return True
            
            # Check if this is a reply to a tracked Slack thread
            if thread_ts:
                return self._handle_thread_reply(channel_id, user_id, message_text, thread_ts, event_ts)
                
            # Create ticket from message
            if message_text and not message_text.startswith('SLACK_'):
                ticket = self._create_ticket_from_message(
                    channel_id=channel_id,
                    user_id=user_id,
                    message_text=message_text,
                    user_full_name=self._get_slack_user_name(user_id),
                    thread_ts=thread_ts,
                    event=event
                )
                return True
            return True
        except Exception as e:
            logger.error(f"Error processing Slack message event: {str(e)}")
            return False
    
    def _handle_thread_reply(self, channel_id: str, user_id: str, message_text: str, 
                            thread_ts: str, event_ts: str) -> bool:
        """
        Handle a reply in a Slack thread - add as comment to the linked ticket.
        """
        try:
            from shared.models.SlackTicketMapping import SlackTicketMapping
            from tenant.models import TicketComment
            from users.models import Users
            
            # Find the ticket linked to this Slack thread
            mapping = SlackTicketMapping.objects.filter(
                slack_channel_id=channel_id,
                slack_thread_ts=thread_ts
            ).first()
            
            if not mapping:
                # Also check if this is a reply to the original message (not the thread root)
                mapping = SlackTicketMapping.objects.filter(
                    slack_channel_id=channel_id,
                    slack_message_ts=thread_ts
                ).first()
            
            if not mapping:
                logger.info(f"No ticket mapping found for Slack thread {channel_id}/{thread_ts}")
                return True  # Not an error, just not a tracked thread
            
            ticket = mapping.ticket
            
            # Skip if this is a bot message
            if user_id == self.bot_user_id:
                return True
            
            # Get or create user
            slack_username = self._get_slack_user_name(user_id)
            user = Users.objects.filter(email__iexact=f"{user_id}@slack.users").first()
            
            # Create comment
            comment = TicketComment.objects.create(
                ticket=ticket,
                content=message_text,
                is_internal=False,
                creator_name=slack_username,
                creator_email=f"{user_id}@slack.users" if not user else user.email,
                author=user
            )
            
            logger.info(f"Added Slack thread reply as comment to ticket {ticket.ticket_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error handling Slack thread reply: {str(e)}")
            return False
    
    def _handle_app_mention_event(self, event: dict) -> bool:
        """Handle app mention events (@yourbot)"""
        try:
            channel_id = event.get('channel')
            user_id = event.get('user')
            text = event.get('text', '')
            
            # Extract command from mention
            parts = text.split(' ', 2)
            if len(parts) >= 3:
                command = parts[1].lower()
                argument = parts[2] if len(parts) > 2 else ""
                
                if command in ['create', 'new']:
                    ticket = self._create_ticket_from_message(
                        channel_id=channel_id,
                        user_id=user_id,
                        message_text=f"Created via command: {argument}",
                        user_full_name=self._get_slack_user_name(user_id),
                        event=event
                    )
                    return True
            return True
        except Exception as e:
            logger.error(f"Error processing Slack app mention event: {str(e)}")
            return False
    
    def _get_slack_user_name(self, slack_user_id: str) -> str:
        """Get the full name of a Slack user by ID"""
        try:
            # Simplified implementation - in practice query Slack API
            return "Slack User"
        except Exception:
            return "Slack User"
    
    def _create_ticket_from_message(self, channel_id: str, user_id: str, message_text: str, 
                                  user_full_name: str = "", thread_ts: Optional[str] = None,
                                  event: dict = None) -> Ticket:
        """Create a ticket from a Slack message"""
        # Generate title from message
        title_lines = [line.strip() for line in message_text.split('\n') if line.strip()]
        title = title_lines[0][:100] if title_lines else "New Slack Message"
        
        # Create ticket
        ticket_data = {
            'business': self.business,
            'ticket_id': f"SLACK-{channel_id[:8].upper()}",
            'title': title,
            'description': message_text,
            'creator_name': user_full_name or "Slack User",
            'creator_email': None,
            'category': None,
            'department': None,
            'priority': 'medium',
            'status': 'open',
            'source': 'api',
        }
        
        ticket = Ticket.objects.create(**ticket_data)
        
        # Create Slack ticket mapping for two-way sync
        from shared.models.SlackTicketMapping import SlackTicketMapping
        SlackTicketMapping.objects.create(
            ticket=ticket,
            slack_channel_id=channel_id,
            slack_thread_ts=thread_ts or (event.get('ts') if event else ''),
            slack_message_ts=event.get('ts', '') if event else '',
            slack_team_id=self.integration.team_id if self.integration else '',
            created_by_event=True
        )
        
        logger.info(f"Created ticket {ticket.ticket_id} from Slack message in channel {channel_id}")
        return ticket

    def post_ticket_update_to_slack(self, ticket, update_type, user=None):
        """
        Post an update to the Slack thread associated with this ticket.
        update_type: 'status', 'assignee', 'priority', 'comment'
        """
        try:
            mapping = ticket.slack_mapping
        except Exception:
            return False  # Not a Slack-originated ticket

        integration = SlackIntegration.objects.filter(
            business=ticket.business,
            is_active=True
        ).first()
        if not integration:
            return False

        message, blocks = self._format_ticket_update(ticket, update_type, user)
        
        return self._send_message_to_thread(
            integration.access_token,
            mapping.slack_channel_id,
            mapping.slack_thread_ts,
            message,
            blocks
        )

    def _format_ticket_update(self, ticket, update_type, user):
        """Format a ticket update for Slack."""
        from django.conf import settings
        base_url = ticket.business.domain_url or getattr(settings, 'FRONTEND_URL_BASE', '')
        ticket_url = f"{base_url}/tickets/{ticket.ticket_id}" if base_url else f"Ticket {ticket.ticket_id}"
        
        updates = {
            'status': f"Status changed to *{ticket.get_status_display()}*",
            'assignee': f"Assigned to *{ticket.assigned_to.get_full_name() if ticket.assigned_to else 'Unassigned'}*",
            'priority': f"Priority changed to *{ticket.priority.upper()}*",
            'comment': f"New comment added"
        }
        
        message = f"Ticket <{ticket_url}|{ticket.ticket_id}> — {updates.get(update_type, 'Updated')}"
        blocks = [{
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": message
            }
        }]
        
        return message, blocks

    def _send_message_to_thread(self, access_token, channel_id, thread_ts, text, blocks=None):
        """Send a message as a reply to a Slack thread."""
        url = f"{self.BASE_URL}/chat.postMessage"
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        data = {
            'channel': channel_id,
            'text': text,
            'thread_ts': thread_ts,
            'reply_broadcast': False
        }
        if blocks:
            data['blocks'] = blocks
        
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        result = response.json()
        return result.get('ok', False)
    """Service for handling Slack API interactions"""
    
    BASE_URL = "https://slack.com/api"
    
    @staticmethod
    def get_oauth_url(state: str) -> str:
        """Generate Slack OAuth URL for app installation"""
        params = {
            'client_id': settings.SLACK_CLIENT_ID,
            'scope': settings.SLACK_OAUTH_SCOPES,
            'redirect_uri': settings.SLACK_REDIRECT_URI,
            'state': state  # Use tenant ID or unique identifier
        }
        return f"https://slack.com/oauth/v2/authorize?{urlencode(params)}"
    
    @staticmethod
    def exchange_code_for_token(code: str) -> Dict:
        """Exchange authorization code for access token"""
        url = f"{SlackService.BASE_URL}/oauth.v2.access"
        
        data = {
            'client_id': settings.SLACK_CLIENT_ID,
            'client_secret': settings.SLACK_CLIENT_SECRET,
            'code': code,
            'redirect_uri': settings.SLACK_REDIRECT_URI
        }
        
        response = requests.post(url, data=data)
        response.raise_for_status()
        
        return response.json()
    
    @staticmethod
    def get_channels(access_token: str) -> List[Dict]:
        """Fetch list of channels from Slack workspace"""
        import logging
        logger = logging.getLogger(__name__)
        
        url = f"{SlackService.BASE_URL}/conversations.list"
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        params = {
            'types': 'public_channel,private_channel',
            'exclude_archived': True,
            'limit': 100
        }
        
        all_channels = []
        cursor = None
        
        try:
            while True:
                if cursor:
                    params['cursor'] = cursor
                
                logger.debug(f"Making Slack API call to {url} with params: {params}")
                
                response = requests.get(url, headers=headers, params=params)
                response.raise_for_status()
                
                data = response.json()
                logger.debug(f"Slack API response: {data}")
                
                if not data.get('ok'):
                    error_msg = data.get('error', 'Unknown error')
                    logger.error(f"Slack API error: {error_msg}")
                    raise Exception(f"Slack API error: {error_msg}")
                
                channels = data.get('channels', [])
                all_channels.extend(channels)
                
                # Check if there are more pages
                cursor = data.get('response_metadata', {}).get('next_cursor')
                if not cursor:
                    break
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error when fetching channels: {str(e)}")
            raise Exception(f"Failed to fetch channels: {str(e)}")
        except Exception as e:
            logger.error(f"Error fetching Slack channels: {str(e)}")
            raise
        
        # Filter and format channels 
        formatted_channels = []
        for channel in all_channels:
            # Only include channels the bot can access
            if channel.get('is_member') or not channel.get('is_private'):
                formatted_channels.append({
                    'id': channel['id'],
                    'name': channel['name'],
                    'is_private': channel.get('is_private', False),
                    'is_member': channel.get('is_member', False)
                })
        
        logger.info(f"Successfully fetched {len(formatted_channels)} channels")
        return formatted_channels
    
    @staticmethod
    def join_channel(access_token: str, channel_id: str) -> bool:
        """Join a public channel"""
        url = f"{SlackService.BASE_URL}/conversations.join"
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'channel': channel_id
        }
        
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        
        result = response.json()
        return result.get('ok', False)
    
    @staticmethod
    def send_message(access_token: str, channel_id: str, message: str, blocks: Optional[List[Dict]] = None) -> bool:
        """Send a message to a Slack channel"""
        url = f"{SlackService.BASE_URL}/chat.postMessage"
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'channel': channel_id,
            'text': message
        }
        
        if blocks:
            data['blocks'] = blocks
        
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        
        result = response.json()
        if not result.get('ok'):
            raise Exception(f"Failed to send message: {result.get('error')}")
        
        return True
    
    @staticmethod
    def send_test_notification(access_token: str, channel_id: str, tenant_name: str) -> bool:
        """Send a test notification to verify integration"""
        message = f"🎉 SafariDesk integration test successful!"
        
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*SafariDesk Integration Test*\n\n✅ Great! Your SafariDesk integration is working perfectly for *{tenant_name}*.\n\nYou'll now receive notifications for:\n• New tickets\n• Ticket assignments\n• Status updates\n• SLA breaches\n• Comments"
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": "🚀 Powered by SafariDesk"
                    }
                ]
            }
        ]
        
        return SlackService.send_message(access_token, channel_id, message, blocks)
    
    @staticmethod
    def _html_to_slack_text(html_content: str) -> str:
        """
        Convert HTML content to Slack mrkdwn format.
        Strips HTML tags and converts to plain text with Slack formatting.
        """
        import re
        from html import unescape
        
        if not html_content:
            return ""
        
        text = html_content
        
        # Convert HTML formatting to Slack mrkdwn
        # <strong>, <b> -> *bold*
        text = re.sub(r'<(strong|b)\b[^>]*>(.*?)</\1>', r'*\2*', text, flags=re.IGNORECASE | re.DOTALL)
        # <em>, <i> -> _italic_
        text = re.sub(r'<(em|i)\b[^>]*>(.*?)</\1>', r'_\2_', text, flags=re.IGNORECASE | re.DOTALL)
        # <code> -> `code`
        text = re.sub(r'<code\b[^>]*>(.*?)</code>', r'`\1`', text, flags=re.IGNORECASE | re.DOTALL)
        # <a href="url">text</a> -> <url|text>
        text = re.sub(r'<a\s+href=["\']([^"\']*)["\'][^>]*>(.*?)</a>', r'<\1|\2>', text, flags=re.IGNORECASE | re.DOTALL)
        
        # Convert <br> and <br/> to newlines
        text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
        
        # Convert </p> and block elements to double newlines
        text = re.sub(r'</p>', '\n\n', text, flags=re.IGNORECASE)
        text = re.sub(r'</div>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'</li>', '\n', text, flags=re.IGNORECASE)
        
        # Remove all remaining HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        
        # Unescape HTML entities
        text = unescape(text)
        
        # Clean up multiple newlines
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Strip leading/trailing whitespace
        text = text.strip()
        
        return text
    
    @staticmethod
    def format_ticket_notification(ticket_data: Dict, notification_type: str) -> Tuple[str, List[Dict]]:
        """Format ticket notification for Slack"""
        ticket_id = ticket_data.get('id')
        title = ticket_data.get('title', 'Untitled')
        priority = ticket_data.get('priority', 'Medium')
        assignee = ticket_data.get('assignee', {}).get('name', 'Unassigned')
        status = ticket_data.get('status', 'Open')
        comment_data = ticket_data.get('comment')
        
        # Priority emoji mapping
        priority_emoji = {
            'Low': '🟢',
            'Medium': '🟡', 
            'High': '🟠',
            'Critical': '🔴'
        }
        
        # Notification type specific formatting
        if notification_type == 'new_ticket':
            message = f"🎫 New ticket created: {title}"
            color = "#36a64f"  # Green
            details = f"{priority_emoji.get(priority, '⚪')} Priority: *{priority}*\n👤 Assigned to: *{assignee}*\n📈 Status: *{status}*"
        elif notification_type == 'assignment':
            message = f"👤 Ticket assigned: {title}"
            color = "#3AA3E3"  # Blue
            details = f"👤 Assigned to: *{assignee}*\n{priority_emoji.get(priority, '⚪')} Priority: *{priority}*\n📈 Status: *{status}*"
        elif notification_type == 'status_update':
            message = f"📊 Status updated: {title}"
            color = "#ff9900"  # Orange
            details = f"📈 Status: *{status}*\n👤 Assigned to: *{assignee}*"
        elif notification_type == 'sla_breach':
            message = f"⚠️ SLA breach: {title}"
            color = "#ff0000"  # Red
            details = f"{priority_emoji.get(priority, '⚪')} Priority: *{priority}*\n👤 Assigned to: *{assignee}*\n📈 Status: *{status}*"
        elif notification_type == 'comment':
            if comment_data:
                author = comment_data.get('author', 'Someone')
                content = comment_data.get('content', '')
                is_internal = comment_data.get('is_internal', False)
                comment_type = "internal note" if is_internal else "comment"
                message = f"💬 New {comment_type} on ticket {ticket_id}"
                # Convert HTML to Slack mrkdwn
                content = SlackService._html_to_slack_text(content)
                # Truncate long comments
                if len(content) > 500:
                    content = content[:500] + "..."
                details = f"*{author}* added a {comment_type}:\n\n>{content}"
            else:
                message = f"💬 New comment: {title}"
                details = f"👤 Assigned to: *{assignee}*\n📈 Status: *{status}*"
            color = "#764FA5"  # Purple
        else:
            message = f"📋 Ticket update: {title}"
            color = "#808080"  # Gray
            details = f"{priority_emoji.get(priority, '⚪')} Priority: *{priority}*\n👤 Assigned to: *{assignee}*\n📈 Status: *{status}*"
        
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{message}*\n\n{details}"
                }
            }
        ]
        
        return message, blocks
    
    @staticmethod
    def revoke_token(access_token: str) -> bool:
        """Revoke Slack access token"""
        url = f"{SlackService.BASE_URL}/auth.revoke"
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        response = requests.post(url, headers=headers)
        response.raise_for_status()
        
        result = response.json()
        return result.get('ok', False)
    
    @staticmethod
    def verify_webhook_signature(signing_secret: str, timestamp: str, signature: str, body: str) -> bool:
        """
        Verify Slack webhook signature for security
        Returns True if signature is valid, False otherwise
        """
        import hmac
        import hashlib
        import time
        
        # Fail fast if any required parameter is missing
        if not signing_secret or not timestamp or not signature or not body:
            return False
        
        # Check if timestamp is within 5 minutes
        current_time = int(time.time())
        try:
            timestamp_int = int(timestamp)
        except (TypeError, ValueError):
            return False
            
        if abs(current_time - timestamp_int) > 300:
            return False
        
        # Build the signature base string
        sig_basestring = f"v0:{timestamp}:{body}"
        
        # Compute the signature
        my_signature = 'v0=' + hmac.new(
            signing_secret.encode('utf-8'),
            sig_basestring.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        # Compare signatures
        return hmac.compare_digest(my_signature, signature)
    
    @staticmethod
    def verify_event_token_permissions(access_token: str) -> Dict:
        """
        Verify the Slack app token has permissions required for event subscriptions.
        
        Note: Slack event subscriptions CANNOT be configured via API.
        They must be set manually in the Slack App dashboard at:
        https://api.slack.com/apps > Your App > Event Subscriptions
        This method only verifies the token has required permissions.
        """
        import logging
        logger = logging.getLogger(__name__)
        
        url = f"{SlackService.BASE_URL}/apps.event.authorizations.list"
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        # First, verify the token has the necessary scopes
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            result = response.json()
            
            if not result.get('ok'):
                logger.error(f"Failed to verify token permissions: {result.get('error')}")
                return {
                    'ok': False,
                    'error': result.get('error', 'Unknown error'),
                    'message': 'Token lacks required permissions for event subscriptions'
                }
        except Exception as e:
            logger.error(f"Error verifying token permissions: {str(e)}")
            return {
                'ok': False,
                'error': 'token_verification_failed',
                'message': str(e)
            }
        
        # Note: Slack event subscriptions CANNOT be configured via API.
        # They must be set manually in the Slack App dashboard at:
        # https://api.slack.com/apps > Your App > Event Subscriptions
        # This method only verifies the token has required permissions.
        
        return {
            'ok': True,
            'message': 'Token verified. Remember: set the webhook URL and subscribe to events in your Slack App dashboard (api.slack.com/apps).'
        }
    
    @staticmethod
    def get_event_subscriptions_status(access_token: str) -> Dict:
        """
        Get the current event subscription status
        """
        import logging
        logger = logging.getLogger(__name__)
        
        url = f"{SlackService.BASE_URL}/apps.event.authorizations.list"
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            result = response.json()
            
            if result.get('ok'):
                return {
                    'ok': True,
                    'authorized': True,
                    'authorizations': result.get('authorizations', [])
                }
            else:
                return {
                    'ok': False,
                    'authorized': False,
                    'error': result.get('error', 'Unknown error')
                }
        except Exception as e:
            logger.error(f"Error getting event subscription status: {str(e)}")
            return {
                'ok': False,
                'authorized': False,
                'error': str(e)
            }