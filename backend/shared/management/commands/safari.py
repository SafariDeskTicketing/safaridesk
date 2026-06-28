from django.core.management.base import BaseCommand
from django.core.management import call_command
from tenant.models import EmailConfig, EmailTemplateCategory
from users.models import Business


class Command(BaseCommand):
    help = 'Initialize Safari Desk core setup'

    def handle(self, *args, **kwargs):
        self.stdout.write("Initializing safari desk core...")
        self.seed_email_config()
        call_command('datasync')
        self.stdout.write("Setup complete")

    def seed_email_config(self):
        businesses = Business.objects.all()
        for business in businesses:
            category = EmailTemplateCategory.objects.filter(name="Default Email Templates", business=business).first()
            if category:
                config, created = EmailConfig.objects.get_or_create(
                    business=business,
                    defaults={
                        'default_template': category,
                        'email_fetching': True
                    }
                )
                if created:
                    self.stdout.write(self.style.SUCCESS(f"Email config created for {business.name}"))
