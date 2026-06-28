import jwt
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from urllib.parse import parse_qs
from django.contrib.auth.models import AnonymousUser

from shared.services.auth_revocation import ensure_user_token_is_current
from rest_framework_simplejwt.exceptions import InvalidToken

User = get_user_model()
logger = logging.getLogger(__name__)

class JWTAuthMiddleware:
    """Proper ASGI middleware to handle JWT Authentication over WebSocket."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        # Extract token from query parameters
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get("token", [None])[0]

        # Default to anonymous user
        scope['user'] = AnonymousUser()

        if token:
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                user = await self.get_user(payload.get("user_id"))
                if user:
                    ensure_user_token_is_current(
                        user,
                        payload.get("iat"),
                        payload.get("auth_session_version"),
                    )
                    scope['user'] = user
            except jwt.ExpiredSignatureError:
                logger.info("WebSocket JWT expired during connect")
            except InvalidToken as exc:
                logger.info("WebSocket session rejected during connect: %s", exc)
            except jwt.InvalidTokenError as exc:
                logger.info("WebSocket JWT invalid during connect: %s", exc)
            except Exception:
                logger.exception("Unexpected WebSocket auth error during connect")

        # Call the inner application
        return await self.inner(scope, receive, send)

    @database_sync_to_async
    def get_user(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return AnonymousUser()
