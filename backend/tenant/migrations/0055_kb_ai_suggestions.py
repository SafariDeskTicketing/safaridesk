# Generated migration for KBAISuggestion model.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenant", "0054_copilot_status_lifecycle"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="KBAISuggestion",
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
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("new_article", "New article"),
                            ("update_article", "Update existing article"),
                        ],
                        db_index=True,
                        default="new_article",
                        max_length=24,
                    ),
                ),
                (
                    "review_status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending review"),
                            ("approved", "Approved"),
                            ("rejected", "Rejected"),
                            ("superseded", "Superseded"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=16,
                    ),
                ),
                (
                    "source_kind",
                    models.CharField(
                        choices=[
                            ("ticket", "Ticket"),
                            ("task", "Task"),
                            ("mixed", "Mixed"),
                        ],
                        db_index=True,
                        default="ticket",
                        max_length=16,
                    ),
                ),
                ("proposed_title", models.CharField(blank=True, max_length=500)),
                ("proposed_slug", models.SlugField(blank=True, max_length=520)),
                ("proposed_content", models.TextField(blank=True)),
                ("proposed_excerpt", models.TextField(blank=True)),
                ("proposed_tags", models.JSONField(blank=True, default=list)),
                ("current_version", models.PositiveIntegerField(blank=True, null=True)),
                ("proposed_version", models.PositiveIntegerField(default=1)),
                ("confidence", models.FloatField(blank=True, db_index=True, null=True)),
                ("source_count", models.PositiveIntegerField(default=0)),
                (
                    "source_refs",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="List of {kind, id, title} dicts pointing at source tickets/tasks.",
                    ),
                ),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "review_reason",
                    models.TextField(blank=True, help_text="Why it was rejected / notes"),
                ),
                ("model_name", models.CharField(blank=True, max_length=80)),
                ("input_tokens", models.PositiveIntegerField(default=0)),
                ("output_tokens", models.PositiveIntegerField(default=0)),
                ("prompt_version", models.CharField(blank=True, max_length=24)),
                ("metadata", models.JSONField(blank=True, default=dict)),
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
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="updated_%(class)s_objects",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "reviewed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="reviewed_kb_suggestions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "suggested_category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="ai_suggestions",
                        to="tenant.kbcategory",
                    ),
                ),
                (
                    "target_article",
                    models.ForeignKey(
                        blank=True,
                        db_index=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ai_suggestions",
                        to="tenant.kbarticle",
                    ),
                ),
            ],
            options={
                "db_table": "kb_ai_suggestions",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["review_status", "kind"],
                        name="kb_ai_suggestions_rev_kind_idx",
                    ),
                    models.Index(
                        fields=["target_article", "review_status"],
                        name="kb_ai_suggestions_tgt_rev_idx",
                    ),
                    models.Index(
                        fields=["confidence"],
                        name="kb_ai_suggestions_conf_idx",
                    ),
                ],
            },
        ),
    ]
