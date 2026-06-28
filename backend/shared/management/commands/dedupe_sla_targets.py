from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

from tenant.models.SlaXModel import SLA, SLATarget


class Command(BaseCommand):
    help = "Report and optionally remove duplicate SLA targets that share the same priority within a policy."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Delete duplicate targets and keep the first target for each priority.",
        )

    def handle(self, *args, **options):
        apply_changes = options["apply"]
        duplicate_groups = []

        for sla in SLA.objects.prefetch_related("targets", "targets__reminders", "targets__escalations"):
            grouped_targets = defaultdict(list)
            for target in sla.targets.all().order_by("created_at", "id"):
                grouped_targets[target.priority].append(target)

            for priority, targets in grouped_targets.items():
                if len(targets) > 1:
                    duplicate_groups.append((sla, priority, targets))

        if not duplicate_groups:
            self.stdout.write(self.style.SUCCESS("No duplicate SLA targets found."))
            return

        for sla, priority, targets in duplicate_groups:
            self.stdout.write(
                f"SLA {sla.id} ({sla.name}) has {len(targets)} targets for priority '{priority}'."
            )

        if not apply_changes:
            self.stdout.write(self.style.WARNING("Run again with --apply to remove duplicate targets."))
            return

        deleted_count = 0
        with transaction.atomic():
            for _, _, targets in duplicate_groups:
                keep_target = targets[0]
                duplicate_targets = targets[1:]

                for duplicate in duplicate_targets:
                    deleted_count += self._merge_related_rows(keep_target, duplicate)
                    duplicate.delete()

        self.stdout.write(self.style.SUCCESS(f"Removed duplicate SLA targets and merged related rows ({deleted_count} related rows reassigned or preserved)."))

    def _merge_related_rows(self, keep_target, duplicate_target):
        preserved_rows = 0

        for reminder in duplicate_target.reminders.all():
            reminder.sla_target = keep_target
            reminder.save(update_fields=["sla_target"])
            preserved_rows += 1

        for escalation in duplicate_target.escalations.all():
            escalation.sla_target = keep_target
            escalation.save(update_fields=["sla_target"])
            preserved_rows += 1

        return preserved_rows