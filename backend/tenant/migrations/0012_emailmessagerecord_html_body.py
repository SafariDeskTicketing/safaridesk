from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tenant", "0011_merge_20251121_1634"),
    ]

    operations = [
        migrations.AddField(
            model_name="emailmessagerecord",
            name="html_body",
            field=models.TextField(blank=True, default=""),
            preserve_default=False,
        ),
    ]
