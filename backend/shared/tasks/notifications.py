import logging
import email
from datetime import datetime, timedelta
from html import escape

from celery import shared_task
from django.conf import settings
from django.core.mail import get_connection, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

from shared.services.notification_preferences import NotificationSettingsService
from shared.workers import Email
from shared.workers.email_reply import send_email_reply_task  # Register with Celery
from tenant.models import Requests, Task, MailIntegration, MailFetchLog
from tenant.models.SlaModel import SLATracker
from tenant.services.audit import log_audit_event
from users.models import Users
from util.EmailTicketService import EmailTicketService
from util.Mailer import Mailer
from util.mail import (
    MailIngestionCoordinator,
    MailIntegrationIngestionService,
    refresh_google_token,
    refresh_microsoft_token,
)

logger = logging.getLogger(__name__)


mailer = Mailer()


def _safe_display_name(user: Users) -> str:
    first = (getattr(user, 'first_name', '') or '').strip()
    last = (getattr(user, 'last_name', '') or '').strip()
    full = f"{first} {last}".strip()
    if full:
        return full
    username = (getattr(user, 'username', '') or '').strip()
    if username:
        return username
    email_value = (getattr(user, 'email', '') or '').strip()
    if email_value and '@' in email_value:
        return email_value.split('@')[0]
    return email_value or 'User'

@shared_task(name="shared.tasks.process_incoming_emails")
def process_incoming_emails():
    message = (
        "Legacy inbound email task 'process_incoming_emails' is disabled. "
        "Use 'shared.tasks.sync_mail_integrations' for polling integrations "
        "and 'shared.tasks.process_mailgun_inbound' for webhook-driven mailboxes."
    )
    logger.error(message)
    return {"status": "blocked", "message": message}


@shared_task(name="shared.tasks.process_all_emails_sync")
def process_all_emails_sync():
    message = (
        "Legacy inbound email task 'process_all_emails_sync' is disabled. "
        "Use 'shared.tasks.sync_mail_integrations' for supported mail polling."
    )
    logger.error(message)
    return {"status": "blocked", "message": message}


@shared_task(name="shared.tasks.refresh_mail_integration_tokens")
def refresh_mail_integration_tokens():
    """
    Refresh OAuth access tokens for Google and Microsoft mail integrations before expiry.
    """
    integrations = MailIntegration.objects.filter(
        is_active=True,
        provider__in=[MailIntegration.Provider.GMAIL, MailIntegration.Provider.OFFICE365],
    ).exclude(oauth_refresh_token_encrypted="")
    refreshed = 0
    errors = 0
    now = timezone.now()
    leeway = timedelta(minutes=10)

    for integration in integrations:
        refresh_token = integration.get_secret("oauth_refresh_token")
        if not refresh_token:
            continue
        if integration.oauth_expires_at and integration.oauth_expires_at - now > leeway:
            continue
        try:
            if integration.provider == MailIntegration.Provider.GMAIL:
                token_data = refresh_google_token(refresh_token)
            else:
                token_data = refresh_microsoft_token(refresh_token)
            integration.set_secret("oauth_access_token", token_data.get("access_token"))
            integration.oauth_expires_at = token_data.get("expires_at")
            update_fields = ["oauth_access_token_encrypted", "oauth_expires_at", "provider_metadata"]
            # Microsoft may rotate the refresh token — persist it when returned
            if token_data.get("refresh_token"):
                integration.set_secret("oauth_refresh_token", token_data["refresh_token"])
                update_fields.append("oauth_refresh_token_encrypted")
            metadata = integration.provider_metadata or {}
            oauth_meta = metadata.get("oauth", {})
            oauth_meta.update(
                {
                    "scope": token_data.get("scope"),
                    "token_type": token_data.get("token_type"),
                    "refreshed_at": timezone.now().isoformat(),
                }
            )
            metadata["oauth"] = oauth_meta
            integration.provider_metadata = metadata
            integration.save(update_fields=update_fields)
            logger.info(
                "mail_integration_token_refreshed",
                extra={
                    "integration_id": integration.id,
                    "provider": integration.provider,
                    "expires_at": integration.oauth_expires_at.isoformat() if integration.oauth_expires_at else None,
                },
            )
            refreshed += 1
        except Exception as exc:
            logger.exception(
                "mail_integration_token_refresh_failed",
                extra={"integration_id": integration.id, "provider": integration.provider, "error": str(exc)},
            )
            integration.mark_failure(str(exc))
            # A 400 from the OAuth provider means the refresh token is permanently invalid
            # (revoked, expired, or consent removed). Deactivate to stop retrying.
            from requests.exceptions import HTTPError
            if isinstance(exc, HTTPError) and exc.response is not None and exc.response.status_code == 400:
                integration.is_active = False
                integration.save(update_fields=["is_active"])
                logger.warning(
                    "mail_integration_deactivated_invalid_token",
                    extra={"integration_id": integration.id, "provider": integration.provider},
                )
            errors += 1

    return {"refreshed": refreshed, "errors": errors}


@shared_task(name="shared.tasks.sync_mail_integrations")
def sync_mail_integrations():
    """
    Run the mail ingestion coordinator across all active integrations.
    """
    # Skip safaridesk (webhook-driven) integrations from IMAP polling
    coordinator = MailIngestionCoordinator()
    summary = coordinator.run(exclude_providers=[MailIntegration.Provider.SAFARIDESK])
    logger.info(
        "Mail ingestion summary: integrations=%s processed=%s tickets=%s replies=%s errors=%s",
        summary["integrations"],
        summary["processed"],
        summary["tickets_created"],
        summary["replies_added"],
        summary["errors"],
    )
    return summary


