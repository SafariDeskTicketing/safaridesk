"""
Celery task for sending email replies from the activity stream.
Supports To/CC/BCC, mailbox selection, and email threading.
"""
from __future__ import annotations

import logging
import re
import uuid
from email.utils import format_datetime
from html import unescape
from typing import Optional

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.utils import timezone
from django.utils.html import escape, linebreaks, strip_tags

from tenant.models import (
    EmailMessageRecord,
    MailIntegration,
    SettingSMTP,
    Ticket,
    TicketComment,
)
from tenant.models.SettingModel import EmailSettings
from util.mail.mailgun import send_mailgun_message
from util.mail.gmail_sender import send_gmail_api_message
from util.mail.graph_sender import send_microsoft_graph_message
from util.mail.transport import resolve_smtp_transport

logger = logging.getLogger(__name__)


class MailboxReplyError(ValueError):
    """Raised when a ticket reply cannot be sent from its required mailbox."""


def _mailbox_from_email(integration: MailIntegration) -> str:
    return integration.email_address or integration.forwarding_address or ""


def _is_send_capable_mailbox(integration: MailIntegration) -> bool:
    return (
        integration.is_active
        and integration.connection_status == MailIntegration.ConnectionStatus.CONNECTED
        and integration.direction in [MailIntegration.Direction.BOTH, MailIntegration.Direction.OUTGOING]
        and bool(_mailbox_from_email(integration))
    )


def _get_receiving_mailbox_for_email_ticket(
    ticket: Ticket,
    mailbox_id: Optional[int] = None,
) -> tuple[MailIntegration, str, str]:
    msg_record = (
        EmailMessageRecord.objects.filter(
            ticket=ticket,
            business=ticket.business,
            direction=EmailMessageRecord.Direction.INCOMING,
        )
        .select_related("integration")
        .order_by("received_at", "id")
        .first()
    )
    if not msg_record or not msg_record.integration:
        raise MailboxReplyError("This email ticket has no receiving mailbox record.")

    integration = msg_record.integration
    if integration.business_id != ticket.business_id:
        raise MailboxReplyError("The receiving mailbox does not belong to this business.")

    if mailbox_id and mailbox_id != integration.id:
        raise MailboxReplyError("Email ticket replies must use the mailbox that received the ticket email.")

    if not _is_send_capable_mailbox(integration):
        raise MailboxReplyError("The receiving mailbox is not connected for outgoing replies.")

    return integration, _mailbox_from_email(integration), integration.provider


def _get_mailbox_for_reply(
    ticket: Ticket,
    mailbox_id: Optional[int] = None,
) -> tuple[Optional[MailIntegration], str, str]:
    """
    Determine which mailbox to send from.
    
    Priority:
    1. Original integration for email-sourced tickets
    2. Explicit mailbox_id from request for non-email tickets
    3. Business default connected mailbox
    4. System SMTP fallback for non-email tickets
    
    Returns: (integration, from_email, provider)
    """
    business = ticket.business

    # Email-created tickets must reply from the mailbox that received the
    # original email. Do not allow UI/default/system sender fallback here.
    if ticket.source == "email":
        return _get_receiving_mailbox_for_email_ticket(ticket, mailbox_id)
    
    # 1. Explicit mailbox selection
    if mailbox_id:
        integration = MailIntegration.objects.filter(
            id=mailbox_id,
            business=business,
            is_active=True,
            connection_status=MailIntegration.ConnectionStatus.CONNECTED,
        ).first()
        if integration:
            from_email = integration.email_address or integration.forwarding_address
            return integration, from_email, integration.provider
    
    # 3. Business default connected mailbox
    integration = MailIntegration.objects.filter(
        business=business,
        is_active=True,
        connection_status=MailIntegration.ConnectionStatus.CONNECTED,
        direction__in=[MailIntegration.Direction.BOTH, MailIntegration.Direction.OUTGOING],
    ).first()
    if integration:
        from_email = integration.email_address or integration.forwarding_address
        return integration, from_email, integration.provider
    
    # 4. Fallback to business SMTP settings
    smtp = SettingSMTP.objects.filter(business=business).first()
    if smtp:
        from_email = (
            f"{smtp.sender_name} <{smtp.default_from_email}>"
            if smtp.sender_name
            else smtp.default_from_email
        )
        return None, from_email, "smtp"
    
    # 5. System default
    default_name = getattr(settings, "DEFAULT_FROM_NAME", None)
    default_email = getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@safaridesk.io")
    from_email = f"{default_name} <{default_email}>" if default_name else default_email
    return None, from_email, "smtp"


