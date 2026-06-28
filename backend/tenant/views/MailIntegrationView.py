import logging
import secrets
from urllib.parse import urlparse

import requests as http_requests
from django.conf import settings
from django.db import transaction
from django.utils.text import slugify
from django.utils import timezone
from rest_framework import permissions, status, viewsets

logger = logging.getLogger(__name__)
from rest_framework.decorators import action
from rest_framework.response import Response

from tenant.models import MailIntegration
from tenant.services.audit import actor_name, log_audit_event
from tenant.serializers.MailIntegrationSerializer import (
    MailIntegrationRoutingSerializer,
    MailIntegrationSerializer,
    MailIntegrationWriteSerializer,
)
from tenant.serializers.MailValidationSerializer import MailCredentialValidationSerializer
from util.mail import (
    build_google_auth_url,
    build_microsoft_auth_url,
    sign_oauth_state,
    validate_mail_credentials,
)


class MailIntegrationViewSet(viewsets.ModelViewSet):
    """
    Manage mailbox integrations per tenant. Secrets are written through the write serializer
    and never returned in responses.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MailIntegrationSerializer
    queryset = MailIntegration.objects.all()

    def get_queryset(self):
        business = getattr(self.request.user, "business", None)
        base_qs = MailIntegration.objects.select_related("department", "default_assignee")
        if not business:
            return base_qs.none()
        return base_qs.filter(business=business)

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return MailIntegrationWriteSerializer
        return MailIntegrationSerializer

    def perform_create(self, serializer):
        integration = serializer.save(business=self.request.user.business)
        log_audit_event(
            self.request,
            event_type="MAILBOX_CREATED",
            entity_type="mailbox",
            entity=integration,
            activity=f"{actor_name(self.request.user)} created mailbox '{integration.email_address or integration.display_name}'",
            metadata={"provider": integration.provider, "direction": integration.direction},
        )

    def perform_update(self, serializer):
        integration = serializer.save()
        log_audit_event(
            self.request,
            event_type="MAILBOX_UPDATED",
            entity_type="mailbox",
            entity=integration,
            activity=f"{actor_name(self.request.user)} updated mailbox '{integration.email_address or integration.display_name}'",
            metadata={"provider": integration.provider, "direction": integration.direction},
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        mailbox_label = instance.email_address or instance.display_name
        metadata = {"provider": instance.provider, "direction": instance.direction}
        self._revoke_oauth_tokens(instance)
        with transaction.atomic():
            instance.fetch_logs.all().delete()
            instance.messages.all().delete()
            self.perform_destroy(instance)
            log_audit_event(
                request,
                event_type="MAILBOX_DELETED",
                entity_type="mailbox",
                entity=instance,
                activity=f"{actor_name(request.user)} deleted mailbox '{mailbox_label}'",
                metadata=metadata,
                business=request.user.business,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _revoke_oauth_tokens(self, integration: MailIntegration):
        """Best-effort token revocation. Never raises — deletion must not be blocked."""
        try:
            if integration.provider == MailIntegration.Provider.GMAIL:
                token = integration.get_secret("oauth_access_token")
                if token:
                    http_requests.post(
                        "https://oauth2.googleapis.com/revoke",
                        params={"token": token},
                        timeout=5,
                    )
            # Microsoft has no simple per-token revocation endpoint;
            # deleting from DB is sufficient — refresh tokens become worthless.
        except Exception:
            logger.warning("oauth_revocation_failed", extra={"integration_id": integration.id})

    @action(detail=True, methods=["patch"], url_path="routing")
    def update_routing(self, request, pk=None):
        integration = self.get_object()
        serializer = MailIntegrationRoutingSerializer(
            integration,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MailIntegrationSerializer(integration).data)

    @action(detail=True, methods=["post"], url_path="provider/change")
    def change_provider(self, request, pk=None):
        integration = self.get_object()
        provider = request.data.get("provider")
        direction = request.data.get("direction")

        if provider not in MailIntegration.Provider.values:
            return Response(
                {"detail": "Invalid provider."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if provider != integration.provider:
            return Response(
                {"detail": "Changing mailbox provider is no longer supported. Create a new mailbox instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if direction and direction in MailIntegration.Direction.values:
            integration.direction = direction
            integration.save(update_fields=["direction"])

        return Response(MailIntegrationSerializer(integration).data)

    @action(detail=True, methods=["post"], url_path="google/start")
    def google_start(self, request, pk=None):
        integration = self.get_object()
        if integration.provider != MailIntegration.Provider.GMAIL:
            return Response(
                {"detail": "Integration provider must be Gmail for this action."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        state = sign_oauth_state(
            {"integration_id": integration.id, "provider": "google", "user_id": request.user.id}
        )
        url = build_google_auth_url(state)
        metadata = integration.provider_metadata or {}
        metadata["pending_state"] = state
        oauth_context = metadata.get("oauth_context") or {}
        return_url = self._extract_return_url(request)
        if return_url:
            oauth_context["return_url"] = return_url
        metadata["oauth_context"] = oauth_context
        integration.provider_metadata = metadata
        update_fields = ["provider_metadata"]
        if integration.connection_status != MailIntegration.ConnectionStatus.CONNECTED:
            integration.connection_status = MailIntegration.ConnectionStatus.CONNECTING
            integration.connection_status_detail = "Pending Google authorization."
            integration.is_active = False
            update_fields.extend(["connection_status", "connection_status_detail", "is_active"])
        integration.save(update_fields=update_fields)
        log_audit_event(
            request,
            event_type="MAILBOX_UPDATED",
            entity_type="mailbox",
            entity=integration,
            activity=f"{actor_name(request.user)} started Google mailbox authorization",
            metadata={"provider": integration.provider, "status": integration.connection_status},
        )
        return Response({"authorization_url": url})

    @action(detail=True, methods=["post"], url_path="microsoft/start")
    def microsoft_start(self, request, pk=None):
        integration = self.get_object()
        if integration.provider != MailIntegration.Provider.OFFICE365:
            return Response(
                {"detail": "Integration provider must be Microsoft 365 for this action."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        state = sign_oauth_state(
            {"integration_id": integration.id, "provider": "microsoft", "user_id": request.user.id}
        )
        url = build_microsoft_auth_url(state)
        metadata = integration.provider_metadata or {}
        metadata["pending_state"] = state
        oauth_context = metadata.get("oauth_context") or {}
        return_url = self._extract_return_url(request)
        if return_url:
            oauth_context["return_url"] = return_url
        metadata["oauth_context"] = oauth_context
        integration.provider_metadata = metadata
        update_fields = ["provider_metadata"]
        if integration.connection_status != MailIntegration.ConnectionStatus.CONNECTED:
            integration.connection_status = MailIntegration.ConnectionStatus.CONNECTING
            integration.connection_status_detail = "Pending Microsoft authorization."
            integration.is_active = False
            update_fields.extend(["connection_status", "connection_status_detail", "is_active"])
        integration.save(update_fields=update_fields)
        log_audit_event(
            request,
            event_type="MAILBOX_UPDATED",
            entity_type="mailbox",
            entity=integration,
            activity=f"{actor_name(request.user)} started Microsoft mailbox authorization",
            metadata={"provider": integration.provider, "status": integration.connection_status},
        )
        return Response({"authorization_url": url})

    @action(detail=False, methods=["post"], url_path="validate-credentials")
    def validate_credentials(self, request):
        serializer = MailCredentialValidationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = validate_mail_credentials(serializer.validated_data)
        return Response(result)

    @action(detail=True, methods=["post"], url_path="forwarding/provision")
    def provision_forwarding(self, request, pk=None):
        integration = self.get_object()
        if integration.provider != MailIntegration.Provider.SAFARIDESK:
            return Response(
                {"detail": "Forwarding aliases only apply to SafariDesk mail server entries."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        already_exists = (
            MailIntegration.objects.filter(
                business=integration.business,
                provider=MailIntegration.Provider.SAFARIDESK,
            )
            .exclude(pk=integration.pk)
            .filter(forwarding_address__isnull=False)
            .exclude(forwarding_address="")
            .exists()
        )
        if already_exists:
            return Response(
                {"detail": "A forwarding address already exists for this business. Delete it before generating a new one."},
                status=status.HTTP_409_CONFLICT,
            )
        if integration.forwarding_address:
            return Response(
                {
                    "forwarding_address": integration.forwarding_address,
                    "forwarding_status": integration.forwarding_status,
                }
            )
        alias = self._generate_forwarding_alias(integration)
        integration.forwarding_address = alias
        integration.email_address = alias
        integration.connection_status = MailIntegration.ConnectionStatus.CONNECTING
        integration.connection_status_detail = "Awaiting forwarded test email."
        integration.is_active = False
        integration.forwarding_status = "pending_verification"
        metadata = integration.provider_metadata or {}
        metadata["forwarding"] = {
            "generated_at": timezone.now().isoformat(),
            "instructions": [
                "Add the alias as a forwarding address in your domain or mailbox provider.",
                f"Forward all support emails to {alias}.",
                "Once forwarding is configured, send a test email so SafariDesk can verify delivery.",
            ],
        }
        integration.provider_metadata = metadata
        integration.save(
            update_fields=[
                "forwarding_address",
                "email_address",
                "connection_status",
                "connection_status_detail",
                "is_active",
                "forwarding_status",
                "provider_metadata",
            ]
        )
        log_audit_event(
            request,
            event_type="MAILBOX_UPDATED",
            entity_type="mailbox",
            entity=integration,
            activity=f"{actor_name(request.user)} provisioned forwarding alias '{alias}'",
            metadata={"provider": integration.provider, "forwarding_status": integration.forwarding_status},
        )
        return Response(
            {
                "forwarding_address": alias,
                "email_address": alias,
                "forwarding_status": integration.forwarding_status,
                "instructions": metadata["forwarding"]["instructions"],
            },
            status=status.HTTP_201_CREATED,
        )

    def _generate_forwarding_alias(self, integration: MailIntegration) -> str:
        inbound_domain = getattr(settings, "SAFARIDESK_FORWARDING_DOMAIN", "safaridesk.io")
        business = getattr(integration, "business", None)
        base_slug = (
            slugify(getattr(business, "name", "") or "tenant")
            or f"tenant-{business.id if business else integration.id}"
        )
        candidate = f"support@{base_slug}.{inbound_domain}"
        if MailIntegration.objects.filter(forwarding_address__iexact=candidate).exclude(id=integration.id).exists():
            counter = 2
            while (
                MailIntegration.objects.filter(
                    forwarding_address__iexact=f"support@{base_slug}-{counter}.{inbound_domain}"
                )
                .exclude(id=integration.id)
                .exists()
            ):
                counter += 1
            candidate = f"support@{base_slug}-{counter}.{inbound_domain}"
        return candidate

    def _reset_credentials(self, integration: MailIntegration):
        integration.set_secret("oauth_access_token", None)
        integration.set_secret("oauth_refresh_token", None)
        integration.set_secret("imap_username", None)
        integration.set_secret("imap_password", None)
        integration.set_secret("smtp_username", None)
        integration.set_secret("smtp_password", None)
        integration.imap_host = ""
        integration.imap_port = None
        integration.imap_use_ssl = None
        integration.smtp_host = ""
        integration.smtp_port = None
        integration.smtp_use_ssl = None
        integration.smtp_use_tls = None
    def _extract_return_url(self, request):
        url = request.data.get("return_url") or request.query_params.get("return_url")
        if not url:
            return None
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            return None
        if not parsed.netloc:
            return None
        return url

    @action(detail=True, methods=["post"], url_path="alias/generate")
    def generate_alias(self, request, pk=None):
        """
        Generate a SafariDesk-hosted alias for this integration (provider must be safaridesk).
        Uses the configured forwarding domain and an incrementing business slug for uniqueness.
        """
        integration = self.get_object()
        if integration.provider != MailIntegration.Provider.SAFARIDESK:
            return Response(
                {"detail": "Alias generation only applies to SafariDesk provider."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        already_exists = (
            MailIntegration.objects.filter(
                business=integration.business,
                provider=MailIntegration.Provider.SAFARIDESK,
            )
            .exclude(pk=integration.pk)
            .filter(forwarding_address__isnull=False)
            .exclude(forwarding_address="")
            .exists()
        )
        if already_exists:
            return Response(
                {"detail": "A forwarding address already exists for this business. Delete it before generating a new one."},
                status=status.HTTP_409_CONFLICT,
            )

        if integration.forwarding_address:
            return Response(
                {
                    "forwarding_address": integration.forwarding_address,
                    "email_address": integration.email_address,
                    "connection_status": integration.connection_status,
                }
            )

        alias = self._generate_forwarding_alias(integration)
        metadata = integration.provider_metadata or {}
        webhook_meta = metadata.get("webhook") or {}
        # Optional shared secret per integration to validate callbacks
        webhook_meta.setdefault("secret", secrets.token_hex(16))
        metadata["webhook"] = webhook_meta

        integration.forwarding_address = alias
        integration.email_address = alias
        integration.connection_status = MailIntegration.ConnectionStatus.CONNECTING
        integration.connection_status_detail = "Awaiting forwarded test email."
        integration.is_active = False
        integration.last_error_at = None
        integration.last_error_message = ""
        integration.provider_metadata = metadata
        integration.save(
            update_fields=[
                "forwarding_address",
                "email_address",
                "connection_status",
                "connection_status_detail",
                "is_active",
                "last_error_at",
                "last_error_message",
                "provider_metadata",
            ]
        )
        log_audit_event(
            request,
            event_type="MAILBOX_UPDATED",
            entity_type="mailbox",
            entity=integration,
            activity=f"{actor_name(request.user)} generated forwarding alias '{alias}'",
            metadata={"provider": integration.provider, "connection_status": integration.connection_status},
        )

        instructions = [
            f"Point your mailbox forwarding to {alias}.",
            "Send a test email to verify delivery. Status will update on first success.",
        ]

        return Response(
            {
                "forwarding_address": alias,
                "email_address": alias,
                "connection_status": integration.connection_status,
                "instructions": instructions,
                "webhook_secret": webhook_meta.get("secret"),
            },
            status=status.HTTP_201_CREATED,
        )
