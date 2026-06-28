"""
Management command to verify custom domains
"""
from django.core.management.base import BaseCommand
from users.models import CustomDomains
from util.DomainVerificationService import DomainVerificationService


class Command(BaseCommand):
    help = 'Verify custom domains'

    def add_arguments(self, parser):
        parser.add_argument(
            '--domain',
            type=str,
            help='Specific domain to verify',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Verify all pending domains',
        )
        parser.add_argument(
            '--retry-failed',
            action='store_true',
            help='Retry failed domain verifications',
        )

    def handle(self, *args, **options):
        verification_service = DomainVerificationService()

        if options['domain']:
            # Verify specific domain
            try:
                domain = CustomDomains.objects.get(domain=options['domain'])
                self.stdout.write(f"Verifying domain: {domain.domain}")

                if verification_service.verify_domain(domain):
                    self.stdout.write(
                        self.style.SUCCESS(f"✓ Domain {domain.domain} verified successfully!")
                    )
                else:
                    self.stdout.write(
                        self.style.ERROR(f"✗ Domain {domain.domain} verification failed")
                    )
            except CustomDomains.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f"Domain {options['domain']} not found")
                )

        elif options['all']:
            # Verify all pending domains
            pending_domains = CustomDomains.objects.filter(
                verification_status='pending',
                is_verified=False
            )

            if not pending_domains.exists():
                self.stdout.write("No pending domains to verify")
                return

            self.stdout.write(f"Found {pending_domains.count()} pending domain(s)")

            for domain in pending_domains:
                self.stdout.write(f"\nVerifying: {domain.domain}")

                if verification_service.verify_domain(domain):
                    self.stdout.write(
                        self.style.SUCCESS(f"✓ Verified: {domain.domain}")
                    )
                else:
                    self.stdout.write(
                        self.style.WARNING(f"✗ Failed: {domain.domain}")
                    )

        elif options['retry_failed']:
            # Retry failed verifications
            failed_domains = CustomDomains.objects.filter(
                verification_status='failed',
                is_verified=False
            )

            if not failed_domains.exists():
                self.stdout.write("No failed domains to retry")
                return

            self.stdout.write(f"Found {failed_domains.count()} failed domain(s)")

            for domain in failed_domains:
                self.stdout.write(f"\nRetrying: {domain.domain}")

                if verification_service.verify_domain(domain):
                    self.stdout.write(
                        self.style.SUCCESS(f"✓ Verified: {domain.domain}")
                    )
                else:
                    self.stdout.write(
                        self.style.WARNING(f"✗ Still failing: {domain.domain}")
                    )

        else:
            self.stdout.write(
                self.style.WARNING(
                    "Please specify --domain, --all, or --retry-failed"
                )
            )

