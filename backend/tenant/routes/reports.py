from django.urls import path

from tenant.views.ReportsView import ReportsViewSet


urlpatterns = [
    path("tickets/", ReportsViewSet.as_view({"get": "tickets"}), name="reports_tickets"),
    path("tasks/", ReportsViewSet.as_view({"get": "tasks"}), name="reports_tasks"),
    path("agents/", ReportsViewSet.as_view({"get": "agents"}), name="reports_agents"),
    path("tickets/export/", ReportsViewSet.as_view({"get": "export_tickets"}), name="reports_tickets_export"),
    path("tasks/export/", ReportsViewSet.as_view({"get": "export_tasks"}), name="reports_tasks_export"),
    path("agents/export/", ReportsViewSet.as_view({"get": "export_agents"}), name="reports_agents_export"),
]
