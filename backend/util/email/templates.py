# app/email_templates.py


class SystemTemplate:
    """
    Wrapper class for system email templates that mimics the DB EmailTemplate model interface.
    Allows direct use of EMAIL_TEMPLATES dict with Mailer.send_templated_email().
    """
    def __init__(self, name: str, data: dict):
        self.name = name
        self.subject = data.get("subject", "")
        self.body = data.get("body", "")
        self.description = data.get("description", "")
        self.type = data.get("type", "")


def get_system_template(template_name: str):
    """
    Get a system template by name directly from EMAIL_TEMPLATES.
    Returns a SystemTemplate object compatible with Mailer.send_templated_email().

    Usage:
        template = get_system_template("NEW_TICKET_AUTO_REPLY")
        mailer.send_templated_email(template=template, ...)
    """
    if template_name not in EMAIL_TEMPLATES:
        return None
    return SystemTemplate(template_name, EMAIL_TEMPLATES[template_name])


# Maps each agent-facing template to its notification_type key used in UserNotificationPreference.
# Customer auto-reply templates (NEW_TICKET_AUTO_REPLY, RESPONSE_REPLY_TEMPLATE, etc.)
# are intentionally excluded — they go to end-users, not agents, and must always send.
TEMPLATE_TO_NOTIFICATION_TYPE: dict[str, str] = {
    # Ticket — agent notifications
    "TICKET_ASSIGNMENT_ALERT":                      "ticket_assigned",
    "TICKET_TRANSFER_ALERT":                        "ticket_assigned",
    "NEW_TICKET_ALERT":                             "ticket_assigned",
    "NEW_MESSAGE_ALERT":                            "ticket_comment",
    "INTERNAL_ACTIVITY_ALERT":                      "ticket_comment",
    "TICKET_ASSIGNMENT_ACTIVITY_NOTICE":            "ticket_assigned",
    "NEW_ACTIVITY_NOTICE":                          "ticket_status_changed",
    "OVERDUE_TICKET_ALERT":                         "sla_breach",
    # Comment notifications
    "COMMENT_REPLY_NOTICE":                         "ticket_comment",
    "COMMENT_LIKED_NOTICE":                         "ticket_comment",
    "COMMENT_FLAGGED_NOTICE":                       "ticket_comment",
    # Task — agent notifications
    "NEW_TASK_ALERT":                               "task_assigned",
    "TASK_ASSIGNMENT_ALERT":                        "task_assigned",
    "TASK_NEW_ACTIVITY_ALERT":                      "task_comment",
    "TASK_NEW_ACTIVITY_NOTICE":                     "task_status_changed",
    "OVERDUE_TASK_ALERT":                           "sla_breach",
    # SLA notifications
    "SLA_REMINDER":                                 "sla_breach",
    "SLA_REMINDER_TASK":                            "sla_breach",
    "SLA_FIRST_RESPONSE_BREACH":                    "sla_breach",
    "SLA_ESCALATION_NOTICE":                        "ticket_escalated",
    "SLA_ESCALATION_NOTICE_TASK":                   "ticket_escalated",
}


def get_template(template_name: str, business=None):
    """
    Get an email template, preferring the DB version (editable via UI) over the
    hardcoded system fallback.

    Args:
        template_name: The template key (e.g. "NEW_TICKET_AUTO_REPLY").
        business: The Business instance to scope the DB lookup.

    Returns:
        An EmailTemplate DB instance, a SystemTemplate, or None.
    """
    if business is not None:
        try:
            from tenant.models.SettingModel import EmailTemplate
            return EmailTemplate.objects.get(name=template_name, business=business, is_active=True)
        except Exception:
            pass
    return get_system_template(template_name)


