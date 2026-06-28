from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0015_users_auth_revoked_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="users",
            name="auth_session_version",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