@shared_task
def send_ticket_notification(ticket_data, department_id):
    """
    Send new ticket notification to department members

    Args:
        ticket_data (dict): Dictionary containing ticket information
        department_id (int): ID of the department to notify
    """
    try:
        from tenant.models import Department, SettingSMTP
        from users.models import Users

        try:
            department = Department.objects.select_related("business").get(id=department_id)
            business = department.business
        except Department.DoesNotExist:
            logger.error(f"Department with ID {department_id} not found")
            return False

        # department_members = Users.objects.filter(
        #     department=department,
        #     is_active=True,
        #     email__isnull=False
        # ).exclude(email='')

        department_members = Users.objects.filter(
            department__in=[department],
            business=department.business,
            is_active=True,
            status='A',
            email__isnull=False
        ).exclude(email='')

        if not department_members.exists():
            logger.warning(f"No active members found for department {department.name}")
            return False

        # Load SMTP settings for this business
        smtp_setting = SettingSMTP.objects.filter(business=business).first()

        if not smtp_setting:
            logger.error(f"No SMTP settings configured for business: {business}")
            return False



        # mailer = Mailer()
        connection, from_email = mailer.get_smtp_connection_for_business(business)

        # Prepare email context
        context = {
            **mailer.get_email_brand_context(business),
            'ticket_id': ticket_data.get('ticket_id'),
            'title': ticket_data.get('title'),
            'department_name': department.name,
            'due_date': ticket_data.get('due_date'),
            'priority': ticket_data.get('priority', 'medium').lower(),
            'creator_name': ticket_data.get('creator_name', 'N/A'),
            'creator_email': ticket_data.get('creator_email', 'N/A'),
            'creator_phone': ticket_data.get('creator_phone', 'N/A'),
            'category_name': ticket_data.get('category_name', 'General'),
            'description': ticket_data.get('description', 'No description provided'),
            'ticket_url': f"{settings.FRONTEND_URL}/tickets/{ticket_data.get('ticket_id')}",
        }

        html_content = render_to_string('new-ticket.html', context)

        plain_text_content = f"""
        New Ticket Assignment - {context['ticket_id']}

        Dear {context['department_name']} Team,

        A new support ticket {context['ticket_id']} has been assigned to your department.

        Details:
        - Title: {context['title']}
        - Priority: {context['priority'].upper()}
        - Due Date: {context['due_date']}
        - Requester: {context['creator_name']} ({context['creator_email']})

        Description:
        {context['description']}

        Please log in to the system to view and assign this ticket.

        Best regards,
        IT Service Management System
        """

        recipient_emails = [
            email
            for email in department_members.values_list('email', flat=True)
            if NotificationSettingsService.should_send_email_for_template(
                email,
                "NEW_TICKET_ALERT",
                business,
            )
        ]
        if not recipient_emails:
            logger.info(
                "All department recipients suppressed by preferences for NEW_TICKET_ALERT on department %s",
                department.id,
            )
            return True
        subject = f"New Ticket Assignment - {context['ticket_id']} [{context['priority'].upper()} Priority]"

        for email in recipient_emails:
            try:
                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=plain_text_content,
                    from_email=from_email,
                    to=[email],
                    connection=connection
                )
                msg.attach_alternative(html_content, "text/html")
                msg.send()
                logger.info(f"Ticket notification sent successfully to {email}")
            except Exception as e:
                logger.error(f"Failed to send email to {email}: {str(e)}")
                continue

        logger.info(f"Ticket notification process completed for ticket {context['ticket_id']}")
        return True

    except Exception as e:
        logger.error(f"Error in send_ticket_notification task: {str(e)}")
        return False


@shared_task
def send_otp(otp, user_email):
    try:
        from users.models import Users

        logger.info(f"Sending OTP: {otp} to {user_email} ...........................")

        if not otp or not user_email:
            logger.error("OTP or user email is missing")
            return False

        # Fetch user
        try:
            user = Users.objects.filter(email__iexact=user_email).first()
            if not user:
                logger.error(f"User with email {user_email} not found")
                return False
        except Exception as e:
            logger.error(f"Database error when fetching user {user_email}: {str(e)}")
            return False

        # Email context
        context = {
            **mailer.get_email_brand_context(getattr(user, 'business', None)),
            'name': user.full_name() if hasattr(user, 'full_name') and callable(user.full_name) else 'User',
            'otp': otp,
        }

        subject = "Your verification OTP"

        plain_text_content = f"""
        Hi {context['name']},

        Your verification OTP is: {otp}

        This OTP will expire in a few minutes. Please use it to complete your verification.

        If you didn't request this OTP, please ignore this email.

        Best regards,
        Your Team
        """

        try:
            html_content = render_to_string('otp.html', context)
        except Exception as e:
            logger.warning(f"Failed to render HTML template: {str(e)}")
            html_content = None

        # Get SMTP connection and from_email for user's business
        try:
            # mailer = Mailer()
            connection, from_email = mailer.get_smtp_connection_for_business(user.business)
        except Exception as e:
            logger.error(f"Error getting SMTP config: {str(e)}")
            return False

        # Prepare email
        try:
            email_message = EmailMultiAlternatives(
                subject=subject,
                body=plain_text_content,
                from_email=from_email,
                to=[user_email],
                connection=connection
            )

            if html_content:
                email_message.attach_alternative(html_content, "text/html")

            email_message.send()
            logger.info(f"OTP email sent successfully to {user_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send OTP email to {user_email}: {str(e)}")
            return False

    except ImportError as e:
        logger.error(f"Import error in send_otp: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error in send_otp: {str(e)}")
        return False

@shared_task
def send_ticket_assignment_email(ticket_id, agent_email, assignment_notes=None):
    """
    Send ticket assignment notification email to assigned agent

    Args:
        ticket_id: ID of the assigned ticket
        agent_email: Email of the assigned agent
        assignment_notes: Optional notes from supervisor/assigner
    """
    try:
        from tenant.models import Ticket  # Adjust import based on your model location
        from users.models import Users     # Adjust import based on your model location

        logger.info("Sending ticket assignment notification for ticket %s to %s", ticket_id, agent_email)

        # Validate inputs
        if not ticket_id or not agent_email:
            logger.error("Ticket ID or agent email is missing")
            return False

        # Get ticket from database
        try:
            ticket = Ticket.objects.select_related(
                'assigned_to', 'category', 'department'
            ).filter(id=ticket_id).first()

            if not ticket:
                logger.error(f"Ticket with ID {ticket_id} not found")
                return False
        except Exception as e:
            logger.error(f"Database error when fetching ticket {ticket_id}: {str(e)}")
            return False

        # Get assigned agent from database
        try:
            agent = Users.objects.filter(email=agent_email).first()
            if not agent:
                logger.error(f"Agent with email {agent_email} not found")
                return False
        except Exception as e:
            logger.error(f"Database error when fetching agent {agent_email}: {str(e)}")
            return False

        # Prepare email context
        try:
            # Build ticket URL (adjust based on your URL structure)
            ticket_url = f"{settings.FRONTEND_URL}/tickets/{ticket.id}" if hasattr(settings, 'FRONTEND_URL') else f"/tickets/{ticket.id}"

            context = {
                **mailer.get_email_brand_context(getattr(agent, 'business', None)),
                'agent_name': agent.full_name() if hasattr(agent, 'full_name') and callable(agent.full_name) else agent.email,
                'ticket_id': ticket.ticket_id,
                'title': ticket.title or "No title provided",
                'description': ticket.description or "No description provided",
                'due_date': ticket.due_date.strftime('%B %d, %Y at %I:%M %p') if ticket.due_date else "Not specified",
                'priority': ticket.priority.lower() if ticket.priority else 'medium',
                'category_name': ticket.category.name if ticket.category else "General",
                'department_name': ticket.department.name if ticket.department else "IT Support",
                'creator_name': ticket.creator_name,
                'creator_email': ticket.creator_email,
                'creator_phone': ticket.creator_phone,
                'ticket_url': ticket_url,
                'assignment_notes': assignment_notes,
            }
        except Exception as e:
            logger.error(f"Error preparing email context for ticket {ticket_id}: {str(e)}")
            # Fallback context with minimal information
            context = {
                **mailer.get_email_brand_context(getattr(agent, 'business', None)),
                'agent_name': agent_email,
                'ticket_id': f"#{ticket_id}",
                'title': 'Ticket Assignment',
                'description': 'Please check the ticket details in the system',
                'due_date': 'Please check system',
                'priority': 'medium',
                'category_name': 'General',
                'department_name': 'IT Support',
                'creator_name': 'Unknown',
                'creator_email': 'Not provided',
                'creator_phone': 'Not provided',
                'ticket_url': f"/tickets/{ticket_id}",
                'assignment_notes': assignment_notes,
            }

        subject = f"Ticket Assignment: {context['title']} (#{context['ticket_id']})"

        # Create plain text content
        plain_text_content = f"""
        Hello {context['agent_name']},

        You have been assigned a new support ticket that requires your attention.

        Ticket Details:
        - Ticket ID: {context['ticket_id']}
        - Title: {context['title']}
        - Priority: {context['priority'].title()}
        - Due Date: {context['due_date']}
        - Category: {context['category_name']}
        - Department: {context['department_name']}

        Requester Information:
        - Name: {context['creator_name']}
        - Email: {context['creator_email']}
        - Phone: {context['creator_phone']}

        Description:
        {context['description']}

        {"Assignment Notes: " + context['assignment_notes'] if context['assignment_notes'] else ""}

        Please log into the system to start working on this ticket: {context['ticket_url']}

        Important: This ticket is due on {context['due_date']}. Please ensure timely resolution and keep the requester updated on progress.

        Best regards,
        IT Service Management System
        """

        # Render HTML template
        try:
            html_content = render_to_string('assigned-ticket.html', context)
        except Exception as e:
            logger.error(f"Error rendering HTML template for ticket assignment: {str(e)}")
            # Fallback to plain text only
            html_content = None

        try:
            # Create email message
            # mailer = Mailer()
            connection, from_email = mailer.get_smtp_connection_for_business(agent.business)


            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_text_content,
                from_email=from_email,
                to=[agent.email],
                connection=connection
            )

            # Attach HTML version if available
            if html_content:
                email.attach_alternative(html_content, "text/html")

            # Send email
            email.send()

            logger.info(f"Ticket assignment email sent successfully to {agent_email} for ticket {ticket_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to send ticket assignment email to {agent_email} for ticket {ticket_id}: {str(e)}")
            return False

    except ImportError as e:
        logger.error(f"Import error in send_ticket_assignment_email: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error in send_ticket_assignment_email: {str(e)}")
        return False