def _send_email_via_provider(
    *,
    integration: Optional[MailIntegration],
    provider: str,
    from_email: str,
    to: list[str],
    cc: Optional[list[str]],
    bcc: Optional[list[str]],
    subject: str,
    plain_text: str,
    html_body: str,
    headers: dict,
    attachments: Optional[list[tuple[str, bytes]]] = None,
    allow_system_smtp_fallback: bool = True,
) -> bool:
    attachments = attachments or []

    if provider == MailIntegration.Provider.SAFARIDESK and settings.MAILGUN_API_KEY:
        return send_mailgun_message(
            to=to,
            cc=cc,
            bcc=bcc,
            subject=subject,
            text=plain_text,
            html=html_body,
            from_email=from_email,
            headers=headers,
            attachments=attachments,
        )

    if provider == MailIntegration.Provider.GMAIL and integration:
        return send_gmail_api_message(
            integration=integration,
            to=to,
            cc=cc,
            bcc=bcc,
            subject=subject,
            text=plain_text,
            html=html_body,
            from_email=from_email,
            headers=headers,
            attachments=attachments,
        )

    if provider == MailIntegration.Provider.OFFICE365 and integration:
        return send_microsoft_graph_message(
            integration=integration,
            to=to,
            cc=cc,
            bcc=bcc,
            subject=subject,
            text=plain_text,
            html=html_body,
            from_email=from_email,
            headers=headers,
            attachments=attachments,
        )

    try:
        if integration and integration.smtp_host:
            smtp_port, smtp_use_ssl, smtp_use_tls = resolve_smtp_transport(
                integration.smtp_port,
                integration.smtp_use_ssl,
                integration.smtp_use_tls,
            )
            connection = get_connection(
                host=integration.smtp_host,
                port=smtp_port,
                username=integration.get_secret("smtp_username"),
                password=integration.get_secret("smtp_password"),
                use_tls=smtp_use_tls,
                use_ssl=smtp_use_ssl,
            )
        elif allow_system_smtp_fallback:
            connection = get_connection()
        else:
            logger.error(
                "mailbox_activity_missing_sender_transport",
                extra={"integration_id": getattr(integration, "id", None), "provider": provider},
            )
            return False

        email = EmailMultiAlternatives(
            subject=subject,
            body=plain_text,
            from_email=from_email,
            to=to,
            cc=cc or [],
            bcc=bcc or [],
            connection=connection,
            headers=headers,
        )
        email.attach_alternative(html_body, "text/html")

        if attachments:
            import mimetypes
            for filename, content in attachments:
                content_type, _ = mimetypes.guess_type(filename)
                email.attach(filename, content, content_type or 'application/octet-stream')
        email.send(fail_silently=False)
        return True
    except Exception as e:
        logger.error(f"SMTP send failed for mailbox activity: {e}")
        return False


