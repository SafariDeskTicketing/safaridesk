from django.urls import path

from shared.views.LicenseView import LicenseStatusView

urlpatterns = [
    path("status/", LicenseStatusView.as_view(), name="license-status"),
]
