from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.settings import api_settings

from shared.services.auth_revocation import ensure_user_token_is_current
from users.models import Customer, Users


class CustomerJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user_type = validated_token.get('user_type', 'staff')
        user_id_claim = api_settings.USER_ID_CLAIM

        if user_type == 'customer':
            customer_id = validated_token.get('customer_id') or validated_token.get(user_id_claim)
            if customer_id is None:
                raise InvalidToken('Customer token is missing a customer id.')

            try:
                customer = Customer.objects.get(id=customer_id)
                if not customer.is_active:
                    raise InvalidToken('Customer account is inactive.')
                return customer
            except Customer.DoesNotExist as exc:
                raise InvalidToken('Customer not found.') from exc

        user_id = validated_token.get(user_id_claim)
        if user_id is None:
            raise InvalidToken('Token contained no recognizable user identifier.')

        try:
            user = Users.objects.get(id=user_id)
            if not user.is_active:
                raise InvalidToken('User account is inactive.')
            
            # Verify token hasn't been revoked
            ensure_user_token_is_current(
                user,
                validated_token.get("iat"),
                validated_token.get("auth_session_version"),
            )
            
            return user
        except Users.DoesNotExist as exc:
            raise InvalidToken('User not found.') from exc
