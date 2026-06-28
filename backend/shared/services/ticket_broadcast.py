import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def _broadcast(business_id: int, event_type: str, payload: dict, log_name: str):
    try:
        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        async_to_sync(channel_layer.group_send)(
            f'business_notifications_{business_id}',
            {
                "type": "business_broadcast",
                "data": {
                    "type": event_type,
                    **payload,
                },
            }
        )
    except Exception as e:
        logger.warning(log_name, extra={"business_id": business_id, "error": str(e)})


def broadcast_ticket_event(business_id: int, payload: dict):
    """Broadcast a ticket_event to all agents in the business WebSocket group."""
    _broadcast(business_id, "ticket_event", payload, "ticket_broadcast_failed")


def broadcast_task_event(business_id: int, payload: dict):
    """Broadcast a task_event to all agents in the business WebSocket group."""
    _broadcast(business_id, "task_event", payload, "task_broadcast_failed")


def broadcast_contact_event(business_id: int, payload: dict):
    """Broadcast a contact_event to all agents in the business WebSocket group."""
    _broadcast(business_id, "contact_event", payload, "contact_broadcast_failed")


def broadcast_request_event(business_id: int, payload: dict):
    """Broadcast a request_event to all agents in the business WebSocket group."""
    _broadcast(business_id, "request_event", payload, "request_broadcast_failed")
