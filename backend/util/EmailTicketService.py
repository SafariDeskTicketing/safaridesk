# services/email_service.py
import email
import imaplib
import logging
from email.utils import parseaddr
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from django.conf import settings
from django.core.mail import send_mail
from django.core.exceptions import MultipleObjectsReturned

from tenant.models.TicketModel import EmailTicketMapping, Ticket, TicketComment
from users.models.UserModel import Users
from tenant.services.tickets.naming import extract_ticket_code, generate_ticket_id, render_ticket_title

logger = logging.getLogger(__name__)

class EmailTicketService:
    def __init__(self, business=None):
        self.imap_server = settings.EMAIL_HOST
        self.email_user = settings.EMAIL_HOST_USER
        self.email_password = settings.EMAIL_HOST_PASSWORD
        self.business = business
        self._last_reply_failure_reason = None
        
    def connect_to_email(self):
        """Connect to email server"""
        print("Connecting to email server...")
        if not self.imap_server or not self.email_user or not self.email_password:
            raise ValueError("Email server settings are not configured properly.")
        mail = imaplib.IMAP4_SSL(self.imap_server)
        mail.login(self.email_user, self.email_password)
        return mail
    
    def extract_ticket_id_from_subject(self, subject, business=None):
        """Extract ticket ID from email subject"""
        return extract_ticket_code(subject, business=business or self.business)

    def _extract_sender_email(self, from_header):
        """Normalize sender header into a bare email address when possible."""
        parsed = parseaddr(from_header or "")[1]
        normalized = (parsed or from_header or "").strip()
        return normalized or None

    def _resolve_reply_business(self, sender_email):
        """
        Resolve tenant scope for reply matching.
        If service business is set, use it. Otherwise infer from sender only when unambiguous.
        """
        if self.business:
            return self.business
        if not sender_email:
            return None

        business_ids = list(
            Users.objects.filter(email__iexact=sender_email, business__isnull=False)
            .values_list("business_id", flat=True)
            .distinct()[:2]
        )
        if len(business_ids) == 1:
            return business_ids[0]
        return None
    
    def parse_email_content(self, email_message):
        """Parse email content and extract text"""
        if email_message.is_multipart():
            for part in email_message.walk():
                if part.get_content_type() == "text/plain":
                    return part.get_payload(decode=True).decode('utf-8')
            return None
        else:
            return email_message.get_payload(decode=True).decode('utf-8')
    
    def create_ticket_from_email(self, email_message):
        """Create a new ticket from email"""
        subject = email_message['Subject']
        from_email = self._extract_sender_email(email_message['From'])
        message_id = email_message['Message-ID']
        content = self.parse_email_content(email_message)
        
        # Try to get or create user
        user = None
        if from_email:
            try:
                user = Users.objects.get(email__iexact=from_email)
            except Users.DoesNotExist:
                # Create user or handle anonymous tickets
                pass

        ticket_business = self.business or getattr(user, "business", None)
        ticket_code = generate_ticket_id(business=ticket_business)
        ticket_title = render_ticket_title(
            summary=subject or "No Subject",
            ticket_id=ticket_code,
            source='email',
            business=ticket_business,
        )
        
        # Create ticket
        ticket = Ticket.objects.create(
            title=ticket_title,
            description=content,
            creator_email=from_email,
            created_by=user,
            ticket_id=ticket_code,
            business=ticket_business,
            source='email',  # Mark as email-created ticket
        )
        
        # Create email mapping
        EmailTicketMapping.objects.create(
            message_id=message_id,
            ticket=ticket
        )
        
        return ticket
    
    def add_comment_to_ticket(self, ticket_code, email_message):
        """Add email as comment to existing ticket"""
        self._last_reply_failure_reason = None
        from_email = self._extract_sender_email(email_message['From'])
        message_id = email_message['Message-ID']
        content = self.parse_email_content(email_message)
        
        try:
            filters = {'ticket_id__iexact': ticket_code}
            reply_business = self._resolve_reply_business(from_email)
            if reply_business is None:
                # Refuse cross-tenant lookup when tenant cannot be determined safely.
                self._last_reply_failure_reason = "tenant_unresolved"
                return None
            filters['business'] = reply_business

            ticket = Ticket.objects.get(**filters)
            user = None
            if from_email:
                try:
                    user = Users.objects.get(email__iexact=from_email, business=ticket.business)
                except Users.DoesNotExist:
                    pass
            
            comment = TicketComment.objects.create(
                ticket=ticket,
                content=content,
                author=user,
            )
            
            # Create email mapping
            EmailTicketMapping.objects.create(
                message_id=message_id,
                ticket=ticket
            )
            
            return comment
        except Ticket.DoesNotExist:
            self._last_reply_failure_reason = "ticket_not_found"
            return None
        except MultipleObjectsReturned:
            self._last_reply_failure_reason = "multiple_ticket_matches"
            return None
    
    def process_emails(self):
        """Main method to process incoming emails"""
        mail = self.connect_to_email()
        mail.select('INBOX')
        
        # Search for unread emails
        status, messages = mail.search(None, 'UNSEEN')
        
        for msg_id in messages[0].split():
            status, msg_data = mail.fetch(msg_id, '(RFC822)')
            email_message = email.message_from_bytes(msg_data[0][1])
            
            # Check if this email is already processed
            message_id = email_message['Message-ID']
            if EmailTicketMapping.objects.filter(message_id=message_id).exists():
                continue
            
            subject = email_message['Subject']
            ticket_id = self.extract_ticket_id_from_subject(subject, business=self.business)
            
            if ticket_id:
                # This is a reply to existing ticket
                comment = self.add_comment_to_ticket(ticket_id, email_message)
                if comment is None:
                    logger.warning(
                        "Skipping unresolved reply email; leaving unread "
                        "(message_id=%s, ticket_code=%s, reason=%s)",
                        message_id,
                        ticket_id,
                        self._last_reply_failure_reason or "unknown",
                    )
                    continue
            else:
                # This is a new ticket
                self.create_ticket_from_email(email_message)
            
            # Mark as read
            mail.store(msg_id, '+FLAGS', '\\Seen')
        
        mail.close()
        mail.logout()
    
    def send_ticket_notification(self, ticket, is_new=True):
        """Send email notification for ticket updates"""
        if is_new:
            subject = f"New Ticket Created: #{ticket.id} - {ticket.subject}"
            message = f"A new support ticket has been created:\n\nTicket ID: #{ticket.id}\nSubject: {ticket.subject}\nFrom: {ticket.email_from}\n\nDescription:\n{ticket.description}"
        else:
            subject = f"Ticket Updated: #{ticket.id} - {ticket.subject}"
            message = f"Ticket #{ticket.id} has been updated."

        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [ticket.email_from],
            fail_silently=False,
        )

    def send_template_email(self, template_name, recipient_email, context, business):
        """
        Send email using template from EMAIL_TEMPLATES dictionary

        Args:
            template_name (str): Name of the template in EMAIL_TEMPLATES
            recipient_email (str): Email address of the recipient
            context (dict): Context variables for template rendering
            business: Business object for SMTP configuration

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        try:
            from shared.services.notification_preferences import NotificationSettingsService
            from util.email.templates import EMAIL_TEMPLATES
            from util.email.mappings import PLACEHOLDER_MAPPINGS
            from django.template import Template, Context
            from django.core.mail import EmailMultiAlternatives
            from django.utils.html import linebreaks
            from util.Mailer import Mailer

            # Get template from EMAIL_TEMPLATES
            if template_name not in EMAIL_TEMPLATES:
                print(f"Template {template_name} not found in EMAIL_TEMPLATES")
                return False

            if not NotificationSettingsService.should_send_email_for_template(
                recipient_email,
                template_name,
                business,
            ):
                logger.info(
                    "[EmailTicketService] Email '%s' suppressed for %s by notification preferences",
                    template_name,
                    recipient_email,
                )
                return False

            template_data = EMAIL_TEMPLATES[template_name]

            # Get SMTP connection
            mailer = Mailer()
            connection, from_email = mailer.get_smtp_connection_for_business(business)

            # Create safe context dict
            class SafeDict(dict):
                def __missing__(self, key):
                    return ''

            safe_context = SafeDict(context)

            # Render subject and body
            subject_template = Template(template_data['subject'])
            body_template = Template(template_data['body'])

            subject = subject_template.render(Context(safe_context))
            body_text = body_template.render(Context(safe_context))
            body_html = linebreaks(body_text)

            # Create and send email
            email = EmailMultiAlternatives(
                subject=subject,
                body=body_text,
                from_email=from_email,
                to=[recipient_email],
                connection=connection
            )

            # Attach HTML version
            email.attach_alternative(body_html, "text/html")

            # Send email
            email.send(fail_silently=False)

            print(f"Template email '{template_name}' sent successfully to {recipient_email}")
            return True

        except Exception as e:
            print(f"Failed to send template email '{template_name}' to {recipient_email}: {str(e)}")
            return False
