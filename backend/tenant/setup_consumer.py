import json
from channels.generic.websocket import AsyncWebsocketConsumer

class SetupConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.business_id = self.scope['url_route']['kwargs']['business_id']
        self.setup_group_name = f'setup_{self.business_id}'

        await self.channel_layer.group_add(
            self.setup_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.setup_group_name,
            self.channel_name
        )

    async def setup_status(self, event):
        await self.send(text_data=json.dumps({
            'status': event['status'],
            'message': event['message'],
            'step': event['step'],
            'total_steps': event['total_steps'],
        }))

