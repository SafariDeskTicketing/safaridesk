from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenant', '0038_ensure_title_format_exists'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='csat_score',
            field=models.IntegerField(
                blank=True,
                null=True,
                help_text='Customer satisfaction score (0\u201310) from CSAT survey',
            ),
        ),
    ]
