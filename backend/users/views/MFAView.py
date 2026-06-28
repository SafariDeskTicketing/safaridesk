"""
MFA Views for TOTP (Authenticator App) and Email OTP management.
"""
import base64
from io import BytesIO

import pyotp
import qrcode
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from users.models import Users


class MFAPreferenceView(APIView):
    """Get or update user's MFA preference."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get current MFA settings."""
        user = request.user
        return Response({
            "mfa_method": user.mfa_method,
            "totp_configured": bool(user.totp_secret),
        })

    @swagger_auto_schema(
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'mfa_method': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    enum=['none', 'email', 'totp']
                ),
            }
        )
    )
    def put(self, request):
        """Update MFA preference."""
        user = request.user
        mfa_method = request.data.get('mfa_method')

        if mfa_method not in ['none', 'email', 'totp']:
            return Response(
                {"error": "Invalid MFA method. Must be 'none', 'email', or 'totp'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Can only enable TOTP if it's already configured
        if mfa_method == 'totp' and not user.totp_secret:
            return Response(
                {"error": "Please set up Authenticator App first"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.mfa_method = mfa_method
        user.save(update_fields=['mfa_method'])

        return Response({
            "message": "MFA preference updated",
            "mfa_method": user.mfa_method
        })


class MFASetupTOTPView(APIView):
    """Generate QR code for Authenticator App setup."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Generate new TOTP secret and QR code."""
        user = request.user

        # Generate new secret
        secret = pyotp.random_base32()

        # Create TOTP object
        totp = pyotp.TOTP(secret)

        # Generate provisioning URI for QR code
        issuer_name = getattr(settings, 'SITE_NAME', 'SafariDesk')
        provisioning_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name=issuer_name
        )

        # Generate QR code as base64
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buffer = BytesIO()
        img.save(buffer, format='PNG')
        qr_base64 = base64.b64encode(buffer.getvalue()).decode()

        # Store secret temporarily (not confirmed yet)
        user.totp_secret = secret
        user.save(update_fields=['totp_secret'])

        return Response({
            "qr_code": f"data:image/png;base64,{qr_base64}",
            "secret": secret,  # For manual entry
            "message": "Scan QR code with your authenticator app, then verify with a code"
        })


class MFAVerifySetupView(APIView):
    """Verify TOTP setup by checking first code."""
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'code': openapi.Schema(type=openapi.TYPE_STRING, description='6-digit code from authenticator'),
            },
            required=['code']
        )
    )
    def post(self, request):
        """Verify the TOTP code to confirm setup."""
        user = request.user
        code = request.data.get('code', '').strip()

        if not user.totp_secret:
            return Response(
                {"error": "No TOTP setup in progress. Please start setup first."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not code or len(code) != 6:
            return Response(
                {"error": "Please enter a 6-digit code"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify the code
        totp = pyotp.TOTP(user.totp_secret)
        if totp.verify(code, valid_window=1):
            # Code is valid - enable TOTP as MFA method
            user.mfa_method = 'totp'
            user.save(update_fields=['mfa_method'])

            return Response({
                "message": "Authenticator App configured successfully!",
                "mfa_method": "totp"
            })
        else:
            return Response(
                {"error": "Invalid code. Please try again."},
                status=status.HTTP_400_BAD_REQUEST
            )


class MFADisableTOTPView(APIView):
    """Disable TOTP and clear the secret."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Disable TOTP authentication."""
        user = request.user

        user.mfa_method = 'none'
        user.totp_secret = None
        user.save(update_fields=['mfa_method', 'totp_secret'])

        return Response({
            "message": "Authenticator App disabled",
            "mfa_method": user.mfa_method
        })
