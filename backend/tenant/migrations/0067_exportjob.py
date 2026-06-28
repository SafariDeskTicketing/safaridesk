# Generated manually for unified export jobs.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenant", "0066_alter_slaescalationnotificationlog_options_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("users", "0017_users_mfa_method_db_default"),
    ]

    operations = [
        migrations.CreateModel(
            name="ExportJob",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("A", "ACTIVE"),
                            ("I", "INACTIVE"),
                            ("S", "Suspended"),
                            ("D", "DEACTIVATED"),
                            ("L", "LOCKED"),
                            ("B", "BLOCKED"),
                        ],
                        default="A",
                        max_length=1,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now_add=True)),
                ("date_updated", models.DateTimeField(auto_now=True)),
                ("export_type", models.CharField(db_index=True, max_length=64)),
                ("format", models.CharField(max_length=16)),
                ("params", models.JSONField(blank=True, default=dict)),
                ("selected_ids", models.JSONField(blank=True, default=list)),
                ("row_count", models.PositiveIntegerField(default=0)),
                (
                    "job_status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("running", "Running"),
                            ("completed", "Completed"),
                            ("failed", "Failed"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=16,
                    ),
                ),
                ("file_path", models.CharField(blank=True, max_length=500)),
                ("filename", models.CharField(blank=True, max_length=255)),
                ("content_type", models.CharField(blank=True, max_length=120)),
                ("error", models.TextField(blank=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "business",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        to="users.business",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_%(class)s_objects",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "requested_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="export_jobs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="updated_%(class)s_objects",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "export_jobs",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["business", "job_status"], name="export_jobs_busines_5c4c18_idx"),
                    models.Index(fields=["requested_by", "created_at"], name="export_jobs_request_06194d_idx"),
                ],
            },
        ),
    ]
