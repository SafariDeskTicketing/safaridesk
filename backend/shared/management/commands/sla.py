from django.core.management.base import BaseCommand
from django.utils import timezone
import logging
from users.models import Business
from shared.workers.Sla import check_sla_for_business_task
from shared.workers.Ticket import send_slack_sla_notification  # Add this import
from datetime import timedelta
from django.conf import settings
from util.Mailer import Mailer
from util.email.parser import TemplateParser
from util.email.templates import get_system_template, get_template
from shared.services.notification_preferences import NotificationSettingsService

from tenant.models.SlaXModel import SLA, SLATarget, SLAEscalations, SLAEscalationNotificationLog, SLAViolation
from tenant.models.TicketModel import Ticket
from tenant.models.TaskModel import Task

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Monitor SLA compliance and trigger escalations for tickets'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run without sending actual notifications or making database changes',
        )

    def _get_sla_target(self, item):
        sla_due_times = item.calculate_sla_due_times()
        if not sla_due_times:
            return None, None
        return sla_due_times.get('sla_target'), sla_due_times

    def _collect_recipients(self, item, escalation=None):
        recipients = []

        if escalation is not None:
            for group in escalation.escalate_to_groups.all():
                for user in group.user_set.filter(is_active=True):
                    if user.email:
                        recipients.append(user.email)

            for agent in escalation.escalate_to_agents.filter(is_active=True):
                if agent.email:
                    recipients.append(agent.email)

            escalation_emails = getattr(escalation, 'escalation_emails', '') or ''
            for raw_email in escalation_emails.replace('\n', ',').split(','):
                email = raw_email.strip()
                if email:
                    recipients.append(email)

        if getattr(item, 'assigned_to', None) and item.assigned_to.email:
            recipients.append(item.assigned_to.email)

        business_owner = getattr(getattr(item, 'business', None), 'owner', None)
        if business_owner and business_owner.email:
            recipients.append(business_owner.email)

        return list(dict.fromkeys(recipients))

    def _send_templated_email_to_recipients(self, template_name, template, context, business, recipients):
        mailer = Mailer()
        sent_recipients = []

        for recipient in recipients:
            if not recipient:
                continue

            if mailer.send_templated_email(
                template=template,
                context=context,
                receiver_email=recipient,
                business=business,
            ):
                sent_recipients.append(recipient)

        if len(sent_recipients) != len(recipients):
            logger.warning(
                "Only sent %s of %s %s email notifications",
                len(sent_recipients),
                len(recipients),
                template_name,
            )

        return sent_recipients

    def _escalation_log_exists(self, item, item_type, sla_target, violation_type, escalation=None):
        filters = {
            'sla_target': sla_target,
            'violation_type': violation_type,
        }

        if item_type == 'Ticket':
            filters['ticket'] = item
        else:
            filters['task'] = item

        if escalation is None:
            filters['escalation__isnull'] = True
        else:
            filters['escalation'] = escalation

        return SLAEscalationNotificationLog.objects.filter(**filters).exists()

    def _record_escalation_log(self, item, item_type, sla_target, violation_type, recipients, escalation=None, target_time=None):
        log_kwargs = {
            'sla_target': sla_target,
            'violation_type': violation_type,
            'breach_time': timezone.now(),
            'target_time': target_time or timezone.now(),
            'recipients': ', '.join(recipients),
            'email_sent': bool(recipients),
        }

        if item_type == 'Ticket':
            log_kwargs['ticket'] = item
        else:
            log_kwargs['task'] = item

        if escalation is not None:
            log_kwargs['escalation'] = escalation

        return SLAEscalationNotificationLog.objects.create(**log_kwargs)

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        self.stdout.write('Starting SLA monitoring for all businesses...')

        businesses = Business.objects.filter(is_active=True)
        total_businesses = businesses.count()
        self.stdout.write(f"Found {total_businesses} active businesses to monitor")

        for business in businesses:
            # Count active SLAs for this business
            active_sla_count = SLA.objects.filter(business=business, is_active=True).count()
            self.stdout.write(f"Queueing SLA check for business: {business.name} ({active_sla_count} active SLAs)")
            check_sla_for_business_task.delay(business.id, dry_run)

        self.stdout.write(self.style.SUCCESS(f'All {total_businesses} business SLA checks have been queued.'))

    def monitor_items(self, items, item_type, dry_run):
        monitored_count = 0
        paused_count = 0
        escalations_triggered = 0
        violations_recorded = 0
        first_response_notifications = 0

        for item in items:
            monitored_count += 1
            item_id = item.ticket_id if item_type == 'Ticket' else item.task_trackid
            self.stdout.write(f"Checking SLA for {item_type} #{item_id} - {item.title}")

            if item.is_sla_paused:
                paused_count += 1
                self.stdout.write(f"SLA for {item_type} #{item_id} is paused. Skipping checks.")
                continue

            sla_status = item.get_sla_status()

            # Check for overdue alert based on due_date (independent of SLA)
            self.check_overdue_notification(item, item_type, dry_run)

            if sla_status and sla_status['has_sla']:
                if hasattr(item, 'check_sla_violations'):
                    new_violations = item.check_sla_violations()
                    violations_recorded += len(new_violations)

                # Check for first response breach notification (only for tickets not on hold)
                if item_type == 'Ticket' and item.status != 'hold':
                    first_response_sent = self.check_first_response_notification(item, sla_status, dry_run)
                    if first_response_sent:
                        first_response_notifications += 1

                triggered_escalations = self.check_escalations(item, sla_status, item_type, dry_run)
                escalations_triggered += triggered_escalations
            else:
                self.stdout.write(f"No active SLA found for {item_type} #{item_id}")

        self.stdout.write(
            self.style.SUCCESS(
                f'SLA monitoring for {item_type}s completed. '
                f'Monitored {monitored_count} {item_type.lower()}s, '
                f'{paused_count} paused, '
                f'recorded {violations_recorded} new violations, '
                f'sent {first_response_notifications} first response notifications, '
                f'triggered {escalations_triggered} escalations.'
            )
        )

    def check_escalations(self, item, sla_status, item_type, dry_run=False):
        """Check and trigger escalations and reminders for an item."""
        escalations_triggered_count = 0
        
        sla_target, sla_due_times = self._get_sla_target(item)
        if not sla_target:
            return 0

        escalations = SLAEscalations.objects.filter(sla_target=sla_target, is_active=True).order_by('level')
        current_time = timezone.now()

        for escalation in escalations:
            escalation_type = escalation.escalation_type
            due_time = sla_status.get(escalation_type, {}).get('due_time')

            if not due_time:
                continue

            # Check for reminders
            if escalation.reminder_time and escalation.reminder_unit:
                reminder_delta = timedelta(**{escalation.reminder_unit: escalation.reminder_time})
                reminder_time = due_time - reminder_delta
                if current_time >= reminder_time and current_time < due_time:
                    self.send_reminder(item, escalation, sla_status, item_type, dry_run)

            # Check for escalations
            if current_time > due_time:
                logger.debug(
                    "check_escalations: item=%s type=%s escalation=%s due_time=%s current_time=%s",
                    getattr(item, 'ticket_id', getattr(item, 'task_trackid', item.id)),
                    item_type,
                    escalation.escalation_type,
                    due_time.isoformat() if hasattr(due_time, 'isoformat') else due_time,
                    current_time.isoformat(),
                )
                existing_log = self._escalation_log_exists(item, item_type, sla_target, escalation_type, escalation)
                
                if not existing_log:
                    if not dry_run:
                        self.trigger_escalation_action(item, escalation, sla_status, current_time, item_type, sla_target, due_time)
                    escalations_triggered_count += 1
                    item_id = item.ticket_id if item_type == 'Ticket' else item.task_trackid
                    self.stdout.write(
                        f'{"[DRY RUN] " if dry_run else ""}Triggered {escalation.escalation_type} '
                        f'escalation (Level {escalation.level}) for {item_type} #{item_id}'
                    )
        
        return escalations_triggered_count

    def check_first_response_notification(self, ticket, sla_status, dry_run=False):
        """Check if first response SLA is breached and send notification."""
        sla_target, sla_due_times = self._get_sla_target(ticket)
        if not sla_target or not sla_due_times.get('first_response_due'):
            return False

        current_time = timezone.now()
        first_response_due = sla_due_times['first_response_due']
        logger.debug(
            "check_first_response_notification: ticket=%s current_time=%s first_response_due=%s first_response_at=%s status=%s",
            getattr(ticket, 'ticket_id', ticket.id),
            current_time.isoformat(),
            first_response_due.isoformat() if hasattr(first_response_due, 'isoformat') else first_response_due,
            getattr(ticket, 'first_response_at', None),
            ticket.status,
        )

        # Check if first response is overdue and no response has been made
        if (current_time > first_response_due and
            not ticket.first_response_at and
            ticket.status != 'resolved'):

            if self._escalation_log_exists(ticket, 'Ticket', sla_target, 'first_response'):
                return False

            if not dry_run:
                self.send_first_response_notification(ticket, sla_target, first_response_due)
                # Send Slack notification for SLA breach
                send_slack_sla_notification.delay(ticket.id, 'first_response_breach')

            ticket_id = ticket.ticket_id
            self.stdout.write(
                f'{"[DRY RUN] " if dry_run else ""}Sent first response breach notification for ticket #{ticket_id}'
            )
            return True

        return False

    def send_first_response_notification(self, ticket, sla_target, target_time):
        """Send first response breach notification."""
        template_name = "SLA_FIRST_RESPONSE_BREACH"
        template = get_template(template_name, business=ticket.business)
        if not template:
            logger.error(f"{template_name} template not found in system templates")
            return

        recipients = self._collect_recipients(ticket)

        if recipients:
            objects = {"ticket": ticket}
            parser = TemplateParser(objects=objects)
            context = parser.build_context(template)

            allowed = [
                r for r in recipients
                if NotificationSettingsService.should_send_email_for_template(r, template_name, ticket.business)
            ]
            if not allowed:
                logger.info(f'All recipients suppressed by preferences for {template_name} on ticket #{ticket.ticket_id}')
                return

            sent_recipients = self._send_templated_email_to_recipients(
                template_name,
                template,
                context,
                ticket.business,
                allowed,
            )
            if not sent_recipients:
                logger.error(f'Failed to send first response breach notification for ticket #{ticket.ticket_id}')
                return

            logger.info(f'Sent first response breach notification for ticket #{ticket.ticket_id} to: {", ".join(sent_recipients)}')
            self._record_escalation_log(
                ticket,
                'Ticket',
                sla_target,
                'first_response',
                sent_recipients,
                target_time=target_time,
            )

    def check_overdue_notification(self, item, item_type, dry_run=False):
        """Send overdue alert once when item's due_date has passed and it is not yet resolved/closed.

        Deduplication is done with a cache key based on the item and the current due date so the
        alert is only sent once per day while the item remains overdue.
        """
        import datetime
        due_date = getattr(item, 'due_date', None)
        if not due_date:
            return

        current_time = timezone.now()
        # Normalise date → aware datetime
        if not hasattr(due_date, 'tzinfo'):
            from django.utils.timezone import make_aware
            due_date = make_aware(datetime.datetime.combine(due_date, datetime.time.min))

        terminal_statuses = {'resolved', 'closed'} if item_type == 'Ticket' else {'completed', 'done', 'closed'}
        item_status = getattr(item, 'status', None) or getattr(item, 'task_status', None) or ''
        if item_status in terminal_statuses or current_time <= due_date:
            return

        item_id = item.ticket_id if item_type == 'Ticket' else item.task_trackid

        # Use persistent notification log to ensure overdue alert is only sent once ever
        sla_target, _ = self._get_sla_target(item)
        # If we've already logged an overdue alert for this item, skip
        if self._escalation_log_exists(item, item_type, sla_target, 'overdue'):
            return

        self.stdout.write(f'{"[DRY RUN] " if dry_run else ""}Sending overdue alert for {item_type} #{item_id}')
        if dry_run:
            return

        template_name = "OVERDUE_TICKET_ALERT" if item_type == 'Ticket' else "OVERDUE_TASK_ALERT"
        template = get_template(template_name, business=item.business)
        if not template:
            logger.error(f"{template_name} template not found")
            return

        recipients = []
        if item.assigned_to and getattr(item.assigned_to, 'email', None):
            recipients.append(item.assigned_to.email)
        elif item_type == 'Ticket' and item.department:
            # Department model exposes `get_members()` to return users belonging to the department
            try:
                members_qs = item.department.get_members()
            except Exception:
                members_qs = None

            if members_qs is not None:
                for user in members_qs.filter(is_active=True):
                    if user.email:
                        recipients.append(user.email)

        recipients = list(set(recipients))
        if not recipients:
            return

        objects = {"ticket" if item_type == 'Ticket' else "task": item}
        parser = TemplateParser(objects=objects)
        context = parser.build_context(template)

        allowed = [
            r for r in recipients
            if NotificationSettingsService.should_send_email_for_template(r, template_name, item.business)
        ]
        if allowed:
            sent_recipients = self._send_templated_email_to_recipients(
                template_name,
                template,
                context,
                item.business,
                allowed,
            )
            if sent_recipients:
                sent_recipient_list = ", ".join(sent_recipients)
                logger.info(f'Sent overdue alert for {item_type} #{item_id} to: {sent_recipient_list}')
                # Record persistent notification so we don't send this overdue alert again
                try:
                    self._record_escalation_log(
                        item,
                        item_type,
                        sla_target,
                        'overdue',
                        sent_recipients,
                        target_time=due_date,
                    )
                except Exception:
                    logger.exception('Failed to record overdue notification log')
            else:
                logger.error(f'Failed to send overdue alert for {item_type} #{item_id}')

    def send_reminder(self, item, escalation, sla_status, item_type, dry_run):
        """Send a reminder email using a template."""
        item_id = item.ticket_id if item_type == 'Ticket' else item.task_trackid
        self.stdout.write(f'{"[DRY RUN] " if dry_run else ""}Sending reminder for {item_type} #{item_id}')
        if dry_run:
            return

        template_name = "SLA_REMINDER" if item_type == 'Ticket' else "SLA_REMINDER_TASK"
        template = get_template(template_name, business=item.business)
        if not template:
            logger.error(f"{template_name} template not found in system templates")
            return

        recipients = []
        if item.assigned_to and item.assigned_to.email:
            recipients.append(item.assigned_to.email)

        if recipients:
            objects = {"ticket" if item_type == 'Ticket' else "task": item}
            parser = TemplateParser(objects=objects)
            context = parser.build_context(template)

            allowed = [
                r for r in recipients
                if NotificationSettingsService.should_send_email_for_template(r, template_name, item.business)
            ]
            if allowed:
                sent_recipients = self._send_templated_email_to_recipients(
                    template_name,
                    template,
                    context,
                    item.business,
                    allowed,
                )
                if sent_recipients:
                    logger.info(f'Sent reminder email for {item_type} #{item_id} to: {", ".join(sent_recipients)}')
                else:
                    logger.error(f'Failed to send reminder email for {item_type} #{item_id}')

            # Send Slack notification for SLA reminder (if it's a ticket)
            if item_type == 'Ticket':
                send_slack_sla_notification.delay(item.id, 'sla_reminder')

    def trigger_escalation_action(self, item, escalation, sla_status, current_time, item_type, sla_target, target_time):
        """Perform the actions defined for an escalation"""
        # Prepare email context
        context = {
            'item': item,
            'item_type': item_type,
            'sla_status': sla_status,
            'escalation': escalation,
            'current_time': current_time,
            'due_time': target_time,
        }

        recipients = self._collect_recipients(item, escalation)
        
        # Send email using template
        template_name = "SLA_ESCALATION_NOTICE" if item_type == 'Ticket' else "SLA_ESCALATION_NOTICE_TASK"
        template = get_template(template_name, business=item.business)
        if not template:
            logger.error(f"{template_name} template not found in system templates")
            return

        if recipients:
            objects = {"ticket" if item_type == 'Ticket' else "task": item}
            parser = TemplateParser(objects=objects)
            context = parser.build_context(template)

            item_id = item.ticket_id if item_type == 'Ticket' else item.task_trackid
            sent_recipients = self._send_templated_email_to_recipients(
                template_name,
                template,
                context,
                item.business,
                recipients,
            )
            if sent_recipients:
                logger.info(f'Sent escalation email for {item_type} #{item_id} to: {", ".join(sent_recipients)}')
                self._record_escalation_log(
                    item,
                    item_type,
                    sla_target,
                    escalation.escalation_type,
                    sent_recipients,
                    escalation=escalation,
                    target_time=target_time,
                )
            else:
                logger.error(f'Failed to send escalation email for {item_type} #{item_id}')
            
            # Send Slack notification for escalation (if it's a ticket)
            if item_type == 'Ticket':
                send_slack_sla_notification.delay(item.id, 'sla_escalation')
        
        return
