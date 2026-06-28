import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        if not self.user or isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        business_id = await self.get_user_business()
        
        # Security: All users must have a business association
        # If superadmin needs notifications, they should be assigned to a business
        if not business_id:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"User {self.user.id} ({getattr(self.user, 'email', 'unknown')}) attempted WebSocket connection without business association")
            await self.close(code=4003)
            return

        self.notification_group_name = f'notifications_{business_id}_{self.user.id}'
        self.business_group_name = f'business_notifications_{business_id}'
        self.session_group_name = f'user_session_{self.user.id}'

        await self.channel_layer.group_add(self.notification_group_name, self.channel_name)
        await self.channel_layer.group_add(self.business_group_name, self.channel_name)
        await self.channel_layer.group_add(self.session_group_name, self.channel_name)

        await self.accept()
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to notification stream',
            'user_id': self.user.id,
            'business_id': business_id
        }))

    @database_sync_to_async
    def get_user_business(self):
        if hasattr(self.user, 'business') and self.user.business:
            return self.user.business.id
        return None

    async def disconnect(self, close_code):
        if hasattr(self, 'notification_group_name'):
            await self.channel_layer.group_discard(self.notification_group_name, self.channel_name)
        if hasattr(self, 'business_group_name'):
            await self.channel_layer.group_discard(self.business_group_name, self.channel_name)
        if hasattr(self, 'session_group_name'):
            await self.channel_layer.group_discard(self.session_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': data.get('timestamp')
                }))
            elif message_type == 'get_notifications':
                # Send notifications list to the requesting user
                await self.send_notifications_list()
            elif message_type == 'get_unread_notifications':
                # Send only unread notifications
                await self.send_unread_notifications_list()
        except json.JSONDecodeError:
            pass

    async def notification_message(self, event):
        data = event.get('data')

        if isinstance(data, dict) and data.get('type'):
            payload = data
        else:
            notification = event.get('notification', data)
            payload = {
                'type': 'notification_message',
                'notification': notification,
                'data': notification,
            }

        await self.send(text_data=json.dumps(payload))

    async def business_broadcast(self, event):
        await self.send(text_data=json.dumps(event['data']))

    async def session_revoked(self, event):
        await self.send(text_data=json.dumps({
            'type': 'session_revoked',
            'reason': event.get('reason', 'session_revoked'),
        }))
        await self.close(code=event.get('close_code', 4005))

    @database_sync_to_async
    def get_user_notifications(self, unread_only=False):
        """Get notifications for the current user"""
        from tenant.models.Notification import Notification
        
        queryset = Notification.objects.filter(user=self.user).order_by('-created_at')
        if unread_only:
            queryset = queryset.filter(is_read=False)
        
        return [notification.to_dict() for notification in queryset]

    async def send_notifications_list(self):
        """Send all notifications for the user"""
        try:
            notifications = await self.get_user_notifications(unread_only=False)
            await self.send(text_data=json.dumps({
                'type': 'notifications_list',
                'notifications': notifications
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Failed to fetch notifications'
            }))

    async def send_unread_notifications_list(self):
        """Send only unread notifications for the user"""
        try:
            notifications = await self.get_user_notifications(unread_only=True)
            await self.send(text_data=json.dumps({
                'type': 'unread_notifications_list',
                'notifications': notifications
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Failed to fetch unread notifications'
            }))
