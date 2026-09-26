from django.urls import path

from .views import LoginView, MyProfileView, RegisterView, WalkStatusListCreateView

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("profile/me/", MyProfileView.as_view(), name="my-profile"),
    path("statuses/", WalkStatusListCreateView.as_view(), name="statuses"),
]
