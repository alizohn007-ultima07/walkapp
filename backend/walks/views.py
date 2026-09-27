from django.contrib.auth import authenticate
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response as DRFResponse
from rest_framework.views import APIView

from .models import Message, Profile, WalkStatus, WalkRating, Comment
from .serializers import (
    MessageSerializer,
    ProfileSerializer,
    PublicKeySerializer,
    RegisterSerializer,
    WalkStatusSerializer,
    WalkRatingSerializer,
    CommentSerializer,
)
from .utils import haversine_km


class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register/  {username, password, display_name}"""

    queryset = None
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return DRFResponse(
            {"token": token.key, "username": user.username}, status=status.HTTP_201_CREATED
        )


class LoginView(APIView):
    """POST /api/auth/login/  {username, password} -> {token}"""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(username=username, password=password)
        if user is None:
            return DRFResponse(
                {"detail": "Неверный логин или пароль."}, status=status.HTTP_401_UNAUTHORIZED
            )
        token, _ = Token.objects.get_or_create(user=user)
        return DRFResponse({"token": token.key, "username": user.username})


class MyProfileView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/profile/me/"""

    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, _ = Profile.objects.get_or_create(
            user=self.request.user, defaults={"display_name": self.request.user.username}
        )
        return profile


class WalkStatusListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/statuses/?lat=..&lon=..   — лента активных статусов,
         отсортированная по расстоянию до переданных координат (если заданы),
         иначе — по времени создания (сначала новые).
    POST /api/statuses/  {text, latitude, longitude} — создать статус.
    """

    serializer_class = WalkStatusSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return WalkStatus.objects.filter(status=WalkStatus.Status.ACTIVE).select_related(
            "author", "author__profile"
        )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        lat = request.query_params.get("lat")
        lon = request.query_params.get("lon")

        items = list(queryset)
        if lat is not None and lon is not None:
            try:
                lat, lon = float(lat), float(lon)
                for item in items:
                    item._distance_km = round(
                        haversine_km(lat, lon, item.latitude, item.longitude), 2
                    )
                items.sort(key=lambda i: i._distance_km)
            except ValueError:
                pass  # некорректные координаты — просто вернём по дате

        serializer = self.get_serializer(items, many=True)
        return DRFResponse(serializer.data)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class ConversationHistoryView(ListAPIView):
    """GET /api/chat/<user_id>/history/ — история переписки текущего пользователя с user_id."""

    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        other_id = self.kwargs["user_id"]
        me = self.request.user
        return Message.objects.filter(
            Q(sender=me, recipient_id=other_id) | Q(sender_id=other_id, recipient=me)
        ).order_by("created_at")


class PublicKeyView(RetrieveAPIView):
    """GET /api/chat/<user_id>/public-key/ — публичный ключ пользователя (для E2E-шифрования)."""

    serializer_class = PublicKeySerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return get_object_or_404(Profile, user_id=self.kwargs["user_id"])


class WalkRatingCreateView(generics.CreateAPIView):
    """POST /api/ratings/  {walk_status, rated_user, score, comment} — оценить пользователя."""

    serializer_class = WalkRatingSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        rating = serializer.save(rater=self.request.user)
        profile, _ = Profile.objects.get_or_create(
            user_id=rating.rated_user_id,
            defaults={"display_name": str(rating.rated_user_id)},
        )
        ratings = WalkRating.objects.filter(rated_user_id=rating.rated_user_id)
        count = ratings.count()
        avg = sum(r.score for r in ratings) / count
        profile.trust_rating = round(avg, 2)
        profile.trust_rating_count = count
        profile.save(update_fields=["trust_rating", "trust_rating_count"])


class CommentListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/statuses/<status_id>/comments/ — список комментариев к статусу.
    POST /api/statuses/<status_id>/comments/  {text} — добавить комментарий.
    """

    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Comment.objects.filter(walk_status_id=self.kwargs["status_id"])

    def perform_create(self, serializer):
        serializer.save(author=self.request.user, walk_status_id=self.kwargs["status_id"])


class ConversationListView(APIView):
    """GET /api/chat/conversations/ — список диалогов текущего пользователя с последним сообщением."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        messages = Message.objects.filter(Q(sender=user) | Q(recipient=user))

        partner_ids = set()
        for m in messages:
            partner_ids.add(m.recipient_id if m.sender_id == user.id else m.sender_id)

        result = []
        for pid in partner_ids:
            last = messages.filter(
                Q(sender_id=pid, recipient=user) | Q(sender=user, recipient_id=pid)
            ).order_by("-created_at").first()
            unread = messages.filter(sender_id=pid, recipient=user, is_read=False).count()
            profile = Profile.objects.filter(user_id=pid).first()
            result.append({
                "user_id": pid,
                "display_name": profile.display_name if profile else str(pid),
                "last_message": last.ciphertext if last else "",
                "last_at": last.created_at.isoformat() if last else None,
                "unread_count": unread,
            })

        result.sort(key=lambda x: x["last_at"] or "", reverse=True)
        return DRFResponse(result)