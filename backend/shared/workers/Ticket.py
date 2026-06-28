from celery import shared_task
from datetime import timedelta
from email.header import decode_header
from email.utils import format_datetime
import logging
import re
import uuid
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl  # noqa: F401

from decouple import config
from django.conf import settings
from django.utils import timezone

from tenant.models import Ticket, TicketComment
from tenant.models import EmailMessageRecord, MailIntegration
from tenant.models.SettingModel import CsatConfiguration, CsatSurveyDispatch
from util.Mailer import Mailer
from util.email.parser import TemplateParser
from util.email.templates import get_system_template, get_template
from shared.services.notification_preferences import NotificationSettingsService
from shared.workers.email_reply import (
    MailboxReplyError,
    _generate_message_id,
    _get_mailbox_for_reply,
    _get_threading_headers,
    _send_email_via_provider,
)
from users.models import Users

logger = logging.getLogger(__name__)
mailer = Mailer()


def _extract_email_domain(from_email: str | None) -> str:
    if not from_email:
        return "safaridesk.io"
    match = re.search(r"([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})", from_email)
    email_address = match.group(1) if match else from_email
    return email_address.split("@", 1)[1] if "@" in email_address else "safaridesk.io"


def _resolve_auto_ack_author(ticket: Ticket) -> Users | None:
    system_user = Users.objects.filter(email__iexact="system@safaridesk.io").first()
    if system_user:
        return system_user
    if ticket.assigned_to_id:
        return ticket.assigned_to
    return None


def _build_auto_ack_activity_content(ticket: Ticket) -> str:
    creator_name = ticket.creator_name or "there"
    ticket_id = ticket.ticket_id or f"#{ticket.id}"
    title = ticket.title or "Support request"
    return (
        f"Hello {creator_name},\n\n"
        "Thank you for contacting support. A new ticket has been created for you.\n\n"
        f"Ticket ID: {ticket_id}\n"
        f"Subject: {title}\n\n"
        "Our support team will get back to you shortly."
    )


