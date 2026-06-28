from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from django.http import HttpResponseRedirect
from django.utils import timezone
from datetime import timedelta

from shared.models.TeamsIntegration import TeamsIntegration
from shared.services.TeamsService import TeamsService
from shared.serializers.TeamsSerializer import (
    TeamsIntegrationSerializer,
    TeamsTeamSerializer,
    TeamsChannelSerializer,
    TeamsTestNotificationSerializer,
    TeamsConfigurationUpdateSerializer
)
from users.models.BusinessModel import Business
import logging

logger = logging.getLogger(__name__)


class TeamsOAuthView(APIView):
    """Initiate Microsoft Teams OAuth flow"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            # Get current business from request user
            business = request.user.business
            state = f"{business.id}"  # Use business ID as state for verification
            
            oauth_url = TeamsService.get_oauth_url(state)
            
            return Response({
                'oauth_url': oauth_url,
                'state': state
            })
            
        except Exception as e:
            logger.error(f"Error generating Teams OAuth URL: {str(e)}")
            return Response(
                {'error': 'Failed to generate OAuth URL'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TeamsOAuthCallbackView(APIView):
    """Handle Microsoft Teams OAuth callback"""
    permission_classes = []  # No auth required for callback
    
    def get(self, request):
        try:
            code = request.GET.get('code')
            state = request.GET.get('state')
            error = request.GET.get('error')
            error_description = request.GET.get('error_description', '')
            
            logger.info(f"Received Teams OAuth callback with state: {state}, error: {error}")
            
            if not state:
                logger.error("Missing state parameter in Teams OAuth callback")
                frontend_url = f"{settings.FRONTEND_URL_BASE}/config/integrations?teams_error=missing_state"
                return HttpResponseRedirect(frontend_url)
            
            # Verify state matches a valid business
            try:
                business_id = int(state)
                business = Business.objects.get(id=business_id)
            except (ValueError, Business.DoesNotExist):
                logger.error(f"Invalid state parameter: {state}")
                frontend_url = f"{settings.FRONTEND_URL_BASE}/config/integrations?teams_error=invalid_state"
                return HttpResponseRedirect(frontend_url)
            
            # Handle OAuth errors
            if error:
                logger.error(f"Teams OAuth error: {error} - {error_description}")
                frontend_url = self._build_frontend_url(business, teams_error=error)
                return HttpResponseRedirect(frontend_url)
            
            if not code:
                logger.error("Missing authorization code in Teams OAuth callback")
                frontend_url = self._build_frontend_url(business, teams_error="missing_code")
                return HttpResponseRedirect(frontend_url)
            
            # Exchange code for access token
            try:
                token_response = TeamsService.exchange_code_for_token(code)
            except Exception as e:
                logger.error(f"Teams OAuth token exchange failed: {str(e)}")
                frontend_url = self._build_frontend_url(business, teams_error="token_exchange_failed")
                return HttpResponseRedirect(frontend_url)
            
            # Extract token data
            access_token = token_response.get('access_token')
            refresh_token = token_response.get('refresh_token')
            expires_in = token_response.get('expires_in', 3600)
            
            if not access_token:
                logger.error("No access token in response")
                frontend_url = self._build_frontend_url(business, teams_error="no_access_token")
                return HttpResponseRedirect(frontend_url)
            
            # Get user info from Microsoft Graph
            try:
                user_info = TeamsService.get_user_info(access_token)
            except Exception as e:
                logger.error(f"Failed to get user info: {str(e)}")
                frontend_url = self._build_frontend_url(business, teams_error="user_info_failed")
                return HttpResponseRedirect(frontend_url)
            
            # Extract tenant ID from the token or user info
            # The tenant ID can be found in the 'tid' claim of the token
            # For simplicity, we'll use the directory ID from settings or extract from user
            tenant_id = settings.TEAMS_DIRECTORY_ID
            
            # Calculate token expiry
            token_expires_at = timezone.now() + timedelta(seconds=expires_in)
            
            # Create or update Teams integration
            teams_integration, created = TeamsIntegration.objects.update_or_create(
                business=business,
                tenant_id=tenant_id,
                defaults={
                    'access_token': access_token,
                    'refresh_token': refresh_token,
                    'token_expires_at': token_expires_at,
                    'user_id': user_info.get('id', ''),
                    'user_email': user_info.get('mail') or user_info.get('userPrincipalName', ''),
                    'user_display_name': user_info.get('displayName', ''),
                    'is_active': True
                }
            )
            
            action = 'connected' if created else 'updated'
            logger.info(f"Teams integration {action} for business {business.name}")

            from util.Helper import Helper
            helper = Helper()
            url = helper.build_integration_url("teams", request, business, user_info)
            
            # Redirect to frontend with success
            # url = f"https://{business.domain}.dev.safaridesk.io/config/integrations?teams_connected=true&user_name={user_info.get('displayName', '')}"
            return HttpResponseRedirect(url)
            
        except Exception as e:
            logger.error(f"Error in Teams OAuth callback: {str(e)}")
            frontend_url = f"{settings.FRONTEND_URL_BASE}/config/integrations?teams_error=callback_failed"
            return HttpResponseRedirect(frontend_url)
    
    def _build_frontend_url(self, business, **query_params):
        """
        Build frontend URL based on the business domain or fallback.
        Accepts optional query parameters as kwargs.
        """
        if business.domain_url:
            base_url = business.domain_url.rstrip("/")
        elif business.domain:
            base_url = f"https://{business.domain}.safaridesk.io".rstrip("/")
        else:
            base_url = f"https://{business.id}.safaridesk.io"
        
        url = f"{base_url}/config/integrations"
        
        if query_params:
            from urllib.parse import urlencode
            url += f"?{urlencode(query_params)}"
        
        return url


class TeamsIntegrationDetailView(APIView):
    """Get, update, or delete Teams integration"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            business = request.user.business
            integration = TeamsIntegration.objects.filter(
                business=business, is_active=True
            ).first()
            
            if not integration:
                return Response({'integration': None})
            
            serializer = TeamsIntegrationSerializer(integration)
            return Response({'integration': serializer.data})
            
        except Exception as e:
            logger.error(f"Error fetching Teams integration: {str(e)}")
            return Response(
                {'error': 'Failed to fetch integration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def patch(self, request):
        try:
            business = request.user.business
            integration = TeamsIntegration.objects.filter(
                business=business, is_active=True
            ).first()
            
            if not integration:
                return Response(
                    {'error': 'Teams integration not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = TeamsConfigurationUpdateSerializer(data=request.data)
            if serializer.is_valid():
                for field, value in serializer.validated_data.items():
                    setattr(integration, field, value)
                integration.save()
                
                response_serializer = TeamsIntegrationSerializer(integration)
                return Response({'integration': response_serializer.data})
            
            return Response(
                {'error': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        except Exception as e:
            logger.error(f"Error updating Teams integration: {str(e)}")
            return Response(
                {'error': 'Failed to update integration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request):
        try:
            business = request.user.business
            integration = TeamsIntegration.objects.filter(
                business=business, is_active=True
            ).first()
            
            if not integration:
                return Response(
                    {'error': 'Teams integration not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Revoke token (Microsoft doesn't have direct revocation, token expires naturally)
            try:
                TeamsService.revoke_token(integration.access_token)
            except Exception as e:
                logger.warning(f"Failed to revoke Teams token: {str(e)}")
            
            # Deactivate integration
            integration.is_active = False
            integration.save()
            
            return Response({'message': 'Teams integration disconnected successfully'})
            
        except Exception as e:
            logger.error(f"Error disconnecting Teams integration: {str(e)}")
            return Response(
                {'error': 'Failed to disconnect integration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TeamsTeamsListView(APIView):
    """Fetch available Teams the user has joined"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            business = request.user.business
            integration = TeamsIntegration.objects.filter(
                business=business, is_active=True
            ).first()
            
            if not integration:
                return Response(
                    {'error': 'Teams integration not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Ensure we have a valid token
            try:
                access_token = TeamsService.ensure_valid_token(integration)
            except Exception as e:
                logger.error(f"Token refresh failed: {str(e)}")
                return Response(
                    {'error': 'Authentication expired. Please reconnect Teams.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            teams = TeamsService.get_joined_teams(access_token)
            serializer = TeamsTeamSerializer(teams, many=True)
            
            return Response({'teams': serializer.data})
            
        except Exception as e:
            logger.error(f"Error fetching Teams: {str(e)}")
            return Response(
                {'error': 'Failed to fetch teams'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TeamsChannelsView(APIView):
    """Fetch available channels in a Team"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        try:
            business = request.user.business
            integration = TeamsIntegration.objects.filter(
                business=business, is_active=True
            ).first()
            
            if not integration:
                return Response(
                    {'error': 'Teams integration not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get team_id from query params or use the saved default
            team_id = request.GET.get('team_id') or integration.team_id
            
            if not team_id:
                return Response(
                    {'error': 'Team ID is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Ensure we have a valid token
            try:
                access_token = TeamsService.ensure_valid_token(integration)
            except Exception as e:
                logger.error(f"Token refresh failed: {str(e)}")
                return Response(
                    {'error': 'Authentication expired. Please reconnect Teams.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            channels = TeamsService.get_team_channels(access_token, team_id)
            serializer = TeamsChannelSerializer(channels, many=True)
            
            return Response({'channels': serializer.data})
            
        except Exception as e:
            logger.error(f"Error fetching Teams channels: {str(e)}")
            return Response(
                {'error': 'Failed to fetch channels'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TeamsTestNotificationView(APIView):
    """Send test notification to Teams channel"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            business = request.user.business
            integration = TeamsIntegration.objects.filter(
                business=business, is_active=True
            ).first()
            
            if not integration:
                return Response(
                    {'error': 'Teams integration not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = TeamsTestNotificationSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {'error': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            team_id = serializer.validated_data['team_id']
            channel_id = serializer.validated_data['channel_id']
            
            # Ensure we have a valid token
            try:
                access_token = TeamsService.ensure_valid_token(integration)
            except Exception as e:
                logger.error(f"Token refresh failed: {str(e)}")
                return Response(
                    {'error': 'Authentication expired. Please reconnect Teams.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            # Try to send test notification
            try:
                success = TeamsService.send_test_notification(
                    access_token,
                    team_id,
                    channel_id,
                    business.name
                )
                
                if success:
                    return Response({
                        'success': True,
                        'message': 'Test notification sent successfully!'
                    })
                else:
                    return Response(
                        {'error': 'Failed to send test notification'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                    
            except Exception as e:
                logger.error(f"Error sending test notification: {str(e)}")
                return Response(
                    {'error': f'Failed to send test notification: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except Exception as e:
            logger.error(f"Error sending Teams test notification: {str(e)}")
            return Response(
                {'error': 'Failed to send test notification'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
