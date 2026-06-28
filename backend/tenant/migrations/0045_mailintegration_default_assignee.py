from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tenant", "0044_update_task_config_default_format"),
        ("users", "0004_alter_users_mfa_method"),
    ]

    operations = [
        migrations.AddField(
            model_name="mailintegration",
            name="default_assignee",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="mail_integration_defaults",
                to="users.users",
            ),
        ),
    ]