def _get_threading_headers(ticket: Ticket) -> dict:
    """Get In-Reply-To and References headers for email threading."""
    headers = {}
    
    # DEBUG: Log all relevant info for threading diagnosis
    logger.info(
        "[THREADING DEBUG] ticket_id=%s ticket_pk=%s source='%s'",
        ticket.ticket_id, ticket.id, ticket.source
    )
    
    if ticket.source == "email":
        # Count all EmailMessageRecords for this ticket
        all_records = EmailMessageRecord.objects.filter(ticket=ticket)
        incoming_records = all_records.filter(direction=EmailMessageRecord.Direction.INCOMING)
        
        logger.info(
            "[THREADING DEBUG] EmailMessageRecord counts: total=%d incoming=%d",
            all_records.count(), incoming_records.count()
        )
        
        # Log the actual direction values stored
        for rec in all_records[:3]:  # Limit to 3 for brevity
            logger.info(
                "[THREADING DEBUG] Record id=%d direction='%s' message_id='%s'",
                rec.id, rec.direction, rec.message_id[:50] if rec.message_id else 'None'
            )
        
        msg_record = incoming_records.order_by("-received_at").first()
        
        if msg_record and msg_record.message_id:
            headers["In-Reply-To"] = msg_record.message_id
            headers["References"] = msg_record.message_id
            logger.info(
                "[THREADING DEBUG] Threading headers SET: In-Reply-To='%s'",
                msg_record.message_id[:50]
            )
        else:
            logger.warning(
                "[THREADING DEBUG] NO threading headers - msg_record=%s message_id=%s",
                msg_record is not None, 
                msg_record.message_id if msg_record else 'N/A'
            )
    else:
        logger.info("[THREADING DEBUG] Skipping - ticket.source='%s' (not 'email')", ticket.source)
    
    return headers


def _generate_message_id(domain: str = "safaridesk.io") -> str:
    """Generate a unique Message-ID for outgoing emails."""
    return f"<{uuid.uuid4()}@{domain}>"


def _get_email_settings(business) -> EmailSettings:
    """Get or create email settings for a business."""
    email_settings, _ = EmailSettings.objects.get_or_create(business=business)
    return email_settings


def _content_looks_like_html(content: str) -> bool:
    return bool(re.search(r"</?[a-z][\s\S]*>", content or "", re.IGNORECASE))


