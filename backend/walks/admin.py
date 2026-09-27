import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import Message  # уточним после models.py


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")

        if self.user is None:
            await self.close(code=4001)
            return

        self.group_name = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(json.dumps({"error": "invalid_json"}))
            return

        recipient_id = data.get("recipient_id")
        ciphertext = data.get("ciphertext")

        if not recipient_id or not ciphertext:
            await self.send(json.dumps({"error": "missing_fields"}))
            return

        message = await self.save_message(self.user.id, recipient_id, ciphertext)

        payload = {
            "sender_id": self.user.id,
            "recipient_id": recipient_id,
            "ciphertext": ciphertext,
            "created_at": message.created_at.isoformat(),
        }

        await self.channel_layer.group_send(
            f"user_{recipient_id}",
            {"type": "chat.message", "payload": payload},
        )
        await self.send(json.dumps(payload))

    async def chat_message(self, event):
        await self.send(json.dumps(event["payload"]))

    @database_sync_to_async
    def save_message(self, sender_id, recipient_id, ciphertext):
        return Message.objects.create(
            sender_id=sender_id,
            recipient_id=recipient_id,
            ciphertext=ciphertext,
        )