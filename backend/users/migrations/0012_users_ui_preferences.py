from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0011_add_idle_logout_settings'),
    ]

    operations = [
        migrations.AddField(
            model_name='users',
            name='ui_preferences',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
