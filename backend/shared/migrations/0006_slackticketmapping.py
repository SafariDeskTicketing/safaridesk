# Generated migration for SlackTicketMapping model
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('shared', '0005_twilio_sms_message'),
        ('tenant', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='SlackTicketMapping',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_active', models.BooleanField(default=True)),
                ('slack_channel_id', models.CharField(max_length=50)),
                ('slack_thread_ts', models.CharField(max_length=50)),
                ('slack_message_ts', models.CharField(max_length=50)),
                ('slack_team_id', models.CharField(max_length=50)),
                ('created_by_event', models.BooleanField(default=True)),
                ('ticket', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='slack_mapping', to='tenant.ticket')),
            ],
            options={
                'db_table': 'slack_ticket_mappings',
                'verbose_name': 'Slack Ticket Mapping',
                'verbose_name_plural': 'Slack Ticket Mappings',
                'constraints': [
                    models.UniqueConstraint(fields=['slack_channel_id', 'slack_thread_ts'], name='unique_slack_thread'),
                ],
            },
        ),
    ]