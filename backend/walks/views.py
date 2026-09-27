from django.contrib.auth import authenticate
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response as DRFResponse
from rest_framework.views import APIView

from .models import Message, Profile, WalkStatus
from .serializers import (
    MessageSerializer,
    ProfileSerializer,
    PublicKeySerializer,
    RegisterSerializer,
    WalkStatusSerializer,
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