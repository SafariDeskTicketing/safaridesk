from django.core.management.base import BaseCommand, CommandParser

from tenant.services.ai.embedding_service import EmbeddingService
from tenant.models.KnowledgeBase import KBArticle


class Command(BaseCommand):
    help = "Generate embeddings for KB articles."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--business-id",
            type=int,
            help="Limit to a specific business ID",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Process all businesses (ignores --business-id)",
        )
        parser.add_argument(
            "--include-existing",
            action="store_true",
            help="Recreate embeddings even if they already exist",
        )

    def handle(self, *args, **options):
        business_id = options.get("business_id")
        process_all = options.get("all")
        include_existing = options.get("include_existing")

        service = EmbeddingService()

        if process_all:
            business_ids = (
                KBArticle.objects.values_list("business_id", flat=True).distinct()
            )
            total = 0
            for bid in business_ids:
                count = service.batch_generate_for_business(
                    business_id=bid, only_missing=not include_existing
                )
                self.stdout.write(self.style.SUCCESS(f"Business {bid}: {count} articles processed"))
                total += count
            self.stdout.write(self.style.SUCCESS(f"Total processed: {total}"))
            return

        if not business_id:
            self.stderr.write("Provide --business-id or use --all")
            return

        count = service.batch_generate_for_business(
            business_id=business_id, only_missing=not include_existing
        )
        self.stdout.write(self.style.SUCCESS(f"Business {business_id}: {count} articles processed"))

