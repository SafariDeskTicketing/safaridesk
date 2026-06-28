import requests
import logging
import json
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode

logger = logging.getLogger(__name__)


class TeamsService:
    """Service for handling Microsoft Teams/Graph API interactions"""
    
    # Microsoft OAuth endpoints
    AUTHORITY_URL = "https://login.microsoftonline.com"
    GRAPH_API_URL = "https://graph.microsoft.com/v1.0"
    
    @staticmethod
    def get_oauth_url(state: str) -> str:
        """Generate Microsoft OAuth URL for Teams authorization"""
        scopes = ' '.join(settings.TEAMS_OAUTH_SCOPES)
        
        params = {
            'client_id': settings.TEAMS_CLIENT_ID,
            'response_type': 'code',
            'redirect_uri': settings.TEAMS_REDIRECT_URI,
            'scope': scopes,
            'state': state,
            'response_mode': 'query',
        }
        
        # Use 'common' for multi-tenant apps or specific tenant ID
        auth_url = f"{TeamsService.AUTHORITY_URL}/common/oauth2/v2.0/authorize"
        return f"{auth_url}?{urlencode(params)}"
    
    @staticmethod
    def exchange_code_for_token(code: str) -> Dict:
        """Exchange authorization code for access token"""
        url = f"{TeamsService.AUTHORITY_URL}/common/oauth2/v2.0/token"
        
        scopes = ' '.join(settings.TEAMS_OAUTH_SCOPES)
        
        data = {
            'client_id': settings.TEAMS_CLIENT_ID,
            'client_secret': settings.TEAMS_CLIENT_SECRET,
            'code': code,
            'redirect_uri': settings.TEAMS_REDIRECT_URI,
            'grant_type': 'authorization_code',
            'scope': scopes,
        }
        
        try:
            response = requests.post(url, data=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Error exchanging code for token: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            raise
    
    @staticmethod
    def refresh_access_token(refresh_token: str) -> Dict:
        """Refresh the access token using the refresh token"""
        url = f"{TeamsService.AUTHORITY_URL}/common/oauth2/v2.0/token"
        
        scopes = ' '.join(settings.TEAMS_OAUTH_SCOPES)
        
        data = {
            'client_id': settings.TEAMS_CLIENT_ID,
            'client_secret': settings.TEAMS_CLIENT_SECRET,
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token',
            'scope': scopes,
        }
        
        try:
            response = requests.post(url, data=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Error refreshing token: {str(e)}")
            raise
    
    @staticmethod
    def get_user_info(access_token: str) -> Dict:
        """Get the current user's profile from Microsoft Graph"""
        url = f"{TeamsService.GRAPH_API_URL}/me"
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching user info: {str(e)}")
            raise
    
    @staticmethod
    def get_joined_teams(access_token: str) -> List[Dict]:
        """Get list of Teams the user has joined"""
        url = f"{TeamsService.GRAPH_API_URL}/me/joinedTeams"
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            teams = []
            for team in data.get('value', []):
                teams.append({
                    'id': team.get('id'),
                    'name': team.get('displayName'),
                    'description': team.get('description', ''),
                })
            
            return teams
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching joined teams: {str(e)}")
            raise
    
    @staticmethod
    def get_team_channels(access_token: str, team_id: str) -> List[Dict]:
        """Get list of channels in a Team"""
        url = f"{TeamsService.GRAPH_API_URL}/teams/{team_id}/channels"
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            channels = []
            for channel in data.get('value', []):
                channels.append({
                    'id': channel.get('id'),
                    'name': channel.get('displayName'),
                    'description': channel.get('description', ''),
                    'membership_type': channel.get('membershipType', 'standard'),
                })
            
            return channels
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching team channels: {str(e)}")
            raise
    
    @staticmethod
    def send_channel_message(access_token: str, team_id: str, channel_id: str, message: str, card: Optional[Dict] = None) -> bool:
        """Send a message to a Teams channel"""
        url = f"{TeamsService.GRAPH_API_URL}/teams/{team_id}/channels/{channel_id}/messages"
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        body = {
            'body': {
                'contentType': 'html',
                'content': message
            }
        }
        
        # If an Adaptive Card is provided, use it
        if card:
            import uuid
            attachment_id = str(uuid.uuid4())
            # Must include attachment marker in body content
            body['body']['content'] = f'<attachment id="{attachment_id}"></attachment>'
            body['attachments'] = [{
                'id': attachment_id,
                'contentType': 'application/vnd.microsoft.card.adaptive',
                'contentUrl': None,
                'content': json.dumps(card)
            }]
        
        try:
            logger.info(f"Sending Teams message to team {team_id}, channel {channel_id}")
            response = requests.post(url, headers=headers, json=body)
            
            if response.status_code == 403:
                error_data = response.json() if response.text else {}
                error_msg = error_data.get('error', {}).get('message', 'Forbidden')
                logger.error(f"Permission denied sending Teams message: {error_msg}")
                raise Exception(f"Permission denied: {error_msg}. Make sure the app has ChannelMessage.Send permission and admin consent.")
            
            if response.status_code == 404:
                logger.error(f"Team or channel not found: {response.text}")
                raise Exception("Team or channel not found. Please verify the selection.")
            
            response.raise_for_status()
            logger.info("Teams message sent successfully")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Error sending channel message: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                error_text = e.response.text
                logger.error(f"Response: {error_text}")
                # Try to parse error message from response
                try:
                    error_data = e.response.json()
                    error_msg = error_data.get('error', {}).get('message', str(e))
                    raise Exception(error_msg)
                except:
                    raise Exception(f"API Error: {error_text[:200] if error_text else str(e)}")
            raise
    
    @staticmethod
    def send_test_notification(access_token: str, team_id: str, channel_id: str, tenant_name: str) -> bool:
        """Send a test notification to verify integration"""
        message = f"""
        <p><strong>🎉 SafariDesk Integration Test</strong></p>
        <p>✅ Great! Your SafariDesk integration is working perfectly for <strong>{tenant_name}</strong>.</p>
        <p>You'll now receive notifications for:</p>
        <ul>
            <li>New tickets</li>
            <li>Ticket assignments</li>
            <li>Status updates</li>
            <li>SLA breaches</li>
            <li>Comments</li>
        </ul>
        <p><em>🚀 Powered by SafariDesk</em></p>
        """
        
        # Adaptive Card for better formatting
        card = {
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.4",
            "body": [
                {
                    "type": "TextBlock",
                    "text": "🎉 SafariDesk Integration Test",
                    "weight": "bolder",
                    "size": "large"
                },
                {
                    "type": "TextBlock",
                    "text": f"✅ Great! Your SafariDesk integration is working perfectly for **{tenant_name}**.",
                    "wrap": True
                },
                {
                    "type": "TextBlock",
                    "text": "You'll now receive notifications for:",
                    "wrap": True,
                    "spacing": "medium"
                },
                {
                    "type": "TextBlock",
                    "text": "• New tickets\n• Ticket assignments\n• Status updates\n• SLA breaches\n• Comments",
                    "wrap": True
                },
                {
                    "type": "TextBlock",
                    "text": "🚀 Powered by SafariDesk",
                    "size": "small",
                    "isSubtle": True,
                    "spacing": "medium"
                }
            ]
        }
        
        return TeamsService.send_channel_message(access_token, team_id, channel_id, message, card)
    
    @staticmethod
    def format_ticket_notification(ticket_data: Dict, notification_type: str) -> Tuple[str, Dict]:
        """Format ticket notification as HTML and Adaptive Card for Teams"""
        ticket_id = ticket_data.get('id')
        title = ticket_data.get('title', 'Untitled')
        priority = ticket_data.get('priority', 'Medium')
        assignee = ticket_data.get('assignee', {}).get('name', 'Unassigned')
        status = ticket_data.get('status', 'Open')
        
        # Priority emoji mapping
        priority_emoji = {
            'Low': '🟢',
            'Medium': '🟡',
            'High': '🟠',
            'Critical': '🔴'
        }
        
        # Priority color mapping for Adaptive Card
        priority_colors = {
            'Low': 'good',
            'Medium': 'warning',
            'High': 'attention',
            'Critical': 'attention'
        }
        
        # Notification type specific formatting
        if notification_type == 'new_ticket':
            header = "🎫 New Ticket Created"
            color = "accent"
        elif notification_type == 'assignment':
            header = "👤 Ticket Assigned"
            color = "accent"
        elif notification_type == 'status_update':
            header = "📊 Status Updated"
            color = "warning"
        elif notification_type == 'sla_breach':
            header = "⚠️ SLA Breach"
            color = "attention"
        elif notification_type == 'comment':
            header = "💬 New Comment"
            color = "accent"
        else:
            header = "📋 Ticket Update"
            color = "default"
        
        # HTML message
        message = f"""
        <p><strong>{header}</strong></p>
        <p><strong>Title:</strong> {title}</p>
        <p><strong>Priority:</strong> {priority_emoji.get(priority, '⚪')} {priority}</p>
        <p><strong>Assigned to:</strong> {assignee}</p>
        <p><strong>Status:</strong> {status}</p>
        """
        
        # Adaptive Card
        card = {
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.4",
            "body": [
                {
                    "type": "TextBlock",
                    "text": header,
                    "weight": "bolder",
                    "size": "medium"
                },
                {
                    "type": "FactSet",
                    "facts": [
                        {"title": "Title", "value": title},
                        {"title": "Priority", "value": f"{priority_emoji.get(priority, '⚪')} {priority}"},
                        {"title": "Assigned to", "value": assignee},
                        {"title": "Status", "value": status}
                    ]
                }
            ]
        }
        
        return message, card
    
    @staticmethod
    def revoke_token(access_token: str) -> bool:
        """
        Revoke Microsoft OAuth token.
        Note: Microsoft doesn't have a direct token revocation endpoint.
        The token will expire naturally. For immediate revocation,
        you would need to revoke app permissions in Azure AD.
        """
        # Microsoft doesn't support token revocation via API
        # Session logout can be done by redirecting user to:
        # https://login.microsoftonline.com/common/oauth2/v2.0/logout
        logger.info("Token revocation requested - token will expire naturally")
        return True
    
    @staticmethod
    def ensure_valid_token(integration) -> str:
        """
        Ensure we have a valid access token, refreshing if necessary.
        Updates the integration object with new tokens if refreshed.
        Returns the valid access token.
        """
        if not integration.is_token_expired():
            return integration.access_token
        
        if not integration.refresh_token:
            raise Exception("Token expired and no refresh token available")
        
        try:
            token_response = TeamsService.refresh_access_token(integration.refresh_token)
            
            integration.access_token = token_response['access_token']
            integration.refresh_token = token_response.get('refresh_token', integration.refresh_token)
            
            expires_in = token_response.get('expires_in', 3600)
            integration.token_expires_at = timezone.now() + timedelta(seconds=expires_in)
            integration.save()
            
            logger.info(f"Refreshed Teams token for business {integration.business.name}")
            return integration.access_token
            
        except Exception as e:
            logger.error(f"Failed to refresh Teams token: {str(e)}")
            raise
