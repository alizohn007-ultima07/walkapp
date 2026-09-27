import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model

from .models import Message

User = get_user_model()


def user_group_name(user_id):
    """Личная группа пользователя — сообщения ему летят сюда независимо
    от того, с кем именно он переписывается."""
    return f"user_{user_id}"


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.group_name = user_group_name(self.user.id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if getattr(self, "group_name", None):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            recipient_id = int(data["recipient_id"])
            ciphertext = data["ciphertext"]
        except (KeyError, ValueError, json.JSONDecodeError):
            await self.send(text_data=json.dumps({"error": "invalid_payload"}))
            return

        message = await self._save_message(recipient_id, ciphertext)
        if message is None:
            await self.send(text_data=json.dumps({"error": "recipient_not_found"}))
            return

        payload = json.dumps(
            {
                "type": "chat.message",
                "id": message.id,
                "sender_id": self.user.id,
                "recipient_id": recipient_id,
                "ciphertext": ciphertext,
                "created_at": message.created_at.isoformat(),
            }
        )

        # получателю
        await self.channel_layer.group_send(
            user_group_name(recipient_id), {"type": "chat.message", "payload": payload}
        )
        # эхо отправителю (чтобы синхронизировать все его вкладки/устройства)
        await self.send(text_data=payload)

    async def chat_message(self, event):
        await self.send(text_data=event["payload"])

    @database_sync_to_async
    def _save_message(self, recipient_id, ciphertext):
        if not User.objects.filter(id=recipient_id).exists():
            return None
        return Message.objects.create(
            sender=self.user, recipient_id=recipient_id, ciphertext=ciphertext
        )