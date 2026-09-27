from django.urls import path

from .views import (
    ConversationHistoryView,
    LoginView,
    MyProfileView,
    PublicKeyView,
    RegisterView,
    WalkStatusListCreateView,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("profile/me/", MyProfileView.as_view(), name="my-profile"),
    path("statuses/", WalkStatusListCreateView.as_view(), name="statuses"),
    path("chat/<int:user_id>/history/", ConversationHistoryView.as_view(), name="chat-history"),
    path("chat/<int:user_id>/public-key/", PublicKeyView.as_view(), name="chat-public-key"),
]