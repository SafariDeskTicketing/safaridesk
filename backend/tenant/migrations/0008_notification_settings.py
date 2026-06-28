from django.db import migrations, models
import django.db.models.deletion


def notification_channel_defaults():
    """Default notification delivery channels"""
    return {
        'email': True,
        'in_app': True,
        'push': False,
        'sms': False,
        'webhook': False
    }


def default_notification_matrix():
    """Default notification matrix for different event types"""
    return {
        'ticket_assigned': {'agent': True, 'customer': False, 'watchers': True},
        'ticket_status_changed': {'agent': True, 'customer': True, 'watchers': True},
        'ticket_comment': {'agent': True, 'customer': True, 'watchers': True},
        'ticket_mention': {'agent': True, 'customer': False, 'watchers': False},
        'sla_breach': {'agent': True, 'customer': False, 'watchers': True},
        'ticket_escalated': {'agent': True, 'customer': False, 'watchers': True},
        'ticket_reopened': {'agent': True, 'customer': True, 'watchers': True},
        'task_assigned': {'agent': True, 'customer': False, 'watchers': False},
        'task_status_changed': {'agent': True, 'customer': False, 'watchers': True},
        'task_comment': {'agent': True, 'customer': False, 'watchers': True},
        'task_mention': {'agent': True, 'customer': False, 'watchers': False},
    }


def default_quiet_hours():
    """Default quiet hours (no notifications during this time)"""
    return {
        'enabled': False,
        'start_time': '22:00',
        'end_time': '08:00',
        'timezone': 'UTC'
    }


def default_escalation_policy():
    """Default escalation policy"""
    return {
        'enabled': False,
        'levels': []
    }


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
        ('tenant', '0007_kb_embedding_vector'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrganizationNotificationSetting',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('delivery_channels', models.JSONField(blank=True, default=notification_channel_defaults)),
                ('notification_matrix', models.JSONField(blank=True, default=default_notification_matrix)),
                ('digest_enabled', models.BooleanField(default=True)),
                ('digest_frequency', models.CharField(choices=[('daily', 'Daily'), ('weekly', 'Weekly'), ('off', 'Off')], default='daily', max_length=20)),
                ('escalation_policy', models.JSONField(blank=True, default=default_escalation_policy)),
                ('webhook_url', models.URLField(blank=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('business', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='notification_settings', to='users.business')),
            ],
            options={
                'verbose_name': 'Organization Notification Setting',
                'db_table': 'notification_settings',
            },
        ),
        migrations.CreateModel(
            name='UserNotificationPreference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('delivery_channels', models.JSONField(blank=True, default=notification_channel_defaults)),
                ('notification_matrix', models.JSONField(blank=True, default=default_notification_matrix)),
                ('quiet_hours', models.JSONField(blank=True, default=default_quiet_hours)),
                ('mute_until', models.DateTimeField(blank=True, null=True)),
                ('browser_push_enabled', models.BooleanField(default=False)),
                ('email_digest_enabled', models.BooleanField(default=True)),
                ('digest_frequency', models.CharField(choices=[('daily', 'Daily'), ('weekly', 'Weekly'), ('off', 'Off')], default='daily', max_length=20)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('business', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='user_notification_preferences', to='users.business')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='notification_preferences', to='users.users')),
            ],
            options={
                'verbose_name': 'User Notification Preference',
                'db_table': 'notification_preferences',
            },
        ),
    ]