def _send_ticket_notification(ticket_id, template_name, recipient_email, comment_id=None, extra_context: dict | None = None):
    """
    Helper function to send ticket-related notifications.
    """
    try:
        ticket = Ticket.objects.get(id=ticket_id)
        template = get_template(template_name, business=ticket.business)

        if not template:
            logger.error(f"Email template '{template_name}' not found in system templates")
            return

        objects = {"ticket": ticket}
        if comment_id:
            try:
                comment = TicketComment.objects.get(id=comment_id)
                objects["comment"] = comment
            except TicketComment.DoesNotExist:
                logger.error(f"Comment with id {comment_id} not found.")
        
        parser = TemplateParser(objects=objects)
        context = parser.build_context(template)
        # decode any encoded names in context
        def _decode_name(val: str) -> str:
            try:
                parts = decode_header(val)
                decoded = "".join(
                    [t[0].decode(t[1] or "utf-8") if isinstance(t[0], bytes) else str(t[0]) for t in parts]
                )
                return decoded
            except Exception:
                return val or ""
        if context.get("creator_name"):
            context["creator_name"] = _decode_name(context["creator_name"])
        if context.get("agent_name"):
            context["agent_name"] = _decode_name(context["agent_name"])
        if comment_id and context.get("agent_response"):
            context["agent_response"] = context["agent_response"]
        if "url" not in context or not context.get("url"):
            context["url"] = ticket.business.support_url or ""
        if extra_context:
            context.update(extra_context)

        # Threading + From selection for email-originated tickets
        extra_headers = {}
        from_email_override = None
        integration = None
        provider = None
        
        # DEBUG: Log threading diagnosis info
        logger.info(
            "[TICKET NOTIF THREADING] ticket_id=%s ticket_pk=%s source='%s' template=%s",
            ticket.ticket_id, ticket.id, ticket.source, template_name
        )
        
        if ticket.source == "email":
            extra_headers.update(_get_threading_headers(ticket))

            if template_name == "NEW_TICKET_AUTO_REPLY":
                try:
                    integration, resolved_from_email, provider = _get_mailbox_for_reply(ticket)
                except MailboxReplyError as exc:
                    logger.error(
                        "[TICKET NOTIF MAILBOX] Auto-ack sender resolution failed for ticket %s: %s",
                        ticket.ticket_id,
                        exc,
                    )
                    return
                from_email_override = resolved_from_email or None
                logger.info(
                    "[TICKET NOTIF MAILBOX] Auto-ack provider=%s integration_id=%s from=%s",
                    provider,
                    getattr(integration, "id", None),
                    from_email_override,
                )
            else:
                # System notifications must not spoof the mailbox sender.
                all_records = EmailMessageRecord.objects.filter(ticket=ticket)
                incoming_records = all_records.filter(direction=EmailMessageRecord.Direction.INCOMING)

                logger.info(
                    "[TICKET NOTIF THREADING] EmailMessageRecord: total=%d incoming=%d",
                    all_records.count(), incoming_records.count()
                )

                msg_record = incoming_records.order_by("-received_at").first()

                if msg_record:
                    original_msg_id = msg_record.message_id
                    logger.info(
                        "[TICKET NOTIF THREADING] Found record id=%d direction='%s' message_id='%s'",
                        msg_record.id, msg_record.direction, original_msg_id[:50] if original_msg_id else 'None'
                    )
                else:
                    logger.warning("[TICKET NOTIF THREADING] No incoming EmailMessageRecord found!")
        else:
            logger.info("[TICKET NOTIF THREADING] Skipping - source='%s' (not 'email')", ticket.source)

        if not NotificationSettingsService.should_send_email_for_template(
            recipient_email, template_name, ticket.business
        ):
            logger.info(
                "[Ticket] Email '%s' suppressed for %s by notification preferences",
                template_name, recipient_email,
            )
            return

        rendered_email = mailer.render_templated_email(
            template=template,
            context=context,
            business=ticket.business,
            receiver_email=recipient_email,
            from_email_override=from_email_override,
        )
        if not rendered_email:
            return

        auto_ack_comment = None
        if template_name == "NEW_TICKET_AUTO_REPLY" and ticket.source == "email":
            comment_author = _resolve_auto_ack_author(ticket)
            comment_kwargs = {
                "ticket": ticket,
                "content": _build_auto_ack_activity_content(ticket),
                "is_internal": False,
                "email_to": [recipient_email],
                "email_cc": None,
                "email_bcc": None,
            }
            if comment_author:
                comment_kwargs["author"] = comment_author
                comment_kwargs["updated_by"] = comment_author
            auto_ack_comment = TicketComment.objects.create(**comment_kwargs)

        message_id = _generate_message_id(_extract_email_domain(rendered_email["from_email"]))
        extra_headers["Message-ID"] = message_id
        extra_headers["Date"] = format_datetime(timezone.now())

        if template_name == "NEW_TICKET_AUTO_REPLY" and ticket.source == "email":
            sent = _send_email_via_provider(
                integration=integration if isinstance(integration, MailIntegration) else None,
                provider=provider or "",
                from_email=rendered_email["from_email"],
                to=[recipient_email],
                cc=None,
                bcc=None,
                subject=rendered_email["subject"],
                plain_text=rendered_email["plain_text_body"],
                html_body=rendered_email["html_body"],
                headers=extra_headers,
                allow_system_smtp_fallback=False,
            )
        else:
            sent = mailer.send_rendered_email(
                template_name=template.name,
                business=ticket.business,
                connection=rendered_email["connection"],
                from_email=rendered_email["from_email"],
                receiver_email=recipient_email,
                subject=rendered_email["subject"],
                plain_text_body=rendered_email["plain_text_body"],
                html_body=rendered_email["html_body"],
                extra_headers=extra_headers,
            )
        if not sent:
            if auto_ack_comment is not None:
                auto_ack_comment.delete()
            return

        if (
            template_name == "NEW_TICKET_AUTO_REPLY"
            and ticket.source == "email"
        ):
            record_headers = dict(extra_headers)
            record_headers["From"] = rendered_email["from_email"]
            record_headers["To"] = recipient_email
            record_headers["Subject"] = rendered_email["subject"]
            if isinstance(integration, MailIntegration) and auto_ack_comment is not None:
                EmailMessageRecord.objects.create(
                    integration=integration,
                    business=ticket.business,
                    ticket=ticket,
                    comment=auto_ack_comment,
                    message_id=message_id,
                    direction=EmailMessageRecord.Direction.OUTGOING,
                    subject=rendered_email["subject"][:512],
                    sender=rendered_email["from_email"],
                    recipient=recipient_email,
                    raw_headers=record_headers,
                    raw_body=rendered_email["plain_text_body"],
                    html_body=rendered_email["html_body"],
                    received_at=timezone.now(),
                )
            else:
                logger.warning(
                    "[TICKET NOTIF MAILBOX] Auto-ack sent without a connected MailIntegration for ticket %s",
                    ticket.ticket_id,
                )

        logger.info(f"Successfully sent '{template_name}' notification for ticket {ticket_id} to {recipient_email}")

    except Ticket.DoesNotExist:
        logger.error(f"Ticket with id {ticket_id} not found.")
    except Exception as e:
        logger.error(f"Error sending ticket notification for ticket {ticket_id}: {e}", exc_info=True)


