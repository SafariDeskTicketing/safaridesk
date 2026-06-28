"""Shared tasks package for SafariDesk Celery tasks."""

# Re-export all notification tasks from notifications.py
from .notifications import (
    process_incoming_emails,
    process_all_emails_sync,
    refresh_mail_integration_tokens,
    sync_mail_integrations,
    send_ticket_notification,
    send_otp,
    send_ticket_assignment_email,
    send_comment_notification,
    send_welcome_message,
    create_notification_task,
    send_bulk_notifications,
    send_ticket_creation_notification_to_customer,
    request_notification,
    notify_admins_of_request,
    send_comment_interaction_notification,
    send_comment_reply_notification,
    send_mention_email_notification,
    send_task_mention_email_notification,
    process_mailgun_inbound,
)

# Re-export domain tasks
from .domain_tasks import (
    verify_pending_domains,
    cleanup_unverified_domains,
)

# Re-export Slack tasks
from .slack_tasks import (
    process_slack_event,
)

# Re-export Teams tasks
from .teams_tasks import (
    notify_teams_ticket_update,
)
