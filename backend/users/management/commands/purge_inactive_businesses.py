from django.core.management.base import BaseCommand

from users.services.tenant_purge import INACTIVITY_DAYS, purge_inactive_tenants


class Command(BaseCommand):
    help = "Purge businesses with no meaningful SafariDesk activity for the configured number of days."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=INACTIVITY_DAYS)
        parser.add_argument("--commit", action="store_true", help="Actually purge candidates. Defaults to dry-run.")

    def handle(self, *args, **options):
        days = options["days"]
        dry_run = not options["commit"]
        results = purge_inactive_tenants(days=days, dry_run=dry_run)

        mode = "DRY RUN" if dry_run else "COMMIT"
        self.stdout.write(f"{mode}: found {len(results)} inactive business(es) for days={days}")
        for result in results:
            self.stdout.write(
                "{business_id}: {business_name} last_activity_at={last_activity_at} "
                "source={last_activity_source} purged={purged}".format(**result)
            )
