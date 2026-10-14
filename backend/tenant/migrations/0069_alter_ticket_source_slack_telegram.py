from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenant', '0068_ticketcalllog_and_copilot_call_log'),
    ]

    operations = [
        migrations.AlterField(
            model_name='ticket',
            name='source',
            field=models.CharField(choices=[('email', 'Email'), ('web', 'Web/Portal'), ('phone', 'Phone'), ('chat', 'Live Chat'), ('chatbot', 'AI Chatbot'), ('api', 'API/Integrations'), ('internal', 'Internal/Staff-created'), ('customer_portal', 'Customer Portal'), ('whatsapp', 'WhatsApp'), ('slack', 'Slack'), ('telegram', 'Telegram')], default='web', help_text='How the ticket was created', max_length=20),
        ),
    ]