@shared_task
def send_comment_notification(ticket_id, author_email, comment_id):
    """
    Send comment notification email to assigned agent when a new comment is added

    Args:
        ticket_id: ID of the ticket
        assigned_to_email: Email of the assigned agent (recipient)
        author_email: Email of the comment author
        comment: Comment object or comment data
    """
    try:
        from tenant.models import Ticket, TicketComment  # Adjust import based on your model location
        from users.models import Users             # Adjust import based on your model location


        # Get ticket from database
        try:
            ticket = Ticket.objects.select_related(
                'assigned_to', 'category', 'department'
            ).filter(id=ticket_id).first()

            if not ticket:
                logger.error(f"Ticket with ID {ticket_id} not found")
                return False
        except Exception as e:
            logger.error(f"Database error when fetching ticket {ticket_id}: {str(e)}")
            return False

        logger.info("Sending comment notification for ticket %s to %s", ticket_id, ticket.assigned_to.email)



        assigned_to_email = ticket.assigned_to.email
        assigned_agent = ticket.assigned_to





        # Get comment author from database
        try:
            comment_author = Users.objects.filter(email=author_email).first()
            if not comment_author:
                logger.warning(f"Comment author with email {author_email} not found, using email as name")
                author_name = author_email
                author_role = "User"
                author_department = "External"
                author_initials = author_email[:2].upper()
            else:
                author_name = comment_author.full_name() if hasattr(comment_author, 'full_name') and callable(comment_author.full_name) else comment_author.email
                author_role = getattr(comment_author, 'role', 'User')
                author_department = getattr(comment_author, 'department', 'General')
                # Get initials from full name or email
                if hasattr(comment_author, 'first_name') and hasattr(comment_author, 'last_name'):
                    author_initials = (comment_author.first_name[:1] + comment_author.last_name[:1]).upper()
                else:
                    author_initials = author_name[:2].upper()
        except Exception as e:
            logger.error(f"Database error when fetching comment author {author_email}: {str(e)}")
            # Fallback values
            author_name = author_email
            author_role = "User"
            author_department = "External"
            author_initials = author_email[:2].upper()

        # Get comment details
        try:
            comment = TicketComment.objects.filter(id=comment_id).first()
            comment_text = comment.content
            comment_date = comment.created_at.strftime('%B %d, %Y')
            comment_time = comment.created_at.strftime('%I:%M %p')

        except Exception as e:
            logger.error(f"Error processing comment data: {str(e)}")
            comment_text = "Error loading comment content"
            comment_date = datetime.now().strftime('%B %d, %Y')
            comment_time = datetime.now().strftime('%I:%M %p')

        # Get total comments count
        try:
            total_comments = TicketComment.objects.filter(ticket=ticket).count()
        except Exception as e:
            logger.warning(f"Could not get comment count for ticket {ticket_id}: {str(e)}")
            total_comments = 1

        # Prepare email context
        try:
            # Build URLs (adjust based on your URL structure)
            base_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else ""
            ticket_url = f"{base_url}/tickets/{ticket.id}"
            reply_url = f"{base_url}/tickets/{ticket.id}#reply"
            unsubscribe_url = f"{base_url}/notifications/unsubscribe?ticket={ticket.id}&user={assigned_agent.id}"
            unwatch_url = f"{base_url}/tickets/{ticket.id}/unwatch"

            context = {
                **mailer.get_email_brand_context(getattr(ticket, 'business', None)),
                # Recipient info
                'recipient_name': assigned_agent.full_name() if hasattr(assigned_agent, 'full_name') and callable(assigned_agent.full_name) else assigned_agent.email,

                # Ticket info
                'ticket_id': ticket.ticket_id if hasattr(ticket, 'ticket_id') else f"#{ticket.id}",
                'ticket_title': ticket.title or "No title provided",
                'priority': ticket.priority.lower() if ticket.priority else 'medium',
                'status': ticket.status or 'Open',
                'assigned_to': assigned_agent.full_name() if hasattr(assigned_agent, 'full_name') and callable(assigned_agent.full_name) else assigned_agent.email,
                'last_updated': ticket.updated_at.strftime('%B %d, %Y at %I:%M %p') if hasattr(ticket, 'updated_at') and ticket.updated_at else comment_date + ' at ' + comment_time,

                # Comment info
                'commenter_name': author_name,
                'commenter_role': author_role,
                'commenter_department': author_department,
                'commenter_initials': author_initials,
                'comment_text': comment_text,
                'comment_date': comment_date,
                'comment_time': comment_time,
                'total_comments': total_comments,

                # URLs
                'ticket_url': ticket_url,
                'reply_url': reply_url,
                'unsubscribe_url': unsubscribe_url,
                'unwatch_url': unwatch_url,

                # Company info
                'company_name': getattr(getattr(ticket, 'business', None), 'name', 'SafariDesk'),
            }
        except Exception as e:
            logger.error(f"Error preparing email context for ticket {ticket_id}: {str(e)}")
            return False

        subject = f"New Comment: {context['ticket_title']} ({context['ticket_id']})"

        # Create plain text content
        plain_text_content = f"""
Hello {context['recipient_name']},

A new comment has been added to ticket {context['ticket_id']} that you are assigned to.

Ticket Details:
- Ticket ID: {context['ticket_id']}
- Title: {context['ticket_title']}
- Status: {context['status']}
- Priority: {context['priority'].title()}

New Comment by {context['commenter_name']} ({context['commenter_role']}):
"{context['comment_text']}"

Comment added on: {context['comment_date']} at {context['comment_time']}
Total comments: {context['total_comments']}

View full ticket: {context['ticket_url']}
Reply to comment: {context['reply_url']}

You are receiving this notification because you are assigned to this ticket.
To stop watching this ticket: {context['unwatch_url']}

Best regards,
IT Service Management System
        """

        # Render HTML template
        try:
            html_content = render_to_string('comment-added.html', context)
        except Exception as e:
            logger.error(f"Error rendering HTML template for comment notification: {str(e)}")
            # Fallback to plain text only
            html_content = None

        try:

            # mailer = Mailer()
            connection, from_email = mailer.get_smtp_connection_for_business(ticket.business)


            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_text_content,
                from_email=from_email,
                to=[assigned_to_email],
                connection=connection
            )



            # Attach HTML version if available
            if html_content:
                email.attach_alternative(html_content, "text/html")

            # Send email
            email.send()

            logger.info(f"Comment notification email sent successfully to {assigned_to_email} for ticket {ticket_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to send comment notification email to {assigned_to_email} for ticket {ticket_id}: {str(e)}")
            return False

    except ImportError as e:
        logger.error(f"Import error in send_comment_notification: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error in send_comment_notification: {str(e)}")
        return False

