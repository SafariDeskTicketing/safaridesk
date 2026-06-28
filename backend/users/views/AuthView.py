from django.db.models import Q
from django_otp.oath import totp
from django_otp.util import random_hex
from drf_yasg.utils import swagger_auto_schema
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView

from RNSafarideskBack.settings import DOMAIN_NAME
from shared.tasks import send_otp
from tenant.services.audit import actor_name, log_audit_event
from users.models import Users, Business
from users.serializers.AuthSerializer import LoginInitiateSerializer, OTPVerifySerializer, ResendOTPSerializer, \
    SendPasswordResetLinkSerializer, ResetPasswordSerializer, UpdatePasswordSerializer
from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password

from users.serializers.MyTokenObtainSerializer import MyTokenObtainPairSerializer
from util.Mailer import Mailer


def _issue_login_tokens(user, request=None):
    user.last_login = timezone.now()
    user.save(update_fields=['last_login'])
    refresh = MyTokenObtainPairSerializer.get_token(user)
    access = refresh.access_token
    log_audit_event(
        request,
        event_type="USER_LOGIN",
        entity_type="user",
        entity=user,
        activity=f"{actor_name(user)} logged in",
        metadata={"method": "password"},
        actor_user=user,
        business=user.business,
    )
    return Response({
        "access": str(access),
        "refresh": str(refresh),
        "mfa_required": False,
    }, status=status.HTTP_200_OK)


class LoginInitiateView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(request_body=LoginInitiateSerializer)
    def post(self, request):
        serializer = LoginInitiateSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.context['user']
            
            # MFA is opt-in. Unknown, blank, or incomplete MFA state must not
            # create a challenge that the user did not explicitly configure.
            mfa_method = (getattr(user, 'mfa_method', 'none') or 'none').strip().lower()
            
            # MFA disabled - direct login
            if mfa_method not in {'email', 'totp'}:
                return _issue_login_tokens(user, request=request)

            if mfa_method == 'totp' and not user.totp_secret:
                return _issue_login_tokens(user, request=request)
            
            # Create session for MFA verification
            session = SessionStore()
            session['_auth_user_id'] = user.id
            session.create()
            
            # TOTP (Authenticator App) - require code from app
            if mfa_method == 'totp':
                return Response({
                    "sessionKey": session.session_key,
                    "mfa_required": True,
                    "mfa_method": "totp",
                    "detail": "Enter code from your authenticator app.",
                }, status=status.HTTP_200_OK)
            
            # Email OTP (default) - send code via email
            device = TOTPDevice.objects.filter(user=user, confirmed=True).first()
            if not device:
                device = TOTPDevice.objects.create(
                    user=user,
                    name='email_otp',
                    key=random_hex(),
                    confirmed=True
                )

            otp = totp(device.bin_key, step=30, t0=0, digits=6)
            otp = f"{int(otp):06d}"
            print(f"Generated OTP ======> {otp}")

            Mailer().send_otp(otp, user.email)
            log_audit_event(
                request,
                event_type="OTP_SENT",
                entity_type="user",
                entity=user,
                activity=f"OTP sent to {user.email}",
                metadata={"method": "email", "target_user_id": user.id, "target_email": user.email},
                business=user.business,
            )

            return Response({
                "sessionKey": session.session_key,
                "mfa_required": True,
                "mfa_method": "email",
                "detail": "OTP sent to your email.",
            }, status=status.HTTP_200_OK)
        
        # Extract error message and error_code from validation errors
        errors = serializer.errors
        if 'non_field_errors' in errors and len(errors['non_field_errors']) > 0:
            error_detail = errors['non_field_errors'][0]
            if isinstance(error_detail, dict):
                return Response(error_detail, status=status.HTTP_400_BAD_REQUEST)
            return Response({"message": str(error_detail)}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            "message": "Invalid credentials"
        }, status=status.HTTP_400_BAD_REQUEST)

class OTPVerifyView(APIView):
    permission_classes = [AllowAny]
    @swagger_auto_schema(request_body=OTPVerifySerializer)
    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.context['user']
            from ..serializers.MyTokenObtainSerializer import MyTokenObtainPairSerializer
            user.last_login = timezone.now()
            user.save(update_fields=['last_login'])
            token = MyTokenObtainPairSerializer.get_token(user)  # this is a RefreshToken with custom claims
            access = token.access_token  # get access token from it
            data = {
                "refresh": str(token),
                "access": str(access),
            }
            log_audit_event(
                request,
                event_type="OTP_VERIFIED",
                entity_type="user",
                entity=user,
                activity=f"{actor_name(user)} verified OTP",
                metadata={},
                actor_user=user,
                business=user.business,
            )
            log_audit_event(
                request,
                event_type="USER_LOGIN",
                entity_type="user",
                entity=user,
                activity=f"{actor_name(user)} logged in",
                metadata={"method": "otp"},
                actor_user=user,
                business=user.business,
            )
            return Response(data)
        return Response({"message": "Invalid or expired OTP!"}, status=status.HTTP_400_BAD_REQUEST)


