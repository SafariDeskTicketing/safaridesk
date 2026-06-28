from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('shared', '0007_increase_from_number_length'),
        ('users', '0009_failedloginattempt'),
    ]

    operations = [
        migrations.CreateModel(
            name='AdminAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('action', models.CharField(max_length=50)),
                ('target_type', models.CharField(max_length=30)),
                ('target_id', models.IntegerField()),
                ('target_label', models.CharField(blank=True, max_length=255)),
                ('detail', models.JSONField(default=dict)),
                ('performed_at', models.DateTimeField(auto_now_add=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('admin_user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='audit_actions',
                    to='users.users',
                )),
            ],
            options={
                'db_table': 'admin_audit_logs',
                'ordering': ['-performed_at'],
                'indexes': [
                    models.Index(fields=['-performed_at'], name='audit_log_time_idx'),
                    models.Index(fields=['admin_user'], name='audit_log_admin_idx'),
                    models.Index(fields=['action'], name='audit_log_action_idx'),
                ],
            },
        ),
    ]
