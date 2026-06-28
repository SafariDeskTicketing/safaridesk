# Generated manually because local makemigrations is blocked by an unrelated import error.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenant', '0040_alter_ticket_category_set_null'),
        ('users', '0002_customdomains_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CsatConfiguration',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('A', 'ACTIVE'), ('I', 'INACTIVE'), ('S', 'Suspended'), ('D', 'DEACTIVATED'), ('L', 'LOCKED'), ('B', 'BLOCKED')], default='A', max_length=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now_add=True)),
                ('date_updated', models.DateTimeField(auto_now=True)),
                ('enabled', models.BooleanField(default=True)),
                ('is_paused', models.BooleanField(default=False)),
                ('mode', models.CharField(choices=[('internal_only', 'Internal Only'), ('external_only', 'External Only'), ('hybrid', 'Hybrid')], default='hybrid', max_length=20)),
                ('dispatch_strategy', models.CharField(choices=[('single_provider_per_ticket', 'Single Provider Per Ticket'), ('dual_send_shadow', 'Dual Send Shadow')], default='single_provider_per_ticket', max_length=40)),
                ('default_provider', models.CharField(choices=[('internal', 'Internal'), ('external', 'External')], default='external', max_length=10)),
                ('fallback_provider', models.CharField(choices=[('none', 'None'), ('internal', 'Internal'), ('external', 'External')], default='none', max_length=10)),
                ('send_on_status', models.JSONField(default=list)),
                ('send_delay_minutes', models.PositiveIntegerField(default=10)),
                ('star_rating_enabled', models.BooleanField(default=True)),
                ('emotion_enabled', models.BooleanField(default=True)),
                ('comment_enabled', models.BooleanField(default=True)),
                ('star_required', models.BooleanField(default=True)),
                ('emotion_required', models.BooleanField(default=False)),
                ('comment_required', models.BooleanField(default=False)),
                ('comment_min_length', models.PositiveIntegerField(default=0)),
                ('comment_max_length', models.PositiveIntegerField(default=2000)),
                ('survey_title', models.CharField(default='How did we do?', max_length=255)),
                ('intro_text', models.TextField(default='Please rate your support experience and share any feedback.')),
                ('thank_you_title', models.CharField(default='Thank you for your feedback', max_length=255)),
                ('thank_you_message', models.TextField(default='We appreciate your time.')),
                ('link_expiry_hours', models.PositiveIntegerField(default=336)),
                ('allow_multiple_submissions', models.BooleanField(default=False)),
                ('external_enabled', models.BooleanField(default=True)),
                ('provider_name', models.CharField(blank=True, default='', max_length=120)),
                ('external_survey_base_url', models.URLField(blank=True, default='')),
                ('webhook_auth_mode', models.CharField(choices=[('bearer_secret', 'Bearer Secret'), ('hmac', 'HMAC'), ('none', 'None')], default='bearer_secret', max_length=20)),
                ('webhook_secret', models.CharField(blank=True, default='', max_length=255)),
                ('webhook_timeout_seconds', models.PositiveIntegerField(default=10)),
                ('official_result_policy', models.CharField(choices=[('first_valid', 'First Valid'), ('preferred_provider', 'Preferred Provider'), ('latest_valid', 'Latest Valid')], default='first_valid', max_length=30)),
                ('positive_min', models.PositiveIntegerField(default=8)),
                ('neutral_min', models.PositiveIntegerField(default=6)),
                ('business', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='users.business')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_%(class)s_objects', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_%(class)s_objects', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'CSAT Configuration',
                'verbose_name_plural': 'CSAT Configurations',
                'db_table': 'csat_configuration',
            },
        ),
    ]
