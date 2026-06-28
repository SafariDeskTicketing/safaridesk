

"""
ASGI config for RNSafarideskBack project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/asgi/
"""

import os
import django

from django.core.asgi import get_asgi_application

# Set settings before initializing Django (default to dev if not provided)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'RNSafarideskBack.settings.dev')
django.setup()

# Import WebSocket routing and JWT middleware after setup
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from shared.middleware.channels_jwt_auth_middleware import JWTAuthMiddleware
from tenant.routing import websocket_urlpatterns

# Final ASGI application config
application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AllowedHostsOriginValidator(
        JWTAuthMiddleware(
            URLRouter(
                websocket_urlpatterns
            )
        )
    ),
})
