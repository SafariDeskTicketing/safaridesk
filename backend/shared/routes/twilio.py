from django.urls import path
from shared.views.TwilioView import (
    TwilioConfigStatusView,
    SendSMSView,
    BulkSendSMSView,
    SMSMessageListView,
    SMSMessageDetailView,
    PhoneLookupView,
    TwilioStatusCallbackView,
    TwilioInboundSMSView,
    TwilioTestView,
)

urlpatterns = [
    # Configuration status
    path('config/', TwilioConfigStatusView.as_view(), name='twilio-config-status'),
    
    # Send SMS
    path('send/', SendSMSView.as_view(), name='twilio-send-sms'),
    path('send/bulk/', BulkSendSMSView.as_view(), name='twilio-send-bulk-sms'),
    
    # Message history
    path('messages/', SMSMessageListView.as_view(), name='twilio-message-list'),
    path('messages/<int:message_id>/', SMSMessageDetailView.as_view(), name='twilio-message-detail'),
    
    # Phone lookup
    path('lookup/', PhoneLookupView.as_view(), name='twilio-phone-lookup'),
    
    # Test endpoint
    path('test/', TwilioTestView.as_view(), name='twilio-test'),
    
    # Webhooks (called by Twilio)
    path('webhook/status/', TwilioStatusCallbackView.as_view(), name='twilio-status-callback'),
    path('webhook/inbound/', TwilioInboundSMSView.as_view(), name='twilio-inbound-sms'),
]
