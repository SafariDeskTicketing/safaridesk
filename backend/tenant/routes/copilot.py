from django.urls import path

from tenant.views.CopilotView import CopilotConfirmView, CopilotInvokeView, CopilotRejectView


urlpatterns = [
    path("invoke/", CopilotInvokeView.as_view(), name="copilot_invoke"),
    path("confirm/<int:suggestion_id>/", CopilotConfirmView.as_view(), name="copilot_confirm"),
    path("reject/<int:suggestion_id>/", CopilotRejectView.as_view(), name="copilot_reject"),
]
