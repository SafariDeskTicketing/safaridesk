from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tenant', '0046_add_telegram_whatsapp_sources'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmailFilterList',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('rules', models.JSONField(default=list)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('business', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='email_filter_list',
                    to='users.business',
                )),
            ],
            options={
                'verbose_name': 'Email Filter List',
                'db_table': 'email_filter_lists',
            },
        ),
        migrations.CreateModel(
            name='EmailFilterLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sender', models.CharField(db_index=True, max_length=320)),
                ('subject', models.CharField(blank=True, max_length=500)),
                ('rule_matched', models.CharField(max_length=500)),
                ('rule_tier', models.CharField(max_length=20)),
                ('blocked_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('business', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='email_filter_logs',
                    to='users.business',
                )),
            ],
            options={
                'verbose_name': 'Email Filter Log',
                'verbose_name_plural': 'Email Filter Logs',
                'db_table': 'email_filter_logs',
                'ordering': ['-blocked_at'],
            },
        ),
        migrations.AddIndex(
            model_name='emailfilterlog',
            index=models.Index(fields=['business', 'blocked_at'], name='filter_log_biz_time_idx'),
        ),
    ]