def _html_to_plain_text(content: str) -> str:
    html = re.sub(r"(?i)<br\s*/?>", "\n", content or "")
    html = re.sub(r"(?i)</p\s*>", "\n", html)
    html = re.sub(r"(?i)<p[^>]*>", "", html)
    text = strip_tags(html)
    text = unescape(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _content_has_signature(content: str, email_settings: EmailSettings) -> bool:
    tail = _html_to_plain_text(content).lower()[-300:]
    greeting = (email_settings.signature_greeting or "Regards,").strip().lower()
    signature_name = email_settings.get_signature_name().strip().lower()

    if not tail or not greeting:
        return False
    if signature_name:
        return greeting in tail and signature_name in tail
    return greeting in tail


def _format_email_content(
    content: str,
    email_settings: EmailSettings,
) -> tuple[str, str]:
    """
    Format email content while avoiding duplicate signatures.
    
    Returns: (plain_text, html_body)
    """
    raw_content = (content or "").strip()
    signature_name = email_settings.get_signature_name()
    signature_greeting = email_settings.signature_greeting or "Regards,"

    signature_lines = "\n".join(part for part in [signature_greeting, signature_name] if part).strip()
    signature_html = "".join(
        part
        for part in [
            f"<p>{escape(signature_greeting)}</p>" if signature_greeting else "",
            f"<p><strong>{escape(signature_name)}</strong></p>" if signature_name else "",
        ]
        if part
    )
    has_signature = _content_has_signature(raw_content, email_settings)

    if _content_looks_like_html(raw_content):
        html_body = raw_content
        plain_text = _html_to_plain_text(raw_content)
        if not has_signature and signature_lines:
            html_body = f"{html_body}<p><br></p>{signature_html}"
            plain_text = "\n\n".join(part for part in [plain_text, signature_lines] if part)
    else:
        plain_text = raw_content
        if not has_signature and signature_lines:
            plain_text = "\n\n".join(part for part in [plain_text, signature_lines] if part)
        html_body = linebreaks(plain_text)

    return plain_text, html_body


@shared_task
def send_email_reply_task(
    ticket_id: int,
    comment_id: int,
    to: list[str],
    cc: Optional[list[str]] = None,
    bcc: Optional[list[str]] = None,
    mailbox_id: Optional[int] = None,
    subject: Optional[str] = None,
) -> dict:
    """
    Send an email reply for a ticket comment with signature.
    
    Args:
        ticket_id: The ticket ID
        comment_id: The comment ID containing the reply content
        to: List of recipient emails
        cc: Optional CC recipients
        bcc: Optional BCC recipients
        mailbox_id: Optional specific mailbox to send from
        subject: Optional custom subject (auto-generated if not provided)
    
    Returns:
        dict with success status and email_record_id
    """
    try:
        ticket = Ticket.objects.select_related("business").get(id=ticket_id)
        comment = TicketComment.objects.get(id=comment_id)
    except (Ticket.DoesNotExist, TicketComment.DoesNotExist) as e:
        logger.error(f"send_email_reply_task failed: {e}")
        return {"success": False, "error": str(e)}
    
    # Get mailbox and from email
    try:
        integration, from_email, provider = _get_mailbox_for_reply(ticket, mailbox_id)
    except MailboxReplyError as exc:
        logger.error(
            "email_reply_sender_resolution_failed",
            extra={"ticket_id": ticket_id, "comment_id": comment_id, "error": str(exc)},
        )
        return {"success": False, "error": str(exc)}
    
    # Generate subject if not provided
    if not subject:
        subject = f"Re: [{ticket.ticket_id}] {ticket.title}"
    
    # Format email content and only append signature if it is missing.
    email_settings = _get_email_settings(ticket.business)
    plain_text, html_body = _format_email_content(
        comment.content, email_settings
    )
    
    # Get threading headers
    extra_headers = _get_threading_headers(ticket)
    message_id = _generate_message_id()
    extra_headers["Message-ID"] = message_id

    # Set Reply-To to the integration's inbound alias so customer replies
    # route back through the correct subdomain inbox (e.g. support@acme.safaridesk.io)
    if integration and integration.forwarding_address:
        extra_headers["Reply-To"] = integration.forwarding_address

    record_headers = dict(extra_headers)
    record_headers["From"] = from_email
    record_headers["To"] = ", ".join(to)
    if cc:
        record_headers["Cc"] = ", ".join(cc)
    if bcc:
        record_headers["Bcc"] = ", ".join(bcc)
    record_headers["Subject"] = subject
    record_headers["Date"] = format_datetime(timezone.now())

    # Load comment attachments for delivery in outgoing email.
    from tenant.models import TicketReplayAttachment
    import os

    attachments: list[tuple[str, bytes]] = []
    try:
        replay_attachments = TicketReplayAttachment.objects.filter(comment=comment)
        if replay_attachments.exists():
            from tenant.views.TicketView import _build_storage_paths
            properties_dir, _ = _build_storage_paths(ticket.business, subfolder='files')

            for att in replay_attachments:
                filename_in_storage = att.file_url.split('?')[0].split('/')[-1]
                file_path = os.path.join(properties_dir, filename_in_storage)

                if os.path.exists(file_path):
                    with open(file_path, 'rb') as file_handle:
                        attachments.append((att.filename or filename_in_storage, file_handle.read()))
                else:
                    logger.warning("Attachment file not found physically: %s", file_path)
    except Exception as att_err:
        logger.error("Failed to load attachments for email reply: %s", att_err)
    
    sent = _send_email_via_provider(
        integration=integration,
        provider=provider,
        from_email=from_email,
        to=to,
        cc=cc,
        bcc=bcc,
        subject=subject,
        plain_text=plain_text,
        html_body=html_body,
        headers=extra_headers,
        attachments=attachments,
        allow_system_smtp_fallback=ticket.source != "email",
    )
    
    if not sent:
        return {"success": False, "error": "Email sending failed"}
    
    # Create EmailMessageRecord for outgoing email
    email_record = EmailMessageRecord.objects.create(
        integration=integration,
        business=ticket.business,
        ticket=ticket,
        comment=comment,
        message_id=message_id,
        direction=EmailMessageRecord.Direction.OUTGOING,
        subject=subject[:512],
        sender=from_email,
        recipient=", ".join(to),
        raw_headers=record_headers,
        raw_body=plain_text,
        html_body=html_body,
        received_at=timezone.now(),
    )
    
    logger.info(
        "email_reply_sent",
        extra={
            "ticket_id": ticket_id,
            "comment_id": comment_id,
            "to": to,
            "cc": cc,
            "provider": provider,
            "email_record_id": email_record.id,
        },
    )
    
    return {"success": True, "email_record_id": email_record.id}
