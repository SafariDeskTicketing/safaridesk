from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0007_business_auth_backdrop_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='users',
            name='onboarding_skipped',
            field=models.BooleanField(default=False),
        ),
    ]
