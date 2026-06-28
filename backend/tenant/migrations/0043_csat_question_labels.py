# Generated manually because local makemigrations is blocked by an unrelated import error.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenant', '0042_csat_survey_dispatch'),
    ]

    operations = [
        migrations.AddField(
            model_name='csatconfiguration',
            name='star_label',
            field=models.CharField(default='How would you rate your experience?', max_length=255),
        ),
        migrations.AddField(
            model_name='csatconfiguration',
            name='emotion_label',
            field=models.CharField(default='How did our team make you feel?', max_length=255),
        ),
        migrations.AddField(
            model_name='csatconfiguration',
            name='comment_label',
            field=models.CharField(default='Tell us more (optional)', max_length=255),
        ),
    ]
