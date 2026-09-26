from django.conf import settings
from django.db import models


class Profile(models.Model):
    """Профиль пользователя. Один профиль на пользователя Django."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    display_name = models.CharField("Имя в приложении", max_length=60)
    bio = models.CharField("О себе", max_length=280, blank=True)
    avatar_url = models.URLField("Ссылка на аватар", blank=True)
    # Агрегированный рейтинг доверия — заполняется на этапе WalkRating (февраль по плану).
    trust_rating = models.FloatField("Рейтинг доверия", default=0.0)
    trust_rating_count = models.PositiveIntegerField("Кол-во оценок", default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.display_name or self.user.username


class WalkStatus(models.Model):
    """
    Статус «иду гулять сейчас/скоро» с координатами.
    Это ядро ленты — сентябрь/октябрь по плану.
    """

    class Status(models.TextChoices):
        ACTIVE = "active", "Активен"
        CLOSED = "closed", "Закрыт"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="walk_statuses"
    )
    text = models.CharField("Текст статуса", max_length=200)
    latitude = models.FloatField("Широта")
    longitude = models.FloatField("Долгота")
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ACTIVE
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.author}: {self.text[:30]}"


# --- Заготовки под следующие этапы плана (ноябрь / январь / февраль) ---
# Поля намеренно минимальны — расширите при реализации соответствующего этапа.


class Response(models.Model):
    """Отклик на статус (этап: 1–23 ноября по плану)."""

    walk_status = models.ForeignKey(
        WalkStatus, on_delete=models.CASCADE, related_name="responses"
    )
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("walk_status", "author")  # один отклик на статус от пользователя


class Message(models.Model):
    """Сообщение в чате между пользователями (этап: 16–31 января по плану)."""

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages"
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_messages"
    )
    text = models.TextField("Текст сообщения")
    is_read = models.BooleanField("Прочитано", default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at"]


class WalkRating(models.Model):
    """Оценка после прогулки (этап: 1–14 февраля по плану)."""

    walk_status = models.ForeignKey(WalkStatus, on_delete=models.CASCADE, related_name="ratings")
    rater = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ratings_given"
    )
    rated_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ratings_received"
    )
    score = models.PositiveSmallIntegerField("Оценка (1-5)")
    comment = models.CharField(max_length=280, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("walk_status", "rater", "rated_user")
