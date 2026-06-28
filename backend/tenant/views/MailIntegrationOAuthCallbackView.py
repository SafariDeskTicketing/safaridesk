import json
import logging
from urllib.parse import urlencode

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from tenant.models import MailIntegration
from tenant.services.audit import actor_name, log_audit_event
from users.models import Users
from util.mail import (
    exchange_google_code,
    exchange_microsoft_code,
    fetch_google_userinfo,
    verify_oauth_state,
)
from util.mail.gmail_api import get_gmail_profile
from util.mail.ingestion import MailIntegrationIngestionService

logger = logging.getLogger(__name__)


def _popup_response(status: str, payload: dict | None, redirect_url: str):
    payload = payload or {}
    message = {"type": "mailIntegrationOauth", "status": status}
    message.update(payload)
    message_json = json.dumps(message)
    fallback_url = redirect_url
    fallback_params = urlencode(message)
    html = f"""
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>OAuth Complete</title>
    <style>
      body {{
        font-family: sans-serif;
        margin: 0;
        padding: 2rem;
        text-align: center;
        color: #1f2937;
      }}
    </style>
  </head>
  <body>
    <p>You can close this window.</p>
    <script>
      (function() {{
        const message = {message_json};
        const fallbackUrl = "{fallback_url}";
        function redirectFallback() {{
          if (!fallbackUrl) return;
          const separator = fallbackUrl.includes("?") ? "&" : "?";
          window.location.href = fallbackUrl + separator + "{fallback_params}";
        }}
        let posted = false;
        try {{
          if (window.opener && !window.opener.closed) {{
            window.opener.postMessage(message, "*");
            posted = true;
          }}
        }} catch (err) {{
          console.error('postMessage failed', err);
        }}
        try {{
          window.close();
        }} catch (err) {{
          console.warn('Unable to close window', err);
        }}
        if (!posted) {{
          redirectFallback();
        }}
      }})();
    </script>
  </body>
</html>
"""
    return HttpResponse(html)


