from django.contrib import admin

from .models import Message, Profile, Response, WalkRating, WalkStatus


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("display_name", "user", "trust_rating", "created_at")
    search_fields = ("display_name", "user__username")


@admin.register(WalkStatus)
class WalkStatusAdmin(admin.ModelAdmin):
    list_display = ("author", "text", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("text", "author__username")


admin.site.register(Response)
admin.site.register(Message)
admin.site.register(WalkRating)
