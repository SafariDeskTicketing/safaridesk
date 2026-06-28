from django.urls import path
from shared.views.SafariSmsView import (
    SafariSmsStatusView,
    SafariSmsConfigView,
    SafariSmsActivateView,
    SafariSmsTestView,
)

urlpatterns = [
    # Status check
    path('status/', SafariSmsStatusView.as_view(), name='safari-sms-status'),
    
    # Configuration
    path('config/', SafariSmsConfigView.as_view(), name='safari-sms-config'),
    
    # Activation
    path('activate/', SafariSmsActivateView.as_view(), name='safari-sms-activate'),
    
    # Test
    path('test/', SafariSmsTestView.as_view(), name='safari-sms-test'),
]