class BaseOAuthCallbackView(APIView):
    permission_classes = [AllowAny]
    provider_name = ""
    integration_provider = ""

    def _verify_provider_connection(self, integration: MailIntegration, access_token: str | None):
        if not access_token:
            raise ValueError("OAuth provider did not return an access token.")

        if self.provider_name == "google":
            get_gmail_profile(access_token)
            return

        if self.provider_name == "microsoft" and integration.direction != MailIntegration.Direction.OUTGOING:
            service = MailIntegrationIngestionService(integration)
            try:
                service._connect_office365_imap_oauth()
            finally:
                service._disconnect_imap()

    def handle(self, request, exchange_func):
        state = request.query_params.get("state")
        code = request.query_params.get("code")
        error = request.query_params.get("error")

        if error:
            return _popup_response("error", {"error": error}, settings.MAIL_INTEGRATION_OAUTH_ERROR_URL)

        if not state or not code:
            return _popup_response("error", {"error": "missing_parameters"}, settings.MAIL_INTEGRATION_OAUTH_ERROR_URL)

        try:
            payload = verify_oauth_state(state)
        except Exception:
            return _popup_response("error", {"error": "invalid_state"}, settings.MAIL_INTEGRATION_OAUTH_ERROR_URL)

        if payload.get("provider") != self.provider_name:
            return _popup_response("error", {"error": "provider_mismatch"}, settings.MAIL_INTEGRATION_OAUTH_ERROR_URL)

        integration_id = payload.get("integration_id")
        integration = MailIntegration.objects.filter(id=integration_id).first()
        if not integration:
            return _popup_response(
                "error",
                {"error": "integration_not_found"},
                settings.MAIL_INTEGRATION_OAUTH_ERROR_URL,
            )
        if integration.provider != self.integration_provider:
            integration.mark_failure("OAuth callback provider does not match this mailbox.")
            return _popup_response(
                "error",
                {"error": "provider_mismatch"},
                settings.MAIL_INTEGRATION_OAUTH_ERROR_URL,
            )
        metadata = integration.provider_metadata or {}
        oauth_context = metadata.get("oauth_context") or {}
        return_url = oauth_context.pop("return_url", None)
        metadata["oauth_context"] = oauth_context
        metadata.pop("pending_state", None)
        success_redirect = return_url or settings.MAIL_INTEGRATION_OAUTH_SUCCESS_URL
        error_redirect = return_url or settings.MAIL_INTEGRATION_OAUTH_ERROR_URL

        try:
            token_data = exchange_func(code)
        except Exception as exc:
            logger.exception("OAuth token exchange failed: %s", exc)
            integration.mark_failure(str(exc))
            integration.provider_metadata = metadata
            integration.save(update_fields=["provider_metadata"])
            return _popup_response(
                "error",
                {"error": "token_exchange_failed"},
                error_redirect,
            )

        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        integration.set_secret("oauth_access_token", access_token)
        if refresh_token:
            integration.set_secret("oauth_refresh_token", refresh_token)
        integration.oauth_expires_at = token_data.get("expires_at")
        metadata["oauth"] = {
            "scope": token_data.get("scope"),
            "token_type": token_data.get("token_type"),
            "connected_at": timezone.now().isoformat(),
        }

        # Populate mailbox email if missing and we can fetch it from the provider.
        if not integration.email_address:
            email_address = None
            if self.provider_name == "google" and access_token:
                try:
                    profile = fetch_google_userinfo(access_token)
                    email_address = profile.get("email")
                except Exception:
                    logger.info("oauth_userinfo_fetch_failed", extra={"integration_id": integration.id, "provider": "google"})
            elif self.provider_name == "microsoft":
                email_address = token_data.get("email")
            if email_address:
                integration.email_address = email_address
                metadata["oauth"]["email"] = email_address

        integration.provider_metadata = metadata

        try:
            self._verify_provider_connection(integration, access_token)
        except Exception as exc:
            logger.exception("OAuth provider verification failed: %s", exc)
            integration.provider_metadata = metadata
            integration.mark_failure(f"Mailbox verification failed: {exc}")
            MailIntegration.objects.filter(pk=integration.pk).update(provider_metadata=metadata)
            return _popup_response(
                "error",
                {"error": "provider_verification_failed", "integration": integration.id},
                error_redirect,
            )

        # If the resolved email already belongs to another connected integration
        # for the same business+direction (e.g. user is re-authorising), migrate
        # the fresh tokens onto that existing record and discard the pending one.
        if integration.email_address:
            existing = (
                MailIntegration.objects.filter(
                    business=integration.business,
                    provider=integration.provider,
                    email_address=integration.email_address,
                    direction=integration.direction,
                    connection_status=MailIntegration.ConnectionStatus.CONNECTED,
                )
                .exclude(pk=integration.pk)
                .first()
            )
            if existing:
                existing.oauth_access_token_encrypted = integration.oauth_access_token_encrypted
                existing.oauth_refresh_token_encrypted = integration.oauth_refresh_token_encrypted
                existing.oauth_expires_at = integration.oauth_expires_at
                existing.provider_metadata = metadata
                existing.mark_success()
                existing.save(
                    update_fields=[
                        "oauth_access_token_encrypted",
                        "oauth_refresh_token_encrypted",
                        "oauth_expires_at",
                        "provider_metadata",
                    ]
                )
                actor = Users.objects.filter(id=payload.get("user_id"), business=existing.business).first()
                log_audit_event(
                    request,
                    event_type="MAILBOX_CONNECTED",
                    entity_type="mailbox",
                    entity=existing,
                    activity=f"{actor_name(actor)} connected mailbox '{existing.email_address or existing.display_name}'",
                    metadata={"provider": existing.provider, "direction": existing.direction},
                    actor_user=actor,
                    business=existing.business,
                )
                # Remove the now-redundant pending integration
                integration.delete()
                return _popup_response(
                    "success",
                    {"provider": self.provider_name, "integration": existing.id},
                    success_redirect,
                )

        integration.mark_success()
        # Persist encrypted tokens + expiry + metadata + optional email.
        update_fields = [
            "oauth_access_token_encrypted",
            "oauth_refresh_token_encrypted",
            "oauth_expires_at",
            "provider_metadata",
        ]
        if integration.email_address:
            update_fields.append("email_address")
        integration.save(update_fields=update_fields)
        actor = Users.objects.filter(id=payload.get("user_id"), business=integration.business).first()
        log_audit_event(
            request,
            event_type="MAILBOX_CONNECTED",
            entity_type="mailbox",
            entity=integration,
            activity=f"{actor_name(actor)} connected mailbox '{integration.email_address or integration.display_name}'",
            metadata={"provider": integration.provider, "direction": integration.direction},
            actor_user=actor,
            business=integration.business,
        )

        return _popup_response(
            "success",
            {"provider": self.provider_name, "integration": integration.id},
            success_redirect,
        )


class GoogleOAuthCallbackView(BaseOAuthCallbackView):
    provider_name = "google"
    integration_provider = MailIntegration.Provider.GMAIL

    def get(self, request, *args, **kwargs):
        return self.handle(request, exchange_google_code)


class MicrosoftOAuthCallbackView(BaseOAuthCallbackView):
    provider_name = "microsoft"
    integration_provider = MailIntegration.Provider.OFFICE365

    def get(self, request, *args, **kwargs):
        return self.handle(request, exchange_microsoft_code)
