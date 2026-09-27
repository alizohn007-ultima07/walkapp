from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Message, Profile, WalkStatus


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    display_name = serializers.CharField(write_only=True, max_length=60)

    class Meta:
        model = User
        fields = ["username", "password", "display_name"]

    def create(self, validated_data):
        display_name = validated_data.pop("display_name")
        user = User.objects.create_user(
            username=validated_data["username"], password=validated_data["password"]
        )
        Profile.objects.create(user=user, display_name=display_name)
        return user


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = Profile
        fields = [
            "id", "user_id", "username", "display_name", "bio", "avatar_url",
            "trust_rating", "trust_rating_count", "created_at",
        ]
        read_only_fields = ["trust_rating", "trust_rating_count"]


class WalkStatusSerializer(serializers.ModelSerializer):
    author_id = serializers.IntegerField(source="author.id", read_only=True)
    author_username = serializers.CharField(source="author.username", read_only=True)
    author_display_name = serializers.CharField(
        source="author.profile.display_name", read_only=True
    )
    # Заполняется во view (сортировка/расстояние до текущего пользователя) — этап ноября по плану.
    distance_km = serializers.SerializerMethodField()

    class Meta:
        model = WalkStatus
        fields = [
            "id", "author_id", "author_username", "author_display_name", "text",
            "latitude", "longitude", "status", "created_at", "distance_km",
        ]
        read_only_fields = [
            "id", "author_id", "author_username", "author_display_name", "created_at",
        ]

    def get_distance_km(self, obj):
        return getattr(obj, "_distance_km", None)


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "sender", "recipient", "ciphertext", "is_read", "created_at"]
        read_only_fields = ["id", "sender", "is_read", "created_at"]


class PublicKeySerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = Profile
        fields = ["user_id", "public_key"]