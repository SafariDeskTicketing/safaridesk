from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_businessdeletionrequest'),
    ]

    operations = [
        migrations.AddField(
            model_name='business',
            name='auth_backdrop_url',
            field=models.CharField(
                blank=True,
                null=True,
                max_length=255,
                help_text='URL to the business auth backdrop image',
            ),
        ),
    ]
