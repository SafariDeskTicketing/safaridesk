# management/commands/purge_request_templates.py
"""
Management command to delete all EmailTemplate records with type='request'
across all businesses.

Background: The Request Functionality was removed from SafariDesk. The email
templates for it were removed from templates.py (stopping new seeding), but
records already seeded in the database need to be cleaned up manually.

Usage:
    python manage.py purge_request_templates
    python manage.py purge_request_templates --business 5   # single business
    python manage.py purge_request_templates --dry-run      # preview only
"""
from django.core.management.base import BaseCommand
from tenant.models.SettingModel import EmailTemplate
from users.models import Business


class Command(BaseCommand):
    help = 'Delete all EmailTemplate records with type="request" (Request Functionality was removed)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--business',
            type=int,
            help='Purge request templates for a specific business ID only',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        business_filter = options.get('business')
        dry_run = options.get('dry_run')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no records will be deleted'))

        qs = EmailTemplate.objects.filter(type='request')

        if business_filter:
            business = Business.objects.filter(id=business_filter, is_active=True).first()
            if not business:
                self.stdout.write(self.style.ERROR(f'Business with ID {business_filter} not found'))
                return
            qs = qs.filter(business=business)
            self.stdout.write(f'Filtering to business: {business.name}')

        total = qs.count()

        if total == 0:
            self.stdout.write(self.style.SUCCESS('No request templates found — nothing to do.'))
            return

        self.stdout.write(f'Found {total} request template(s) to delete:')
        for tmpl in qs.select_related('business'):
            self.stdout.write(f'  [{tmpl.business.name}] {tmpl.name}')

        if dry_run:
            self.stdout.write(self.style.WARNING(f'DRY RUN complete — {total} record(s) would be deleted.'))
            return

        deleted_count, _ = qs.delete()
        self.stdout.write(
            self.style.SUCCESS(f'✅ Deleted {deleted_count} request template(s) successfully.')
        )