@shared_task
def send_welcome_message(business_id, user_id, raw_password):
    """
    Send welcome email to new user with login credentials

    Args:
        business_id (int): ID of the business/organization
        user_id (int): ID of the newly created user
        raw_password (str): The plain text password for the new user
    """
    try:
        # Import models inside the task to avoid circular imports

        from users.models import Users
        from users.models.BusinessModel import Business


        # Get the business and user
        try:
            business = Business.objects.get(id=business_id)
            user = Users.objects.get(id=user_id)

            if not user.email:
                logger.warning(f"User {user.id} has no email address")
                return False

        except Business.DoesNotExist:
            logger.error(f"Business with ID {business_id} not found")
            return False
        except Users.DoesNotExist:
            logger.error(f"User with ID {user_id} not found")
            return False


        # Get user role display name

        # Prepare email context
        context = {
            **mailer.get_email_brand_context(business),
            'user_name': user.full_name() or user.first_name or user.username,
            'username': user.username,
            'password': raw_password,
            'subdomain_url': business.domain_url,
            'organization_name': business.name,
            'user_email': user.email,
            'business_logo': mailer.get_email_brand_context(business).get('business_logo'),
        }

        # Render HTML template
        html_content = render_to_string('new-business.html', context)

        # Create plain text version (fallback)
        plain_text_content = f"""
        Welcome to SafariDesk - Your Account is Ready!

        Hello {context['user_name']},

        Welcome to SafariDesk! Your account has been successfully created for {context['organization_name']}.

        Your Login Credentials:
        - Username: {context['username']}
        - Password: {context['password']}
        - Portal URL: {context['subdomain_url']}

        About SafariDesk:
        SafariDesk is a comprehensive ticketing and customer support management system designed to streamline your support operations. Whether you're handling customer inquiries, technical issues, or internal requests, SafariDesk provides the tools you need to deliver exceptional service.

        Key Features:
        • Smart Ticket Management - Automatically categorize, prioritize, and route tickets
        • Team Collaboration - Work together with internal notes and assignments
        • Advanced Analytics - Track performance metrics and customer satisfaction
        • Automation Engine - Set up automated workflows and responses
        • Multi-Channel Support - Manage tickets from email, web, chat, and more
        • Customizable Workflows - Tailor the system to match your processes

        Next Steps:
        1. Log in to your SafariDesk portal using the credentials above
        2. Complete your profile setup and change your password
        3. Explore the dashboard and familiarize yourself with the interface
        4. Set up your notification preferences
        5. Review any training materials provided by your administrator

        Security Reminder:
        Keep your login credentials secure and never share them with others. We recommend changing your password after your first login.

        Need Help?
        • Email: support@safariDesk.com
        • Live Chat: Available in your portal

        Best regards,
        The SafariDesk Team

        ---
        This email was sent to {context['user_email']}
        SafariDesk. All rights reserved.
        """

        # Email subject
        subject = "Welcome to SafariDesk - Your Account is Ready!"

        try:
            connection, from_email = mailer.get_smtp_connection_for_business(user.business)

            sent = mailer.send_rendered_email(
                template_name="WELCOME_EMAIL",
                business=user.business,
                connection=connection,
                from_email=from_email,
                receiver_email=user.email,
                subject=subject,
                plain_text_body=plain_text_content.strip(),
                html_body=html_content,
            )

            if sent:
                logger.info(f"Welcome email sent successfully to {user.email} for user {user.id}")
                if hasattr(user, 'welcome_email_sent'):
                    user.welcome_email_sent = True
                    user.welcome_email_sent_at = timezone.now()
                    user.save(update_fields=['welcome_email_sent', 'welcome_email_sent_at'])
                return True
            else:
                logger.error(f"Failed to send welcome email to {user.email}")
                return False

        except Exception as e:
            logger.error(f"Failed to send welcome email to {user.email}: {str(e)}")
            return False

    except Exception as e:
        logger.error(f"Error in send_welcome_message task: {str(e)}")
        return False
