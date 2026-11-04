from __future__ import annotations

import logging
from typing import Any, Dict, List

from tenant.models import Ticket
from tenant.services.tickets.errors import TicketActionError

logger = logging.getLogger(__name__)


def bulk_archive(*, ticket_ids: List[Any]) -> Dict[str, Any]:
    """Archive selected tickets"""
    if not ticket_ids:
        raise TicketActionError({"error": "No tickets selected for archiving"}, 400)

    updated_count = Ticket.objects.for_business().filter(id__in=ticket_ids).update(is_archived=True)

    return {
        "message": f"Successfully archived {updated_count} tickets",
        "archived_count": updated_count,
    }


def bulk_delete(*, ticket_ids: List[Any]) -> Dict[str, Any]:
    """Soft delete selected tickets"""
    if not ticket_ids:
        raise TicketActionError({"error": "No tickets selected for deletion"}, 400)

    updated_count = Ticket.objects.for_business().filter(id__in=ticket_ids).update(is_deleted=True)

    return {
        "message": f"Successfully deleted {updated_count} tickets",
        "deleted_count": updated_count,
    }


def bulk_unarchive(*, ticket_ids: List[Any]) -> Dict[str, Any]:
    """Unarchive selected tickets"""
    if not ticket_ids:
        raise TicketActionError({"error": "No tickets selected for unarchiving"}, 400)

    updated_count = Ticket.objects.for_business().filter(id__in=ticket_ids).update(is_archived=False)

    return {
        "message": f"Successfully unarchived {updated_count} tickets",
        "unarchived_count": updated_count,
    }


def bulk_restore(*, ticket_ids: List[Any]) -> Dict[str, Any]:
    """Restore selected tickets from trash"""
    if not ticket_ids:
        raise TicketActionError({"error": "No tickets selected for restoration"}, 400)

    updated_count = Ticket.objects.for_business().filter(id__in=ticket_ids).update(is_deleted=False)

    return {
        "message": f"Successfully restored {updated_count} tickets",
        "restored_count": updated_count,
    }


def bulk_permanent_delete(*, ticket_ids: List[Any], business_id) -> Dict[str, Any]:
    """Permanently delete tickets from trash (hard delete)"""
    if not ticket_ids:
        raise TicketActionError({"error": "No tickets selected for permanent deletion"}, 400)

    tickets_to_delete = Ticket.objects.for_business().filter(
        id__in=ticket_ids,
        is_deleted=True
    )
    deleted_count = tickets_to_delete.count()
    tickets_to_delete.delete()
    logger.info("bulk_permanent_delete: removed %s tickets for business %s", deleted_count, business_id)

    return {
        "message": f"Permanently deleted {deleted_count} tickets",
        "deleted_count": deleted_count,
    }
