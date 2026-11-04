import logging

from rest_framework.permissions import BasePermission

from shared.services.TwilioService import TwilioService

logger = logging.getLogger(__name__)


class HasValidTwilioSignature(BasePermission):
    """
    Validates the X-Twilio-Signature header against the request body.

    Twilio webhooks (status callbacks, inbound SMS/WhatsApp) are AllowAny by
    necessity — Twilio itself calls in with no session/JWT — so this is the
    only thing standing between the endpoint and anyone who can POST to it.
    Add to a view's permission_classes instead of checking inline; one place
    to get this right instead of four copies that can individually rot.
    """

    message = "Invalid Twilio webhook signature."

    def has_permission(self, request, view) -> bool:
        signature = request.headers.get("X-Twilio-Signature", "")
        request_url = request.build_absolute_uri()
        is_valid = TwilioService.validate_webhook_signature(
            request_url, request.POST.dict(), signature
        )
        if not is_valid:
            logger.warning("Invalid Twilio webhook signature for %s", request_url)
        return is_valid
