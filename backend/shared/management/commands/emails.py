from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Legacy email ingestion command. Disabled in favor of the canonical mail integration pipeline."

    def add_arguments(self, parser):
        parser.add_argument(
            "--sync",
            action="store_true",
            help="Deprecated. The legacy email ingestion command is disabled.",
        )
        parser.add_argument(
            "--business",
            type=int,
            help="Deprecated. Business-scoped legacy email ingestion is disabled.",
        )

    def handle(self, *args, **options):
        raise CommandError(
            "The legacy 'emails' command is disabled. "
            "Use 'shared.tasks.sync_mail_integrations' for supported inbound polling "
            "and 'shared.tasks.process_mailgun_inbound' for webhook-driven Safaridesk mailboxes."
        )
