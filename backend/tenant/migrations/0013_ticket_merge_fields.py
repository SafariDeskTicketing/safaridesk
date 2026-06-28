from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
        ('tenant', '0012_emailmessagerecord_html_body'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticket',
            name='is_merged',
            field=models.BooleanField(default=False, help_text='Indicates if this ticket was merged into another ticket'),
        ),
        migrations.AddField(
            model_name='ticket',
            name='merge_note',
            field=models.TextField(blank=True, help_text='Optional note about the merge', null=True),
        ),
        migrations.AddField(
            model_name='ticket',
            name='merged_at',
            field=models.DateTimeField(blank=True, help_text='When the ticket was merged', null=True),
        ),
        migrations.AddField(
            model_name='ticket',
            name='merged_by',
            field=models.ForeignKey(blank=True, help_text='User who performed the merge', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='merged_tickets', to='users.users'),
        ),
        migrations.AddField(
            model_name='ticket',
            name='merged_into',
            field=models.ForeignKey(blank=True, help_text='Primary ticket this ticket was merged into', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='merged_children', to='tenant.ticket'),
        ),
    ]
