# management/commands/update_task_naming.py
"""
Management command to update the default task naming convention to 'TSK {##}'.

Old format: TSK-{YYYY}-{####}  →  e.g. TSK-2026-0001
New format: TSK {##}           →  e.g. TSK 01

This updates all existing TaskConfig records that still use the old default
format. Businesses that have already customised their format are left untouched.

Usage:
    python manage.py update_task_naming
    python manage.py update_task_naming --business 5   # single business
    python manage.py update_task_naming --all          # update ALL configs (overrides custom too)
    python manage.py update_task_naming --dry-run      # preview only
"""
from django.core.management.base import BaseCommand
from tenant.models.ConfigModel import TaskConfig
from users.models import Business

OLD_DEFAULT = 'TSK-{YYYY}-{####}'
NEW_DEFAULT = 'TSK {##}'


class Command(BaseCommand):
    help = f'Update task naming convention from "{OLD_DEFAULT}" to "{NEW_DEFAULT}"'

    def add_arguments(self, parser):
        parser.add_argument(
            '--business',
            type=int,
            help='Update task config for a specific business ID only',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Update ALL TaskConfig records regardless of current format (overrides custom formats too)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview what would be updated without making changes',
        )

    def handle(self, *args, **options):
        business_filter = options.get('business')
        update_all = options.get('all')
        dry_run = options.get('dry_run')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no records will be updated'))

        # Base queryset
        if update_all:
            qs = TaskConfig.objects.all()
        else:
            # Only update configs still using the old default (safe — preserves customisations)
            qs = TaskConfig.objects.filter(id_format=OLD_DEFAULT)

        if business_filter:
            business = Business.objects.filter(id=business_filter, is_active=True).first()
            if not business:
                self.stdout.write(self.style.ERROR(f'Business with ID {business_filter} not found'))
                return
            qs = qs.filter(business=business)
            self.stdout.write(f'Filtering to business: {business.name}')

        total = qs.count()

        if total == 0:
            self.stdout.write(self.style.SUCCESS('No TaskConfig records to update — already up to date.'))
            return

        self.stdout.write(f'Found {total} TaskConfig record(s) to update:')
        for cfg in qs.select_related('business'):
            self.stdout.write(f'  [{cfg.business.name}] {cfg.id_format!r} → {NEW_DEFAULT!r}')

        if dry_run:
            self.stdout.write(self.style.WARNING(f'DRY RUN complete — {total} record(s) would be updated.'))
            return

        updated = qs.update(id_format=NEW_DEFAULT)
        self.stdout.write(
            self.style.SUCCESS(f'✅ Updated {updated} TaskConfig record(s) to use "{NEW_DEFAULT}".')
        )
