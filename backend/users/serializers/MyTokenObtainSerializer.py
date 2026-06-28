from django.contrib.auth.models import Permission
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from django.contrib.auth import authenticate


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        from django.contrib.auth import get_user_model
        from django.utils import timezone
        User = get_user_model()
        
        authenticate_kwargs = {
            self.username_field: attrs[self.username_field],
            'password': attrs['password'],
        }
        try:
            self.user = authenticate(**authenticate_kwargs)
        except Exception:
            self.user = None
        
        if self.user is None:
            # Check if user exists to provide better error message
            try:
                matched = User.objects.get(email=attrs.get('username'))
                from users.models.FailedLoginModel import FailedLoginAttempt
                FailedLoginAttempt.log(
                    email=attrs.get('username', ''),
                    request=self.context.get('request'),
                    reason='wrong_password',
                    business=getattr(matched, 'business', None),
                )
                raise serializers.ValidationError({"detail": "Wrong password", "error_code": "wrong_password"})
            except User.DoesNotExist:
                from users.models.FailedLoginModel import FailedLoginAttempt
                FailedLoginAttempt.log(
                    email=attrs.get('username', ''),
                    request=self.context.get('request'),
                    reason='account_not_found',
                )
                raise serializers.ValidationError({"detail": "Invalid username", "error_code": "invalid_username"})

        if not self.user.is_active:
            from users.models.FailedLoginModel import FailedLoginAttempt
            FailedLoginAttempt.log(
                email=attrs.get('username', ''),
                request=self.context.get('request'),
                reason='account_disabled',
                business=getattr(self.user, 'business', None),
            )
            raise serializers.ValidationError({"detail": "User account is disabled", "error_code": "account_disabled"})
        
        # Update last_login timestamp
        self.user.last_login = timezone.now()
        self.user.save(update_fields=['last_login'])
        
        # Call parent's validate to get the tokens
        data = super(TokenObtainPairSerializer, self).validate(attrs)
        
        refresh = self.get_token(self.user)
        data['refresh'] = str(refresh)
        data['access'] = str(refresh.access_token)
        request = self.context.get('request')
        if request:
            from tenant.services.audit import actor_name, log_audit_event
            log_audit_event(
                request,
                event_type="USER_LOGIN",
                entity_type="user",
                entity=self.user,
                activity=f"{actor_name(self.user)} logged in",
                metadata={"method": "password"},
                actor_user=self.user,
                business=self.user.business,
            )

        return data
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add user details to the token
        token['user_type'] = 'staff'
        token['email'] = user.email
        token['role'] = user.role.name if user.role else None
        token['first_name'] = user.first_name
        token['last_name'] = user.last_name
        token['first_login'] = user.first_login
        token['phone_number'] = user.phone_number
        token['status'] = user.status
        token['is_active'] = user.is_active
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        token['category'] = user.category
        token['role'] = user.role.name if user.role else None
        token['auth_session_version'] = user.auth_session_version
        
        # Add department info (ManyToMany field)
        departments = user.department.all()
        token['departments'] = [{"id": dept.id, "name": dept.name} for dept in departments]

        # Add user permissions
        if user.role and user.role.name:
            auth_perms = Permission.objects.filter(group__name=user.role.name)
            permissions_data = [{"name": perm.name, "codename": perm.codename} for perm in auth_perms]
            token["permissions"] = permissions_data

        business = user.business if user.business else None
        # Add business details if associated with the user

        if business:
            token['business'] = {
                "id": business.id,
                "name": business.name,
                "email": business.email,
                "phone": business.phone,
                "logo_url": business.logo_url,
                "favicon_url": business.favicon_url,
                "auth_backdrop_url": business.auth_backdrop_url,
                "timezone": business.timezone,
                "support_url": business.support_url,
                "domain_url": f"https://{business.domain}.safaridesk.io",
                "owner_id": business.owner_id,
                "allow_idle_logout": business.allow_idle_logout,
                "idle_seconds": business.idle_seconds,
            }

        return token



