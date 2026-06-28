from rest_framework import serializers
from django.contrib.auth import authenticate
from django_otp.plugins.otp_totp.models import TOTPDevice
from django_otp.oath import totp
import pyotp


class LoginInitiateSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, data):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        user = authenticate(username=data['username'], password=data['password'])

        # If username auth failed, try treating the input as an email
        if not user:
            try:
                user_by_email = User.objects.get(email__iexact=data['username'])
                user = authenticate(username=user_by_email.username, password=data['password'])
            except User.DoesNotExist:
                pass

        if not user:
            try:
                User.objects.get(email__iexact=data['username'])
                raise serializers.ValidationError({"message": "Wrong password", "error_code": "wrong_password"})
            except User.DoesNotExist:
                raise serializers.ValidationError({"message": "Invalid username", "error_code": "invalid_username"})
        
        if not user.is_active:
            raise serializers.ValidationError({"message": "User account is disabled", "error_code": "account_disabled"})
        
        self.context['user'] = user
        return data


class OTPVerifySerializer(serializers.Serializer):
    otp = serializers.CharField()
    session_key = serializers.CharField()

    def validate(self, data):
        from django.contrib.sessions.models import Session

        try:
            session = Session.objects.get(session_key=data['session_key'])
            user_id = session.get_decoded().get('_auth_user_id')
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.get(pk=user_id)
        except Exception:
            raise serializers.ValidationError("Invalid session")

        mfa_method = (getattr(user, 'mfa_method', 'none') or 'none').strip().lower()
        otp_code = data['otp'].strip()

        # Verify based on MFA method
        if mfa_method == 'totp':
            # Verify against user's stored TOTP secret (Authenticator App)
            if not user.totp_secret:
                raise serializers.ValidationError("TOTP not configured")
            totp_verifier = pyotp.TOTP(user.totp_secret)
            if not totp_verifier.verify(otp_code, valid_window=1):
                raise serializers.ValidationError("Invalid OTP")
        elif mfa_method == 'email':
            # Verify against django_otp device (Email OTP)
            
            device = TOTPDevice.objects.filter(user=user, confirmed=True).first()
            if not device:
                raise serializers.ValidationError("Invalid OTP")
            
            # Check OTP codes from the past 5 minutes (10 x 30-second windows) plus current and 1 future
            # drift parameter = number of time steps to offset from current time
            valid = False
            for drift in range(-10, 2):  # -5 min to +30 sec
                expected_otp = totp(device.bin_key, step=30, t0=0, digits=6, drift=drift)
                expected_otp = f"{int(expected_otp):06d}"
                print(f"[OTP Verify] drift={drift} expected={expected_otp} received={otp_code}")
                if otp_code == expected_otp:
                    valid = True
                    break
            
            if not valid:
                raise serializers.ValidationError("Invalid OTP")
        else:
            raise serializers.ValidationError("MFA is not required for this user")

        self.context['user'] = user
        return data

class ResendOTPSerializer(serializers.Serializer):
    session_key = serializers.CharField()

class SendPasswordResetLinkSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=255)
    business_id = serializers.IntegerField()

class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=200)
    new_password = serializers.CharField(max_length=200)
    uid = serializers.CharField(max_length=200)


class UpdatePasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(max_length=200)
    old_password = serializers.CharField(max_length=200)
