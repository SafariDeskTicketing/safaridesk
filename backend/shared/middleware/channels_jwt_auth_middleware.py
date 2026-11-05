import logging
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

from shared.services.auth_revocation import ensure_user_token_is_current
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()
logger = logging.getLogger(__name__)

# The access token rides in the Sec-WebSocket-Protocol header, not the query
# string — a query string gets written to nginx/uvicorn access logs in
# plaintext, a header does not. Browsers can't set a custom header on a
# WebSocket handshake, but they can set subprotocols, so the client offers
# ["access_token", "<jwt>"] and the consumer echoes "access_token" back to
# complete the handshake.
ACCESS_TOKEN_SUBPROTOCOL = "access_token"


def extract_token_from_subprotocols(scope):
    protocols = scope.get("subprotocols") or []
    if len(protocols) >= 2 and protocols[0] == ACCESS_TOKEN_SUBPROTOCOL:
        return protocols[1]
    return None


class JWTAuthMiddleware:
    """Proper ASGI middleware to handle JWT Authentication over WebSocket."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        token = extract_token_from_subprotocols(scope)

        # Default to anonymous user
        scope['user'] = AnonymousUser()

        if token:
            try:
                # AccessToken (not a hand-rolled jwt.decode) so this verifies
                # against the same SIMPLE_JWT["SIGNING_KEY"] simplejwt itself
                # signs with — settings.SECRET_KEY is a different value in
                # prod (overridden after SIMPLE_JWT is built in base.py),
                # which silently broke every WebSocket JWT verification. This
                # also rejects refresh tokens (wrong token_type) the old
                # manual decode would have accepted.
                validated = AccessToken(token)
                user = await self.get_user(validated.get("user_id"))
                if user:
                    ensure_user_token_is_current(
                        user,
                        validated.get("iat"),
                        validated.get("auth_session_version"),
                    )
                    scope['user'] = user
            except InvalidToken as exc:
                logger.info("WebSocket session rejected during connect: %s", exc)
            except TokenError as exc:
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
