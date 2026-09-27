from django.urls import path

from .views import (
    RegisterView,
    LoginView,
    MyProfileView,
    WalkStatusListCreateView,
    ConversationHistoryView,
    PublicKeyView,
    WalkRatingCreateView,
    CommentListCreateView,
    ConversationListView,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),

    path("profile/me/", MyProfileView.as_view(), name="profile-me"),

    path("statuses/", WalkStatusListCreateView.as_view(), name="status-list-create"),
    path("statuses/<int:status_id>/comments/", CommentListCreateView.as_view(), name="status-comments"),

    path("chat/<int:user_id>/history/", ConversationHistoryView.as_view(), name="chat-history"),
    path("chat/<int:user_id>/public-key/", PublicKeyView.as_view(), name="chat-public-key"),
    path("chat/conversations/", ConversationListView.as_view(), name="conversations"),

    path("ratings/", WalkRatingCreateView.as_view(), name="rating-create"),
]