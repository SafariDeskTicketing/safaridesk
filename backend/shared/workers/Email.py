import logging
import imaplib
import email
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import decode_header
from typing import Dict, List, Optional

from celery import shared_task, group, chord
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from tenant.models import Department, DepartmentEmails, Ticket, TicketComment, EmailTicketMapping, TicketAttachment
from tenant.models.SlaXModel import SLA
from tenant.services.tickets.duplicate_detection import DuplicateDetectionService
from users.models import Business, Users
from util.Mailer import Mailer
from util.email.parser import TemplateParser
from tenant.services.contact_linker import link_or_create_contact
from tenant.services.tickets.naming import extract_ticket_code, generate_ticket_id, render_ticket_title
import smtplib
import os
import uuid

logger = logging.getLogger(__name__)


class EmailProcessor:
    def __init__(self, department_email: DepartmentEmails):
        self.department_email = department_email
        self.mail = None

    def connect_imap(self) -> bool:
        """Connect to IMAP server using department email IMAP settings"""
        try:
            # Use IMAP fields if available, otherwise fall back to SMTP fields for backward compatibility
            imap_host = self.department_email.imap_host or self.department_email.host
            imap_port = self.department_email.imap_port or 993  # Default IMAP SSL port
            imap_username = self.department_email.imap_username or self.department_email.username
            imap_password = self.department_email.imap_password or self.department_email.password
            use_ssl = self.department_email.imap_use_ssl if self.department_email.imap_use_ssl is not None else True

            if not imap_host or not imap_username or not imap_password:
                logger.error(f"IMAP settings not configured for {self.department_email.email}")
                return False

            if use_ssl:
                self.mail = imaplib.IMAP4_SSL(imap_host, imap_port)
            else:
                self.mail = imaplib.IMAP4(imap_host, imap_port)

            self.mail.login(imap_username, imap_password)
            self.mail.select('INBOX')
            logger.info(f"Successfully connected to IMAP for {self.department_email.email}")
            return True

        except Exception as e:
            error_msg = f"Failed to connect to IMAP for {self.department_email.email}: {str(e)}"
            logger.error(error_msg)
            logger.error(f"IMAP connection details: host={imap_host}, port={imap_port}, ssl={use_ssl}, user={imap_username}")
            if "Authentication failed" in str(e) or "LOGIN" in str(e) or "login" in str(e).lower():
                logger.error("This is likely an authentication issue. Please check:")
                logger.error("1. Username and password are correct")
                logger.error("2. IMAP is enabled for this email account")
                logger.error("3. If 2FA is enabled, you may need an app password")
            return False

    def disconnect_imap(self):
        """Disconnect from IMAP server"""
        try:
            if self.mail:
                self.mail.close()
                self.mail.logout()
        except Exception as e:
            logger.error(f"Error disconnecting from IMAP: {str(e)}")

    def parse_email_content(self, email_message) -> Optional[str]:
        """Parse email content and extract text"""
        try:
            body = ""
            if email_message.is_multipart():
                for part in email_message.walk():
                    if part.get_content_type() == "text/plain":
                        payload = part.get_payload(decode=True)
                        charset = part.get_content_charset() or 'utf-8'
                        body = payload.decode(charset, errors='ignore')
                        break
            else:
                payload = email_message.get_payload(decode=True)
                charset = email_message.get_content_charset() or 'utf-8'
                body = payload.decode(charset, errors='ignore')

            return body.strip()
        except Exception as e:
            logger.error(f"Error parsing email content: {str(e)}")
            return None

    def extract_sender_info(self, email_message) -> tuple[Optional[str], Optional[str], Optional[str]]:
        """Extract sender email, name, and phone from email"""
        try:
            from_header = email_message.get('From', '')
            # Simple email extraction - you might want to use email.utils.parseaddr
            match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', from_header)
            sender_email = match.group() if match else None

            # Extract sender name (simple implementation)
            sender_name = None
            if '<' in from_header and '>' in from_header:
                name_part = from_header.split('<')[0].strip()
                if name_part:
                    sender_name = name_part

            return sender_email, sender_name, None  # Phone not available from email
        except Exception as e:
            logger.error(f"Error extracting sender info: {str(e)}")
            return None, None, None

    def extract_ticket_id_from_subject(self, subject: str) -> Optional[str]:
        """Extract ticket ID from email subject"""
        return extract_ticket_code(subject, business=self.department_email.department.business)

    def create_ticket_from_email(self, email_message, message_id: str) -> Optional[Ticket]:
        """Create a new ticket from email"""
        try:
            subject = email_message.get('Subject', 'No Subject')
            sender_email, sender_name, sender_phone = self.extract_sender_info(email_message)
            body_content = self.parse_email_content(email_message)

            # Find user if exists
            user = None
            try:
                user = Users.objects.filter(
                    email=sender_email,
                    business=self.department_email.department.business
                ).first()
            except Exception as e:
                logger.warning(f"Error finding user {sender_email}: {str(e)}")

            # Create ticket
            ticket_id_code = generate_ticket_id(business=self.department_email.department.business)
            ticket_title = render_ticket_title(
                summary=subject,
                ticket_id=ticket_id_code,
                source='email',
                business=self.department_email.department.business,
            )

            with transaction.atomic():
                ticket = Ticket.objects.create(
                    title=ticket_title,
                    description=body_content or f"Email from {sender_email}",
                    creator_name=sender_name,
                    creator_email=sender_email,
                    creator_phone=sender_phone,
                    created_by=user,
                    ticket_id=ticket_id_code,
                    department=self.department_email.department,
                    is_public=False,  # Email tickets are typically internal
                    business=self.department_email.department.business,
                    priority='medium',  # Default priority for email tickets
                    customer_tier='standard',  # Default tier for email tickets
                    source='email'  # Set source to email for tickets created from emails
                )

                logger.info(f"✅ Ticket #{ticket_id_code} mapped to department: {self.department_email.department.name} (via email: {self.department_email.email})")

                # Create email mapping
                EmailTicketMapping.objects.create(
                    message_id=message_id,
                    ticket=ticket
                )

                # Assign SLA if available
                self.assign_sla_to_ticket(ticket)

                # Auto-create or link contact
                if sender_email or sender_name:
                    contact = link_or_create_contact(
                        business=self.department_email.department.business,
                        name=sender_name,
                        email=sender_email,
                        phone=sender_phone,
                        owner=user,
                    )
                    if contact:
                        ticket.contact = contact
                        ticket.save(update_fields=["contact"])
                        logger.info(f"Linked contact {contact.id} to ticket #{ticket_id_code}")

                # Process email attachments
                self.process_email_attachments(email_message, ticket)

                # Create system comment
                self.create_system_comment(ticket, subject, body_content, sender_email)

                duplicate_detection = DuplicateDetectionService().process_new_ticket(ticket, actor=user)
                if duplicate_detection:
                    setattr(ticket, "_duplicate_detection", duplicate_detection)
                    ticket.refresh_from_db()
                    if duplicate_detection.get("status") == "auto_merged" and ticket.merged_into_id:
                        EmailTicketMapping.objects.filter(message_id=message_id).update(ticket_id=ticket.merged_into_id)
                        return Ticket.objects.get(id=ticket.merged_into_id)

            logger.info(f"Created ticket #{ticket_id_code} from email: {subject}")
            return ticket

        except Exception as e:
            logger.error(f"Error creating ticket from email: {str(e)}")
            return None

    def add_comment_to_ticket(self, ticket: Ticket, email_message, message_id: str) -> bool:
        """Add email as comment to existing ticket"""
        try:
            sender_email, sender_name, sender_phone = self.extract_sender_info(email_message)
            body_content = self.parse_email_content(email_message)

            # Find user if exists
            user = None
            try:
                user = Users.objects.filter(
                    email=sender_email,
                    business=self.department_email.department.business
                ).first()
            except Exception as e:
                logger.warning(f"Error finding user {sender_email}: {str(e)}")

            with transaction.atomic():
                # Create comment on ticket
                comment = ticket.comments.create(
                    ticket=ticket,
                    content=body_content or "Email reply",
                    author=user,
                    is_internal=False
                )

                # Create email mapping
                EmailTicketMapping.objects.create(
                    message_id=message_id,
                    ticket=ticket
                )

            logger.info(f"Added comment to ticket #{ticket.ticket_id} from email")
            return True

        except Exception as e:
            logger.error(f"Error adding comment to ticket #{ticket.ticket_id}: {str(e)}")
            return False

    def assign_sla_to_ticket(self, ticket: Ticket):
        """Assign SLA to ticket if available"""
        try:
            # Find applicable SLA for the business and ticket priority
            applicable_sla = SLA.objects.filter(
                business=ticket.business,
                is_active=True,
                targets__priority=ticket.priority
            ).first()

            if applicable_sla:
                ticket.sla = applicable_sla
                ticket.save()
                logger.info(f"Assigned SLA '{applicable_sla.name}' to ticket #{ticket.ticket_id}")
            else:
                logger.warning(f"No applicable SLA found for ticket {ticket.ticket_id} with priority {ticket.priority} in business {ticket.business.name}")
        except Exception as e:
            logger.error(f"Error assigning SLA to ticket #{ticket.ticket_id}: {str(e)}")

    def process_email_attachments(self, email_message, ticket: Ticket):
        """Process email attachments and save them to the ticket"""
        try:
            if not email_message.is_multipart():
                return

            for part in email_message.walk():
                if part.get_content_maintype() == 'multipart':
                    continue

                if part.get('Content-Disposition') is None:
                    continue

                filename = part.get_filename()
                if not filename:
                    continue

                # Decode filename if necessary
                filename = decode_header(filename)[0]
                if isinstance(filename, tuple):
                    filename = filename[0].decode(filename[1] or 'utf-8') if filename[1] else filename[0]

                # Validate file extension
                file_extension = os.path.splitext(filename)[1].lower()
                allowed_extensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx']
                if file_extension not in allowed_extensions:
                    logger.warning(f"Skipping attachment {filename} - extension {file_extension} not allowed")
                    continue

                # Get attachment data
                attachment_data = part.get_payload(decode=True)
                if not attachment_data:
                    continue

                # Generate unique filename
                unique_filename = f"{uuid.uuid4()}{file_extension}"

                # Create directory scoped by business
                business = ticket.business if ticket else None
                files_dir = os.path.join(settings.MEDIA_ROOT, 'files', str(business.id)) if business else os.path.join(settings.MEDIA_ROOT, 'files')
                os.makedirs(files_dir, exist_ok=True)

                # Full file path
                file_path = os.path.join(files_dir, unique_filename)

                # Save file
                with open(file_path, 'wb') as f:
                    f.write(attachment_data)

                # Generate URL
                if business:
                    file_url = f"{settings.FILE_URL}/{business.id}/{unique_filename}"
                else:
                    file_url = f"{settings.FILE_URL}/{unique_filename}"

                # Create attachment record
                TicketAttachment.objects.create(
                    ticket=ticket,
                    file_url=file_url,
                    filename=filename,  # Save original filename from email
                    description=f"Email attachment: {filename}"
                )

                logger.info(f"Saved email attachment {filename} to ticket #{ticket.ticket_id}")

        except Exception as e:
            logger.error(f"Error processing email attachments for ticket #{ticket.ticket_id}: {str(e)}")

    def create_system_comment(self, ticket: Ticket, subject: str, body_content: str, sender_email: str):
        """Create a system comment for ticket creation"""
        try:
            system_user = Users.objects.filter(email='system@safaridesk.io').first()
            comment_content = f"Ticket Creation\nTitle: {subject}\nDescription: {body_content or 'No description provided'}\nFrom: {sender_email}"

            ticket.comments.create(
                ticket=ticket,
                author=system_user,
                content=comment_content,
                updated_by=system_user,
                is_internal=False
            )

            logger.info(f"Created system comment for ticket #{ticket.ticket_id}")

        except Exception as e:
            logger.error(f"Error creating system comment for ticket #{ticket.ticket_id}: {str(e)}")

    def process_unread_emails(self) -> Dict[str, int]:
        """Process unread emails for this department email"""
        stats = {'processed': 0, 'tickets_created': 0, 'comments_added': 0, 'errors': 0}

        if not self.connect_imap():
            stats['errors'] += 1
            return stats

        try:
            # Search for unread emails
            status, messages = self.mail.search(None, 'UNSEEN')

            if status != 'OK':
                logger.error("Failed to search for unread emails")
                return stats

            email_ids = messages[0].split()

            for email_id in email_ids:
                try:
                    # Fetch email
                    status, msg_data = self.mail.fetch(email_id, '(RFC822)')

                    if status != 'OK':
                        logger.error(f"Failed to fetch email {email_id}")
                        stats['errors'] += 1
                        continue

                    email_message = email.message_from_bytes(msg_data[0][1])
                    message_id = email_message.get('Message-ID', '')

                    # Check if already processed
                    if EmailTicketMapping.objects.filter(message_id=message_id).exists():
                        # Mark as read anyway
                        self.mail.store(email_id, '+FLAGS', '\\Seen')
                        continue

                    subject = email_message.get('Subject', '')

                    # Check if this is a reply to existing ticket
                    ticket_id_from_subject = self.extract_ticket_id_from_subject(subject)

                    if ticket_id_from_subject:
                        # Find ticket
                        try:
                            ticket = Ticket.objects.get(
                                ticket_id__iexact=ticket_id_from_subject,
                                business=self.department_email.department.business
                            )
                            if self.add_comment_to_ticket(ticket, email_message, message_id):
                                stats['comments_added'] += 1
                            else:
                                stats['errors'] += 1
                        except Ticket.DoesNotExist:
                            logger.warning(f"Ticket #{ticket_id_from_subject} not found, creating new ticket")
                            ticket = self.create_ticket_from_email(email_message, message_id)
                            if ticket:
                                stats['tickets_created'] += 1
                            else:
                                stats['errors'] += 1
                    else:
                        # Create new ticket
                        ticket = self.create_ticket_from_email(email_message, message_id)
                        if ticket:
                            stats['tickets_created'] += 1
                        else:
                            stats['errors'] += 1

                    # Mark as read
                    self.mail.store(email_id, '+FLAGS', '\\Seen')
                    stats['processed'] += 1

                except Exception as e:
                    logger.error(f"Error processing email {email_id}: {str(e)}")
                    stats['errors'] += 1

        except Exception as e:
            logger.error(f"Error in email processing: {str(e)}")
            stats['errors'] += 1

        finally:
            self.disconnect_imap()

        return stats


