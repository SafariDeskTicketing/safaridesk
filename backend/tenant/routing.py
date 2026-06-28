from django.urls import re_path
from tenant.consumers import NotificationConsumer
from tenant.consumers.ChatConsumer import ChatConsumer
from tenant.setup_consumer import SetupConsumer

websocket_urlpatterns = [
    re_path(r'^ws/setup/(?P<business_id>\w+)/?$', SetupConsumer.as_asgi()),
    re_path(r'^ws/chat/(?P<business_id>\w+)/(?P<mode>\w+)/?$', ChatConsumer.as_asgi()),
    re_path(r'^ws/notifications/?$', NotificationConsumer.as_asgi()),
]
