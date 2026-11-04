from __future__ import annotations

from tenant.services.exports import (
    audit_direct_export,
    build_export_file,
    export_file_response,
    export_job_payload,
    is_admin_user,
    normalize_export_format,
    queue_export_job,
    should_queue_export,
)
from tenant.services.reports import (
    build_selected_ticket_export_dataset,
    selected_ticket_export_row_count,
)
from tenant.services.tickets.errors import TicketActionError


def export_tickets(*, request):
    """Export selected tickets to CSV, Excel, or JSON format.

    Returns a ready-made DRF/HTTP response object (a file download or a
    202-accepted job payload), matching the original view's behavior of
    constructing the Response directly rather than a plain result dict.
    May raise ValueError, which the view translates the same way it always
    did.
    """
    if not is_admin_user(request.user):
        raise TicketActionError({"detail": "You do not have permission to export tickets."}, 403)

    ticket_ids = request.data.get('ticket_ids', [])
    if not ticket_ids:
        raise TicketActionError({"error": "No tickets selected for export"}, 400)

    export_format = normalize_export_format(request.data.get("format", "xlsx"), allow_pdf=False)
    ticket_ids = [int(ticket_id) for ticket_id in ticket_ids]
    row_count = selected_ticket_export_row_count(request.user, ticket_ids)
    if should_queue_export(row_count):
        job = queue_export_job(
            user=request.user,
            export_type="selected_tickets",
            export_format=export_format,
            params={"selected_count": len(ticket_ids)},
            selected_ids=ticket_ids,
            row_count=row_count,
            request=request,
        )
        from rest_framework.response import Response
        from rest_framework import status
        response = Response(export_job_payload(job), status=status.HTTP_202_ACCEPTED)
    else:
        dataset = build_selected_ticket_export_dataset(request.user, ticket_ids)
        response = export_file_response(build_export_file(dataset, export_format))
        audit_direct_export(
            request,
            export_type="selected_tickets",
            export_format=export_format,
            row_count=row_count,
            params={"selected_count": len(ticket_ids)},
        )

    return response
