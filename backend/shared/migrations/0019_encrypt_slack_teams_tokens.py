from django.db import migrations, models

from util.security.encryption import encrypt_value


def encrypt_existing_tokens(apps, schema_editor):
    SlackIntegration = apps.get_model('shared', 'SlackIntegration')
    TeamsIntegration = apps.get_model('shared', 'TeamsIntegration')

    for integration in SlackIntegration.objects.all():
        raw = integration.access_token_encrypted
        if raw:
            integration.access_token_encrypted = encrypt_value(raw)
            integration.save(update_fields=['access_token_encrypted'])

    for integration in TeamsIntegration.objects.all():
        update_fields = []
        if integration.access_token_encrypted:
            integration.access_token_encrypted = encrypt_value(integration.access_token_encrypted)
            update_fields.append('access_token_encrypted')
        if integration.refresh_token_encrypted:
            integration.refresh_token_encrypted = encrypt_value(integration.refresh_token_encrypted)
            update_fields.append('refresh_token_encrypted')
        if update_fields:
            integration.save(update_fields=update_fields)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('shared', '0018_licensestatus'),
    ]

    operations = [
        migrations.RenameField(
            model_name='slackintegration',
            old_name='access_token',
            new_name='access_token_encrypted',
        ),
        migrations.AlterField(
            model_name='slackintegration',
            name='access_token_encrypted',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.RenameField(
            model_name='teamsintegration',
            old_name='access_token',
            new_name='access_token_encrypted',
        ),
        migrations.AlterField(
            model_name='teamsintegration',
            name='access_token_encrypted',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.RenameField(
            model_name='teamsintegration',
            old_name='refresh_token',
            new_name='refresh_token_encrypted',
        ),
        migrations.AlterField(
            model_name='teamsintegration',
            name='refresh_token_encrypted',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.RunPython(encrypt_existing_tokens, noop_reverse),
    ]
