from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import LimitOffsetPagination
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.http import HttpResponse
from django.db import models as db_models

from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from shared.models.TwilioWhatsAppMessage import TwilioWhatsAppMessage
from shared.services.TwilioWhatsAppService import TwilioWhatsAppService
from shared.serializers.TwilioWhatsAppSerializer import (
    TwilioWhatsAppMessageSerializer,
    SendWhatsAppMessageSerializer,
    SendWhatsAppMediaSerializer,
    SendWhatsAppTemplateSerializer,
    BulkSendWhatsAppSerializer,
    WhatsAppStatusCallbackSerializer,
    WhatsAppInboundMessageSerializer,
    WhatsAppConfigStatusSerializer,
    WhatsAppTestSerializer,
)
import logging

logger = logging.getLogger(__name__)


class WhatsAppConfigStatusView(APIView):
    """Get WhatsApp configuration status"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Check if Twilio WhatsApp is properly configured",
        responses={
            200: openapi.Response(
                description="WhatsApp configuration status",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'is_configured': openapi.Schema(type=openapi.TYPE_BOOLEAN, description='Whether WhatsApp is configured'),
                        'whatsapp_number': openapi.Schema(type=openapi.TYPE_STRING, description='Configured WhatsApp number'),
                        'account_status': openapi.Schema(type=openapi.TYPE_STRING, description='Twilio account status'),
                        'account_name': openapi.Schema(type=openapi.TYPE_STRING, description='Twilio account name'),
                    }
                )
            ),
            500: 'Internal Server Error'
        }
    )
    def get(self, request):
        """Check if WhatsApp is properly configured"""
        try:
            is_configured = TwilioWhatsAppService.is_configured()
            whatsapp_number = TwilioWhatsAppService.get_default_from_number() if is_configured else ''
            
            account_info = None
            if is_configured:
                account_info = TwilioWhatsAppService.get_account_info()
            
            data = {
                'is_configured': is_configured,
                'whatsapp_number': whatsapp_number,
                'account_status': account_info.get('status') if account_info else None,
                'account_name': account_info.get('friendly_name') if account_info else None,
            }
            
            return Response(data)
            
        except Exception as e:
            logger.error(f"Error checking WhatsApp config: {str(e)}")
            return Response(
                {'error': 'Failed to check WhatsApp configuration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SendWhatsAppMessageView(APIView):
    """Send a WhatsApp message"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Send a WhatsApp message via Twilio",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['to', 'body'],
            properties={
                'to': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Recipient WhatsApp number (E.164 format, e.g., +1234567890)'
                ),
                'body': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Message content (max 4096 characters)'
                ),
                'from_number': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Sender WhatsApp number (optional)'
                ),
                'media_url': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='URL of media to attach (image, document, audio, video)'
                ),
                'ticket_id': openapi.Schema(
                    type=openapi.TYPE_INTEGER,
                    description='Related ticket ID (optional)'
                ),
                'contact_id': openapi.Schema(
                    type=openapi.TYPE_INTEGER,
                    description='Related contact ID (optional)'
                ),
            }
        ),
        responses={
            201: openapi.Response(
                description="WhatsApp message sent successfully",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'message': openapi.Schema(type=openapi.TYPE_STRING),
                        'whatsapp_message': openapi.Schema(type=openapi.TYPE_OBJECT),
                    }
                )
            ),
            400: 'Bad Request',
            500: 'Internal Server Error'
        }
    )
    def post(self, request):
        """Send a WhatsApp message"""
        try:
            serializer = SendWhatsAppMessageSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {'error': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            data = serializer.validated_data
            business = request.user.business
            
            # Build status callback URL
            status_callback = request.build_absolute_uri('/api/v1/integrations/whatsapp/webhook/status/')
            
            # Send the message
            success, message_data, error = TwilioWhatsAppService.send_message(
                to=data['to'],
                body=data['body'],
                from_number=data.get('from_number') or None,
                media_url=data.get('media_url') or None,
                status_callback=status_callback
            )
            
            if not success:
                return Response(
                    {'error': error or 'Failed to send WhatsApp message'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Determine message type
            message_type = 'text'
            if data.get('media_url'):
                # Determine type from URL or content type
                media_url = data['media_url'].lower()
                if any(ext in media_url for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                    message_type = 'image'
                elif any(ext in media_url for ext in ['.pdf', '.doc', '.docx', '.xls', '.xlsx']):
                    message_type = 'document'
                elif any(ext in media_url for ext in ['.mp3', '.ogg', '.wav', '.m4a']):
                    message_type = 'audio'
                elif any(ext in media_url for ext in ['.mp4', '.avi', '.mov', '.webm']):
                    message_type = 'video'
            
            # Store the message in database
            whatsapp_message = TwilioWhatsAppMessage.objects.create(
                twilio_sid=message_data['sid'],
                from_number=message_data['from_'],
                to_number=message_data['to'],
                body=message_data['body'],
                message_type=message_type,
                direction='outbound',
                message_status=message_data['status'],
                media_url=data.get('media_url'),
                price=message_data.get('price'),
                price_unit=message_data.get('price_unit', 'USD'),
                error_code=message_data.get('error_code'),
                error_message=message_data.get('error_message'),
                sent_at=message_data.get('date_sent') or timezone.now(),
                business=business,
                ticket_id=data.get('ticket_id'),
                contact_id=data.get('contact_id'),
            )
            
            response_serializer = TwilioWhatsAppMessageSerializer(whatsapp_message)
            return Response({
                'message': 'WhatsApp message sent successfully',
                'whatsapp_message': response_serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error sending WhatsApp message: {str(e)}")
            return Response(
                {'error': 'Failed to send WhatsApp message'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SendWhatsAppMediaView(APIView):
    """Send a WhatsApp media message"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Send a WhatsApp message with media attachment",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['to', 'media_url'],
            properties={
                'to': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Recipient WhatsApp number'
                ),
                'media_url': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Public URL of the media file'
                ),
                'caption': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Caption for the media (optional)'
                ),
                'from_number': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Sender WhatsApp number (optional)'
                ),
                'ticket_id': openapi.Schema(
                    type=openapi.TYPE_INTEGER,
                    description='Related ticket ID (optional)'
                ),
                'contact_id': openapi.Schema(
                    type=openapi.TYPE_INTEGER,
                    description='Related contact ID (optional)'
                ),
            }
        ),
        responses={
            201: openapi.Response(description="Media message sent successfully"),
            400: 'Bad Request',
            500: 'Internal Server Error'
        }
    )
    def post(self, request):
        """Send a WhatsApp media message"""
        try:
            serializer = SendWhatsAppMediaSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {'error': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            data = serializer.validated_data
            business = request.user.business
            
            status_callback = request.build_absolute_uri('/api/v1/integrations/whatsapp/webhook/status/')
            
            success, message_data, error = TwilioWhatsAppService.send_media_message(
                to=data['to'],
                media_url=data['media_url'],
                caption=data.get('caption'),
                from_number=data.get('from_number') or None,
                status_callback=status_callback
            )
            
            if not success:
                return Response(
                    {'error': error or 'Failed to send WhatsApp media'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Determine message type from URL
            media_url = data['media_url'].lower()
            if any(ext in media_url for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                message_type = 'image'
            elif any(ext in media_url for ext in ['.pdf', '.doc', '.docx', '.xls', '.xlsx']):
                message_type = 'document'
            elif any(ext in media_url for ext in ['.mp3', '.ogg', '.wav', '.m4a']):
                message_type = 'audio'
            elif any(ext in media_url for ext in ['.mp4', '.avi', '.mov', '.webm']):
                message_type = 'video'
            else:
                message_type = 'document'
            
            whatsapp_message = TwilioWhatsAppMessage.objects.create(
                twilio_sid=message_data['sid'],
                from_number=message_data['from_'],
                to_number=message_data['to'],
                body=data.get('caption', ''),
                message_type=message_type,
                direction='outbound',
                message_status=message_data['status'],
                media_url=data['media_url'],
                price=message_data.get('price'),
                price_unit=message_data.get('price_unit', 'USD'),
                sent_at=message_data.get('date_sent') or timezone.now(),
                business=business,
                ticket_id=data.get('ticket_id'),
                contact_id=data.get('contact_id'),
            )
            
            response_serializer = TwilioWhatsAppMessageSerializer(whatsapp_message)
            return Response({
                'message': 'WhatsApp media message sent successfully',
                'whatsapp_message': response_serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error sending WhatsApp media: {str(e)}")
            return Response(
                {'error': 'Failed to send WhatsApp media'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SendWhatsAppTemplateView(APIView):
    """Send a WhatsApp template message"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Send a pre-approved WhatsApp template message (for business-initiated conversations)",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['to', 'template_sid'],
            properties={
                'to': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Recipient WhatsApp number'
                ),
                'template_sid': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Content SID of the approved WhatsApp template'
                ),
                'template_variables': openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    description='Variables to fill in the template (e.g., {"1": "value1", "2": "value2"})'
                ),
                'from_number': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Sender WhatsApp number (optional)'
                ),
                'ticket_id': openapi.Schema(
                    type=openapi.TYPE_INTEGER,
                    description='Related ticket ID (optional)'
                ),
                'contact_id': openapi.Schema(
                    type=openapi.TYPE_INTEGER,
                    description='Related contact ID (optional)'
                ),
            }
        ),
        responses={
            201: openapi.Response(description="Template message sent successfully"),
            400: 'Bad Request',
            500: 'Internal Server Error'
        }
    )
    def post(self, request):
        """Send a WhatsApp template message"""
        try:
            serializer = SendWhatsAppTemplateSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {'error': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            data = serializer.validated_data
            business = request.user.business
            
            status_callback = request.build_absolute_uri('/api/v1/integrations/whatsapp/webhook/status/')
            
            success, message_data, error = TwilioWhatsAppService.send_template_message(
                to=data['to'],
                template_sid=data['template_sid'],
                template_variables=data.get('template_variables'),
                from_number=data.get('from_number') or None,
                status_callback=status_callback
            )
            
            if not success:
                return Response(
                    {'error': error or 'Failed to send WhatsApp template'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            whatsapp_message = TwilioWhatsAppMessage.objects.create(
                twilio_sid=message_data['sid'],
                from_number=message_data['from_'],
                to_number=message_data['to'],
                body=message_data.get('body', ''),
                message_type='template',
                direction='outbound',
                message_status=message_data['status'],
                template_name=data['template_sid'],
                template_parameters=data.get('template_variables'),
                price=message_data.get('price'),
                price_unit=message_data.get('price_unit', 'USD'),
                sent_at=message_data.get('date_sent') or timezone.now(),
                business=business,
                ticket_id=data.get('ticket_id'),
                contact_id=data.get('contact_id'),
            )
            
            response_serializer = TwilioWhatsAppMessageSerializer(whatsapp_message)
            return Response({
                'message': 'WhatsApp template message sent successfully',
                'whatsapp_message': response_serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error sending WhatsApp template: {str(e)}")
            return Response(
                {'error': 'Failed to send WhatsApp template'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BulkSendWhatsAppView(APIView):
    """Send WhatsApp messages to multiple recipients"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Send WhatsApp message to multiple recipients (max 100)",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['recipients', 'body'],
            properties={
                'recipients': openapi.Schema(
                    type=openapi.TYPE_ARRAY,
                    items=openapi.Schema(type=openapi.TYPE_STRING),
                    description='List of recipient WhatsApp numbers'
                ),
                'body': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Message content'
                ),
                'from_number': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Sender WhatsApp number (optional)'
                ),
                'media_url': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Media URL to attach to all messages'
                ),
            }
        ),
        responses={
            201: openapi.Response(
                description="Bulk WhatsApp messages sent",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'message': openapi.Schema(type=openapi.TYPE_STRING),
                        'successful': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Schema(type=openapi.TYPE_OBJECT)),
                        'failed': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Schema(type=openapi.TYPE_OBJECT)),
                    }
                )
            ),
            400: 'Bad Request',
            500: 'Internal Server Error'
        }
    )
    def post(self, request):
        """Send bulk WhatsApp messages"""
        try:
            serializer = BulkSendWhatsAppSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {'error': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            data = serializer.validated_data
            business = request.user.business
            
            status_callback = request.build_absolute_uri('/api/v1/integrations/whatsapp/webhook/status/')
            
            results = TwilioWhatsAppService.send_bulk_messages(
                recipients=data['recipients'],
                body=data['body'],
                from_number=data.get('from_number') or None,
                media_url=data.get('media_url'),
                status_callback=status_callback
            )
            
            successful = []
            failed = []
            
            for result in results:
                if result['success']:
                    msg_data = result['message_data']
                    whatsapp_message = TwilioWhatsAppMessage.objects.create(
                        twilio_sid=msg_data['sid'],
                        from_number=msg_data['from_'],
                        to_number=msg_data['to'],
                        body=msg_data['body'],
                        message_type='image' if data.get('media_url') else 'text',
                        direction='outbound',
                        message_status=msg_data['status'],
                        media_url=data.get('media_url'),
                        price=msg_data.get('price'),
                        price_unit=msg_data.get('price_unit', 'USD'),
                        sent_at=msg_data.get('date_sent') or timezone.now(),
                        business=business,
                    )
                    successful.append({
                        'to': result['to'],
                        'sid': msg_data['sid'],
                        'id': whatsapp_message.id
                    })
                else:
                    failed.append({
                        'to': result['to'],
                        'error': result['error']
                    })
            
            return Response({
                'message': f'Sent {len(successful)} of {len(results)} WhatsApp messages',
                'successful': successful,
                'failed': failed
            }, status=status.HTTP_201_CREATED if successful else status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Error sending bulk WhatsApp: {str(e)}")
            return Response(
                {'error': 'Failed to send bulk WhatsApp messages'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class WhatsAppMessageListView(APIView):
    """List WhatsApp messages with pagination"""
    permission_classes = [IsAuthenticated]
    
    direction_param = openapi.Parameter(
        'direction', openapi.IN_QUERY,
        description='Filter by direction (inbound/outbound)',
        type=openapi.TYPE_STRING,
        enum=['inbound', 'outbound']
    )
    status_param = openapi.Parameter(
        'status', openapi.IN_QUERY,
        description='Filter by message status',
        type=openapi.TYPE_STRING,
        enum=['queued', 'sending', 'sent', 'delivered', 'read', 'undelivered', 'failed', 'received']
    )
    type_param = openapi.Parameter(
        'type', openapi.IN_QUERY,
        description='Filter by message type',
        type=openapi.TYPE_STRING,
        enum=['text', 'image', 'document', 'audio', 'video', 'location', 'template']
    )
    ticket_param = openapi.Parameter(
        'ticket_id', openapi.IN_QUERY,
        description='Filter by ticket ID',
        type=openapi.TYPE_INTEGER
    )
    contact_param = openapi.Parameter(
        'contact_id', openapi.IN_QUERY,
        description='Filter by contact ID',
        type=openapi.TYPE_INTEGER
    )
    phone_param = openapi.Parameter(
        'phone', openapi.IN_QUERY,
        description='Filter by phone number (partial match)',
        type=openapi.TYPE_STRING
    )
    
    @swagger_auto_schema(
        operation_description="List WhatsApp messages for your business with optional filters",
        manual_parameters=[direction_param, status_param, type_param, ticket_param, contact_param, phone_param],
        responses={
            200: openapi.Response(
                description="List of WhatsApp messages",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'count': openapi.Schema(type=openapi.TYPE_INTEGER),
                        'next': openapi.Schema(type=openapi.TYPE_STRING),
                        'previous': openapi.Schema(type=openapi.TYPE_STRING),
                        'results': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Schema(type=openapi.TYPE_OBJECT)),
                    }
                )
            ),
            500: 'Internal Server Error'
        }
    )
    def get(self, request):
        """Get list of WhatsApp messages"""
        try:
            business = request.user.business
            
            direction = request.query_params.get('direction')
            message_status = request.query_params.get('status')
            message_type = request.query_params.get('type')
            ticket_id = request.query_params.get('ticket_id')
            contact_id = request.query_params.get('contact_id')
            phone = request.query_params.get('phone')
            
            queryset = TwilioWhatsAppMessage.objects.filter(
                business=business,
                status='A'
            )
            
            if direction:
                queryset = queryset.filter(direction=direction)
            if message_status:
                queryset = queryset.filter(message_status=message_status)
            if message_type:
                queryset = queryset.filter(message_type=message_type)
            if ticket_id:
                queryset = queryset.filter(ticket_id=ticket_id)
            if contact_id:
                queryset = queryset.filter(contact_id=contact_id)
            if phone:
                queryset = queryset.filter(
                    db_models.Q(to_number__icontains=phone) | 
                    db_models.Q(from_number__icontains=phone)
                )
            
            queryset = queryset.order_by('-created_at')
            
            paginator = LimitOffsetPagination()
            paginator.default_limit = 20
            page = paginator.paginate_queryset(queryset, request)
            
            serializer = TwilioWhatsAppMessageSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
            
        except Exception as e:
            logger.error(f"Error listing WhatsApp messages: {str(e)}")
            return Response(
                {'error': 'Failed to list WhatsApp messages'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class WhatsAppMessageDetailView(APIView):
    """Get details of a specific WhatsApp message"""
    permission_classes = [IsAuthenticated]
    
    refresh_param = openapi.Parameter(
        'refresh', openapi.IN_QUERY,
        description='Refresh status from Twilio API (true/false)',
        type=openapi.TYPE_BOOLEAN,
        default=False
    )
    
    @swagger_auto_schema(
        operation_description="Get details of a specific WhatsApp message by ID",
        manual_parameters=[refresh_param],
        responses={
            200: openapi.Response(
                description="WhatsApp message details",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'whatsapp_message': openapi.Schema(type=openapi.TYPE_OBJECT),
                    }
                )
            ),
            404: 'WhatsApp message not found',
            500: 'Internal Server Error'
        }
    )
    def get(self, request, message_id):
        """Get WhatsApp message details"""
        try:
            business = request.user.business
            
            whatsapp_message = TwilioWhatsAppMessage.objects.filter(
                id=message_id,
                business=business,
                status='A'
            ).first()
            
            if not whatsapp_message:
                return Response(
                    {'error': 'WhatsApp message not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            refresh = request.query_params.get('refresh', 'false').lower() == 'true'
            if refresh and whatsapp_message.twilio_sid:
                twilio_data = TwilioWhatsAppService.get_message(whatsapp_message.twilio_sid)
                if twilio_data:
                    whatsapp_message.message_status = twilio_data['status']
                    whatsapp_message.price = twilio_data.get('price')
                    whatsapp_message.error_code = twilio_data.get('error_code')
                    whatsapp_message.error_message = twilio_data.get('error_message')
                    whatsapp_message.save()
            
            serializer = TwilioWhatsAppMessageSerializer(whatsapp_message)
            return Response({'whatsapp_message': serializer.data})
            
        except Exception as e:
            logger.error(f"Error getting WhatsApp message: {str(e)}")
            return Response(
                {'error': 'Failed to get WhatsApp message'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@method_decorator(csrf_exempt, name='dispatch')
class WhatsAppStatusCallbackView(APIView):
    """Handle Twilio WhatsApp status callback webhooks"""
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        """Handle message status updates from Twilio"""
        try:
            serializer = WhatsAppStatusCallbackSerializer(data=request.POST)
            if not serializer.is_valid():
                logger.warning(f"Invalid WhatsApp status callback: {serializer.errors}")
                return Response(status=status.HTTP_400_BAD_REQUEST)
            
            data = serializer.validated_data
            message_sid = data['MessageSid']
            message_status = data['MessageStatus']
            
            whatsapp_message = TwilioWhatsAppMessage.objects.filter(
                twilio_sid=message_sid
            ).first()
            
            if whatsapp_message:
                whatsapp_message.message_status = message_status
                whatsapp_message.callback_received = True
                whatsapp_message.last_callback_at = timezone.now()
                
                if data.get('ErrorCode'):
                    whatsapp_message.error_code = data['ErrorCode']
                if data.get('ErrorMessage'):
                    whatsapp_message.error_message = data['ErrorMessage']
                
                if message_status == 'delivered':
                    whatsapp_message.delivered_at = timezone.now()
                elif message_status == 'read':
                    whatsapp_message.read_at = timezone.now()
                
                whatsapp_message.save()
                logger.info(f"Updated WhatsApp message {message_sid} status to {message_status}")
            else:
                logger.warning(f"Received callback for unknown WhatsApp message: {message_sid}")
            
            return Response(status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error processing WhatsApp status callback: {str(e)}")
            return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class WhatsAppInboundView(APIView):
    """Handle inbound WhatsApp messages from Twilio"""
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        """Handle incoming WhatsApp messages"""
        try:
            serializer = WhatsAppInboundMessageSerializer(data=request.POST)
            if not serializer.is_valid():
                logger.warning(f"Invalid inbound WhatsApp data: {serializer.errors}")
                return Response(status=status.HTTP_400_BAD_REQUEST)
            
            data = serializer.validated_data
            
            logger.info(f"Received inbound WhatsApp from {data['From']} to {data['To']}")
            
            # Determine message type
            message_type = 'text'
            media_url = None
            media_content_type = None
            
            num_media = int(data.get('NumMedia', 0))
            if num_media > 0:
                media_url = data.get('MediaUrl0')
                media_content_type = data.get('MediaContentType0', '')
                
                if 'image' in media_content_type:
                    message_type = 'image'
                elif 'audio' in media_content_type:
                    message_type = 'audio'
                elif 'video' in media_content_type:
                    message_type = 'video'
                else:
                    message_type = 'document'
            
            whatsapp_message = TwilioWhatsAppMessage.objects.create(
                twilio_sid=data['MessageSid'],
                from_number=data['From'],
                to_number=data['To'],
                body=data.get('Body', ''),
                message_type=message_type,
                direction='inbound',
                message_status='received',
                media_url=media_url,
                media_content_type=media_content_type,
                sent_at=timezone.now(),
            )
            
            logger.info(f"Stored inbound WhatsApp message with ID {whatsapp_message.id}")
            
            # Return TwiML response
            twiml_response = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
            return HttpResponse(twiml_response, content_type='text/xml')
            
        except Exception as e:
            logger.error(f"Error processing inbound WhatsApp: {str(e)}")
            return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class WhatsAppTestView(APIView):
    """Test WhatsApp configuration"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Send a test WhatsApp message to verify configuration",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['to'],
            properties={
                'to': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Phone number to send test WhatsApp message to (E.164 format)'
                ),
            }
        ),
        responses={
            200: openapi.Response(
                description="Test WhatsApp message sent successfully",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'message': openapi.Schema(type=openapi.TYPE_STRING),
                        'sid': openapi.Schema(type=openapi.TYPE_STRING),
                        'status': openapi.Schema(type=openapi.TYPE_STRING),
                    }
                )
            ),
            400: 'Bad Request',
            500: 'Internal Server Error'
        }
    )
    def post(self, request):
        """Send a test WhatsApp message"""
        try:
            serializer = WhatsAppTestSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {'error': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            to_number = serializer.validated_data['to']
            
            if not TwilioWhatsAppService.is_configured():
                return Response(
                    {'error': 'WhatsApp is not configured'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            business = request.user.business
            business_name = business.name if business else 'SafariDesk'
            
            test_message = f"👋 *{business_name}*\n\nThis is a test message from SafariDesk WhatsApp integration.\n\n✅ If you received this, your configuration is working correctly!"
            
            success, message_data, error = TwilioWhatsAppService.send_message(
                to=to_number,
                body=test_message
            )
            
            if success:
                TwilioWhatsAppMessage.objects.create(
                    twilio_sid=message_data['sid'],
                    from_number=message_data['from_'],
                    to_number=message_data['to'],
                    body=test_message,
                    message_type='text',
                    direction='outbound',
                    message_status=message_data['status'],
                    sent_at=timezone.now(),
                    business=business,
                )
                
                return Response({
                    'message': 'Test WhatsApp message sent successfully',
                    'sid': message_data['sid'],
                    'status': message_data['status']
                })
            else:
                return Response(
                    {'error': error or 'Failed to send test WhatsApp message'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
        except Exception as e:
            logger.error(f"Error sending test WhatsApp: {str(e)}")
            return Response(
                {'error': 'Failed to send test WhatsApp message'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