@shared_task
def process_emails_for_department_email(department_email_id: int) -> Dict[str, int]:
    logger.error(
        "Legacy department email ingestion task 'process_emails_for_department_email' is disabled. "
        "Use 'shared.tasks.sync_mail_integrations' or 'shared.tasks.process_mailgun_inbound'."
    )
    return {'processed': 0, 'tickets_created': 0, 'comments_added': 0, 'errors': 1}


@shared_task
def process_emails_for_business_departments(business_id: int) -> Dict[str, int]:
    logger.error(
        "Legacy business email ingestion task 'process_emails_for_business_departments' is disabled. "
        "Use 'shared.tasks.sync_mail_integrations' for supported inbound email polling."
    )
    return {'total_departments': 0, 'processed': 0, 'tickets_created': 0, 'comments_added': 0, 'errors': 1}


@shared_task
def process_emails_for_all_businesses():
    logger.error(
        "Legacy global email ingestion task 'process_emails_for_all_businesses' is disabled. "
        "Use 'shared.tasks.sync_mail_integrations' for canonical inbound email processing."
    )
    return {'total_businesses': 0, 'processed': 0, 'tickets_created': 0, 'comments_added': 0, 'errors': 1}


@shared_task
def aggregate_email_processing_results(results: List[Dict[str, int]]) -> Dict[str, int]:
    """Aggregate results from all business email processing tasks"""
    total_stats = {
        'total_businesses': len(results),
        'total_departments': 0,
        'processed': 0,
        'tickets_created': 0,
        'comments_added': 0,
        'errors': 0,
    }

    for business_result in results:
        total_stats['total_departments'] += business_result.get('total_departments', 0)
        total_stats['processed'] += business_result.get('processed', 0)
        total_stats['tickets_created'] += business_result.get('tickets_created', 0)
        total_stats['comments_added'] += business_result.get('comments_added', 0)
        total_stats['errors'] += business_result.get('errors', 0)
    logger.info(f"Aggregated email processing results: {total_stats}")
    return total_stats