@shared_task
def ticket_created_customer_notification(ticket_id):
    ticket = Ticket.objects.get(id=ticket_id)
    _send_ticket_notification(ticket_id, "NEW_TICKET_AUTO_REPLY", ticket.creator_email)

@shared_task
def ticket_created_agent_notification(ticket_id):
    ticket = Ticket.objects.get(id=ticket_id)
    # Notify all members of the department
    for member in NotificationSettingsService.active_department_members(ticket.department):
        if member.email:
            _send_ticket_notification(ticket_id, "NEW_TICKET_ALERT", member.email)

@shared_task
def ticket_assigned_notification(ticket_id):
    try:
        ticket = Ticket.objects.get(id=ticket_id)
    except Ticket.DoesNotExist:
        logger.error(f"Ticket with id {ticket_id} not found for assignment notification.")
        return

    # 1. Notify the assigned agent specifically
    if NotificationSettingsService.is_delivery_eligible_user(ticket.assigned_to) and ticket.assigned_to.email:
        _send_ticket_notification(ticket_id, "TICKET_ASSIGNMENT_ALERT", ticket.assigned_to.email)

@shared_task
def ticket_status_changed_notification(ticket_id):
    try:
        ticket = Ticket.objects.get(id=ticket_id)
    except Ticket.DoesNotExist:
        logger.error(f"Ticket with id {ticket_id} not found for status-change notification.")
        return

    recipients = set()
    # Always notify the ticket creator (customer)
    if ticket.creator_email:
        recipients.add(ticket.creator_email)

    # Add department members
    if getattr(ticket, 'department', None):
        for member in NotificationSettingsService.active_department_members(ticket.department):
            if member.email:
                recipients.add(member.email)

    # Add watchers
    for watcher in NotificationSettingsService.active_ticket_watchers(ticket):
        if watcher.email:
            recipients.add(watcher.email)

    for email in recipients:
        _send_ticket_notification(ticket_id, "NEW_ACTIVITY_NOTICE", email)


@shared_task
def ticket_reopened_notification(ticket_id):
    # DISABLED: Activity notifications are turned off
    # ticket = Ticket.objects.get(id=ticket_id)
    # recipients = set([ticket.creator_email])
    #
    # if ticket.assigned_to:
    #     recipients.add(ticket.assigned_to.email)
    #
    # # Add department members
    # for member in ticket.department.get_members():
    #     recipients.add(member.email)
    #
    # # Add watchers
    # for watcher in ticket.watchers.all():
    #     recipients.add(watcher.watcher.email)
    #
    # for email in recipients:
    #     _send_ticket_notification(ticket_id, "NEW_ACTIVITY_NOTICE", email)
    pass


@shared_task
def new_public_reply_customer_notification(ticket_id, comment_id):
    ticket = Ticket.objects.get(id=ticket_id)
    _send_ticket_notification(ticket_id, "RESPONSE_REPLY_TEMPLATE", ticket.creator_email, comment_id=comment_id)


@shared_task
def new_public_reply_agent_notification(ticket_id, comment_id):
    ticket = Ticket.objects.get(id=ticket_id)
    if NotificationSettingsService.is_delivery_eligible_user(ticket.assigned_to):
        _send_ticket_notification(ticket_id, "NEW_MESSAGE_ALERT", ticket.assigned_to.email, comment_id=comment_id)


@shared_task
def private_note_added_notification(ticket_id, comment_id):
    ticket = Ticket.objects.get(id=ticket_id)
    if NotificationSettingsService.is_delivery_eligible_user(ticket.assigned_to):
        _send_ticket_notification(ticket_id, "INTERNAL_ACTIVITY_ALERT", ticket.assigned_to.email, comment_id=comment_id)


