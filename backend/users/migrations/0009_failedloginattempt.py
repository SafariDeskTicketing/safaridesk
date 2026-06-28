from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_users_onboarding_skipped'),
    ]

    operations = [
        migrations.CreateModel(
            name='FailedLoginAttempt',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(db_index=True, max_length=254)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('reason', models.CharField(
                    choices=[
                        ('wrong_password', 'Wrong Password'),
                        ('account_not_found', 'Account Not Found'),
                        ('account_disabled', 'Account Disabled'),
                        ('otp_expired', 'OTP Expired'),
                        ('mfa_failed', 'MFA Failed'),
                        ('unknown', 'Unknown'),
                    ],
                    default='unknown',
                    max_length=30,
                )),
                ('attempted_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('business', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='failed_login_attempts',
                    to='users.business',
                )),
            ],
            options={
                'ordering': ['-attempted_at'],
                'indexes': [
                    models.Index(fields=['-attempted_at'], name='users_faile_attempt_desc_idx'),
                    models.Index(fields=['ip_address'], name='users_faile_ip_idx'),
                    models.Index(fields=['email'], name='users_faile_email_idx'),
                ],
            },
        ),
    ]
