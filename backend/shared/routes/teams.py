from django.urls import path
from shared.views.TeamsView import (
    TeamsOAuthView,
    TeamsOAuthCallbackView,
    TeamsIntegrationDetailView,
    TeamsTeamsListView,
    TeamsChannelsView,
    TeamsTestNotificationView
)

urlpatterns = [
    # OAuth flow
    path('oauth/', TeamsOAuthView.as_view(), name='teams-oauth'),
    path('callback/', TeamsOAuthCallbackView.as_view(), name='teams-callback'),
    
    # Integration management
    path('integration/', TeamsIntegrationDetailView.as_view(), name='teams-integration-detail'),
    
    # Teams listing
    path('teams/', TeamsTeamsListView.as_view(), name='teams-list'),
    
    # Channels
    path('channels/', TeamsChannelsView.as_view(), name='teams-channels'),
    
    # Test notification
    path('test/', TeamsTestNotificationView.as_view(), name='teams-test-notification'),
]
