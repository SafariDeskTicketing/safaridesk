"""
Management command to regenerate ticket/task IDs based on current config format.

⚠️ WARNING: This is a DANGEROUS operation!
- Existing ticket IDs in emails, URLs, and integrations will break
- User bookmarks and references will become invalid
- Only use this if you understand the consequences

Usage:
    python manage.py regenerate_ids --type=tickets --business=1 --dry-run
    python manage.py regenerate_ids --type=tasks --business=1 --confirm
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from tenant.models.TicketModel import Ticket
from tenant.models.TaskModel import Task
from tenant.models.ConfigModel import TicketConfig, TaskConfig
from users.models.BusinessModel import Business
from util.Helper import Helper
from datetime import datetime


class Command(BaseCommand):
    help = 'Regenerate ticket or task IDs based on current config format (DANGEROUS!)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--type',
            type=str,
            required=True,
            choices=['tickets', 'tasks'],
            help='Type of records to regenerate: tickets or tasks'
        )
        parser.add_argument(
            '--business',
            type=int,
            required=True,
            help='Business ID to regenerate IDs for'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without applying them'
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm you understand the risks and want to proceed'
        )
        parser.add_argument(
            '--year',
            type=int,
            help='Only regenerate IDs for records from this year (e.g., 2025)'
        )

    def handle(self, *args, **options):
        record_type = options['type']
        business_id = options['business']
        dry_run = options['dry_run']
        confirm = options['confirm']
        year_filter = options.get('year')

        # Safety checks
        if not dry_run and not confirm:
            self.stdout.write(self.style.ERROR(
                '⚠️  DANGER: This operation will change existing IDs!\n'
                'This will break:\n'
                '  - Email references\n'
                '  - URLs and bookmarks\n'
                '  - Integration links\n'
                '  - User references\n\n'
                'Use --dry-run to preview changes first.\n'
                'Use --confirm to proceed with changes.'
            ))
            return

        try:
            business = Business.objects.get(id=business_id)
        except Business.DoesNotExist:
            raise CommandError(f'Business with ID {business_id} does not exist')

        # Get config
        helper = Helper()
        
        if record_type == 'tickets':
            config = TicketConfig.objects.filter(business=business).first()
            if not config:
                raise CommandError('No TicketConfig found for this business')
            
            queryset = Ticket.objects.filter(business=business).order_by('created_at')
            if year_filter:
                queryset = queryset.filter(created_at__year=year_filter)
            
            model_name = 'Ticket'
            format_template = config.id_format
        else:
            config = TaskConfig.objects.filter(business=business).first()
            if not config:
                raise CommandError('No TaskConfig found for this business')
            
            queryset = Task.objects.filter(business=business).order_by('created_at')
            if year_filter:
                queryset = queryset.filter(created_at__year=year_filter)
            
            model_name = 'Task'
            format_template = config.id_format

        total_count = queryset.count()
        
        if total_count == 0:
            self.stdout.write(self.style.WARNING(f'No {model_name.lower()}s found to regenerate'))
            return

        self.stdout.write(
            f'\n{model_name} ID Format: {format_template}\n'
            f'Business: {business.name} (ID: {business.id})\n'
            f'Total {model_name.lower()}s: {total_count}\n'
        )

        if dry_run:
            self.stdout.write(self.style.WARNING('\n🔍 DRY RUN MODE - No changes will be made\n'))
        else:
            self.stdout.write(self.style.WARNING('\n⚠️  LIVE MODE - Changes will be applied!\n'))

        changes = []
        
        # Group by year for sequential numbering
        records_by_year = {}
        for record in queryset:
            year = record.created_at.year
            if year not in records_by_year:
                records_by_year[year] = []
            records_by_year[year].append(record)

        # Generate new IDs maintaining chronological order within each year
        for year in sorted(records_by_year.keys()):
            records = records_by_year[year]
            sequence_counter = 1
            
            for record in records:
                old_id = record.ticket_id if record_type == 'tickets' else record.task_trackid
                
                # Generate new ID with explicit sequence number
                new_id = self._generate_sequential_id(
                    format_template, 
                    sequence_counter, 
                    record.created_at
                )
                
                if old_id != new_id:
                    changes.append({
                        'record': record,
                        'old_id': old_id,
                        'new_id': new_id,
                        'created_at': record.created_at
                    })
                
                sequence_counter += 1

        if not changes:
            self.stdout.write(self.style.SUCCESS('✓ All IDs already match the current format!'))
            return

        # Show preview
        self.stdout.write(f'\n📋 Changes to apply: {len(changes)}\n')
        
        # Show sample (first 10)
        sample_size = min(10, len(changes))
        self.stdout.write(f'First {sample_size} changes:\n')
        for i, change in enumerate(changes[:sample_size], 1):
            self.stdout.write(
                f'  {i}. {change["old_id"]} → {change["new_id"]} '
                f'({change["created_at"].strftime("%Y-%m-%d")})'
            )
        
        if len(changes) > sample_size:
            self.stdout.write(f'  ... and {len(changes) - sample_size} more\n')

        if dry_run:
            self.stdout.write(self.style.SUCCESS(
                f'\n✓ Dry run complete. Use --confirm to apply changes.'
            ))
            return

        # Apply changes
        self.stdout.write('\n💾 Applying changes...\n')
        
        with transaction.atomic():
            for change in changes:
                record = change['record']
                if record_type == 'tickets':
                    record.ticket_id = change['new_id']
                else:
                    record.task_trackid = change['new_id']
                record.save(update_fields=['ticket_id' if record_type == 'tickets' else 'task_trackid'])

        self.stdout.write(self.style.SUCCESS(
            f'\n✓ Successfully regenerated {len(changes)} {model_name.lower()} IDs!'
        ))

    def _generate_sequential_id(self, format_template, sequence, created_at):
        """Generate ID with explicit sequence number"""
        import re
        
        result = format_template
        
        # Replace date tokens
        result = result.replace('{YYYY}', str(created_at.year))
        result = result.replace('{YY}', str(created_at.year)[2:])
        result = result.replace('{MM}', f"{created_at.month:02d}")
        result = result.replace('{DD}', f"{created_at.day:02d}")
        
        # Replace number patterns with explicit sequence
        def replace_hash_pattern(match):
            pattern = match.group(0)
            padding = len(pattern)
            if padding == 1:
                return str(sequence)
            else:
                return str(sequence).zfill(padding)
        
        result = re.sub(r'#{1,}', replace_hash_pattern, result)
        
        return result
