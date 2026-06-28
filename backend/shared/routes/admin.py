from django.urls import path
from rest_framework.routers import DefaultRouter

from shared.views.AdminView import (
    AdminBusinessViewSet,
    AdminUserViewSet,
    AdminSystemHealthView,
    AdminFailedLoginsView,
    AdminEmailFilterViewSet,
    AdminEmailFilterLogView,
    AdminPaymentViewSet,
    AdminSuspiciousActivityView,
    AdminAuditLogView,
    AdminLogTailView,
    AdminIntegrationsView,
    AdminQueueView,
)

router = DefaultRouter()
router.register(r'businesses', AdminBusinessViewSet, basename='admin-businesses')
router.register(r'users', AdminUserViewSet, basename='admin-users')
router.register(r'email-filters', AdminEmailFilterViewSet, basename='admin-email-filters')
router.register(r'payments', AdminPaymentViewSet, basename='admin-payments')

urlpatterns = router.urls + [
    path('system/health/', AdminSystemHealthView.as_view(), name='admin-system-health'),
    path('system/integrations/', AdminIntegrationsView.as_view(), name='admin-system-integrations'),
    path('system/queue/', AdminQueueView.as_view(), name='admin-system-queue'),
    path('auth/failed-logins/', AdminFailedLoginsView.as_view(), name='admin-failed-logins'),
    path('email-filter-log/', AdminEmailFilterLogView.as_view(), name='admin-email-filter-log'),
    path('suspicious-activity/', AdminSuspiciousActivityView.as_view(), name='admin-suspicious-activity'),
    path('audit-log/', AdminAuditLogView.as_view(), name='admin-audit-log'),
    path('logs/tail/', AdminLogTailView.as_view(), name='admin-logs-tail'),
]
