from django.urls import path
from shared.views.SlackView import (
    SlackOAuthView,
    SlackOAuthCallbackView, 
    SlackIntegrationDetailView,
    SlackChannelsView,
    SlackTestNotificationView,
    SlackWebhookView
)

urlpatterns = [
    # OAuth flow
    path('oauth/', SlackOAuthView.as_view(), name='slack-oauth'),
    path('callback/', SlackOAuthCallbackView.as_view(), name='slack-callback'),
    
    # Integration management
    path('integration/', SlackIntegrationDetailView.as_view(), name='slack-integration-detail'),
    
    # Channels
    path('channels/', SlackChannelsView.as_view(), name='slack-channels'),
    
    # Test notification
    path('test/', SlackTestNotificationView.as_view(), name='slack-test-notification'),
    
    # Event webhook for two-way integration
    path('events/webhook/', SlackWebhookView.as_view(), name='slack-webhook'),
]
