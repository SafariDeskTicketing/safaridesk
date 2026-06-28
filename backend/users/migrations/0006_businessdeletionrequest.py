from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_accountdeletionrequest'),
    ]

    operations = [
        migrations.CreateModel(
            name='BusinessDeletionRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('business_name', models.CharField(max_length=255)),
                ('business_domain', models.CharField(blank=True, max_length=200)),
                ('reason', models.TextField(blank=True)),
                ('status', models.CharField(
                    choices=[('pending', 'Pending'), ('purged', 'Purged'), ('cancelled', 'Cancelled')],
                    default='pending',
                    max_length=20,
                )),
                ('grace_period_end', models.DateTimeField()),
                ('purged_at', models.DateTimeField(blank=True, null=True)),
                ('cancelled_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('business', models.OneToOneField(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='deletion_request',
                    to='users.business',
                )),
                ('cancelled_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='cancelled_business_deletions',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('requested_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='initiated_business_deletions',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'business_deletion_requests',
                'ordering': ['-created_at'],
            },
        ),
    ]
