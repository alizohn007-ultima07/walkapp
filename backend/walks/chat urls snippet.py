# Добавьте этот список в urlpatterns вашего walks/urls.py (или подключите через include)

from django.urls import path

from .views import ConversationHistoryView, PublicKeyView

chat_urlpatterns = [
    path("chat/<int:user_id>/history/", ConversationHistoryView.as_view(), name="chat-history"),
    path("chat/<int:user_id>/public-key/", PublicKeyView.as_view(), name="chat-public-key"),
]