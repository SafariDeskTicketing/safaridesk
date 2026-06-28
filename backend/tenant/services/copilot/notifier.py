from __future__ import annotations

import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from shared.services.ticket_broadcast import broadcast_ticket_event
from tenant.serializers.CopilotSerializer import CopilotSuggestionSerializer


logger = logging.getLogger(__name__)


class CopilotNotifier:
    def broadcast_suggestion(self, suggestion, *, event: str, payload: dict[str, Any] | None = None) -> None:
        broadcast_ticket_event(
            suggestion.business_id,
            {
                "ticket_id": suggestion.ticket_id,
                "event": event,
                "copilot_suggestion_id": suggestion.id,
                "copilot_command": suggestion.command,
                **(payload or {}),
            },
        )
        self._broadcast_private_suggestion(suggestion=suggestion, event=event, payload=payload)

    def _broadcast_private_suggestion(
        self,
        *,
        suggestion,
        event: str,
        payload: dict[str, Any] | None = None,
    ) -> None:
        channel_layer = get_channel_layer()
        if not channel_layer:
            return

        serialized = CopilotSuggestionSerializer(suggestion).data
        group_name = f"notifications_{suggestion.business_id}_{suggestion.requested_by_id}"

        try:
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "business_broadcast",
                    "data": {
                        "type": "ticket_event",
                        "ticket_id": suggestion.ticket_id,
                        "event": event,
                        "copilot_suggestion_id": suggestion.id,
                        "copilot_command": suggestion.command,
                        "copilot_suggestion": serialized,
                        **(payload or {}),
                    },
                },
            )
        except Exception as exc:
            logger.warning(
                "copilot_private_broadcast_failed",
                extra={"suggestion_id": suggestion.id, "user_id": suggestion.requested_by_id, "error": str(exc)},
            )
