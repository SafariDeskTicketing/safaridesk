from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime
from typing import Any, Dict

from django.db import transaction
from django.forms import ValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone

from RNSafarideskBack import settings
from RNSafarideskBack.settings import FILE_URL
from tenant.models import Ticket, TicketAttachment
from tenant.models.TicketModel import TicketReplayAttachment
from tenant.services.tickets.attachments import _build_storage_paths, _extract_and_save_base64_images
from tenant.services.tickets.errors import TicketActionError
from tenant.services.tickets.shared import sanitize_text_for_mysql

logger = logging.getLogger(__name__)


def send_email_reply(*, request, pk) -> Dict[str, Any]:
    """
    Send an email reply for a ticket from the activity stream.
    Supports JSON and multipart/form-data payloads with optional attachments.
    """
    if not pk:
        raise TicketActionError({"message": "Ticket ID is required"}, 400)

    ticket = get_object_or_404(Ticket, id=pk, business=request.user.business)

    def parse_list_field(field_val):
        if not field_val:
            return []
        if isinstance(field_val, list):
            return field_val
        if isinstance(field_val, str):
            try:
                parsed = json.loads(field_val)
                if isinstance(parsed, list):
                    return parsed
            except (json.JSONDecodeError, TypeError):
                return [field_val]
        return [field_val]

    # Validate recipients
    to_emails = parse_list_field(request.data.get('to'))
    if not to_emails:
        raise TicketActionError({"message": "'to' must be a non-empty list of emails"}, 400)

    # Basic email validation
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    for email in to_emails:
        if not re.match(email_pattern, email):
            raise TicketActionError({"message": f"Invalid email address: {email}"}, 400)

    cc_emails = parse_list_field(request.data.get('cc'))
    bcc_emails = parse_list_field(request.data.get('bcc'))
    content = request.data.get('content', '')

    mailbox_id = request.data.get('mailbox_id')
    if mailbox_id in [None, '', 'undefined']:
        mailbox_id = None
    else:
        try:
            mailbox_id = int(mailbox_id)
        except (TypeError, ValueError):
            raise TicketActionError({"message": "mailbox_id must be an integer"}, 400)

    if ticket.source == "email":
        from shared.workers.email_reply import MailboxReplyError, _get_mailbox_for_reply
        try:
            receiving_integration, _, _ = _get_mailbox_for_reply(ticket, mailbox_id)
        except MailboxReplyError as exc:
            raise TicketActionError({"message": str(exc)}, 400)
        mailbox_id = receiving_integration.id

    close_ticket_raw = request.data.get('close_ticket', False)
    if isinstance(close_ticket_raw, str):
        close_ticket = close_ticket_raw.strip().lower() == 'true'
    else:
        close_ticket = bool(close_ticket_raw)

    if not content.strip() and not request.FILES:
        raise TicketActionError({"message": "Email content or attachments are required"}, 400)

    # Sanitize content
    content = sanitize_text_for_mysql(content) if content else content

    # Create comment record (non-internal since it's going to customer)
    author = request.user
    com = ticket.comments.create(
        ticket=ticket,
        author=author,
        content=content,
        updated_by=author,
        is_internal=False,
        email_to=to_emails,
        email_cc=cc_emails if cc_emails else None,
        email_bcc=bcc_emails if bcc_emails else None
    )

    # ========== EXTRACT AND SAVE BASE64 IMAGES ==========
    # Extract embedded base64 images from HTML content and save as attachments
    try:
        if content and '<img' in content and 'base64' in content:
            updated_content = _extract_and_save_base64_images(
                html_content=content,
                comment=com,
                business=ticket.business
            )
            # Update comment content with file URLs instead of base64
            if updated_content != content:
                com.content = updated_content
                com.save(update_fields=['content'])
                content = updated_content  # Use updated content for email
    except Exception as img_error:
        logger.error(f"Failed to extract base64 images from email reply: {img_error}")
    # =====================================================

    # ========== SAVE FORM DATA FILE ATTACHMENTS ==========
    if request.FILES:
        uploaded_files = request.FILES.getlist('files')
        if not uploaded_files:
            uploaded_files = list(request.FILES.values())

        for uploaded_file in uploaded_files:
            try:
                file_extension = os.path.splitext(uploaded_file.name)[1].lower()
                unique_filename = f"{uuid.uuid4()}{file_extension}"
                properties_dir, url_base = _build_storage_paths(ticket.business, subfolder='files')
                file_path = os.path.join(properties_dir, unique_filename)

                with open(file_path, 'wb+') as destination:
                    for chunk in uploaded_file.chunks():
                        destination.write(chunk)

                file_url_base = url_base or FILE_URL or getattr(settings, 'FILE_BASE_URL', '')
                if file_url_base:
                    file_url = f"{file_url_base.rstrip('/')}/{unique_filename}"
                else:
                    file_url = unique_filename

                # 1) Attach to activity stream comment.
                TicketReplayAttachment.objects.create(
                    comment=com,
                    file_url=file_url,
                    filename=uploaded_file.name,
                )

                # 2) Attach to ticket attachment list.
                TicketAttachment.objects.create(
                    ticket=ticket,
                    file_url=file_url,
                    filename=uploaded_file.name,
                    description=f"Attached to email reply by {author.full_name()}",
                )
            except Exception as file_error:
                logger.exception("Error saving uploaded file for email reply %s", uploaded_file.name)
                raise ValidationError(f"Failed to save attachment {uploaded_file.name}: {file_error}")
    # =====================================================

    subject = request.data.get('subject') or None

    # Queue email sending via Celery
    from shared.workers.email_reply import send_email_reply_task
    transaction.on_commit(
        lambda: send_email_reply_task.delay(
            ticket_id=ticket.id,
            comment_id=com.id,
            to=to_emails,
            cc=cc_emails if cc_emails else None,
            bcc=bcc_emails if bcc_emails else None,
            mailbox_id=mailbox_id,
            subject=subject,
        )
    )

    # When an agent sends an email reply on an open ticket, move it to in progress.
    if author and ticket.status == 'open' and not close_ticket:
        old_status = ticket.status
        ticket.status = 'in_progress'
        ticket.updated_at = datetime.now()
        ticket.updated_by = author
        ticket.save(update_fields=['status', 'updated_at', 'updated_by'])

        from tenant.models import TicketActivity
        TicketActivity.objects.create(
            ticket=ticket,
            user=author,
            activity_type='status_changed',
            description="System changed the ticket status to In Progress",
            old_value=old_status,
            new_value='in_progress'
        )

    # Optionally close ticket after sending
    if close_ticket:
        old_status = ticket.status
        ticket.status = 'closed'
        ticket.resolved_at = timezone.now()
        ticket.updated_by = author
        ticket.save()

        # Create activity for close
        from tenant.models import TicketActivity
        TicketActivity.objects.create(
            ticket=ticket,
            user=author,
            activity_type='status_changed',
            description="Ticket closed after sending email reply",
            old_value=old_status,
            new_value='closed'
        )

    return {
        "message": "Email reply queued successfully",
        "comment_id": com.id,
    }


def _parse_ai_email_draft(raw_content: str, fallback_subject: str = "") -> dict:
    cleaned = (raw_content or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            payload = json.loads(cleaned[start:end + 1])
            return {
                "subject": str(payload.get("subject") or fallback_subject).strip(),
                "content": str(payload.get("content") or "").strip(),
            }
        except json.JSONDecodeError:
            pass

    subject_match = re.search(r"^subject:\s*(.+)$", cleaned, flags=re.IGNORECASE | re.MULTILINE)
    if subject_match:
        subject = subject_match.group(1).strip()
        cleaned = re.sub(r"^subject:\s*.+$\n?", "", cleaned, count=1, flags=re.IGNORECASE | re.MULTILINE).strip()
    else:
        subject = fallback_subject

    return {
        "subject": subject.strip(),
        "content": cleaned,
    }