@shared_task
def ticket_resolved_customer_notification(ticket_id):
    """Deprecated wrapper retained for compatibility; CSAT now sends only on close."""
    logger.info("[CSAT] Ignoring deprecated resolved trigger for ticket_id=%s", ticket_id)


@shared_task
def ticket_closed_customer_notification(ticket_id):
    # Backwards-compatible wrapper.
    ticket_customer_csat_notification.delay(ticket_id, 'closed')


def _append_query_params(url: str, params: dict[str, str]) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update(params)
    encoded_query = urlencode(query)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, encoded_query, parts.fragment))


def _build_internal_survey_url(ticket: Ticket, csat_config: CsatConfiguration, trigger_status: str) -> str:
    frontend_base = (ticket.business.domain_url or '').rstrip('/')
    if not frontend_base:
        frontend_base = (getattr(settings, 'FRONTEND_URL_BASE', '') or config('FRONTEND_URL_BASE', default='')).rstrip('/')
    if not frontend_base:
        return ''

    token = uuid.uuid4().hex
    now = timezone.now()
    expires_at = now + timedelta(hours=max(csat_config.link_expiry_hours, 1))

    dispatch = CsatSurveyDispatch.objects.create(
        business=ticket.business,
        ticket=ticket,
        provider=CsatSurveyDispatch.PROVIDER_INTERNAL,
        trigger_status=trigger_status,
        recipient_email=ticket.creator_email or '',
        token=token,
        expires_at=expires_at,
        sent_at=now,
        is_active=True,
    )

    survey_url = f"{frontend_base}/helpcenter/csat/{token}"
    dispatch.survey_url = survey_url
    dispatch.save(update_fields=['survey_url', 'date_updated'])
    return survey_url


@shared_task
def ticket_customer_csat_notification(ticket_id, trigger_status='closed'):
    """Send internal CSAT survey email when a ticket is closed."""
    try:
        ticket = Ticket.objects.select_related('business', 'assigned_to').get(id=ticket_id)
    except Ticket.DoesNotExist:
        logger.error("[CSAT] Ticket id=%s not found.", ticket_id)
        return

    if not ticket.business or not ticket.creator_email:
        logger.warning("[CSAT] Ticket id=%s missing business or creator_email. Skipping.", ticket_id)
        return

    csat_config, _ = CsatConfiguration.objects.get_or_create(
        business=ticket.business,
        defaults={'send_on_status': ['closed']},
    )

    if not csat_config.enabled or csat_config.is_paused:
        logger.info("[CSAT] CSAT disabled/paused for business_id=%s. Skipping.", ticket.business_id)
        return

    survey_url = _build_internal_survey_url(ticket, csat_config, trigger_status)
    if not survey_url:
        logger.warning("[CSAT] Could not generate survey URL for ticket_id=%s.", ticket.id)
        return

    logger.info("[CSAT] Dispatching survey for ticket_id=%s trigger=%s", ticket.id, trigger_status)
    _send_ticket_notification(
        ticket_id,
        "CSAT_SURVEY_REQUEST",
        ticket.creator_email,
        extra_context={"survey_url": survey_url},
    )

@shared_task
def ticket_claim_task(ticket_id):
    ticket = Ticket.objects.get(id=ticket_id)
    if NotificationSettingsService.is_delivery_eligible_user(ticket.assigned_to):
        _send_ticket_notification(ticket_id, "TICKET_ASSIGNMENT_ALERT", ticket.assigned_to.email)


@shared_task
def ticket_transfer_notification(ticket_id, previous_assignee_name):
    """Notify the new assignee that the ticket was transferred from a previous agent."""
    ticket = Ticket.objects.get(id=ticket_id)
    if NotificationSettingsService.is_delivery_eligible_user(ticket.assigned_to):
        _send_ticket_notification(
            ticket_id,
            "TICKET_TRANSFER_ALERT",
            ticket.assigned_to.email,
            extra_context={"previous_agent": previous_assignee_name},
        )


@shared_task
def watcher_added_notification(ticket_id, user_id):
    # DISABLED: Activity notifications are turned off
    # from users.models import Users
    # user = Users.objects.get(id=user_id)
    # _send_ticket_notification(ticket_id, "NEW_ACTIVITY_NOTICE", user.email)
    pass


# ================================
# Slack Notification Tasks
# ================================

