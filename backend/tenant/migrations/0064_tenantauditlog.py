from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tenant", "0063_mailintegration_provider_unique"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("users", "0017_users_mfa_method_db_default"),
    ]

    operations = [
        migrations.CreateModel(
            name="TenantAuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("actor_name", models.CharField(blank=True, max_length=255)),
                ("actor_email", models.EmailField(blank=True, max_length=254)),
                ("actor_avatar_url", models.URLField(blank=True, max_length=1000)),
                ("event_type", models.CharField(max_length=80)),
                ("entity_type", models.CharField(max_length=50)),
                ("entity_id", models.CharField(max_length=80)),
                ("entity_label", models.CharField(blank=True, max_length=255)),
                ("activity", models.TextField()),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("user_agent", models.CharField(blank=True, max_length=500)),
                ("request_path", models.CharField(blank=True, max_length=500)),
                ("request_method", models.CharField(blank=True, max_length=10)),
                ("timestamp", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="tenant_audit_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "business",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tenant_audit_logs",
                        to="users.business",
                    ),
                ),
            ],
            options={
                "db_table": "tenant_audit_logs",
                "ordering": ["-timestamp", "-id"],
                "indexes": [
                    models.Index(fields=["business", "-timestamp"], name="tenant_audit_biz_time_idx"),
                    models.Index(fields=["business", "event_type"], name="tenant_audit_biz_event_idx"),
                    models.Index(fields=["business", "entity_type"], name="tenant_audit_biz_entity_idx"),
                    models.Index(fields=["business", "actor"], name="tenant_audit_biz_actor_idx"),
                ],
            },
        ),
    ]
