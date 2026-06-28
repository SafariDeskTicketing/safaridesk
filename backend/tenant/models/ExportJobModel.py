from __future__ import annotations

from django.conf import settings
from django.db import models

from shared.models.BaseModel import BaseEntity


class ExportJob(BaseEntity):
    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_RUNNING, "Running"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_FAILED, "Failed"),
    ]

    export_type = models.CharField(max_length=64, db_index=True)
    format = models.CharField(max_length=16)
    params = models.JSONField(default=dict, blank=True)
    selected_ids = models.JSONField(default=list, blank=True)
    row_count = models.PositiveIntegerField(default=0)
    job_status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    file_path = models.CharField(max_length=500, blank=True)
    filename = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=120, blank=True)
    error = models.TextField(blank=True)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="export_jobs",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "export_jobs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["business", "job_status"]),
            models.Index(fields=["requested_by", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.export_type} {self.format} export #{self.pk}"
