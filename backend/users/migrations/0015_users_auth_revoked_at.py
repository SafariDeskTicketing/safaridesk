from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0014_customer_magic_link_token"),
    ]

    operations = [
        migrations.AddField(
            model_name="users",
            name="auth_revoked_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
