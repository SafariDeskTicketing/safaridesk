from __future__ import annotations

from celery import shared_task
from django.utils import timezone

from tenant.models import ExportJob
from tenant.services.copilot.service import CopilotService
from tenant.services.exports import audit_export_completed, audit_export_failed, save_export_file_for_job


@shared_task(name="tenant.process_copilot_suggestion")
def process_copilot_suggestion(suggestion_id: int) -> int:
    service = CopilotService()
    suggestion = service.process_queued_suggestion(suggestion_id=suggestion_id)
    return suggestion.id if suggestion else suggestion_id


@shared_task(name="tenant.generate_export_job")
def generate_export_job(job_id: int) -> int:
    job = ExportJob.objects.select_related("business", "requested_by").get(pk=job_id)
    job.job_status = ExportJob.STATUS_RUNNING
    job.error = ""
    job.save(update_fields=["job_status", "error", "date_updated"])
    if not job.business_id:
        error = "Export job is missing business scope."
        job.job_status = ExportJob.STATUS_FAILED
        job.error = error
        job.save(update_fields=["job_status", "error", "date_updated"])
        audit_export_failed(job, error)
        return job.id

    try:
        export_file = save_export_file_for_job(job)
    except Exception as exc:
        job.job_status = ExportJob.STATUS_FAILED
        job.error = str(exc)
        job.save(update_fields=["job_status", "error", "date_updated"])
        audit_export_failed(job, str(exc))
        raise

    job.filename = export_file.filename
    job.content_type = export_file.content_type
    job.job_status = ExportJob.STATUS_COMPLETED
    job.completed_at = timezone.now()
    job.save(update_fields=["file_path", "filename", "content_type", "job_status", "completed_at", "date_updated"])
    audit_export_completed(job)
    return job.id
