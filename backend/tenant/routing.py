from django.urls import re_path
from tenant.consumers import NotificationConsumer
from tenant.consumers.ChatConsumer import ChatConsumer

websocket_urlpatterns = [
    re_path(r'^ws/chat/(?P<business_id>\w+)/(?P<mode>\w+)/?$', ChatConsumer.as_asgi()),
    re_path(r'^ws/notifications/?$', NotificationConsumer.as_asgi()),
]
