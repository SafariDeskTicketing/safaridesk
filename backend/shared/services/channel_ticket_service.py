from __future__ import annotations

import logging
import os
import uuid
from dataclasses import dataclass, field
from typing import List, Optional

from django.conf import settings
from django.db import transaction

from tenant.models import Ticket, TicketAttachment
from tenant.services.contact_linker import link_or_create_contact
from tenant.services.tickets.naming import generate_ticket_id, render_ticket_title

logger = logging.getLogger(__name__)


@dataclass
class AttachmentPayload:
    filename: str
    content: bytes
    content_type: Optional[str] = None


@dataclass
class NormalizedChannelMessage:
    """A channel-agnostic representation of an inbound message that should become a ticket.

    Every channel adapter (Slack, Telegram, ...) is responsible for building one of
    these from its own payload shape; everything downstream of this point is shared.
    """

    source: str  # must be a valid Ticket.TICKET_SOURCE_CHOICES value
    business: "users.models.BusinessModel.Business"
    title_hint: str
    body: str
    sender_display_name: Optional[str] = None
    sender_email: Optional[str] = None
    sender_phone: Optional[str] = None
    priority: str = "medium"
    attachments: List[AttachmentPayload] = field(default_factory=list)


class ChannelTicketService:
    """Creates tickets from normalized channel messages (Slack, Telegram, ...).

    Mirrors the ticket-creation shape already used by the email path
    (see shared/workers/Email.py:create_ticket_from_email) so every channel
    gets consistent ticket IDs/titles, contact linking, and attachment handling.
    """

    @staticmethod
    def create_ticket(msg: NormalizedChannelMessage) -> Ticket:
        ticket_id_code = generate_ticket_id(business=msg.business)
        title = render_ticket_title(
            summary=msg.title_hint,
            ticket_id=ticket_id_code,
            source=msg.source,
            business=msg.business,
        )

        with transaction.atomic():
            ticket = Ticket.objects.create(
                business=msg.business,
                ticket_id=ticket_id_code,
                title=title,
                description=msg.body,
                creator_name=msg.sender_display_name,
                creator_email=msg.sender_email,
                creator_phone=msg.sender_phone,
                priority=msg.priority,
                customer_tier="standard",
                source=msg.source,
            )

            if msg.sender_email or msg.sender_display_name or msg.sender_phone:
                contact = link_or_create_contact(
                    business=msg.business,
                    name=msg.sender_display_name,
                    email=msg.sender_email,
                    phone=msg.sender_phone,
                )
                if contact:
                    ticket.contact = contact
                    ticket.save(update_fields=["contact"])

            for attachment in msg.attachments:
                ChannelTicketService._save_attachment(ticket, attachment)

        logger.info(f"Created ticket {ticket.ticket_id} from {msg.source} message")
        return ticket

    @staticmethod
    def _save_attachment(ticket: Ticket, attachment: AttachmentPayload) -> None:
        try:
            file_extension = os.path.splitext(attachment.filename)[1].lower()
            unique_filename = f"{uuid.uuid4()}{file_extension}"

            business = ticket.business
            files_dir = os.path.join(settings.MEDIA_ROOT, "files", str(business.id)) if business else os.path.join(
                settings.MEDIA_ROOT, "files"
            )
            os.makedirs(files_dir, exist_ok=True)

            file_path = os.path.join(files_dir, unique_filename)
            with open(file_path, "wb") as f:
                f.write(attachment.content)

            if business:
                file_url = f"{settings.FILE_URL}/{business.id}/{unique_filename}"
            else:
                file_url = f"{settings.FILE_URL}/{unique_filename}"

            TicketAttachment.objects.create(
                ticket=ticket,
                file_url=file_url,
                filename=attachment.filename,
                description=f"{ticket.source} attachment: {attachment.filename}",
            )
        except Exception as e:
            logger.error(f"Error saving attachment {attachment.filename} for ticket #{ticket.ticket_id}: {str(e)}")
