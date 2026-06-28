from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0012_users_ui_preferences'),
    ]

    operations = [
        migrations.AddField(
            model_name='business',
            name='color_theme',
            field=models.CharField(
                choices=[
                    ('default', 'Default'),
                    ('indigo', 'Indigo'),
                    ('microsoft', 'Microsoft'),
                    ('forest', 'Forest'),
                    ('red', 'Red'),
                    ('gray', 'Gray'),
                ],
                default='default',
                help_text='Brand accent color theme for all users on this domain',
                max_length=20,
            ),
        ),
    ]
