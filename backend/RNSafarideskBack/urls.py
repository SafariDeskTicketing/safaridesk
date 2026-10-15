from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.views.static import serve
from django.conf.urls.static import static
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework import permissions

from util.ErrorResponse import custom_404, custom_500
from django.conf.urls.static import static
from django.http import JsonResponse
from tenant.views.MailgunWebhookView import MailgunInboundWebhookView
from tenant.views.CsatWebhookView import CsatWebhookView

schema_view = get_schema_view(
    openapi.Info(
        title="Safari Desk Ticketing API - safari.io",
        default_version="v1",
    ),
    public=True,
    permission_classes=[
        permissions.AllowAny,
    ],
)

urlpatterns = [
    path("api/v1/health/", lambda request: JsonResponse({"status": "ok"}), name="health"),
    path("api/v1/auth/", include("users.routes.auth")),
    path("api/v1/users/", include("users.routes.users")),
    path("api/v1/business/", include("users.routes.business")),
    path("api/v1/domains/", include("users.routes.custom_domains")),
    path("api/v1/department/", include("tenant.routes.department")),
    path("api/v1/public/", include("tenant.routes.public")),
    # REMOVED: Request workflow has been disabled (Issue #170)
    # path("api/v1/requests/", include("tenant.routes.req")),
    path("api/v1/agent/", include("tenant.routes.agent")),
    path("api/v1/ticket/", include("tenant.routes.ticket")),
    path("api/v1/labels/", include("tenant.routes.label")),
    # path("api/v1/sla/", include("tenant.routes.sla")),
    path("api/v1/sla/", include("tenant.routes.slax")),
    path("api/v1/task/", include("tenant.routes.task")),
    path("api/v1/kb/", include("tenant.routes.knowledgebase")),
    path("api/v1/chatbot/", include("tenant.routes.chatbot")),
    path("api/v1/copilot/", include("tenant.routes.copilot")),
    path("api/v1/account/", include("users.routes.users")),
    path("api/v1/settings/", include("tenant.routes.setting")),
    path("api/v1/dashboard/", include("tenant.routes.dashboard")),
    path("api/v1/reports/", include("tenant.routes.reports")),
    path("api/v1/exports/", include("tenant.routes.exports")),
    path("api/v1/assets/", include("tenant.routes.assets")),
    path("api/v1/audit-logs/", include("tenant.routes.audit")),
    path("api/v1/contacts/", include("tenant.routes.contact")),
    path("api/v1/notifications/", include("tenant.routes.notifications")),
    path("api/v1/admin/", include("shared.routes.admin")),
    path("api/v1/license/", include("shared.routes.license")),

    path("api/v1/payment/", include("shared.routes.payment")),
    path("api/v1/integrations/slack/", include("shared.routes.slack")),
    path("api/v1/integrations/teams/", include("shared.routes.teams")),
    path("api/v1/integrations/twilio/", include("shared.routes.twilio")),
    path("api/v1/integrations/whatsapp/", include("shared.routes.whatsapp")),
    path("api/v1/integrations/safari-sms/", include("shared.routes.safari_sms")),
    path("api/v1/integrations/telegram/", include("shared.routes.telegram")),

    path("mailgun/inbound/", MailgunInboundWebhookView.as_view(), name="mailgun-inbound"),
    path("mailgun/inbound/mime", MailgunInboundWebhookView.as_view(), name="mailgun-inbound-mime"),
    path("api/v1/public/webhooks/csat/", CsatWebhookView.as_view(), name="csat-webhook"),

    path(
        "swagger/",
        schema_view.with_ui("swagger", cache_timeout=0),
        name="schema-swagger-ui",
    ),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    path("uploads/<path:path>", serve, {"document_root": settings.MEDIA_ROOT}),
]
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
# Client & server errors handlers
handler404 = custom_404
handler500 = custom_500
