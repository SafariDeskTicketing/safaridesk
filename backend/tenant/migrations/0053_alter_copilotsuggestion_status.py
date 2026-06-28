from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenant", "0052_copilot_models"),
    ]

    operations = [
        migrations.AlterField(
            model_name="copilotsuggestion",
            name="status",
            field=models.CharField(
                choices=[
                    ("queued", "Queued"),
                    ("pending_review", "Pending Review"),
                    ("confirmed", "Confirmed"),
                    ("rejected", "Rejected"),
                    ("failed", "Failed"),
                ],
                db_index=True,
                default="pending_review",
                max_length=24,
            ),
        ),
    ]
