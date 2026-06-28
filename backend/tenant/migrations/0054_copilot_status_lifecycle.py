from django.db import migrations, models


def migrate_confirmed_statuses(apps, schema_editor):
    CopilotSuggestion = apps.get_model("tenant", "CopilotSuggestion")
    CopilotSuggestion.objects.filter(status="confirmed", suggestion_type="suggested_action").update(status="executed")
    CopilotSuggestion.objects.filter(status="confirmed").exclude(suggestion_type="suggested_action").update(status="approved")


class Migration(migrations.Migration):

    dependencies = [
        ("tenant", "0053_alter_copilotsuggestion_status"),
    ]

    operations = [
        migrations.AlterField(
            model_name="copilotsuggestion",
            name="status",
            field=models.CharField(
                choices=[
                    ("queued", "Queued"),
                    ("pending_review", "Pending Review"),
                    ("approved", "Approved"),
                    ("executed", "Executed"),
                    ("rejected", "Rejected"),
                    ("failed", "Failed"),
                ],
                db_index=True,
                default="pending_review",
                max_length=24,
            ),
        ),
        migrations.RunPython(migrate_confirmed_statuses, migrations.RunPython.noop),
    ]