class ResendOTPView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(request_body=ResendOTPSerializer)
    def post(self, request):
        session_key = request.data.get('session_key')
        if not session_key:
            return Response({"detail": "Session key is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            session = Session.objects.get(session_key=session_key)
            user_id = session.get_decoded().get('_auth_user_id')
            User = get_user_model()
            user = User.objects.get(pk=user_id)
        except Exception:
            return Response({"detail": "Invalid session."}, status=status.HTTP_400_BAD_REQUEST)
        device = TOTPDevice.objects.filter(user=user, confirmed=True).first()
        if not device:
            device = TOTPDevice.objects.create(
                user=user,
                name='email_otp',
                key=random_hex(),
                confirmed=True
            )
        otp = totp(device.bin_key, step=120, t0=0, digits=6)  # 2 minutes
        print(f"Resend OTP ======> {otp}")


        # Send email
        # send_otp.apply(args=[otp, user.email]).get()
        Mailer().send_otp(otp, user.email)
        log_audit_event(
            request,
            event_type="OTP_SENT",
            entity_type="user",
            entity=user,
            activity=f"OTP resent to {user.email}",
            metadata={"method": "email", "target_user_id": user.id, "target_email": user.email},
            business=user.business,
        )


#         Mailing().send_otp(user, otp)
        return Response({
            "detail": "OTP resent to your email.",
        }, status=status.HTTP_200_OK)


class SendPasswordResetLinkView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(request_body=SendPasswordResetLinkSerializer)
    def post(self, request):
        serializer = SendPasswordResetLinkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        identifier = serializer.validated_data['identifier'].strip()
        business_id = serializer.validated_data['business_id']
        business = Business.objects.filter(id=business_id, is_active=True).first()
        if not business:
            return Response({
                "message": "Business workspace could not be validated for this reset request."
            }, status=status.HTTP_400_BAD_REQUEST)

        user = Users.objects.filter(business=business).filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier)
        ).first()
        if not user:
            return Response({
                "message": f"User with {identifier} not found! Please check and try again"
            }, status=status.HTTP_400_BAD_REQUEST)

        # Invalidate previously issued reset links by rotating the token hash input.
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        # Generate token and UID
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # Get protocol (http or https) from request
        protocol = "https" if request.is_secure() else "http"

        # Get user business subdomain
        user_subdomain = user.business.domain.lower() if user.business else None
        if not user_subdomain:
            return Response({
                "message": "Business domain is not configured for this user."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Build reset URL
        reset_url = f"{protocol}://{user_subdomain}.{DOMAIN_NAME}/new-password?token={token}&uid={uid}"

        try:
            Mailer().send_password_reset_link(reset_url, user.email)
        except Exception:
            return Response({"message": "Failed to send email."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        log_audit_event(
            request,
            event_type="PASSWORD_RESET_REQUESTED",
            entity_type="user",
            entity=user,
            activity=f"Password reset requested for {user.email}",
            metadata={"target_user_id": user.id, "target_email": user.email},
            business=user.business,
        )

        return Response({
            "message": "Password reset link has been sent to your email."
        }, status=status.HTTP_200_OK)


class LoginView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer
    authentication_classes = []


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({"message": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = RefreshToken(refresh_token)
            token_user_id = str(token.payload.get(api_settings.USER_ID_CLAIM))
            if token_user_id != str(request.user.id):
                return Response({"message": "Refresh token does not belong to the authenticated user."}, status=status.HTTP_400_BAD_REQUEST)
            token.blacklist()
        except AttributeError:
            return Response({"message": "Token revocation is not available."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except TokenError:
            return Response({"message": "Invalid or expired refresh token."}, status=status.HTTP_400_BAD_REQUEST)

        log_audit_event(
            request,
            event_type="USER_LOGOUT",
            entity_type="user",
            entity=request.user,
            activity=f"{actor_name(request.user)} logged out",
            metadata={},
            business=request.user.business,
        )
        return Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)


class PasswordResetView(APIView):
    permission_classes = [AllowAny]
    @swagger_auto_schema(request_body=ResetPasswordSerializer)
    def post(self, request):
        token = request.data.get('token')
        uid = request.data.get('uid')
        new_password = request.data.get('new_password')

        if not all([token, uid, new_password]):
            return Response(
                {"message": "Token, UID, and new password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Decode UID
            user_id = urlsafe_base64_decode(uid).decode()
            User = get_user_model()
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"message": "Invalid reset link."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify token
        if not default_token_generator.check_token(user, token):
            return Response(
                {"message": "Invalid or expired reset link."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            validate_password(new_password, user)
        except ValidationError as e:
            return Response(
                {"message": e.messages},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Set new password
        user.set_password(new_password)
        user.save()
        log_audit_event(
            request,
            event_type="PASSWORD_RESET_COMPLETED",
            entity_type="user",
            entity=user,
            activity=f"Password reset completed for {user.email}",
            metadata={},
            actor_user=user,
            business=user.business,
        )
        return Response({
            "message": "Password has been reset successfully."
        }, status=status.HTTP_200_OK)


class UpdatePassword(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(request_body=UpdatePasswordSerializer)
    def post(self, request):
        user = request.user
        new_password = request.data.get('new_password')
        old_password = request.data.get('old_password')

        # Check if old password is correct
        if not user.check_password(old_password):
            return Response({
                "message": "Old password is incorrect."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if new password is not the same as old one
        if old_password == new_password:
            return Response({
                "message": "New password cannot be the same as the old password."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Set the new password
        user.set_password(new_password)
        user.first_login = False
        user.save()
        log_audit_event(
            request,
            event_type="PASSWORD_UPDATED",
            entity_type="user",
            entity=user,
            activity=f"{actor_name(user)} updated their password",
            metadata={},
        )

        # Generate fresh tokens
        refresh = MyTokenObtainPairSerializer.get_token(user)
        access = refresh.access_token

        return Response({
            "message": "Password has been updated successfully.",
             "refresh": str(refresh),
            "access": str(access),
        }, status=status.HTTP_200_OK)
