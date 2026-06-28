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

from shared.models.TwilioSMSMessage import TwilioSMSMessage
from shared.services.TwilioService import TwilioService
from shared.serializers.TwilioSerializer import (
    TwilioSMSMessageSerializer,
    SendSMSSerializer,
    BulkSendSMSSerializer,
    TwilioStatusCallbackSerializer,
    TwilioInboundSMSSerializer,
    TwilioConfigStatusSerializer,
    PhoneLookupSerializer,
)
import logging

logger = logging.getLogger(__name__)


class TwilioConfigStatusView(APIView):
    """Get Twilio configuration status"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Check if Twilio SMS is properly configured",
        responses={
            200: openapi.Response(
                description="Twilio configuration status",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'is_configured': openapi.Schema(type=openapi.TYPE_BOOLEAN, description='Whether Twilio is configured'),
                        'phone_number': openapi.Schema(type=openapi.TYPE_STRING, description='Configured Twilio phone number'),
                        'account_status': openapi.Schema(type=openapi.TYPE_STRING, description='Twilio account status'),
                        'account_name': openapi.Schema(type=openapi.TYPE_STRING, description='Twilio account name'),
                    }
                )
            ),
            500: 'Internal Server Error'
        }
    )
    def get(self, request):
        """Check if Twilio is properly configured"""
        try:
            is_configured = TwilioService.is_configured()
            phone_number = TwilioService.get_default_from_number() if is_configured else ''
            
            account_info = None
            if is_configured:
                account_info = TwilioService.get_account_info()
            
            data = {
                'is_configured': is_configured,
                'phone_number': phone_number,
                'account_status': account_info.get('status') if account_info else None,
                'account_name': account_info.get('friendly_name') if account_info else None,
            }
            
            return Response(data)
            
        except Exception as e:
            logger.error(f"Error checking Twilio config: {str(e)}")
            return Response(
                {'error': 'Failed to check Twilio configuration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SendSMSView(APIView):
    """Send a single SMS message"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Send a single SMS message via Twilio",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['to', 'body'],
            properties={
                'to': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Recipient phone number (E.164 format, e.g., +1234567890)'
                ),
                'body': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Message content (max 1600 characters)'
                ),
                'from_number': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Sender phone number (optional, defaults to configured Twilio number)'
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
                description="SMS sent successfully",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'message': openapi.Schema(type=openapi.TYPE_STRING),
                        'sms': openapi.Schema(type=openapi.TYPE_OBJECT, description='SMS message details'),
                    }
                )
            ),
            400: 'Bad Request - Invalid phone number or message',
            500: 'Internal Server Error'
        }
    )
    def post(self, request):
        """Send an SMS message"""
        try:
            serializer = SendSMSSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {'error': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            data = serializer.validated_data
            business = request.user.business
            
            # Build status callback URL
            status_callback = request.build_absolute_uri('/api/v1/integrations/twilio/webhook/status/')
            
            # Send the SMS
            success, message_data, error = TwilioService.send_sms(
                to=data['to'],
                body=data['body'],
                from_number=data.get('from_number') or None,
                status_callback=status_callback
            )
            
            if not success:
                return Response(
                    {'error': error or 'Failed to send SMS'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Store the message in database
            sms_message = TwilioSMSMessage.objects.create(
                twilio_sid=message_data['sid'],
                from_number=message_data['from_'],
                to_number=message_data['to'],
                body=message_data['body'],
                direction='outbound',
                message_status=message_data['status'],
                price=message_data.get('price'),
                price_unit=message_data.get('price_unit', 'USD'),
                error_code=message_data.get('error_code'),
                error_message=message_data.get('error_message'),
                sent_at=message_data.get('date_sent') or timezone.now(),
                business=business,
                ticket_id=data.get('ticket_id'),
                contact_id=data.get('contact_id'),
            )
            
            response_serializer = TwilioSMSMessageSerializer(sms_message)
            return Response({
                'message': 'SMS sent successfully',
                'sms': response_serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error sending SMS: {str(e)}")
            return Response(
                {'error': 'Failed to send SMS'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BulkSendSMSView(APIView):
    """Send SMS to multiple recipients"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Send SMS to multiple recipients at once (max 100)",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['recipients', 'body'],
            properties={
                'recipients': openapi.Schema(
                    type=openapi.TYPE_ARRAY,
                    items=openapi.Schema(type=openapi.TYPE_STRING),
                    description='List of recipient phone numbers (E.164 format)'
                ),
                'body': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Message content (max 1600 characters)'
                ),
                'from_number': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Sender phone number (optional)'
                ),
            }
        ),
        responses={
            201: openapi.Response(
                description="Bulk SMS sent",
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
        """Send bulk SMS messages"""
        try:
            serializer = BulkSendSMSSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {'error': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            data = serializer.validated_data
            business = request.user.business
            
            # Build status callback URL
            status_callback = request.build_absolute_uri('/api/v1/integrations/twilio/webhook/status/')
            
            # Send bulk SMS
            results = TwilioService.send_bulk_sms(
                recipients=data['recipients'],
                body=data['body'],
                from_number=data.get('from_number') or None,
                status_callback=status_callback
            )
            
            # Store successful messages
            successful = []
            failed = []
            
            for result in results:
                if result['success']:
                    msg_data = result['message_data']
                    sms_message = TwilioSMSMessage.objects.create(
                        twilio_sid=msg_data['sid'],
                        from_number=msg_data['from_'],
                        to_number=msg_data['to'],
                        body=msg_data['body'],
                        direction='outbound',
                        message_status=msg_data['status'],
                        price=msg_data.get('price'),
                        price_unit=msg_data.get('price_unit', 'USD'),
                        sent_at=msg_data.get('date_sent') or timezone.now(),
                        business=business,
                    )
                    successful.append({
                        'to': result['to'],
                        'sid': msg_data['sid'],
                        'id': sms_message.id
                    })
                else:
                    failed.append({
                        'to': result['to'],
                        'error': result['error']
                    })
            
            return Response({
                'message': f'Sent {len(successful)} of {len(results)} messages',
                'successful': successful,
                'failed': failed
            }, status=status.HTTP_201_CREATED if successful else status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            logger.error(f"Error sending bulk SMS: {str(e)}")
            return Response(
                {'error': 'Failed to send bulk SMS'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SMSMessageListView(APIView):
    """List SMS messages with pagination"""
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
        enum=['queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'received']
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
        operation_description="List SMS messages for your business with optional filters",
        manual_parameters=[direction_param, status_param, ticket_param, contact_param, phone_param],
        responses={
            200: openapi.Response(
                description="List of SMS messages",
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
        """Get list of SMS messages for the business"""
        try:
            business = request.user.business
            
            # Get filter parameters
            direction = request.query_params.get('direction')
            message_status = request.query_params.get('status')
            ticket_id = request.query_params.get('ticket_id')
            contact_id = request.query_params.get('contact_id')
            phone = request.query_params.get('phone')
            
            # Build queryset
            queryset = TwilioSMSMessage.objects.filter(
                business=business,
                status='A'  # Active records only
            )
            
            if direction:
                queryset = queryset.filter(direction=direction)
            if message_status:
                queryset = queryset.filter(message_status=message_status)
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
            
            # Pagination
            paginator = LimitOffsetPagination()
            paginator.default_limit = 20
            page = paginator.paginate_queryset(queryset, request)
            
            serializer = TwilioSMSMessageSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
            
        except Exception as e:
            logger.error(f"Error listing SMS messages: {str(e)}")
            return Response(
                {'error': 'Failed to list SMS messages'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SMSMessageDetailView(APIView):
    """Get details of a specific SMS message"""
    permission_classes = [IsAuthenticated]
    
    refresh_param = openapi.Parameter(
        'refresh', openapi.IN_QUERY,
        description='Refresh status from Twilio API (true/false)',
        type=openapi.TYPE_BOOLEAN,
        default=False
    )
    
    @swagger_auto_schema(
        operation_description="Get details of a specific SMS message by ID",
        manual_parameters=[refresh_param],
        responses={
            200: openapi.Response(
                description="SMS message details",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'sms': openapi.Schema(type=openapi.TYPE_OBJECT, description='SMS message object'),
                    }
                )
            ),
            404: 'SMS message not found',
            500: 'Internal Server Error'
        }
    )
    def get(self, request, message_id):
        """Get SMS message details"""
        try:
            business = request.user.business
            
            sms_message = TwilioSMSMessage.objects.filter(
                id=message_id,
                business=business,
                status='A'
            ).first()
            
            if not sms_message:
                return Response(
                    {'error': 'SMS message not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Optionally refresh status from Twilio
            refresh = request.query_params.get('refresh', 'false').lower() == 'true'
            if refresh and sms_message.twilio_sid:
                twilio_data = TwilioService.get_message(sms_message.twilio_sid)
                if twilio_data:
                    sms_message.message_status = twilio_data['status']
                    sms_message.price = twilio_data.get('price')
                    sms_message.error_code = twilio_data.get('error_code')
                    sms_message.error_message = twilio_data.get('error_message')
                    sms_message.save()
            
            serializer = TwilioSMSMessageSerializer(sms_message)
            return Response({'sms': serializer.data})
            
        except Exception as e:
            logger.error(f"Error getting SMS message: {str(e)}")
            return Response(
                {'error': 'Failed to get SMS message'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PhoneLookupView(APIView):
    """Lookup phone number information"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Lookup phone number information using Twilio Lookup API",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['phone'],
            properties={
                'phone': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Phone number to lookup (E.164 format recommended)'
                ),
            }
        ),
        responses={
            200: openapi.Response(
                description="Phone number information",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'phone_number': openapi.Schema(type=openapi.TYPE_STRING),
                        'country_code': openapi.Schema(type=openapi.TYPE_STRING),
                        'national_format': openapi.Schema(type=openapi.TYPE_STRING),
                        'valid': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                    }
                )
            ),
            400: 'Bad Request - Invalid phone number',
            500: 'Internal Server Error'
        }
    )
    def post(self, request):
        """Lookup phone number using Twilio Lookup API"""
        try:
            serializer = PhoneLookupSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {'error': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            phone = serializer.validated_data['phone']
            result = TwilioService.lookup_phone_number(phone)
            
            if not result:
                return Response(
                    {'error': 'Failed to lookup phone number'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            return Response(result)
            
        except Exception as e:
            logger.error(f"Error looking up phone number: {str(e)}")
            return Response(
                {'error': 'Failed to lookup phone number'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@method_decorator(csrf_exempt, name='dispatch')
class TwilioStatusCallbackView(APIView):
    """Handle Twilio status callback webhooks"""
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        """Handle message status updates from Twilio"""
        try:
            # Log the full callback payload for debugging
            logger.info(f"[Twilio Status Callback] Received payload: {dict(request.POST)}")
            logger.info(f"[Twilio Status Callback] Headers: X-Twilio-Signature={request.headers.get('X-Twilio-Signature', 'N/A')}")
            
            # Validate Twilio signature (optional but recommended)
            signature = request.headers.get('X-Twilio-Signature', '')
            request_url = request.build_absolute_uri()
            
            # Note: In production, you should validate the signature
            # is_valid = TwilioService.validate_webhook_signature(
            #     request_url, request.POST.dict(), signature
            # )
            # if not is_valid:
            #     logger.warning("Invalid Twilio webhook signature")
            #     return Response(status=status.HTTP_403_FORBIDDEN)
            
            serializer = TwilioStatusCallbackSerializer(data=request.POST)
            if not serializer.is_valid():
                logger.warning(f"Invalid status callback data: {serializer.errors}")
                return Response(status=status.HTTP_400_BAD_REQUEST)
            
            data = serializer.validated_data
            message_sid = data['MessageSid']
            message_status = data['MessageStatus']
            
            # Update the message in our database
            sms_message = TwilioSMSMessage.objects.filter(
                twilio_sid=message_sid
            ).first()
            
            if sms_message:
                sms_message.message_status = message_status
                sms_message.callback_received = True
                sms_message.last_callback_at = timezone.now()
                
                if data.get('ErrorCode'):
                    sms_message.error_code = data['ErrorCode']
                if data.get('ErrorMessage'):
                    sms_message.error_message = data['ErrorMessage']
                
                # Track delivery timestamp
                if message_status == 'delivered':
                    sms_message.delivered_at = timezone.now()
                
                sms_message.save()
                logger.info(f"Updated message {message_sid} status to {message_status}")
            else:
                logger.warning(f"Received callback for unknown message: {message_sid}")
            
            # Twilio expects empty 200 response
            return Response(status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error processing status callback: {str(e)}")
            return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class TwilioInboundSMSView(APIView):
    """Handle inbound SMS messages from Twilio"""
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        """Handle incoming SMS messages"""
        try:
            # Validate Twilio signature (optional but recommended)
            signature = request.headers.get('X-Twilio-Signature', '')
            
            serializer = TwilioInboundSMSSerializer(data=request.POST)
            if not serializer.is_valid():
                logger.warning(f"Invalid inbound SMS data: {serializer.errors}")
                return Response(status=status.HTTP_400_BAD_REQUEST)
            
            data = serializer.validated_data
            
            logger.info(f"Received inbound SMS from {data['From']} to {data['To']}")
            
            # Find the business associated with this phone number
            # This assumes TWILIO_PHONE_NUMBER is the number receiving messages
            # In a multi-tenant setup, you might have a PhoneNumber model
            from django.conf import settings
            
            # Store the inbound message
            sms_message = TwilioSMSMessage.objects.create(
                twilio_sid=data['MessageSid'],
                from_number=data['From'],
                to_number=data['To'],
                body=data.get('Body', ''),
                direction='inbound',
                message_status='received',
                sent_at=timezone.now(),
                # Business association would need to be determined
                # based on the receiving phone number in a multi-tenant setup
            )
            
            logger.info(f"Stored inbound message with ID {sms_message.id}")
            
            # TODO: Optionally create a ticket from this message
            # TODO: Optionally auto-reply
            
            # Return TwiML response (empty = no auto-reply)
            twiml_response = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
            return HttpResponse(twiml_response, content_type='text/xml')
            
        except Exception as e:
            logger.error(f"Error processing inbound SMS: {str(e)}")
            return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TwilioTestView(APIView):
    """Test Twilio configuration"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Send a test SMS to verify Twilio configuration is working",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['to'],
            properties={
                'to': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Phone number to send test SMS to (E.164 format, e.g., +1234567890)'
                ),
            }
        ),
        responses={
            200: openapi.Response(
                description="Test SMS sent successfully",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'message': openapi.Schema(type=openapi.TYPE_STRING),
                        'sid': openapi.Schema(type=openapi.TYPE_STRING, description='Twilio message SID'),
                        'status': openapi.Schema(type=openapi.TYPE_STRING, description='Message status'),
                    }
                )
            ),
            400: 'Bad Request - Invalid phone number or Twilio not configured',
            500: 'Internal Server Error'
        }
    )
    def post(self, request):
        """Send a test SMS to verify configuration"""
        try:
            to_number = request.data.get('to')
            if not to_number:
                return Response(
                    {'error': 'Phone number (to) is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not TwilioService.is_configured():
                return Response(
                    {'error': 'Twilio is not configured'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            business = request.user.business
            business_name = business.name if business else 'SafariDesk'
            
            test_message = f"[{business_name}] This is a test message from SafariDesk SMS integration. If you received this, your configuration is working correctly!"
            
            success, message_data, error = TwilioService.send_sms(
                to=to_number,
                body=test_message
            )
            
            if success:
                # Store the test message
                TwilioSMSMessage.objects.create(
                    twilio_sid=message_data['sid'],
                    from_number=message_data['from_'],
                    to_number=message_data['to'],
                    body=test_message,
                    direction='outbound',
                    message_status=message_data['status'],
                    sent_at=timezone.now(),
                    business=business,
                )
                
                return Response({
                    'message': 'Test SMS sent successfully',
                    'sid': message_data['sid'],
                    'status': message_data['status']
                })
            else:
                return Response(
                    {'error': error or 'Failed to send test SMS'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
        except Exception as e:
            logger.error(f"Error sending test SMS: {str(e)}")
            return Response(
                {'error': 'Failed to send test SMS'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
