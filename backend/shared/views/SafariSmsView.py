from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from django.conf import settings
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from shared.models.SafariSmsConfigModel import SafariSmsConfig
from shared.services.TwilioService import TwilioService
from shared.services.TwilioWhatsAppService import TwilioWhatsAppService
from shared.serializers.SafariSmsSerializer import (
    SafariSmsConfigSerializer,
    SafariSmsConfigUpdateSerializer,
    SafariSmsStatusSerializer,
    SafariSmsActivateSerializer,
)
import logging

logger = logging.getLogger(__name__)


class SafariSmsStatusView(APIView):
    """Get Safari SMS configuration status"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Check Safari SMS activation and configuration status",
        responses={
            200: openapi.Response(
                description="Safari SMS status",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'is_activated': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                        'is_configured': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                        'sms_enabled': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                        'whatsapp_enabled': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                        'twilio_sms_configured': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                        'twilio_whatsapp_configured': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                    }
                )
            ),
        }
    )
    def get(self, request):
        """Get Safari SMS status for the current business"""
        try:
            business = request.user.business
            config = SafariSmsConfig.get_for_business(business)
            
            # Check if Twilio is configured
            twilio_sms_configured = TwilioService.is_configured()
            twilio_whatsapp_configured = TwilioWhatsAppService.is_configured()
            
            data = {
                'is_activated': config.is_activated,
                'is_configured': config.has_any_channel_enabled and config.has_any_notification_enabled,
                'sms_enabled': config.sms_enabled,
                'whatsapp_enabled': config.whatsapp_enabled,
                'twilio_sms_configured': twilio_sms_configured,
                'twilio_whatsapp_configured': twilio_whatsapp_configured,
            }
            
            return Response(data)
            
        except Exception as e:
            logger.error(f"Error checking Safari SMS status: {str(e)}")
            return Response(
                {'error': 'Failed to check Safari SMS status'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SafariSmsConfigView(APIView):
    """Get and update Safari SMS configuration"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Get Safari SMS configuration for the current business",
        responses={
            200: SafariSmsConfigSerializer,
        }
    )
    def get(self, request):
        """Get the current Safari SMS configuration"""
        try:
            business = request.user.business
            config = SafariSmsConfig.get_for_business(business)
            serializer = SafariSmsConfigSerializer(config)
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Error getting Safari SMS config: {str(e)}")
            return Response(
                {'error': 'Failed to get Safari SMS configuration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @swagger_auto_schema(
        operation_description="Update Safari SMS configuration",
        request_body=SafariSmsConfigUpdateSerializer,
        responses={
            200: SafariSmsConfigSerializer,
            400: 'Bad Request',
        }
    )
    def put(self, request):
        """Update Safari SMS configuration"""
        try:
            serializer = SafariSmsConfigUpdateSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {'error': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            business = request.user.business
            config = SafariSmsConfig.get_for_business(business)
            
            # Update fields from validated data
            validated = serializer.validated_data
            for field, value in validated.items():
                setattr(config, field, value)
            
            config.updated_by = request.user
            config.save()
            
            response_serializer = SafariSmsConfigSerializer(config)
            return Response(response_serializer.data)
            
        except Exception as e:
            logger.error(f"Error updating Safari SMS config: {str(e)}")
            return Response(
                {'error': 'Failed to update Safari SMS configuration'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @swagger_auto_schema(
        operation_description="Partially update Safari SMS configuration",
        request_body=SafariSmsConfigUpdateSerializer,
        responses={
            200: SafariSmsConfigSerializer,
            400: 'Bad Request',
        }
    )
    def patch(self, request):
        """Partially update Safari SMS configuration"""
        return self.put(request)


class SafariSmsActivateView(APIView):
    """Activate or deactivate Safari SMS"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Activate or deactivate Safari SMS for the business",
        request_body=SafariSmsActivateSerializer,
        responses={
            200: openapi.Response(
                description="Activation status updated",
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'message': openapi.Schema(type=openapi.TYPE_STRING),
                        'is_activated': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                    }
                )
            ),
            400: 'Bad Request',
        }
    )
    def post(self, request):
        """Activate or deactivate Safari SMS"""
        try:
            serializer = SafariSmsActivateSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {'error': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            business = request.user.business
            config = SafariSmsConfig.get_for_business(business)
            
            is_activated = serializer.validated_data['is_activated']
            config.is_activated = is_activated
            config.updated_by = request.user
            config.save()
            
            action = 'activated' if is_activated else 'deactivated'
            
            return Response({
                'message': f'Safari SMS {action} successfully',
                'is_activated': config.is_activated,
            })
            
        except Exception as e:
            logger.error(f"Error activating Safari SMS: {str(e)}")
            return Response(
                {'error': 'Failed to update Safari SMS activation status'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SafariSmsTestView(APIView):
    """Test Safari SMS by sending test messages"""
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Send a test SMS/WhatsApp message",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['to', 'channel'],
            properties={
                'to': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='Phone number to send test message to'
                ),
                'channel': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    enum=['sms', 'whatsapp'],
                    description='Channel to use for test message'
                ),
            }
        ),
        responses={
            200: openapi.Response(description="Test message sent"),
            400: 'Bad Request',
            500: 'Internal Server Error',
        }
    )
    def post(self, request):
        """Send a test message"""
        try:
            to = request.data.get('to')
            channel = request.data.get('channel', 'sms')
            
            if not to:
                return Response(
                    {'error': 'Phone number is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            business = request.user.business
            business_name = business.name if business else 'SafariDesk'
            test_message = f"[{business_name}] This is a test message from Safari SMS. Your notification setup is working correctly!"
            
            if channel == 'sms':
                if not TwilioService.is_configured():
                    return Response(
                        {'error': 'Twilio SMS is not configured'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                success, message_data, error = TwilioService.send_sms(
                    to=to,
                    body=test_message
                )
                
            elif channel == 'whatsapp':
                if not TwilioWhatsAppService.is_configured():
                    return Response(
                        {'error': 'Twilio WhatsApp is not configured'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Use template for WhatsApp (required for business-initiated messages)
                template_sid = getattr(settings, 'TWILIO_WHATSAPP_TEMPLATE_SID', '')
                logger.info(f"WhatsApp test: template_sid={template_sid}, to={to}")
                if template_sid:
                    # Template variables (Card format):
                    # 1: Title (e.g., "Test Notification")
                    # 2: Ticket Ref (e.g., TEST-0000)
                    # 3: Summary (the actual content)
                    # 4: Caller (who created the ticket)
                    # 5: Link to ticket
                    template_variables = {
                        "1": "Test Notification",
                        "2": "TEST-0000",
                        "3": "This is a test message to verify your WhatsApp notification setup is working correctly.",
                        "4": "System",
                        "5": f"https://{business.domain}.safaridesk.io" if business and business.domain else "https://safaridesk.io"
                    }
                    logger.info(f"WhatsApp test: sending with template_variables={template_variables}")
                    success, message_data, error = TwilioWhatsAppService.send_template_message(
                        to=to,
                        template_sid=template_sid,
                        template_variables=template_variables,
                    )
                    logger.info(f"WhatsApp test result: success={success}, data={message_data}, error={error}")
                else:
                    # Fallback to freeform (only works within 24h session window)
                    success, message_data, error = TwilioWhatsAppService.send_message(
                        to=to,
                        body=test_message
                    )
            else:
                return Response(
                    {'error': 'Invalid channel. Use "sms" or "whatsapp"'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if success:
                response_data = {
                    'message': f'Test {channel.upper()} sent successfully',
                    'sid': message_data.get('sid') if message_data else None,
                    'status': message_data.get('status') if message_data else None,
                }
                # Add WhatsApp-specific guidance
                if channel == 'whatsapp':
                    template_sid = getattr(settings, 'TWILIO_WHATSAPP_TEMPLATE_SID', '')
                    if template_sid:
                        response_data['note'] = 'Message sent using approved WhatsApp template.'
                    else:
                        response_data['note'] = (
                            'No template configured. Freeform messages only work if the recipient '
                            'has messaged your business number within the last 24 hours.'
                        )
                return Response(response_data)
            else:
                return Response(
                    {'error': error or f'Failed to send test {channel}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
        except Exception as e:
            logger.error(f"Error sending test message: {str(e)}")
            return Response(
                {'error': 'Failed to send test message'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
