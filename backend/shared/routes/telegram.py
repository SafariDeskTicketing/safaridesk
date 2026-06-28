from django.urls import path
from shared.views.TelegramView import (
    TelegramConnectView,
    TelegramIntegrationDetailView,
    TelegramTestConnectionView,
    TelegramSendTestMessageView,
    TelegramWebhookView,
    TelegramChatsView
)

urlpatterns = [
    # Connect bot
    path('connect/', TelegramConnectView.as_view(), name='telegram-connect'),
    
    # Integration management
    path('integration/', TelegramIntegrationDetailView.as_view(), name='telegram-integration-detail'),
    
    # Test connection (validates token)
    path('test/', TelegramTestConnectionView.as_view(), name='telegram-test-connection'),
    
    # Send test message (actually sends to Telegram)
    path('send-test/', TelegramSendTestMessageView.as_view(), name='telegram-send-test'),
    
    # List chats
    path('chats/', TelegramChatsView.as_view(), name='telegram-chats'),
    
    # Webhook endpoint (called by Telegram)
    # URL: /api/integrations/telegram/webhook/{subdomain}/
    path('webhook/<str:subdomain>/', TelegramWebhookView.as_view(), name='telegram-webhook'),
]
