# Generated manually because local makemigrations is blocked by an unrelated import error.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenant', '0041_csat_configuration'),
        ('users', '0002_customdomains_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CsatSurveyDispatch',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('status', models.CharField(choices=[('A', 'ACTIVE'), ('I', 'INACTIVE'), ('S', 'Suspended'), ('D', 'DEACTIVATED'), ('L', 'LOCKED'), ('B', 'BLOCKED')], default='A', max_length=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now_add=True)),
                ('date_updated', models.DateTimeField(auto_now=True)),
                ('provider', models.CharField(choices=[('internal', 'Internal'), ('external', 'External')], default='internal', max_length=10)),
                ('trigger_status', models.CharField(default='closed', max_length=20)),
                ('recipient_email', models.EmailField(blank=True, default='', max_length=254)),
                ('token', models.CharField(db_index=True, max_length=64, unique=True)),
                ('survey_url', models.URLField(blank=True, default='')),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('responded_at', models.DateTimeField(blank=True, null=True)),
                ('star_rating', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('emotion', models.CharField(blank=True, choices=[('happy', 'Happy'), ('sad', 'Sad')], max_length=10, null=True)),
                ('comment', models.TextField(blank=True, default='')),
                ('normalized_score', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('raw_payload', models.JSONField(blank=True, default=dict)),
                ('is_active', models.BooleanField(default=True)),
                ('business', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='users.business')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_%(class)s_objects', to=settings.AUTH_USER_MODEL)),
                ('ticket', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='csat_dispatches', to='tenant.ticket')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_%(class)s_objects', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'CSAT Survey Dispatch',
                'verbose_name_plural': 'CSAT Survey Dispatches',
                'db_table': 'csat_survey_dispatch',
            },
        ),
    ]
