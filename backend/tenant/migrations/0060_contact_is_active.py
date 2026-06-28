from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenant", "0059_rename_ai_usage_e_business_45ac47_idx_ai_usage_ev_busines_8293f9_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="contact",
            name="is_active",
            field=models.BooleanField(default=True, db_index=True),
        ),
    ]
