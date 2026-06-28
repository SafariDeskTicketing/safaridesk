from django.urls import path

from tenant.views.ExportView import ExportJobDetailView, ExportJobDownloadView


urlpatterns = [
    path("<int:pk>/", ExportJobDetailView.as_view(), name="export_job_detail"),
    path("<int:pk>/download/", ExportJobDownloadView.as_view(), name="export_job_download"),
]