@shared_task(name="create_notification_task")
def create_notification_task(user_id, ticket_id, message, notification_type, metadata=None):
    """
    Create a notification and send it via WebSocket in real-time
    """
    # logger.info(f"Creating notification task - User: {user_id}, Ticket: {ticket_id}, Type: {notification_type}")

    try:
        from users.models import Users
        from tenant.models.TicketModel import Ticket


        user = Users.objects.get(id=user_id)
        ticket = Ticket.objects.get(id=ticket_id)

        # logger.info(f"Found user: {user.username} (ID: {user.id}) and ticket: {ticket.ticket_id}")

        # Create notification in database
        notification = NotificationSettingsService.create_in_app_notification(
            user=user,
            ticket=ticket,
            message=message,
            notification_type=notification_type,
            metadata=metadata or {},
        )

        if not notification:
            logger.info(
                "Notification suppressed by settings - user=%s type=%s",
                getattr(user, 'email', user.id),
                notification_type,
            )
            return None

        logger.info(f"[SUCCESS] Notification sent - ID: {notification.id}")
        return notification.id

    except Users.DoesNotExist:
        logger.error(f"[ERROR] User with ID {user_id} not found")
        return None
    except Ticket.DoesNotExist:
        logger.error(f"[ERROR] Ticket with ID {ticket_id} not found")
        return None
    except Exception as e:
        logger.error(f"[ERROR] Notification task failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return None



@shared_task
def send_bulk_notifications(user_ids, message, notification_type="ticket_assigned"):
    """
    Send notifications to multiple users at once
    """
    for user_id in user_ids:
        create_notification_task.delay(
            user_id=user_id,
            message=message,
            notification_type=notification_type
        )

@shared_task
def send_ticket_creation_notification_to_customer(id):
    """
    Send new ticket notification to the customer when a ticket is created.
    """
    try:
        from tenant.models import SettingSMTP, Ticket


        # Fetch ticket
        try:
            ticket = Ticket.objects.select_related("business").get(id=id)

        except Ticket.DoesNotExist:
            return False

        # Get SMTP connection
        try:
            connection, from_email = mailer.get_smtp_connection_for_business(ticket.business)
        except Exception as e:
            logger.error(f"SMTP connection failed for business {ticket.business.name}: {str(e)}")
            return False

        # Prepare email context
        context = {
            **mailer.get_email_brand_context(ticket.business),
            'ticket_id': ticket.ticket_id,
            'title': ticket.title,
            'description': ticket.description,
            'ticket_url': f"{settings.FRONTEND_URL_BASE}/ticket/{ticket.ticket_id}",
        }

        html_content = render_to_string('customer-new-ticket.html', context)
        plain_text_content = strip_tags(html_content)

        subject = f"Ticket Created - {context['ticket_id']}"
        creator_email = ticket.creator_email

        # Send email
        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_text_content,
                from_email=from_email,
                to=[creator_email],
                connection=connection
            )
            msg.attach_alternative(html_content, "text/html")
            msg.send()
            logger.info(f"Ticket notification sent successfully to {creator_email}")
        except Exception as e:
            logger.error(f"Failed to send email to {creator_email}: {str(e)}")
            return False

        return True

    except Exception as e:
        logger.error(f"Unexpected error in send_ticket_notification task: {str(e)}")
        return False
@shared_task
def request_notification(reqId):
    """
    Send a generic notification email to the request creator
    """
    try:
        req = Requests.objects.get(id=reqId)
        connection, from_email = mailer.get_smtp_connection_for_business(req.business)
        subject = f"Request Received - {req.ref_number or req.title}"
        to_email = req.creator_email

        reference = req.ref_number or req.title
        submitted_on = req.created_at.strftime('%B %d, %Y %I:%M %p')

        # Compose email body
        message = f"""
Hello {req.creator_name},

Thank you for reaching out to {req.business.name}.
We have received your request and our team will review it shortly.

Request Details:
- Reference Number: {reference}
- Title: {req.title}
- Type: {req.get_type_display()}
- Status: {req.get_status_display()}
- Submitted On: {submitted_on}

You will receive updates as soon as progress is made on your request.

If you need immediate assistance, you can reply to this email or contact our support team at {req.business.support_email if hasattr(req.business, 'support_email') else 'support@example.com'}.

Best regards,
{req.business.name} Support Team
""".strip()

        html_body = render_to_string('email/base.html', {
            **mailer.get_email_brand_context(req.business),
            'eyebrow': 'Request received',
            'headline': 'We received your request',
            'preheader': f"Request {reference} was received by {req.business.name}.",
            'body_html': f"""
<p>Hello {escape(req.creator_name or 'there')},</p>
<p>Thank you for reaching out to {escape(req.business.name)}. We have received your request and our team will review it shortly.</p>
<table role="presentation" class="data-table" cellpadding="0" cellspacing="0" width="100%" style="margin-top:22px;">
  <tr><td class="data-label">Reference</td><td class="data-value"><strong>{escape(str(reference))}</strong></td></tr>
  <tr><td class="data-label">Title</td><td class="data-value">{escape(req.title or 'Support request')}</td></tr>
  <tr><td class="data-label">Type</td><td class="data-value">{escape(req.get_type_display())}</td></tr>
  <tr><td class="data-label">Status</td><td class="data-value">{escape(req.get_status_display())}</td></tr>
  <tr><td class="data-label">Submitted</td><td class="data-value">{escape(submitted_on)}</td></tr>
</table>
<p style="margin-top:22px;">You will receive updates as soon as progress is made on your request.</p>
""",
            'signature_name': f"{req.business.name} Support Team",
        })

        email = EmailMultiAlternatives(
            subject=subject,
            body=message,
            from_email=from_email,
            to=[to_email],
            connection=connection
        )
        email.attach_alternative(html_body, "text/html")
        email.send()
        logger.info(f"Notification email sent to {to_email} with subject '{subject}'")
        return True

    except Exception as e:
        logger.error(f"Failed to send notification email for request {reqId}: {str(e)}")
        return False

