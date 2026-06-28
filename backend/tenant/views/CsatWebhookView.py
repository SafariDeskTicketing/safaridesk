from __future__ import annotations

import logging

from decouple import config
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from tenant.models import Ticket
from tenant.services.csat import apply_csat_score, create_external_dispatch_record, get_or_create_csat_config

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name="dispatch")
class CsatWebhookView(APIView):
    """
    Unauthenticated POST endpoint that receives CSAT survey submission webhooks
    from the SafariDesk Survey platform.

    Expected payload:
    {
        "survey_id": 3,
        "csat_value": 8,
        "metadata": { "ticket_id": "TKT-1024", "agent_id": "7" },
        "answers": [...]
    }

    Authentication: The CSAT Survey platform sends an `Authorization: Bearer <secret>` header.
    We validate this against the `CSAT_WEBHOOK_SECRET` environment variable.
    """

    permission_classes = [AllowAny]
    authentication_classes = []  # Skip JWT auth — we do our own secret validation below

    def post(self, request, *args, **kwargs) -> Response:
        # Validate the webhook secret
        webhook_secret = config("CSAT_WEBHOOK_SECRET", default="")
        if webhook_secret:
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer ") or auth_header[7:] != webhook_secret:
                logger.warning("[CSAT Webhook] Invalid or missing Authorization header.")
                return Response({"detail": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        data = request.data
        csat_value = data.get("csat_value")
        metadata = data.get("metadata", {})
        ticket_id = metadata.get("ticket_id")

        if csat_value is None:
            logger.warning("[CSAT Webhook] Received payload with no csat_value.")
            return Response({"detail": "csat_value is required"}, status=status.HTTP_400_BAD_REQUEST)

        if not ticket_id:
            logger.warning("[CSAT Webhook] Received payload with no ticket_id in metadata.")
            return Response({"detail": "metadata.ticket_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Validate score is in expected range (0–10)
        try:
            csat_value = int(csat_value)
            if not (0 <= csat_value <= 10):
                raise ValueError("Out of range")
        except (ValueError, TypeError):
            return Response({"detail": "csat_value must be an integer between 0 and 10"}, status=status.HTTP_400_BAD_REQUEST)

        # Find ticket and apply coexistence policy
        ticket = Ticket.objects.select_related('business').filter(ticket_id=ticket_id).first()
        if not ticket:
            logger.warning("[CSAT Webhook] No ticket found with ticket_id=%s", ticket_id)
            return Response({"detail": f"Ticket '{ticket_id}' not found"}, status=status.HTTP_404_NOT_FOUND)

        csat_config = get_or_create_csat_config(ticket)
        if csat_config.mode == csat_config.MODE_INTERNAL_ONLY or not csat_config.external_enabled:
            logger.info(
                "[CSAT Webhook] Ignored external CSAT for ticket_id=%s due to mode=%s external_enabled=%s",
                ticket.ticket_id,
                csat_config.mode,
                csat_config.external_enabled,
            )
            return Response(
                {"detail": "External CSAT ignored by configuration"},
                status=status.HTTP_202_ACCEPTED,
            )

        create_external_dispatch_record(
            ticket=ticket,
            normalized_score=csat_value,
            raw_payload=dict(data) if hasattr(data, 'items') else {},
        )
        apply_result = apply_csat_score(
            ticket=ticket,
            provider='external',
            normalized_score=csat_value,
        )

        logger.info(
            "[CSAT Webhook] Processed ticket_id=%s score=%s applied=%s reason=%s",
            ticket.ticket_id,
            csat_value,
            apply_result.applied,
            apply_result.reason,
        )
        return Response(
            {
                "detail": "CSAT webhook processed successfully",
                "applied": apply_result.applied,
                "reason": apply_result.reason,
            },
            status=status.HTTP_200_OK,
        )
