from django.urls import path

from tenant.views.DashboardView import DashView

urlpatterns = [
    path('data/', DashView.as_view({'get': 'load'}), name='agent_create'),
    path('get-started/', DashView.as_view({'get': 'get_started', 'patch': 'update_onboarding_state'}), name='get_started'),
]