@shared_task
def notify_admins_of_request(reqId):
    """
    Send notification email to all admins of the business when a new request is created
    """
    try:
        req = Requests.objects.get(id=reqId)

        # Get admins: superusers OR users in the "Admin" group
        admins = Users.objects.filter(
            business=req.business,
            is_active=True,
            status='A',
        ).filter(
            models.Q(role__name="admin")
        ).distinct()

        if not admins.exists():
            logger.warning(f"No admins found for business {req.business.name}")
            return False

        connection, from_email = mailer.get_smtp_connection_for_business(req.business)

        subject = f"New Request Submitted - {req.ref_number or req.title}"
        to_emails = [admin.email for admin in admins if admin.email]

        reference = req.ref_number or req.title
        submitted_on = req.created_at.strftime('%B %d, %Y %I:%M %p')

        message = f"""
Hello Admin,

A new request has been submitted for {req.business.name}.

Request Details:
- Reference Number: {reference}
- Title: {req.title}
- Type: {req.get_type_display()}
- Status: {req.get_status_display()}
- Created By: {req.creator_name} ({req.creator_email}, {req.creator_phone})
- Submitted On: {submitted_on}

Please log in to the admin portal to review and take action.

Best regards,
{req.business.name} System
        """.strip()

        html_body = render_to_string('email/base.html', {
            **mailer.get_email_brand_context(req.business),
            'eyebrow': 'New request',
            'headline': 'A new request was submitted',
            'preheader': f"Request {reference} needs review.",
            'body_html': f"""
<p>Hello Admin,</p>
<p>A new request has been submitted for {escape(req.business.name)}.</p>
<table role="presentation" class="data-table" cellpadding="0" cellspacing="0" width="100%" style="margin-top:22px;">
  <tr><td class="data-label">Reference</td><td class="data-value"><strong>{escape(str(reference))}</strong></td></tr>
  <tr><td class="data-label">Title</td><td class="data-value">{escape(req.title or 'Support request')}</td></tr>
  <tr><td class="data-label">Type</td><td class="data-value">{escape(req.get_type_display())}</td></tr>
  <tr><td class="data-label">Status</td><td class="data-value">{escape(req.get_status_display())}</td></tr>
  <tr><td class="data-label">Created by</td><td class="data-value">{escape(req.creator_name or 'Unknown')} &lt;{escape(req.creator_email or 'No email')}&gt;</td></tr>
  <tr><td class="data-label">Submitted</td><td class="data-value">{escape(submitted_on)}</td></tr>
</table>
<p style="margin-top:22px;">Please sign in to the admin portal to review and take action.</p>
""",
            'signature_name': f"{req.business.name} System",
        })

        email = EmailMultiAlternatives(
            subject=subject,
            body=message,
            from_email=from_email,
            to=to_emails,
            connection=connection
        )
        email.attach_alternative(html_body, "text/html")
        email.send()
        logger.info(f"Admin notification sent for request {req.ref_number} to {to_emails}")
        return True

    except Exception as e:
        logger.error(f"Failed to send admin notification for request {reqId}: {str(e)}")
        return False


