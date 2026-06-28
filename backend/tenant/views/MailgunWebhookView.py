from __future__ import annotations

import logging

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from shared.tasks import process_mailgun_inbound
from tenant.models import MailIntegration
from util.mail.mailgun import verify_mailgun_signature

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name="dispatch")
class MailgunInboundWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        data = request.data
        timestamp = data.get("timestamp")
        token = data.get("token")
        signature = data.get("signature")

        if not verify_mailgun_signature(timestamp, token, signature):
            logger.warning(
                "mailgun_webhook_signature_invalid",
                extra={
                    "timestamp": timestamp,
                    "has_token": bool(token),
                    "has_signature": bool(signature),
                    "data_keys": list(data.keys()),
                },
            )
            return Response({"detail": "Invalid signature"}, status=status.HTTP_403_FORBIDDEN)

        recipient = data.get("recipient")
        # Mailgun sends Body-mime when the URL ends with "mime"; use either key just in case.
        raw_mime = data.get("body-mime") or data.get("Body-mime")
        if not recipient or not raw_mime:
            logger.warning("mailgun_webhook_missing_fields", extra={"recipient": recipient, "has_mime": bool(raw_mime)})
            return Response({"detail": "recipient and body-mime are required"}, status=status.HTTP_400_BAD_REQUEST)

        integration = MailIntegration.objects.filter(
            provider=MailIntegration.Provider.SAFARIDESK,
            forwarding_address__iexact=recipient,
        ).first() or MailIntegration.objects.filter(
            provider=MailIntegration.Provider.SAFARIDESK,
            email_address__iexact=recipient,
        ).first()

        if not integration:
            logger.warning("mailgun_webhook_integration_not_found", extra={"recipient": recipient})
            return Response({"detail": "No integration found"}, status=status.HTTP_200_OK)

        metadata = {
            "message_id": data.get("Message-Id") or data.get("message-id") or "",
            "from": data.get("from") or "",
            "subject": data.get("subject") or "",
            "recipient": recipient,
        }

        process_mailgun_inbound.delay(raw_mime, integration.id, metadata)
        return Response({"detail": "accepted"}, status=status.HTTP_200_OK)
