from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from tenant.services.reports import (
    build_agent_report,
    build_task_report,
    build_ticket_report,
    export_agent_report,
    export_task_report,
    export_ticket_report,
    report_export_row_count,
)
from tenant.services.exports import (
    audit_direct_export,
    export_job_payload,
    is_admin_user,
    normalize_export_format,
    queue_export_job,
    should_queue_export,
)


class ReportsViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def tickets(self, request):
        denial = self._ensure_admin(request)
        if denial:
            return denial
        return Response(build_ticket_report(request.user, request.GET))

    def tasks(self, request):
        denial = self._ensure_admin(request)
        if denial:
            return denial
        return Response(build_task_report(request.user, request.GET))

    def agents(self, request):
        denial = self._ensure_admin(request)
        if denial:
            return denial
        return Response(build_agent_report(request.user, request.GET))

    def export_tickets(self, request):
        denial = self._ensure_admin(request)
        if denial:
            return denial
        try:
            response = self._export_or_queue(request, "tickets", export_ticket_report)
            return response
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    def export_tasks(self, request):
        denial = self._ensure_admin(request)
        if denial:
            return denial
        try:
            response = self._export_or_queue(request, "tasks", export_task_report)
            return response
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    def export_agents(self, request):
        denial = self._ensure_admin(request)
        if denial:
            return denial
        try:
            response = self._export_or_queue(request, "agents", export_agent_report)
            return response
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    def _export_or_queue(self, request, report_type: str, exporter):
        export_format = normalize_export_format(request.GET.get("format", "csv"))
        row_count = report_export_row_count(request.user, report_type, request.GET)
        if export_format == "pdf" and row_count > 200:
            raise ValueError("PDF export is limited to 200 rows. Narrow the report filters or use CSV.")
        if should_queue_export(row_count):
            job = queue_export_job(
                user=request.user,
                export_type=report_type,
                export_format=export_format,
                params=request.GET.dict(),
                row_count=row_count,
                request=request,
            )
            return Response(export_job_payload(job), status=status.HTTP_202_ACCEPTED)
        response = exporter(request.user, request.GET, export_format)
        audit_direct_export(
            request,
            export_type=report_type,
            export_format=export_format,
            row_count=row_count,
            params=request.GET.dict(),
        )
        return response

    def _ensure_admin(self, request):
        if not is_admin_user(request.user):
            return Response({"detail": "You do not have permission to access reports."}, status=status.HTTP_403_FORBIDDEN)
        return None