EMAIL_TEMPLATES = {
    # =========================
    # Ticket End-User Templates
    # =========================
    "NEW_TICKET_AUTO_REPLY": {
        "type": "ticket",
        "description": "Sends an auto-reply to the user when a new ticket is created.",
        "subject": "Ticket #{{ticket_id}} Created Successfully",
        "body": """
Hello <strong>{{creator_name}}</strong>,

Thank you for contacting support. A new ticket has been created for you:

<strong>Ticket ID:</strong> {{ticket_id}}
<strong>Subject:</strong> {{title}}

Our support team will get back to you shortly.
"""
    },


    "RESPONSE_REPLY_TEMPLATE": {
        "type": "ticket",
        "description": "Sends a reply from an agent to the user for a ticket.",
        "subject": "Re: Ticket #{{ticket_id}} - {{title}}",
        "body": """
Hello {{creator_name}},

This is a response to your ticket #{{ticket_id}}: {{title}}.

Response from {{agent_name}}:
{{agent_response}}

Regards,
Support Team
"""
    },

    # =========================
    # Ticket Agent Templates
    # =========================
    "INTERNAL_ACTIVITY_ALERT": {
        "type": "ticket",
        "description": "Alerts agents when an internal activity (note or reply) is added to a ticket.",
        "subject": "Internal Activity on Ticket #{{ticket_id}}",
        "body": """
Hello {{agent_name}},

An internal activity has been added to ticket #{{ticket_id}}: {{title}}.
Activity: {{internal_note}}

Please review the update in the system: {{url}}
"""
    },

    "NEW_MESSAGE_ALERT": {
        "type": "ticket",
        "description": "Notifies agents when a user replies to an existing ticket.",
        "subject": "New Message on Ticket #{{ticket_id}}: {{title}}",
        "body": """
Hello {{agent_name}},

User {{creator_name}} has replied to ticket #{{ticket_id}}.
Message: {{user_message}}

You can view the ticket and reply here: {{url}}
"""
    },

    "NEW_TICKET_ALERT": {
        "type": "ticket",
        "description": "Notifies agents when a new ticket is created.",
        "subject": "New Ticket Alert: #{{ticket_id}} - {{title}}",
        "body": """
Hello {{agent_name}},

A new ticket has been created.
Ticket ID: {{ticket_id}}
Subject: {{title}}
Description: {{description}}
Creator: {{creator_name}} ({{creator_email}})
Priority: {{priority}}
Department: {{department_name}}


"""
    },

    "OVERDUE_TICKET_ALERT": {
        "type": "ticket",
        "description": "Alerts agents when a ticket becomes overdue.",
        "subject": "Overdue Ticket Alert: #{{ticket_id}} - {{title}}",
        "body": """
Hello {{agent_name}},

Ticket #{{ticket_id}} is overdue.
Subject: {{title}}
Due date: {{due_date}}
Priority: {{priority}}

Please take necessary action: {{url}}
"""
    },

    "TICKET_ASSIGNMENT_ALERT": {
        "type": "ticket",
        "description": "Notifies an agent when they are assigned to a ticket.",
        "subject": "You have been assigned to Ticket #{{ticket_id}}",
        "body": """
Hello {{agent_name}},

You have been assigned to ticket #{{ticket_id}}: {{title}}.
Priority: {{priority}}
Status: {{status}}
"""
    },

    "TICKET_TRANSFER_ALERT": {
        "type": "ticket",
        "description": "Notifies an agent when a ticket has been transferred to them.",
        "subject": "Ticket #{{ticket_id}} has been transferred to you",
        "body": """
Hello {{agent_name}},

Ticket #{{ticket_id}}: {{title}} has been transferred to you.
Previous agent: {{previous_agent}}
Priority: {{priority}}
Status: {{status}}
"""
    },

    "TICKET_ASSIGNMENT_ACTIVITY_NOTICE": {
        "type": "ticket",
        "description": "Notifies department members and watchers about a ticket assignment event.",
        "subject": "Ticket #{{ticket_id}} has new assignment activity",
        "body": """
Hello {{agent_name}},

Ticket #{{ticket_id}}: {{title}} has new assignment activity.
Priority: {{priority}}
Status: {{status}}

Please review the latest update here: {{url}}
"""
    },

    "NEW_ACTIVITY_NOTICE": {
        "type": "ticket",
        "description": "Notifies interested parties when a ticket status changes.",
        "subject": "Ticket #{{ticket_id}} status updated",
        "body": """
Hello {{agent_name}},

Ticket #{{ticket_id}}: {{title}} has a new status update.
Current status: {{status}}
Priority: {{priority}}

You can review the ticket here: {{url}}
"""
    },

    # =========================
    # Task Templates
    # =========================
    "TASK_NEW_ACTIVITY_ALERT": {
        "type": "task",
        "description": "Alerts an agent when a new activity is added to a task.",
        "subject": "New Activity on Task #{{track_id}}",
        "body": """
Hello {{agent_name}},

A new activity has been added to task #{{track_id}}: {{title}}.
Activity: {{task_activity}}
"""
    },

    "TASK_NEW_ACTIVITY_NOTICE": {
        "type": "task",
        "description": "Notifies a user when there is an update on their task.",
        "subject": "Update on Task #{{track_id}}",
        "body": """
Hello {{user_name}},

There has been an update on task #{{track_id}}: {{title}}.
Update details: {{task_update}}
"""
    },

    "NEW_TASK_ALERT": {
        "type": "task",
        "description": "Notifies an agent when a new task is created.",
        "subject": "New Task Created: #{{track_id}} - {{title}}",
        "body": """
Hello {{agent_name}},

A new task has been created.
Task ID: {{track_id}}
Title: {{title}}
Description: {{description}}
Priority: {{priority}}
Due Date: {{due_date}}
"""
    },

    "OVERDUE_TASK_ALERT": {
        "type": "task",
        "description": "Alerts an agent when a task becomes overdue.",
        "subject": "Overdue Task Alert: #{{track_id}} - {{title}}",
        "body": """
Hello {{agent_name}},

Task #{{track_id}}: {{title}} is overdue.
Due date: {{due_date}}
Priority: {{priority}}
"""
    },

    "TASK_ASSIGNMENT_ALERT": {
        "type": "task",
        "description": "Notifies an agent when they are assigned to a task.",
        "subject": "You have been assigned to Task #{{track_id}}",
        "body": """
Hello {{agent_name}},

You have been assigned to task #{{track_id}}: {{title}}.
Description: {{description}}
Priority: {{priority}}
Due Date: {{due_date}}
"""
    },

    # =========================
    # SLA Templates
    # =========================
    "SLA_REMINDER_TASK": {
        "type": "sla",
        "description": "Reminds agents of an approaching SLA deadline for a task.",
        "subject": "SLA Reminder for Task #{{track_id}}: {{title}}",
        "body": """
Hello {{agent_name}},

This is a reminder for task #{{track_id}}.
Subject: {{title}}

The SLA resolution time is approaching.
SLA Name: {{sla_name}}
Remaining time: {{remaining_time}}

Please ensure timely action to avoid escalation: {{url}}
"""
    },

    "SLA_ESCALATION_NOTICE_TASK": {
        "type": "sla",
        "description": "Notifies a manager that a task has been escalated due to SLA breach.",
        "subject": "SLA Escalation Notice for Task #{{track_id}}: {{title}}",
        "body": """
Hello {{escalation_manager}},

Task #{{track_id}} has been escalated due to SLA breach.
Subject: {{title}}
Assigned agent: {{assigned_to_name}}
SLA Name: {{sla_name}}

Escalation reason: {{escalation_reason}}

Please review the task: {{url}}
"""
    },

    "SLA_REMINDER": {
        "type": "sla",
        "description": "Reminds agents of an approaching SLA deadline.",
        "subject": "SLA Reminder for Ticket #{{ticket_id}}: {{title}}",
        "body": """
Hello {{agent_name}},

This is a reminder for ticket #{{ticket_id}}.
Subject: {{title}}

The SLA response time is approaching.
SLA Name: {{sla_name}}
Remaining time: {{remaining_time}}

Please ensure timely action to avoid escalation: {{url}}
"""
    },

    "SLA_ESCALATION_NOTICE": {
        "type": "sla",
        "description": "Notifies a manager that a ticket has been escalated due to SLA breach.",
        "subject": "SLA Escalation Notice for Ticket #{{ticket_id}}: {{title}}",
        "body": """
Hello {{escalation_manager}},

Ticket #{{ticket_id}} has been escalated due to SLA breach.
Subject: {{title}}
Assigned agent: {{assigned_to_name}}
User: {{creator_name}}
SLA Name: {{sla_name}}

Escalation reason: {{escalation_reason}}

Please review the ticket: {{url}}
"""
    },

    "SLA_FIRST_RESPONSE_BREACH": {
        "type": "sla",
        "description": "Notifies agents when a ticket breaches the first response SLA.",
        "subject": "First Response SLA Breach on Ticket #{{ticket_id}}: {{title}}",
        "body": """
Hello {{agent_name}},

Ticket #{{ticket_id}} has breached the **first response SLA**.
Subject: {{title}}
User: {{creator_name}}
SLA Name: {{sla_name}}

Please respond immediately to avoid further escalation: {{url}}
"""
    },

    "CSAT_SURVEY_REQUEST": {
        "type": "csat",
        "description": "Sends a customer satisfaction survey link when a ticket is closed or resolved.",
        "subject": "Ticket #{{ticket_id}} Resolved — How did we do?",
        "body": """
Hello {{creator_name}},

Good news! Your ticket #{{ticket_id}}: {{title}} has been resolved.

We'd love to hear about your experience. Please take a moment to rate our support:

{{survey_url}}

Thank you for your patience.
"""
    },

    # =========================
    # Comment Interaction Templates
    # =========================
    "COMMENT_LIKED_NOTICE": {
        "type": "comment",
        "description": "Notifies a user when their comment is liked.",
        "subject": "Your comment was liked on Ticket #{{ticket_id}}",
        "body": """
Hello {{comment_author_name}},

Your comment on ticket #{{ticket_id}}: {{ticket_title}} has been liked by {{liker_name}}.

Comment: {{comment_content}}
Liked by: {{liker_name}}

Regards,
Support Team
"""
    },

    "COMMENT_FLAGGED_NOTICE": {
        "type": "comment",
        "description": "Notifies relevant users when a comment is flagged.",
        "subject": "Comment flagged on Ticket #{{ticket_id}}",
        "body": """
Hello {{agent_name}},

A comment has been flagged on ticket #{{ticket_id}}: {{ticket_title}}.

Comment author: {{comment_author_name}}
Comment: {{comment_content}}
Flagged by: {{flagger_name}}

Please review the flagged comment: {{url}}

Regards,
Support Team
"""
    },

    "COMMENT_REPLY_NOTICE": {
        "type": "comment",
        "description": "Notifies users when someone replies to a comment.",
        "subject": "New reply on Ticket #{{ticket_id}}",
        "body": """
Hello {{recipient_name}},

{{replier_name}} has replied to a comment on ticket #{{ticket_id}}: {{ticket_title}}.

Original comment by {{comment_author_name}}: {{original_comment_content}}

Reply by {{replier_name}}: {{reply_content}}

You can view the ticket and reply here: {{url}}

Regards,
Support Team
"""
    },

}