@shared_task
def send_slack_ticket_notification(ticket_id, notification_type, comment_id=None):
    """
    Send Slack notification for ticket events
    """
    logger.info("slack_notification_start", extra={"ticket_id": ticket_id, "notification_type": notification_type})

    try:
        from shared.models.SlackIntegration import SlackIntegration
        from shared.services.SlackService import SlackService
        from tenant.models import TicketComment

        ticket = Ticket.objects.select_related('business', 'assigned_to', 'created_by').get(id=ticket_id)

        # Get active Slack integration for the business
        integration = SlackIntegration.objects.filter(
            business=ticket.business,
            is_active=True
        ).first()

        if not integration:
            logger.info("slack_no_integration", extra={"business": ticket.business.name})
            return

        if not integration.default_channel:
            logger.info("slack_no_channel", extra={"integration_id": integration.id})
            return

        # Check if notification type is enabled
        notification_enabled = {
            'new_ticket': integration.notify_new_tickets,
            'assignment': integration.notify_assignments,
            'status_update': integration.notify_status_updates,
            'sla_breach': integration.notify_sla_breaches,
            'comment': integration.notify_comments,
        }.get(notification_type, False)

        if not notification_enabled:
            logger.info("slack_notification_disabled", extra={"notification_type": notification_type})
            return

        # Prepare ticket data for formatting
        ticket_data = {
            'id': ticket.ticket_id,
            'title': ticket.title,
            'priority': ticket.priority,
            'status': ticket.get_status_display(),
            'assignee': {
                'name': ticket.assigned_to.get_full_name() if ticket.assigned_to else 'Unassigned'
            },
            'creator': {
                'name': ticket.creator_name,
                'email': ticket.creator_email
            }
        }
        
        # Add comment data if this is a comment notification
        if notification_type == 'comment' and comment_id:
            try:
                comment = TicketComment.objects.select_related('author').get(id=comment_id)
                ticket_data['comment'] = {
                    'content': comment.content,
                    'author': comment.author.get_full_name() if comment.author else 'Customer',
                    'is_internal': comment.is_internal
                }
            except TicketComment.DoesNotExist:
                logger.warning(f"Comment {comment_id} not found for Slack notification")

        # Format and send notification
        message, blocks = SlackService.format_ticket_notification(ticket_data, notification_type)
        success = SlackService.send_message(
            integration.access_token,
            integration.default_channel,
            message,
            blocks
        )

        if success:
            logger.info("slack_notification_sent", extra={"ticket_id": ticket.ticket_id, "notification_type": notification_type})
        else:
            logger.error("slack_notification_failed", extra={"ticket_id": ticket.ticket_id})

    except Exception as e:
        logger.exception("slack_notification_error", extra={"ticket_id": ticket_id, "error": str(e)})


@shared_task  
def send_slack_sla_notification(ticket_id, violation_type='sla_breach'):
    """
    Send Slack notification for SLA violations/breaches
    """
    try:
        from shared.models.SlackIntegration import SlackIntegration
        from shared.services.SlackService import SlackService
        
        ticket = Ticket.objects.select_related('business', 'assigned_to', 'created_by').get(id=ticket_id)
        
        # Get active Slack integration for the business
        integration = SlackIntegration.objects.filter(
            business=ticket.business, 
            is_active=True
        ).first()
        
        if not integration or not integration.default_channel or not integration.notify_sla_breaches:
            logger.info(f"SLA breach notifications disabled or no integration found for business {ticket.business.name}")
            return
            
        # Prepare ticket data for formatting
        ticket_data = {
            'id': ticket.ticket_id,
            'title': ticket.title,
            'priority': ticket.priority,
            'status': ticket.get_status_display(),
            'assignee': {
                'name': ticket.assigned_to.get_full_name() if ticket.assigned_to else 'Unassigned'
            },
            'creator': {
                'name': ticket.creator_name,
                'email': ticket.creator_email
            }
        }
        
        # Format notification message
        message, blocks = SlackService.format_ticket_notification(ticket_data, 'sla_breach')
        
        # Send notification
        success = SlackService.send_message(
            integration.access_token,
            integration.default_channel,
            message,
            blocks
        )
        
        if success:
            logger.info(f"Slack SLA breach notification sent for ticket {ticket.ticket_id}")
        else:
            logger.error(f"Failed to send Slack SLA notification for ticket {ticket.ticket_id}")
            
    except Exception as e:
        logger.error(f"Error sending Slack SLA notification for ticket {ticket_id}: {str(e)}")
