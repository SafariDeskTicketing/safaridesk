from django.urls import path, include

from users.views.AuthView import LoginInitiateView
from users.views.UserView import UserView

urlpatterns = [
    path('update/', UserView.as_view({"put": "update"}), name='Update-user'),
    path('avatar/', UserView.as_view({"get": "retrieve_avatar"}), name='Get-user-avatar'),
    path('get/customers', UserView.as_view({"get": "list_customers"}), name='list-customers'),
    path('me/', UserView.as_view({"get": "current_user"}), name='Current-user'),
    path('preferences/', UserView.as_view({"get": "get_preferences", "patch": "update_preferences"}), name='user-preferences'),
]
