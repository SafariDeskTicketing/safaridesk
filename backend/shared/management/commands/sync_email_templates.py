# management/commands/sync_email_templates.py
"""
Management command to sync email templates from templates.py to the database.
Uses BusinessSetup.seed_default_email_templates() which now uses update_or_create.
"""
from django.core.management.base import BaseCommand
from users.models import Business
from util.BusinessSetup import BusinessSetup


class Command(BaseCommand):
    help = 'Sync email templates from templates.py to the database for all businesses'

    def add_arguments(self, parser):
        parser.add_argument(
            '--business',
            type=int,
            help='Sync templates for specific business ID only',
        )

    def handle(self, *args, **options):
        business_filter = options.get('business')

        if business_filter:
            businesses = Business.objects.filter(id=business_filter, is_active=True)
            if not businesses.exists():
                self.stdout.write(self.style.ERROR(f'Business with ID {business_filter} not found'))
                return
        else:
            businesses = Business.objects.filter(is_active=True)

        from util.email.templates import EMAIL_TEMPLATES
        from tenant.models.SettingModel import EmailTemplate

        self.stdout.write(f'Syncing email templates for {businesses.count()} business(es)...')

        for business in businesses:
            self.stdout.write(f'  Syncing templates for: {business.name}')
            setup = BusinessSetup(business, business.owner)
            setup.seed_default_email_templates()

            # Remove templates that are no longer in EMAIL_TEMPLATES
            deleted, _ = EmailTemplate.objects.filter(
                business=business
            ).exclude(name__in=EMAIL_TEMPLATES.keys()).delete()
            if deleted:
                self.stdout.write(f'    Removed {deleted} stale template(s)')

        self.stdout.write(self.style.SUCCESS('✅ Email templates synced successfully!'))
