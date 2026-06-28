from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenant', '0025_convert_ticket_statuses'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='is_opened',
            field=models.BooleanField(default=False, help_text='True once any agent has viewed this ticket'),
        ),
        migrations.AddField(
            model_name='ticket',
            name='has_new_reply',
            field=models.BooleanField(default=False, help_text='True when customer reply received; cleared on view'),
        ),
    ]
