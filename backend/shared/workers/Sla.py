from celery import shared_task
from django.utils import timezone
from tenant.models.TicketModel import Ticket
from tenant.models.TaskModel import Task
import logging
from django.core.management import call_command

logger = logging.getLogger(__name__)


@shared_task
def check_sla_breaches():
    """
    Runs the sla management command.
    This task is intended to be run by Celery Beat.
    """
    logger.info("Running SLA ====> Starting scheduled SLA breach checks via management command...")
    call_command('sla')
    logger.info("Running SLA ====> Successfully finished SLA breach checks.")


@shared_task
def check_sla_for_business_task(business_id, dry_run=False):
    """
    Checks SLA for all tickets and tasks for a given business.
    Ensures all configured SLAs are taken into account for accuracy.
    """
    from shared.management.commands.sla import Command
    from tenant.models.SlaXModel import SLA
    command = Command()

    # Get all active SLAs for the business to ensure comprehensive monitoring
    active_slas = SLA.objects.filter(business_id=business_id, is_active=True)

    if not active_slas.exists():
        command.stdout.write(f"No active SLAs found for business {business_id}. Skipping SLA checks.")
        return

    command.stdout.write(f"Found {active_slas.count()} active SLAs for business {business_id}")

    # Monitor tickets that have SLA assigned and are in active statuses
    tickets_to_monitor = Ticket.objects.filter(
        business_id=business_id,
        status__in=['unassigned', 'assigned', 'in_progress', 'hold'],
        sla__isnull=False
    )
    command.stdout.write(f"Monitoring {tickets_to_monitor.count()} tickets with SLA")
    command.monitor_items(tickets_to_monitor, 'Ticket', dry_run)

    # Monitor tasks that have SLA assigned and are in active statuses
    tasks_to_monitor = Task.objects.filter(
        business_id=business_id,
        task_status__in=['open', 'in_progress', 'hold'],
        sla__isnull=False
    )
    command.stdout.write(f"Monitoring {tasks_to_monitor.count()} tasks with SLA")
    command.monitor_items(tasks_to_monitor, 'Task', dry_run)

    command.stdout.write(f"SLA monitoring completed for business {business_id}")
