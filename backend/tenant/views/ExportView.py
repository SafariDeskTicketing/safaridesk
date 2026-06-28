from __future__ import annotations

import os

from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from tenant.models import ExportJob
from tenant.services.exports import audit_export_downloaded, export_job_payload, is_admin_user


class ExportJobDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int, *args, **kwargs):
        denial = self._ensure_admin(request)
        if denial:
            return denial
        job = self._get_job(request, pk)
        return Response(export_job_payload(job), status=status.HTTP_200_OK)

    def _ensure_admin(self, request):
        if not is_admin_user(request.user):
            return Response({"detail": "You do not have permission to access exports."}, status=status.HTTP_403_FORBIDDEN)
        return None

    def _get_job(self, request, pk: int) -> ExportJob:
        job = ExportJob.objects.for_business(request.user).filter(pk=pk).first()
        if not job:
            raise Http404("Export job not found")
        return job


class ExportJobDownloadView(ExportJobDetailView):
    def get(self, request, pk: int, *args, **kwargs):
        denial = self._ensure_admin(request)
        if denial:
            return denial
        job = self._get_job(request, pk)
        if job.job_status != ExportJob.STATUS_COMPLETED:
            return Response({"detail": "Export is not ready yet."}, status=status.HTTP_409_CONFLICT)
        if not job.file_path or not os.path.exists(job.file_path):
            raise Http404("Export file not found")

        audit_export_downloaded(request, job)
        response = FileResponse(open(job.file_path, "rb"), content_type=job.content_type or "application/octet-stream")
        response["Content-Disposition"] = f'attachment; filename="{job.filename}"'
        return response
