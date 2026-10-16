import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.conf import settings
from django.shortcuts import redirect
from django.urls import reverse
from django.http import HttpResponseRedirect, HttpResponse
from django.utils import timezone
import json
from django.db import IntegrityError

from shared.models import SlackIntegration
from shared.services import SlackService
from shared.serializers.SlackSerializer import (
    SlackIntegrationSerializer,
    SlackChannelSerializer,
    SlackTestNotificationSerializer,
    SlackConfigurationUpdateSerializer
)
from shared.tasks import slack_tasks
from users.models.BusinessModel import Business

logger = logging.getLogger(__name__)


class SlackOAuthView(APIView):
    """Initiate Slack OAuth flow"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get current business from request user
            business = request.user.business
            state = f"{business.id}"  # Use business ID as state for verification

            oauth_url = SlackService.get_oauth_url(state)

            return Response({
                'oauth_url': oauth_url,
                'state': state
            })

        except Exception as e:
            logger.error(f"Error generating Slack OAuth URL: {str(e)}")
            return Response({'error': 'Failed to generate OAuth URL'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SlackOAuthCallbackView(APIView):
    """Handle Slack OAuth callback"""
    permission_classes = []  # No auth required for callback

    def get(self, request):
        try:
            code = request.GET.get('code')
            state = request.GET.get('state')
            error = request.GET.get('error')

            logger.info(f"Received Slack OAuth callback with code: {code}, state: {state}, error: {error}")

            if not state:
                logger.error("Missing state parameter in Slack OAuth callback")
                frontend_url = f"{settings.FRONTEND_URL_BASE}/config/integrations?slack_error=missing_state"
                return HttpResponseRedirect(frontend_url)

            # Verify state matches a valid business
            try:
                business_id = int(state)
                business = Business.objects.get(id=business_id)
            except (ValueError, Business.DoesNotExist):
                logger.error(f"Invalid state parameter: {state}")
                frontend_url = f"{settings.FRONTEND_URL_BASE}/config/integrations?slack_error=invalid_state"
                return HttpResponseRedirect(frontend_url)

            # Handle Slack OAuth errors
            if error:
                logger.error(f"Slack OAuth error: {error}")
                frontend_url = self._build_frontend_url(business, slack_error=error)
                return HttpResponseRedirect(frontend_url)

            if not code:
                logger.error("Missing authorization code in Slack OAuth callback")
                frontend_url = self._build_frontend_url(business, slack_error="missing_code")
                return HttpResponseRedirect(frontend_url)

            # Exchange code for access token
            oauth_response = SlackService.exchange_code_for_token(code)

            if not oauth_response.get('ok'):
                logger.error(f"Slack OAuth token exchange failed: {oauth_response}")
                frontend_url = self._build_frontend_url(business, slack_error="token_exchange_failed")
                return HttpResponseRedirect(frontend_url)

            # Extract OAuth data
            team = oauth_response.get('team', {})
            access_token = oauth_response.get('access_token')  # User token
            bot_data = oauth_response.get('bot', {})
            bot_access_token = bot_data.get('access_token')  # Bot token - preferred for API calls
            bot_user_id = oauth_response.get('bot_user_id')
            app_id = oauth_response.get('app_id')
            scope = oauth_response.get('scope')

            # Verify token has sufficient permissions for webhook events
            subscription_result = SlackService.verify_event_token_permissions(
                bot_access_token or access_token
            )

            logger.info(f"Event subscription configuration result: {subscription_result}")

            # Check if this Slack workspace is already connected to another business
            team_id = team.get('id')
            existing_integration = (
                SlackIntegration.objects.filter(team_id=team_id, is_active=True)
                .exclude(business=business)
                .first()
            )

            if existing_integration:
                logger.warning(f"Attempted to connect Slack workspace {team_id} which is already connected to business {existing_integration.business_id}")
                return HttpResponseRedirect(self._build_frontend_url(business, slack_error="workspace_already_connected"))

            # Create or update Slack integration for this business
            try:
                slack_integration, created = SlackIntegration.objects.update_or_create(
                    business=business,
                    team_id=team_id,
                    defaults={
                        'access_token': bot_access_token or access_token,  # Prefer bot token
                        'team_name': team.get('name'),
                        'workspace_url': f"https://{team.get('domain')}.slack.com",
                        'bot_user_id': bot_user_id,
                        'app_id': app_id,
                        'scope': scope,
                        'is_active': True,
                        'subscription_status': 'active' if subscription_result.get('ok', False) else 'pending'
                    }
                )
            except IntegrityError as e:
                logger.error(f"Integrity error creating Slack integration: {str(e)}")
                return HttpResponseRedirect(self._build_frontend_url(business, slack_error="workspace_already_connected"))

            action = 'connected' if created else 'updated'
            logger.info(f"Slack integration {action} for business {business.name}")

            # Auto-join every public channel so ticket creation works immediately
            # without a manual /invite in each one. Private channels are skipped --
            # Slack never allows apps to self-join those, a human must invite the
            # bot explicitly for any private channel.
            try:
                token = slack_integration.access_token
                for channel in SlackService.get_channels(token):
                    if channel.get('is_private') or channel.get('is_member'):
                        continue
                    try:
                        SlackService.join_channel(token, channel['id'])
                    except Exception as join_error:
                        logger.warning(f"Could not auto-join Slack channel {channel.get('name')}: {str(join_error)}")
            except Exception as e:
                logger.warning(f"Could not auto-join Slack channels for business {business.name}: {str(e)}")

            from util.Helper import Helper
            helper = Helper()
            url = helper.build_integration_url("slack", request, business, team)

            # Redirect to frontend with success (hardcoded production domain)
            return HttpResponseRedirect(url)

        except Exception as e:
            logger.error(f"Error in Slack OAuth callback: {str(e)}")
            # fallback to base frontend URL
            frontend_url = f"{settings.FRONTEND_URL_BASE}/config/integrations?slack_error=callback_failed"
            return HttpResponseRedirect(frontend_url)

    def _build_webhook_url(self, request):
        """Build the webhook URL for receiving Slack events"""
        # Build webhook URL based on the request host
        host = request.get_host()
        scheme = request.scheme
        return f"{scheme}://{host}/api/v1/integrations/slack/events/webhook/"

    def _build_frontend_url(self, business, **query_params):
        """
        Build frontend URL based on the business domain or fallback.
        Accepts optional query parameters as kwargs.
        """
        if business.domain_url:
            base_url = business.domain_url.rstrip("/")
        elif business.domain:
            base_url = f"https://{business.domain}".rstrip("/")
        else:
            # fallback: localhost for dev or `{id}.safaridesk.io` for prod
            base_url = f"https://{business.id}.safaridesk.io"

        url = f"{base_url}/config/integrations"

        if query_params:
            from urllib.parse import urlencode
            url += f"?{urlencode(query_params)}"

        return url


class SlackIntegrationDetailView(APIView):
    """Get or update Slack integration details"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            business = request.user.business
            integration = SlackIntegration.objects.filter(business=business, is_active=True).first()

            if not integration:
                # Check if there's any inactive integration for documentation purposes
                has_inactive = SlackIntegration.objects.filter(business=business, is_active=False).exists()
                message = 'No Slack integration found' if not has_inactive else 'Slack integration is disconnected'
                
                return Response({
                    'connected': False,
                    'message': message
                })

            serializer = SlackIntegrationSerializer(integration)
            return Response({
                'connected': True,
                'integration': serializer.data
            })

        except Exception as e:
            logger.error(f"Error fetching Slack integration: {str(e)}")
            return Response({"error": "Failed to fetch integration"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request):
        try:
            business = request.user.business
            integration = SlackIntegration.objects.filter(business=business, is_active=True).first()

            if not integration:
                return Response({"error": "Slack integration not found"}, status=status.HTTP_404_NOT_FOUND)

            serializer = SlackConfigurationUpdateSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({"error": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

            # Update configuration
            for field, value in serializer.validated_data.items():
                setattr(integration, field, value)

            integration.save()

            # Auto-join the selected default channel so tickets start flowing
            # without requiring a manual /invite (private channels still need one;
            # Slack never lets apps self-join those).
            if 'default_channel' in serializer.validated_data and integration.default_channel:
                try:
                    SlackService.join_channel(integration.access_token, integration.default_channel)
                except Exception as e:
                    logger.warning(f"Could not auto-join Slack channel {integration.default_channel}: {str(e)}")

            return Response({
                'success': True,
                'message': 'Configuration updated successfully',
                'integration': SlackIntegrationSerializer(integration).data
            })

        except Exception as e:
            logger.error(f"Error updating Slack integration: {str(e)}")
            return Response({"error": "Failed to update integration"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request):
        """Disconnect Slack integration"""
        try:
            business = request.user.business
            integration = SlackIntegration.objects.filter(business=business, is_active=True).first()

            if not integration:
                return Response({"error": "No active Slack integration found"}, status=status.HTTP_404_NOT_FOUND)

            # Try to revoke the token (best effort)
            try:
                SlackService.revoke_token(integration.access_token)
            except Exception as e:
                logger.warning(f"Failed to revoke Slack token: {str(e)}")

            # Deactivate integration
            integration.is_active = False
            integration.save()

            return Response({'message': 'Slack integration disconnected successfully'})

        except Exception as e:
            logger.error(f"Error disconnecting Slack integration: {str(e)}")
            return Response({"error": "Failed to disconnect integration"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SlackChannelsView(APIView):
    """Fetch available Slack channels"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            business = request.user.business
            integration = SlackIntegration.objects.filter(business=business, is_active=True).first()

            if not integration:
                return Response({"error": "Slack integration not found"}, status=status.HTTP_404_NOT_FOUND)

            channels = SlackService.get_channels(integration.access_token)
            serializer = SlackChannelSerializer(channels, many=True)

            return Response({'channels': serializer.data})

        except Exception as e:
            logger.error(f"Error fetching Slack channels: {str(e)}")
            return Response({"error": "Failed to fetch channels"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SlackTestNotificationView(APIView):
    """Send test notification to Slack channel"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            business = request.user.business
            integration = SlackIntegration.objects.filter(business=business, is_active=True).first()

            if not integration:
                return Response({"error": "Slack integration not found"}, status=status.HTTP_404_NOT_FOUND)

            serializer = SlackTestNotificationSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({"error": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

            channel_id = serializer.validated_data['channel_id']

            # Try to send test notification
            success = SlackService.send_test_notification(
                integration.access_token,
                channel_id,
                business.name
            )

            if success:
                return Response({
                    'success': True,
                    'message': 'Test notification sent successfully!'
                })
            else:
                return Response({"error": "Failed to send test notification"}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"Error sending Slack test notification: {str(e)}")
            return Response({"error": "Failed to send test notification"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SlackWebhookView(APIView):
    """Handle incoming Slack events via webhook"""
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        try:
            # Parse the raw request body for signature verification
            body = request.body.decode('utf-8')
            payload = json.loads(body)

            # Extract Slack signature headers
            signature = request.headers.get('X-Slack-Signature')
            timestamp = request.headers.get('X-Slack-Request-Timestamp')

            # Reject requests missing required security headers
            if not signature or not timestamp:
                logger.error("Missing Slack signature headers")
                return Response({"error": "Missing required security headers"}, status=status.HTTP_401_UNAUTHORIZED)

            # Verify Slack webhook signature
            if not SlackService.verify_webhook_signature(
                signing_secret=settings.SLACK_SIGNING_SECRET,
                timestamp=timestamp,
                signature=signature,
                body=body
            ):
                logger.error("Invalid Slack webhook signature")
                return Response({"error": "Invalid signature"}, status=status.HTTP_401_UNAUTHORIZED)

            # Handle Slack URL verification challenge
            if payload.get('type') == 'url_verification':
                return Response({'challenge': payload.get('challenge')}, status=status.HTTP_200_OK)

            # Extract event payload and team ID from request
            event_payload = payload.get('event', {})
            team_id = payload.get('team_id')

            # Find the associated SlackIntegration
            try:
                integration = SlackIntegration.objects.get(team_id=team_id, is_active=True)
            except SlackIntegration.DoesNotExist:
                # Check if there's an inactive integration for logging purposes
                has_inactive = SlackIntegration.objects.filter(team_id=team_id, is_active=False).exists()
                if has_inactive:
                    logger.warning(f"Received event for inactive Slack integration team_id={team_id}")
                    return Response({"error": "Integration is disconnected"}, status=status.HTTP_400_BAD_REQUEST)
                
                logger.error(f"No SlackIntegration found for team_id={team_id}")
                return Response({"error": "No integration found"}, status=status.HTTP_400_BAD_REQUEST)
            except SlackIntegration.MultipleObjectsReturned:
                logger.critical(f"FATAL: Multiple SlackIntegration entries found for team_id={team_id} - this violates unique constraint!")
                return Response({"error": "Invalid integration state"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Enqueue the event processing task
            slack_tasks.process_slack_event.delay(event_payload, integration.id)

            # Return immediate 200 response to Slack
            return Response({"status": "success"}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in Slack webhook: {str(e)}")
            return Response({"error": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
