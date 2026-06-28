from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView

from users.views.AuthView import LoginInitiateView, OTPVerifyView, ResendOTPView, SendPasswordResetLinkView, \
    PasswordResetView, LoginView, UpdatePassword, LogoutView
from users.views.CustomerAuthView import CustomerLoginView, CustomerMagicLoginVerifyView
from users.views.MFAView import MFAPreferenceView, MFASetupTOTPView, MFAVerifySetupView, MFADisableTOTPView

urlpatterns = [

    # Auth
    path('login/', LoginInitiateView.as_view(), name='initiate-login'),
    path('customer/login/', CustomerLoginView.as_view(), name='customer-login'),
    path('customer/magic-login/', CustomerMagicLoginVerifyView.as_view(), name='customer-magic-login'),
    path('verify-otp/', OTPVerifyView.as_view(), name='verify-otp'),
    path('resend-otp/', ResendOTPView.as_view(), name='resend-otp'),
    path('send-password-reset/', SendPasswordResetLinkView.as_view(), name='send-password-reset-link'),
    path('password-reset/', PasswordResetView.as_view(), name='password-reset'),
    path('express/login/', LoginView.as_view(), name='express-login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('password/update/', UpdatePassword.as_view(), name='password-update'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),

    # MFA
    path('mfa/preference/', MFAPreferenceView.as_view(), name='mfa-preference'),
    path('mfa/setup-totp/', MFASetupTOTPView.as_view(), name='mfa-setup-totp'),
    path('mfa/verify-totp/', MFAVerifySetupView.as_view(), name='mfa-verify-totp'),
    path('mfa/disable-totp/', MFADisableTOTPView.as_view(), name='mfa-disable-totp'),

]
