from django.urls import path, include
from rest_framework.routers import DefaultRouter

from tenant.views.SlaXView import SLAViewSet, HolidayViewSet, SLAConfigurationView

router = DefaultRouter()
router.register(r'policies', SLAViewSet)
router.register(r'holidays', HolidayViewSet)


urlpatterns = [
    path('config/', SLAConfigurationView.as_view(), name='sla_config'),
    path('', include(router.urls)),
]
