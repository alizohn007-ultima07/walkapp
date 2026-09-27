"""
Мидлварь для Channels: аутентификация WebSocket-подключений по DRF Token,
переданному в query-параметре ?token=<key>.

Подключение с фронтенда:
    new WebSocket(`wss://host/ws/chat/?token=${authToken}`)
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token


@database_sync_to_async
def get_user_from_token(token_key):
    try:
        return Token.objects.select_related("user").get(key=token_key).user
    except Token.DoesNotExist:
        return AnonymousUser()


class TokenAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = parse_qs(scope["query_string"].decode())
        token_key = query_string.get("token", [None])[0]

        scope["user"] = (
            await get_user_from_token(token_key) if token_key else AnonymousUser()
        )
        return await super().__call__(scope, receive, send)