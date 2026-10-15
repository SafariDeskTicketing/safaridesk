from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.db import transaction

from shared.models.TelegramIntegration import TelegramIntegration, TelegramChat
from shared.services.TelegramService import TelegramService
from shared.serializers.TelegramSerializer import (
    TelegramIntegrationSerializer,
    TelegramConnectSerializer,
    TelegramConfigurationUpdateSerializer,
    TelegramChatSerializer
)
from users.models.BusinessModel import Business
from shared.services.channel_ticket_service import ChannelTicketService, NormalizedChannelMessage
import logging

logger = logging.getLogger(__name__)


class TelegramConnectView(APIView):
    """Connect a Telegram bot to the business"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            business = request.user.business
            
            serializer = TelegramConnectSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {'error': serializer.errors}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            bot_token = serializer.validated_data['bot_token']
            
            # Validate the bot token with Telegram
            is_valid, bot_info = TelegramService.validate_bot_token(bot_token)
            
            if not is_valid:
                return Response(
                    {'error': 'Invalid bot token. Please check and try again.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Generate webhook secret
            webhook_secret = TelegramService.generate_webhook_secret()
            
            # Create or update integration
            integration, created = TelegramIntegration.objects.update_or_create(
                business=business,
                defaults={
                    'bot_username': bot_info.get('username', ''),
                    'bot_id': str(bot_info.get('id', '')),
                    'webhook_secret': webhook_secret,
                    'is_active': True
                }
            )
            
            # Set the encrypted bot token
            integration.bot_token = bot_token
            integration.save()
            
            # Set up webhook with Telegram
            webhook_url = integration.get_webhook_url()
            webhook_set = TelegramService.set_webhook(
                bot_token, 
                webhook_url, 
                webhook_secret
            )
            
            if webhook_set:
                integration.webhook_configured = True
                integration.save()
            else:
                logger.warning(f"Failed to set webhook for business {business.name}")
            
            serializer = TelegramIntegrationSerializer(integration)
            return Response({
                'integration': serializer.data,
                'message': f'Successfully connected bot @{bot_info.get("username")}'
            }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error connecting Telegram bot: {str(e)}")
            return Response(
                {'error': 'Failed to connect Telegram bot'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TelegramIntegrationDetailView(APIView):
    """Get, update, or delete Telegram integration"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get current Telegram integration"""
        try:
            business = request.user.business
            integration = TelegramIntegration.objects.filter(
                business=business, 
                is_active=True
            ).first()
            
            if not integration:
                return Response({'integration': None})
            
            serializer = TelegramIntegrationSerializer(integration)
            return Response({'integration': serializer.data})
            
        except Exception as e:
            logger.error(f"Error fetching Telegram integration: {str(e)}")
            return Response(
                {'error': 'Failed to fetch integration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def patch(self, request):
        """Update Telegram integration settings"""
        try:
            business = request.user.business
            integration = TelegramIntegration.objects.filter(
                business=business, 
                is_active=True
            ).first()
            
            if not integration:
                return Response(
                    {'error': 'Telegram integration not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = TelegramConfigurationUpdateSerializer(data=request.data)
            if serializer.is_valid():
                # Map serializer fields to model fields
                field_mapping = {
                    'send_resolution_updates': 'notify_on_resolved',
                }
                # Map priority values from frontend (lowercase) to model (capitalized)
                priority_mapping = {
                    'low': 'Low',
                    'medium': 'Normal',
                    'high': 'High',
                    'urgent': 'Urgent',
                }
                for field, value in serializer.validated_data.items():
                    model_field = field_mapping.get(field, field)
                    # Convert priority value if needed
                    if model_field == 'default_priority' and value in priority_mapping:
                        value = priority_mapping[value]
                    setattr(integration, model_field, value)
                integration.save()
                
                response_serializer = TelegramIntegrationSerializer(integration)
                return Response({'integration': response_serializer.data})
            
            return Response(
                {'error': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        except Exception as e:
            logger.error(f"Error updating Telegram integration: {str(e)}")
            return Response(
                {'error': 'Failed to update integration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request):
        """Disconnect Telegram integration"""
        try:
            business = request.user.business
            integration = TelegramIntegration.objects.filter(
                business=business, 
                is_active=True
            ).first()
            
            if not integration:
                return Response(
                    {'error': 'Telegram integration not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Delete webhook from Telegram
            try:
                TelegramService.delete_webhook(integration.bot_token)
            except Exception as e:
                logger.warning(f"Failed to delete Telegram webhook: {str(e)}")
            
            # Deactivate integration
            integration.is_active = False
            integration.webhook_configured = False
            integration.save()
            
            return Response({'message': 'Telegram integration disconnected successfully'})
            
        except Exception as e:
            logger.error(f"Error disconnecting Telegram integration: {str(e)}")
            return Response(
                {'error': 'Failed to disconnect integration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TelegramTestConnectionView(APIView):
    """Test Telegram bot connection"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Send a test message to verify connection"""
        try:
            business = request.user.business
            integration = TelegramIntegration.objects.filter(
                business=business, 
                is_active=True
            ).first()
            
            if not integration:
                return Response(
                    {'error': 'Telegram integration not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Validate the bot token is still valid
            is_valid, bot_info = TelegramService.validate_bot_token(integration.bot_token)
            
            if not is_valid:
                return Response(
                    {'error': 'Bot token is no longer valid'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check webhook status
            webhook_info = TelegramService.get_webhook_info(integration.bot_token)
            
            return Response({
                'success': True,
                'bot_info': {
                    'username': bot_info.get('username'),
                    'id': bot_info.get('id'),
                    'first_name': bot_info.get('first_name'),
                    'can_join_groups': bot_info.get('can_join_groups'),
                    'can_read_all_group_messages': bot_info.get('can_read_all_group_messages')
                },
                'webhook': {
                    'url': webhook_info.get('url') if webhook_info else None,
                    'has_custom_certificate': webhook_info.get('has_custom_certificate') if webhook_info else None,
                    'pending_update_count': webhook_info.get('pending_update_count') if webhook_info else 0
                },
                'message': 'Connection verified successfully!'
            })
            
        except Exception as e:
            logger.error(f"Error testing Telegram connection: {str(e)}")
            return Response(
                {'error': 'Failed to test connection'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TelegramSendTestMessageView(APIView):
    """Send an actual test message to Telegram chats"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Send a test message to registered Telegram chats"""
        try:
            business = request.user.business
            integration = TelegramIntegration.objects.filter(
                business=business, 
                is_active=True
            ).first()
            
            if not integration:
                return Response(
                    {'error': 'Telegram integration not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # First, try to sync chats from Telegram updates (for local dev where webhook doesn't work)
            synced = self._sync_chats_from_updates(integration)
            
            # Get chat_id from request (optional - if not provided, send to all chats)
            chat_id = request.data.get('chat_id')
            
            # Get registered chats
            if chat_id:
                chats = TelegramChat.objects.filter(
                    integration=integration,
                    chat_id=chat_id
                )
            else:
                chats = TelegramChat.objects.filter(integration=integration)
            
            if not chats.exists():
                return Response({
                    'success': False,
                    'error': 'No registered chats found. Please message your bot on Telegram first (send /start to @' + integration.bot_username + ').',
                    'bot_username': integration.bot_username
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Send test message to chats
            test_message = f"🔔 <b>Test Notification from SafariDesk</b>\n\nThis is a test message to verify your Telegram integration is working correctly.\n\nBusiness: {business.name}\nBot: @{integration.bot_username}"
            
            sent_count = 0
            failed_count = 0
            
            for chat in chats:
                result = TelegramService.send_message(
                    integration.bot_token,
                    chat.chat_id,
                    test_message
                )
                if result:
                    sent_count += 1
                else:
                    failed_count += 1
            
            if sent_count > 0:
                return Response({
                    'success': True,
                    'message': f'Test message sent successfully to {sent_count} chat(s)!',
                    'sent_count': sent_count,
                    'failed_count': failed_count
                })
            else:
                return Response({
                    'success': False,
                    'error': 'Failed to send test message. The chat may have blocked the bot.',
                    'sent_count': sent_count,
                    'failed_count': failed_count
                }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Error sending Telegram test message: {str(e)}")
            return Response(
                {'error': 'Failed to send test message'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _sync_chats_from_updates(self, integration: TelegramIntegration) -> int:
        """
        Sync chats by fetching recent updates via polling.
        This is a fallback for when webhook isn't working (e.g., local development).
        Returns the number of new chats synced.
        """
        try:
            # Telegram doesn't allow getUpdates when webhook is active
            # We need to temporarily delete the webhook, get updates, then re-set it
            webhook_info = TelegramService.get_webhook_info(integration.bot_token)
            had_webhook = webhook_info and webhook_info.get('url')
            logger.info(f"Telegram sync: webhook_info={webhook_info}, had_webhook={had_webhook}")
            
            if had_webhook:
                # Delete webhook temporarily
                deleted = TelegramService.delete_webhook(integration.bot_token)
                logger.info(f"Telegram sync: deleted webhook = {deleted}")
            
            updates = TelegramService.get_updates(integration.bot_token, limit=100)
            logger.info(f"Telegram sync: got {len(updates) if updates else 0} updates")
            
            # Re-set webhook if it was active (even if non-functional in dev)
            if had_webhook:
                webhook_url = integration.get_webhook_url()
                logger.info(f"Telegram sync: re-setting webhook to {webhook_url}")
                TelegramService.set_webhook(
                    integration.bot_token,
                    webhook_url,
                    integration.webhook_secret
                )
            
            if not updates:
                logger.warning("Telegram sync: no updates found")
                return 0
            
            synced_count = 0
            for update in updates:
                parsed = TelegramService.parse_message(update)
                if not parsed:
                    continue
                
                chat_id = parsed['chat_id']
                
                # Check if chat already exists
                existing = TelegramChat.objects.filter(
                    integration=integration,
                    chat_id=chat_id
                ).exists()
                
                if not existing:
                    TelegramChat.objects.create(
                        integration=integration,
                        chat_id=chat_id,
                        chat_type=parsed['chat_type'],
                        user_id=parsed['user_id'],
                        username=parsed['username'],
                        first_name=parsed['first_name'],
                        last_name=parsed['last_name'],
                        business=integration.business
                    )
                    synced_count += 1
                    logger.info(f"Synced new Telegram chat {chat_id} for {integration.business.name}")
            
            return synced_count
            
        except Exception as e:
            logger.error(f"Error syncing chats from updates: {str(e)}")
            return 0


@method_decorator(csrf_exempt, name='dispatch')
class TelegramWebhookView(APIView):
    """
    Handle incoming Telegram webhook updates
    This endpoint is called by Telegram when messages are sent to the bot
    URL: /api/integrations/telegram/webhook/{subdomain}/
    """
    permission_classes = [AllowAny]  # No auth - Telegram sends updates here
    authentication_classes = []  # Disable authentication
    
    def post(self, request, subdomain):
        """Process incoming Telegram update"""
        try:
            # Find the business by subdomain
            business = Business.objects.filter(domain=subdomain).first()
            
            if not business:
                logger.warning(f"Telegram webhook: Business not found for subdomain {subdomain}")
                # Return 200 to avoid Telegram retrying
                return Response({'status': 'ignored'}, status=status.HTTP_200_OK)
            
            # Get the integration
            integration = TelegramIntegration.objects.filter(
                business=business, 
                is_active=True
            ).first()
            
            if not integration:
                logger.warning(f"Telegram webhook: No active integration for {subdomain}")
                return Response({'status': 'ignored'}, status=status.HTTP_200_OK)
            
            # Verify webhook secret if provided
            secret_header = request.headers.get('X-Telegram-Bot-Api-Secret-Token')
            if integration.webhook_secret and secret_header:
                if not TelegramService.verify_webhook_secret(
                    secret_header, 
                    integration.webhook_secret
                ):
                    logger.warning(f"Telegram webhook: Invalid secret for {subdomain}")
                    return Response({'status': 'unauthorized'}, status=status.HTTP_200_OK)
            
            # Parse the update
            update = request.data
            parsed = TelegramService.parse_message(update)
            
            if not parsed:
                # Not a message update, ignore
                return Response({'status': 'ok'}, status=status.HTTP_200_OK)
            
            # Handle the message
            self._handle_message(integration, parsed)
            
            return Response({'status': 'ok'}, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error processing Telegram webhook: {str(e)}")
            # Return 200 to avoid Telegram retrying on errors
            return Response({'status': 'error'}, status=status.HTTP_200_OK)
    
    def _handle_message(self, integration: TelegramIntegration, parsed: dict):
        """Handle an incoming message"""
        chat_id = parsed['chat_id']
        text = parsed['text']
        
        # Handle commands
        if parsed['is_command']:
            self._handle_command(integration, parsed)
            return
        
        # Get or create chat record
        chat, created = TelegramChat.objects.get_or_create(
            integration=integration,
            chat_id=chat_id,
            defaults={
                'chat_type': parsed['chat_type'],
                'user_id': parsed['user_id'],
                'username': parsed['username'],
                'first_name': parsed['first_name'],
                'last_name': parsed['last_name'],
                'business': integration.business
            }
        )
        
        # If new chat, send welcome message
        if created:
            TelegramService.send_message(
                integration.bot_token,
                chat_id,
                integration.welcome_message
            )
        
        # Auto-create ticket if enabled
        if integration.auto_create_tickets and text and not chat.ticket:
            self._create_ticket_from_message(integration, chat, parsed)
        elif chat.ticket and text:
            # Add message as comment to existing ticket
            self._add_comment_to_ticket(chat, parsed)
    
    def _handle_command(self, integration: TelegramIntegration, parsed: dict):
        """Handle bot commands"""
        chat_id = parsed['chat_id']
        text = parsed['text'].lower()
        
        # Always create/get chat record for commands too
        chat, created = TelegramChat.objects.get_or_create(
            integration=integration,
            chat_id=chat_id,
            defaults={
                'chat_type': parsed['chat_type'],
                'user_id': parsed['user_id'],
                'username': parsed['username'],
                'first_name': parsed['first_name'],
                'last_name': parsed['last_name'],
                'business': integration.business
            }
        )
        
        if text.startswith('/start'):
            TelegramService.send_message(
                integration.bot_token,
                chat_id,
                integration.welcome_message
            )
        elif text.startswith('/help'):
            help_text = """<b>Available Commands:</b>

/start - Start a conversation
/help - Show this help message
/status - Check your ticket status
/new - Create a new ticket

Just send a message to create or update your support ticket."""
            TelegramService.send_message(
                integration.bot_token,
                chat_id,
                help_text
            )
        elif text.startswith('/status'):
            self._send_ticket_status(integration, parsed)
        elif text.startswith('/new'):
            # Mark current conversation as closed and ready for new ticket
            chat = TelegramChat.objects.filter(
                integration=integration,
                chat_id=chat_id
            ).first()
            if chat:
                chat.ticket = None
                chat.is_active_conversation = True
                chat.save()
            TelegramService.send_message(
                integration.bot_token,
                chat_id,
                "Ready for a new ticket. Send your message to create a support request."
            )
    
    def _send_ticket_status(self, integration: TelegramIntegration, parsed: dict):
        """Send ticket status to user"""
        chat_id = parsed['chat_id']
        
        chat = TelegramChat.objects.filter(
            integration=integration,
            chat_id=chat_id
        ).first()
        
        if not chat or not chat.ticket:
            TelegramService.send_message(
                integration.bot_token,
                chat_id,
                "No active ticket found. Send a message to create a new support request."
            )
            return
        
        ticket = chat.ticket
        status_message = TelegramService.format_ticket_notification(
            ticket_id=ticket.ticket_id,
            title=ticket.subject,
            status=ticket.status,
            priority=ticket.priority,
            requester=chat.display_name
        )
        TelegramService.send_message(
            integration.bot_token,
            chat_id,
            status_message
        )
    
    def _create_ticket_from_message(
        self, 
        integration: TelegramIntegration, 
        chat: TelegramChat, 
        parsed: dict
    ):
        """Create a new ticket from Telegram message"""
        try:
            with transaction.atomic():
                ticket = ChannelTicketService.create_ticket(
                    NormalizedChannelMessage(
                        source='telegram',
                        business=integration.business,
                        title_hint=parsed['text'][:100],
                        body=parsed['text'],
                        sender_display_name=chat.display_name,
                        sender_email=f"telegram_{chat.user_id}@telegram.local",
                        priority=integration.default_priority,
                    )
                )

                # Link chat to ticket
                chat.ticket = ticket
                chat.save()
            
            # Send confirmation
            if integration.confirm_ticket_creation:
                confirmation = integration.ticket_created_message.format(
                    ticket_id=ticket.ticket_id
                )
                TelegramService.send_message(
                    integration.bot_token,
                    chat.chat_id,
                    confirmation
                )
            
            logger.info(f"Created ticket {ticket.ticket_id} from Telegram for {integration.business.name}")
            
        except Exception as e:
            logger.error(f"Error creating ticket from Telegram: {str(e)}", exc_info=True)
    
    def _add_comment_to_ticket(self, chat: TelegramChat, parsed: dict):
        """Add a comment to existing ticket from Telegram message"""
        try:
            from tenant.models import TicketComment
            
            if not chat.ticket:
                return
            
            # Create comment with telegram source marker
            TicketComment.objects.create(
                ticket=chat.ticket,
                content=parsed['text'],
                is_internal=False,  # Public comment
                business=chat.integration.business
            )
            
            logger.info(f"Added comment to ticket {chat.ticket.ticket_id} from Telegram")
            
        except Exception as e:
            logger.error(f"Error adding comment from Telegram: {str(e)}", exc_info=True)


class TelegramChatsView(APIView):
    """List Telegram chats for the business"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get all Telegram chats"""
        try:
            business = request.user.business
            integration = TelegramIntegration.objects.filter(
                business=business, 
                is_active=True
            ).first()
            
            if not integration:
                return Response(
                    {'error': 'Telegram integration not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            chats = TelegramChat.objects.filter(
                integration=integration
            ).order_by('-created_at')
            
            serializer = TelegramChatSerializer(chats, many=True)
            return Response({'chats': serializer.data})
            
        except Exception as e:
            logger.error(f"Error fetching Telegram chats: {str(e)}")
            return Response(
                {'error': 'Failed to fetch chats'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