@shared_task
def send_comment_interaction_notification(ticket_id, comment_id, interaction_type, actor_id, recipient_emails=None):
    """
    Send email notifications for comment interactions (likes, flags, replies)

    Args:
        ticket_id: ID of the ticket
        comment_id: ID of the comment being interacted with
        interaction_type: 'liked', 'flagged', 'replied'
        actor_id: ID of the user performing the action
        recipient_emails: Optional list of specific recipient emails
    """
    try:
        from tenant.models.TicketModel import Ticket, TicketComment
        from users.models import Users
        from util.EmailTicketService import EmailTicketService

        # Get ticket and comment
        try:
            ticket = Ticket.objects.select_related('business', 'assigned_to').get(id=ticket_id)
            comment = TicketComment.objects.select_related('author').get(id=comment_id, ticket=ticket)
        except (Ticket.DoesNotExist, TicketComment.DoesNotExist) as e:
            logger.error(f"Ticket or comment not found: {str(e)}")
            return False

        # Get actor (user performing the action)
        try:
            actor = Users.objects.get(id=actor_id)
            actor_name = actor.full_name() if hasattr(actor, 'full_name') and callable(actor.full_name) else actor.email
        except Users.DoesNotExist:
            logger.error(f"Actor with ID {actor_id} not found")
            return False

        # Determine recipients based on interaction type and ticket context
        if recipient_emails is None:
            recipient_emails = []

            # Always notify the comment author (if not the actor)
            if (
                NotificationSettingsService.is_delivery_eligible_user(comment.author)
                and comment.author.email
                and comment.author.id != actor_id
            ):
                recipient_emails.append(comment.author.email)

            # For flags, notify assigned agent and department members
            if interaction_type == 'flagged':
                if (
                    NotificationSettingsService.is_delivery_eligible_user(ticket.assigned_to)
                    and ticket.assigned_to.email
                ):
                    recipient_emails.append(ticket.assigned_to.email)

                # Add department members
                if hasattr(ticket, 'department') and ticket.department:
                    department_members = Users.objects.filter(
                        department=ticket.department,
                        business=ticket.business,
                        is_active=True,
                        status='A',
                        email__isnull=False
                    ).exclude(email='').values_list('email', flat=True)
                    recipient_emails.extend(department_members)

            # For replies, notify assigned agent and watchers
            elif interaction_type == 'replied':
                if (
                    NotificationSettingsService.is_delivery_eligible_user(ticket.assigned_to)
                    and ticket.assigned_to.email
                ):
                    recipient_emails.append(ticket.assigned_to.email)

                # Add watchers
                if hasattr(ticket, 'watchers'):
                    watcher_emails = ticket.watchers.filter(
                        watcher__is_active=True,
                        watcher__status='A',
                        watcher__email__isnull=False
                    ).exclude(watcher__email='').values_list('watcher__email', flat=True)
                    recipient_emails.extend(watcher_emails)

        # Remove duplicates and actor's email
        recipient_emails = list(set(recipient_emails))
        if actor.email in recipient_emails:
            recipient_emails.remove(actor.email)

        if not recipient_emails:
            logger.info(f"No recipients found for {interaction_type} notification on comment {comment_id}")
            return True

        # Prepare email context based on interaction type
        context = {
            'ticket_id': ticket.ticket_id,
            'ticket_title': ticket.title,
            'comment_content': comment.content[:200] + '...' if len(comment.content) > 200 else comment.content,
            'comment_author_name': comment.author.full_name() if comment.author and hasattr(comment.author, 'full_name') else 'Anonymous',
            'actor_name': actor_name,
            'url': f"{ticket.business.support_url}/tickets/{ticket.id}" if hasattr(ticket.business, 'support_url') else f"/tickets/{ticket.id}",
        }

        # Select appropriate template and customize context
        if interaction_type == 'liked':
            template_name = 'COMMENT_LIKED_NOTICE'
            context.update({
                'liker_name': actor_name,
                'recipient_name': context['comment_author_name']
            })
        elif interaction_type == 'flagged':
            template_name = 'COMMENT_FLAGGED_NOTICE'
            context.update({
                'flagger_name': actor_name,
                'agent_name': 'Support Team'  # Generic for department notifications
            })
        elif interaction_type == 'replied':
            template_name = 'COMMENT_REPLY_NOTICE'
            # For replies, we need the reply content - this will be passed separately
            context.update({
                'replier_name': actor_name,
                'original_comment_content': context['comment_content'],
                'recipient_name': 'Team Member'  # Generic recipient
            })

        # Get email service and send notifications
        email_service = EmailTicketService()

        success_count = 0
        for recipient_email in recipient_emails:
            try:
                # Customize context for each recipient
                recipient_context = context.copy()
                if interaction_type == 'replied':
                    recipient_context['recipient_name'] = recipient_email.split('@')[0]  # Simple name extraction

                success = email_service.send_template_email(
                    template_name=template_name,
                    recipient_email=recipient_email,
                    context=recipient_context,
                    business=ticket.business
                )

                if success:
                    success_count += 1
                    logger.info(f"Comment {interaction_type} notification sent to {recipient_email}")
                else:
                    logger.error(f"Failed to send comment {interaction_type} notification to {recipient_email}")

            except Exception as e:
                logger.error(f"Error sending notification to {recipient_email}: {str(e)}")
                continue

        logger.info(f"Comment {interaction_type} notifications: {success_count}/{len(recipient_emails)} sent successfully")
        return success_count > 0

    except Exception as e:
        logger.error(f"Error in send_comment_interaction_notification: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return False


@shared_task
def send_comment_reply_notification(ticket_id, comment_id, reply_id, replier_id):
    """
    Send notification when someone replies to a comment

    Args:
        ticket_id: ID of the ticket
        comment_id: ID of the parent comment
        reply_id: ID of the new reply
        replier_id: ID of the user who made the reply
    """
    try:
        from tenant.models.TicketModel import Ticket, TicketComment, CommentReply
        from users.models import Users
        from util.EmailTicketService import EmailTicketService

        # Get ticket, comment, and reply
        try:
            ticket = Ticket.objects.select_related('business', 'assigned_to').get(id=ticket_id)
            comment = TicketComment.objects.select_related('author').get(id=comment_id, ticket=ticket)
            reply = CommentReply.objects.select_related('author').get(id=reply_id, parent_comment=comment)
        except Exception as e:
            logger.error(f"Error fetching ticket/comment/reply data: {str(e)}")
            return False

        # Get replier
        try:
            replier = Users.objects.get(id=replier_id)
            replier_name = replier.full_name() if hasattr(replier, 'full_name') and callable(replier.full_name) else replier.email
        except Users.DoesNotExist:
            logger.error(f"Replier with ID {replier_id} not found")
            return False

        # Determine recipients
        recipient_emails = []

        # Notify comment author (if not the replier)
        if (
            NotificationSettingsService.is_delivery_eligible_user(comment.author)
            and comment.author.email
            and comment.author.id != replier_id
        ):
            recipient_emails.append(comment.author.email)

        # Notify assigned agent
        if (
            NotificationSettingsService.is_delivery_eligible_user(ticket.assigned_to)
            and ticket.assigned_to.email
        ):
            recipient_emails.append(ticket.assigned_to.email)

        # Notify other users who commented on this ticket (excluding replier)
        other_commenters = TicketComment.objects.filter(
            ticket=ticket,
            author__isnull=False,
            author__is_active=True,
            author__status='A',
        ).exclude(
            author__id=replier_id
        ).exclude(
            author__email__isnull=True
        ).exclude(
            author__email=''
        ).values_list('author__email', flat=True).distinct()

        recipient_emails.extend(other_commenters)

        # Remove duplicates and replier's email
        recipient_emails = list(set(recipient_emails))
        if replier.email in recipient_emails:
            recipient_emails.remove(replier.email)

        if not recipient_emails:
            logger.info(f"No recipients found for reply notification on comment {comment_id}")
            return True

        # Prepare email context
        context = {
            'ticket_id': ticket.ticket_id,
            'ticket_title': ticket.title,
            'comment_author_name': comment.author.full_name() if comment.author and hasattr(comment.author, 'full_name') else 'Anonymous',
            'original_comment_content': comment.content[:200] + '...' if len(comment.content) > 200 else comment.content,
            'replier_name': replier_name,
            'reply_content': reply.content[:200] + '...' if len(reply.content) > 200 else reply.content,
            'url': f"{ticket.business.support_url}/tickets/{ticket.id}" if hasattr(ticket.business, 'support_url') else f"/tickets/{ticket.id}",
        }

        # Send notifications
        email_service = EmailTicketService()
        success_count = 0

        for recipient_email in recipient_emails:
            try:
                recipient_context = context.copy()
                recipient_context['recipient_name'] = recipient_email.split('@')[0]  # Simple name extraction

                success = email_service.send_template_email(
                    template_name='COMMENT_REPLY_NOTICE',
                    recipient_email=recipient_email,
                    context=recipient_context,
                    business=ticket.business
                )

                if success:
                    success_count += 1
                    logger.info(f"Reply notification sent to {recipient_email}")
                else:
                    logger.error(f"Failed to send reply notification to {recipient_email}")

            except Exception as e:
                logger.error(f"Error sending reply notification to {recipient_email}: {str(e)}")
                continue

        logger.info(f"Reply notifications: {success_count}/{len(recipient_emails)} sent successfully")
        return success_count > 0

    except Exception as e:
        logger.error(f"Error in send_comment_reply_notification: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return False


@shared_task(name="send_mention_email_notification")
def send_mention_email_notification(mentioned_user_id, ticket_id, mentioned_by_id, comment_text):
    """
    Send email notification when a user is mentioned in a ticket comment.
    Works with multitenancy - only sends to users in the same business.
    """
    try:
        from tenant.models import Ticket, SettingSMTP
        from users.models import Users
        from datetime import datetime

        # Get users and ticket
        try:
            mentioned_user = Users.objects.get(id=mentioned_user_id)
            mentioned_by = Users.objects.get(id=mentioned_by_id)
            ticket = Ticket.objects.get(id=ticket_id)
        except (Users.DoesNotExist, Ticket.DoesNotExist) as e:
            logger.error(f"User or ticket not found: {e}")
            return False

        # Verify multitenancy - both users must be in same business
        if mentioned_user.business != mentioned_by.business:
            logger.warning(f"Cross-tenant mention attempt blocked: {mentioned_by.email} -> {mentioned_user.email}")
            return False

        # Respect user and business email notification preferences
        if not NotificationSettingsService.should_send_email(mentioned_user, 'ticket_mention'):
            logger.info("Email notifications disabled for user %s (ticket mention)", mentioned_user.email)
            return False

        # Get SMTP settings for the business
        try:
            smtp_settings = SettingSMTP.objects.filter(business=mentioned_user.business).first()
            if not smtp_settings:
                logger.warning(f"No SMTP settings found for business {mentioned_user.business.id}")
                return False
        except Exception as e:
            logger.error(f"Error fetching SMTP settings: {e}")
            return False

        # Prepare email context
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')

        # Get initials for avatar
        mentioned_by_initials = ''
        if mentioned_by.first_name:
            mentioned_by_initials = mentioned_by.first_name[0].upper()
            if mentioned_by.last_name:
                mentioned_by_initials += mentioned_by.last_name[0].upper()
        else:
            mentioned_by_initials = mentioned_by.email[0].upper()

        recipient_name = _safe_display_name(mentioned_user)
        actor_name = _safe_display_name(mentioned_by)

        context = {
            **mailer.get_email_brand_context(mentioned_user.business),
            'recipient_name': recipient_name,
            'mentioned_by_name': actor_name,
            'mentioned_by_initials': mentioned_by_initials,
            'ticket_id': ticket.ticket_id,
            'ticket_title': ticket.title,
            'ticket_status': ticket.status.capitalize(),
            'comment_excerpt': comment_text[:500] + ('...' if len(comment_text) > 500 else ''),
            'comment_date': datetime.now().strftime('%B %d, %Y at %I:%M %p'),
            'ticket_url': f"{frontend_url}/ticket/{ticket.ticket_id}",
            'reply_url': f"{frontend_url}/ticket/{ticket.ticket_id}#reply",
        }

        # Render email template
        html_content = render_to_string('mention-notification.html', context)
        text_content = strip_tags(html_content)

        subject = f"@{actor_name} mentioned you in {ticket.ticket_id}"

        # Send email using SMTP settings
        try:
            connection = get_connection(
                host=smtp_settings.smtp_server,
                port=smtp_settings.smtp_port,
                username=smtp_settings.smtp_username,
                password=smtp_settings.smtp_password,
                use_tls=smtp_settings.use_tls,
                use_ssl=smtp_settings.use_ssl,
            )

            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=smtp_settings.from_email,
                to=[mentioned_user.email],
                connection=connection
            )
            email.attach_alternative(html_content, "text/html")
            email.send()

            logger.info(f"Mention email sent successfully to {mentioned_user.email} for ticket {ticket.ticket_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to send mention email to {mentioned_user.email}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False

    except Exception as e:
        logger.error(f"Error in send_mention_email_notification: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


@shared_task(name="send_task_mention_email_notification")
def send_task_mention_email_notification(mentioned_user_id, task_id, mentioned_by_id, comment_text):
    """
    Send email notification when a user is mentioned in a task comment.
    """
    try:
        from tenant.models import SettingSMTP
        from tenant.models.TaskModel import Task
        from users.models import Users
        from datetime import datetime

        try:
            mentioned_user = Users.objects.get(id=mentioned_user_id)
            mentioned_by = Users.objects.get(id=mentioned_by_id)
            task = Task.objects.select_related('linked_ticket').get(id=task_id)
        except (Users.DoesNotExist, Task.DoesNotExist) as e:
            logger.error(f"User or task not found: {e}")
            return False

        if mentioned_user.business != mentioned_by.business:
            logger.warning(f"Cross-tenant task mention attempt blocked: {mentioned_by.email} -> {mentioned_user.email}")
            return False

        if not NotificationSettingsService.should_send_email(mentioned_user, 'task_mention'):
            logger.info("Email notifications disabled for user %s (task mention)", mentioned_user.email)
            return False

        smtp_settings = SettingSMTP.objects.filter(business=mentioned_user.business).first()
        if not smtp_settings:
            logger.warning(f"No SMTP settings found for business {getattr(mentioned_user.business, 'id', None)}")
            return False

        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        recipient_name = _safe_display_name(mentioned_user)
        actor_name = _safe_display_name(mentioned_by)

        task_url = f"{frontend_url}/task/{task.task_trackid}"
        linked_ticket_text = task.linked_ticket.ticket_id if task.linked_ticket else "Not linked"
        linked_ticket_url = f"{frontend_url}/ticket/{task.linked_ticket.ticket_id}" if task.linked_ticket else None

        context = {
            **mailer.get_email_brand_context(mentioned_user.business),
            'recipient_name': recipient_name,
            'mentioned_by_name': actor_name,
            'task_trackid': task.task_trackid,
            'task_title': task.title,
            'task_status': (task.task_status or '').replace('_', ' ').title(),
            'linked_ticket_text': linked_ticket_text,
            'linked_ticket_url': linked_ticket_url,
            'comment_text': comment_text[:500] + ('...' if len(comment_text) > 500 else ''),
            'comment_date': datetime.now().strftime('%B %d, %Y at %I:%M %p'),
            'task_url': task_url,
        }

        html_content = render_to_string('task-mention-notification.html', context)
        text_content = strip_tags(html_content)
        subject = f"@{actor_name} mentioned you in task {task.task_trackid}"

        connection = get_connection(
            host=smtp_settings.smtp_server,
            port=smtp_settings.smtp_port,
            username=smtp_settings.smtp_username,
            password=smtp_settings.smtp_password,
            use_tls=smtp_settings.use_tls,
            use_ssl=smtp_settings.use_ssl,
        )

        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=smtp_settings.from_email,
            to=[mentioned_user.email],
            connection=connection,
        )
        email.attach_alternative(html_content, "text/html")
        email.send()

        logger.info(f"Task mention email sent successfully to {mentioned_user.email} for task {task.task_trackid}")
        return True

    except Exception as e:
        logger.error(f"Error in send_task_mention_email_notification: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


@shared_task(name="shared.tasks.process_mailgun_inbound")
def process_mailgun_inbound(raw_mime: str, integration_id: int, metadata=None):
    """
    Process a single inbound email posted by Mailgun (raw MIME, no IMAP).
    """
    metadata = metadata or {}
    integration = (
        MailIntegration.objects.select_related("business", "default_assignee")
        .filter(id=integration_id)
        .first()
    )
    if not integration:
        logger.warning("mailgun_inbound_integration_missing", extra={"integration_id": integration_id})
        return

    raw_bytes = raw_mime if isinstance(raw_mime, (bytes, bytearray)) else (raw_mime or "").encode("utf-8", errors="ignore")
    start = timezone.now()
    service = MailIntegrationIngestionService(integration)
    last_uid = metadata.get("message_id") or ""
    result = "success"
    was_connected = integration.connection_status == MailIntegration.ConnectionStatus.CONNECTED
    previous_forwarding_status = integration.forwarding_status

    try:
        email_message = email.message_from_bytes(raw_bytes)
        service._process_email_message(email_message, raw_bytes)
        integration.mark_success()
        if integration.provider == MailIntegration.Provider.SAFARIDESK:
            integration.forwarding_status = "verified"
            MailIntegration.objects.filter(pk=integration.pk).update(forwarding_status=integration.forwarding_status)
        if not was_connected or previous_forwarding_status != integration.forwarding_status:
            log_audit_event(
                None,
                event_type="MAILBOX_CONNECTED",
                entity_type="mailbox",
                entity=integration,
                activity=f"Mailbox '{integration.email_address or integration.forwarding_address or integration.display_name}' verified by inbound email",
                metadata={
                    "provider": integration.provider,
                    "direction": integration.direction,
                    "forwarding_status": integration.forwarding_status,
                },
                business=integration.business,
            )
    except Exception as exc:
        logger.exception(
            "mailgun_inbound_processing_failed",
            extra={"integration_id": integration.id, "error": str(exc)},
        )
        service.stats["errors"] += 1
        integration.mark_failure(str(exc))
        result = "error"
    finally:
        duration = (timezone.now() - start).total_seconds() * 1000
        stats = service.stats
        if MailIntegration.objects.filter(pk=integration.pk).exists():
            MailFetchLog.objects.create(
                integration=integration,
                business=integration.business,
                duration_ms=int(duration),
                result=result,
                message_count=stats.get("processed", 0),
                new_ticket_count=stats.get("tickets_created", 0),
                new_reply_count=stats.get("replies_added", 0),
                error_message=integration.last_error_message if result == "error" else "",
                last_message_uid=last_uid,
            )
