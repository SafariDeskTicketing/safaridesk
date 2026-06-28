from django.urls import path
from shared.views.TwilioWhatsAppView import (
    WhatsAppConfigStatusView,
    SendWhatsAppMessageView,
    SendWhatsAppMediaView,
    SendWhatsAppTemplateView,
    BulkSendWhatsAppView,
    WhatsAppMessageListView,
    WhatsAppMessageDetailView,
    WhatsAppStatusCallbackView,
    WhatsAppInboundView,
    WhatsAppTestView,
)

urlpatterns = [
    # Configuration status
    path('config/', WhatsAppConfigStatusView.as_view(), name='whatsapp-config-status'),
    
    # Send messages
    path('send/', SendWhatsAppMessageView.as_view(), name='whatsapp-send-message'),
    path('send/media/', SendWhatsAppMediaView.as_view(), name='whatsapp-send-media'),
    path('send/template/', SendWhatsAppTemplateView.as_view(), name='whatsapp-send-template'),
    path('send/bulk/', BulkSendWhatsAppView.as_view(), name='whatsapp-send-bulk'),
    
    # Message history
    path('messages/', WhatsAppMessageListView.as_view(), name='whatsapp-message-list'),
    path('messages/<int:message_id>/', WhatsAppMessageDetailView.as_view(), name='whatsapp-message-detail'),
    
    # Test endpoint
    path('test/', WhatsAppTestView.as_view(), name='whatsapp-test'),
    
    # Webhooks (called by Twilio)
    path('webhook/status/', WhatsAppStatusCallbackView.as_view(), name='whatsapp-status-callback'),
    path('webhook/inbound/', WhatsAppInboundView.as_view(), name='whatsapp-inbound'),
]
