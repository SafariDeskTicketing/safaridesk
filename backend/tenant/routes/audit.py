from django.urls import path

from tenant.views.AuditLogView import TenantAuditLogListView

urlpatterns = [
    path("", TenantAuditLogListView.as_view(), name="tenant-audit-logs"),
]
