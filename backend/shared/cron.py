import logging
import os

from django_cron import CronJobBase, Schedule
from django.utils import timezone
from shared.tasks import create_notification_task
from tenant.models.SlaModel import SLATracker

logger = logging.getLogger(__name__)


class RunEmailsCommand(CronJobBase):
    RUN_EVERY_MINS = 1  # every 1 minute

    schedule = Schedule(run_every_mins=RUN_EVERY_MINS)
    code = 'shared.run_emails_command'  # unique identifier

    def do(self):
        logger.info("cron_emails_start")
        os.system("python3 manage.py emails --sync")


class RunSLACommand(CronJobBase):
    RUN_EVERY_MINS = 1  # every 1 minute

    schedule = Schedule(run_every_mins=RUN_EVERY_MINS)
    code = 'shared.run_sla_command'  # unique identifier

    def do(self):
        logger.info("cron_sla_start")
        os.system("python3 manage.py sla")


# Uncomment the following code to enable the SLA breach checking cron job  currently i have used celery-beat for this purpose
# This cron job checks for SLA breaches every minute and sends notifications if any breaches are detected.
# class CheckSLABreachCron(CronJobBase):
#     RUN_EVERY_MINS = 1  # every 1 minute

#     schedule = Schedule(run_every_mins=RUN_EVERY_MINS)
#     code = 'shared.check_sla_breach_cron'

#     def do(self):
#         now = timezone.now()

#         # First Response Breaches
#         response_breaches = SLATracker.objects.filter(
#             first_response_completed__isnull=True,
#             ticket__status__in=["open", "assigned", "in_progress"],
#         ).select_related("ticket", "ticket__assigned_to")

#         for tracker in response_breaches:
#             if tracker.is_paused:
#                 continue  # Skip paused trackers

#             effective_due = tracker.effective_first_response_due
#             if now > effective_due and tracker.first_response_status != "breached":
#                 ticket = tracker.ticket
#                 minutes_late = int((now - effective_due).total_seconds() / 60)

#                 if ticket.assigned_to:
#                     message = f"SLA BREACH: Ticket #{ticket.ticket_id} first response overdue by {minutes_late} minutes"
#                     create_notification_task.delay(
#                         user_id=ticket.assigned_to.id,
#                         ticket_id=ticket.id,
#                         message=message,
#                         notification_type="sla_breach",
#                         metadata={
#                             "breach_type": "first_response",
#                             "minutes_late": minutes_late,
#                             "due_date": effective_due.isoformat(),
#                         }
#                     )

#                 tracker.first_response_status = "breached"
#                 tracker.first_response_breach_time = now
#                 tracker.save()

#         # Resolution Breaches
#         resolution_breaches = SLATracker.objects.filter(
#             resolution_completed__isnull=True,
#             ticket__status__in=["open", "assigned", "in_progress", "pending"],
#         ).select_related("ticket", "ticket__assigned_to")

#         for tracker in resolution_breaches:
#             if tracker.is_paused:
#                 continue

#             effective_due = tracker.effective_resolution_due
#             if now > effective_due and tracker.resolution_status != "breached":
#                 ticket = tracker.ticket
#                 hours_late = int((now - effective_due).total_seconds() / 3600)

#                 if ticket.assigned_to:
#                     message = f"CRITICAL SLA BREACH: Ticket #{ticket.ticket_id} resolution overdue by {hours_late} hours"
#                     create_notification_task.delay(
#                         user_id=ticket.assigned_to.id,
#                         ticket_id=ticket.id,
#                         message=message,
#                         notification_type="sla_breach",
#                         metadata={
#                             "breach_type": "resolution",
#                             "hours_late": hours_late,
#                             "due_date": effective_due.isoformat(),
#                         }
#                     )

#                 tracker.resolution_status = "breached"
#                 tracker.resolution_breach_time = now
#                 tracker.save()
