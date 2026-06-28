from django.core.management.base import BaseCommand
from tenant.models import DepartmentEmails


class Command(BaseCommand):
    help = 'Update IMAP settings for existing DepartmentEmails records'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes',
        )
        parser.add_argument(
            '--provider',
            type=str,
            help='Email provider (hostinger, gmail, outlook, etc.)',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        provider = (options.get('provider') or '').lower()

        # Get all department emails
        department_emails = DepartmentEmails.objects.all()

        if not department_emails.exists():
            self.stdout.write('No DepartmentEmails records found.')
            return

        self.stdout.write(f'Found {department_emails.count()} DepartmentEmails records.')

        # Provider-specific IMAP settings
        provider_settings = {
            'hostinger': {
                'imap_host': 'imap.hostinger.com',
                'imap_port': 993,
                'imap_use_ssl': True,
            },
            'gmail': {
                'imap_host': 'imap.gmail.com',
                'imap_port': 993,
                'imap_use_ssl': True,
            },
            'outlook': {
                'imap_host': 'outlook.office365.com',
                'imap_port': 993,
                'imap_use_ssl': True,
            },
            'yahoo': {
                'imap_host': 'imap.mail.yahoo.com',
                'imap_port': 993,
                'imap_use_ssl': True,
            },
        }

        updated_count = 0

        for dept_email in department_emails:
            needs_update = False

            # If provider is specified, use provider settings
            if provider and provider in provider_settings:
                settings = provider_settings[provider]
                if not dept_email.imap_host:
                    dept_email.imap_host = settings['imap_host']
                    needs_update = True
                if not dept_email.imap_port:
                    dept_email.imap_port = settings['imap_port']
                    needs_update = True
                if dept_email.imap_use_ssl is None:
                    dept_email.imap_use_ssl = settings['imap_use_ssl']
                    needs_update = True

            # If no provider specified, try to infer from existing SMTP host
            elif dept_email.host and not dept_email.imap_host:
                smtp_host = dept_email.host.lower()

                # Try to map SMTP host to IMAP host
                if 'smtp.hostinger.com' in smtp_host:
                    dept_email.imap_host = 'imap.hostinger.com'
                    dept_email.imap_port = 993
                    dept_email.imap_use_ssl = True
                    needs_update = True
                elif 'smtp.gmail.com' in smtp_host:
                    dept_email.imap_host = 'imap.gmail.com'
                    dept_email.imap_port = 993
                    dept_email.imap_use_ssl = True
                    needs_update = True
                elif 'smtp-mail.outlook.com' in smtp_host or 'smtp.office365.com' in smtp_host:
                    dept_email.imap_host = 'outlook.office365.com'
                    dept_email.imap_port = 993
                    dept_email.imap_use_ssl = True
                    needs_update = True

            # Copy SMTP credentials to IMAP if IMAP credentials are missing
            if dept_email.username and not dept_email.imap_username:
                dept_email.imap_username = dept_email.username
                needs_update = True

            if dept_email.password and not dept_email.imap_password:
                dept_email.imap_password = dept_email.password
                needs_update = True

            if needs_update:
                if dry_run:
                    self.stdout.write(
                        f'Would update {dept_email.email}: '
                        f'IMAP host={dept_email.imap_host}, '
                        f'port={dept_email.imap_port}, '
                        f'ssl={dept_email.imap_use_ssl}'
                    )
                else:
                    dept_email.save()
                    self.stdout.write(
                        f'Updated {dept_email.email}: '
                        f'IMAP host={dept_email.imap_host}, '
                        f'port={dept_email.imap_port}, '
                        f'ssl={dept_email.imap_use_ssl}'
                    )
                updated_count += 1

        if dry_run:
            self.stdout.write(f'Would update {updated_count} records.')
        else:
            self.stdout.write(f'Updated {updated_count} records.')

        if updated_count == 0:
            self.stdout.write('No records needed updating.')
