
def _build_base_url(business):
    """Build the frontend base URL from settings.DOMAIN_NAME + business.domain.
    Falls back to business.support_url if settings are not configured."""
    from django.conf import settings
    domain = getattr(business, 'domain', '') or ''
    domain_name = getattr(settings, 'DOMAIN_NAME', '') or ''
    if domain and domain_name:
        scheme = 'http' if 'localhost' in domain_name else 'https'
        return f"{scheme}://{domain}.{domain_name}"
    # Fallback: strip any trailing /support path from stored support_url
    stored = getattr(business, 'support_url', '') or ''
    return stored.rstrip('/').removesuffix('/support')


PLACEHOLDER_FIELDS = {
    'ticket': [
        'title', 'description', 'category_name', 'department_name',
        'creator_name', 'creator_email', 'creator_phone', 'ticket_id', 'notes',
        'status', 'priority', 'sla_name', 'assigned_to_name',
        'due_date', 'resolved_at', 'first_response_at', 'created_at',
        'created_by_name', 'url', 'agent_name'
    ],
    'sla': [
        'name', 'description', 'priority', 'first_response_time', 'resolution_time',
        'first_response_due', 'resolution_due'
    ],
    'task': [
        'title', 'priority', 'description', 'department_name', 'task_status',
        'track_id', 'assigned_to_name', 'linked_ticket_id', 'due_date',
        'completed_at', 'created_at', 'url'
    ],
    'department': [
        'name', 'support_email'
    ],
    'user': [
        'email', 'full_name', 'phone_number'
    ],
    'request': [
        'title', 'description', 'type', 'status', 'creator_name',
        'creator_email', 'creator_phone', 'ref_number', 'created_at',
        'approved_at', 'approver_name', 'department_name', 'url',
        'ticket_id', 'task_id', 'priority', 'due_date'
    ],
    'customer': [
        'email', 'full_name', 'phone_number'
    ],
    'comment': [
        'ticket_id', 'ticket_title', 'comment_content', 'comment_author_name',
        'liker_name', 'flagger_name', 'replier_name', 'recipient_name',
        'original_comment_content', 'reply_content', 'activity_description', 'url'
    ]
}



PLACEHOLDER_MAPPINGS = {
    "ticket": {
        "title": lambda t: t.title,
        "description": lambda t: t.description,
        "category_name": lambda t: getattr(t.category, "name", ""),
        "department_name": lambda t: getattr(t.department, "name", ""),
        "creator_name": lambda t: getattr(t, "creator_name", ""),
        "creator_phone": lambda t: getattr(t, "creator_phone", ""),
        "creator_email": lambda t: getattr(t, "creator_email", ""),
        "ticket_id": lambda t: getattr(t, "ticket_id", ""),
        "notes": lambda t: getattr(t, "notes", ""),
        "status": lambda t: getattr(t, "status", ""),
        "priority": lambda t: getattr(t, "priority", ""),
        "sla_name": lambda t: getattr(t.sla, "name", ""),
        "assigned_to_name": lambda t: getattr(t.assigned_to, "full_name", lambda: getattr(t.assigned_to, "name", ""))(),
        "due_date": lambda t: getattr(t, "due_date", ""),
        "resolved_at": lambda t: getattr(t, "resolved_at", ""),
        "first_response_at": lambda t: getattr(t, "first_response_at", ""),
        "created_at": lambda t: getattr(t, "created_at", ""),
        "agent_name": lambda t: getattr(t.assigned_to, "full_name", lambda: getattr(t.assigned_to, "name", ""))(),
        "url": lambda t: _build_base_url(t.department.business) + '/tk/' + getattr(t, "ticket_id", ""),
    },
    "sla": {
        "name": lambda s: s.name,
        "description": lambda s: s.description,
        "priority": lambda s: getattr(s, "priority", ""),
        "first_response_time": lambda s: getattr(s, "first_response_time", ""),
        "resolution_time": lambda s: getattr(s, "resolution_time", ""),
        "first_response_due": lambda s: getattr(s, "first_response_due", ""),
        "resolution_due": lambda s: getattr(s, "resolution_due", ""),
    },
    "task": {
        "title": lambda t: t.title,
        "priority": lambda t: getattr(t, "priority", ""),
        "description": lambda t: t.description,
        "department_name": lambda t: getattr(t.department, "name", ""),
        "task_status": lambda t: getattr(t, "task_status", ""),
        "track_id": lambda t: getattr(t, "task_trackid", ""),
        "assigned_to_name": lambda t: getattr(t.assigned_to, "full_name", lambda: getattr(t.assigned_to, "name", ""))(),
        "linked_ticket_id": lambda t: getattr(t.linked_ticket, "id", ""),
        "due_date": lambda t: getattr(t, "due_date", ""),
        "completed_at": lambda t: getattr(t, "completed_at", ""),
        "created_at": lambda t: getattr(t, "created_at", ""),
        "url": lambda t: getattr(t.department.business, "support_url", "") + '/tasks/' + getattr(t, "task_trackid", ""),
    },
    "department": {
        "name": lambda d: d.name,
        "support_email": lambda d: getattr(d, "support_email", ""),
    },
    "user": {
        "email": lambda u: u.email,
        "full_name": lambda u: u.full_name() if callable(getattr(u, "full_name", None)) else getattr(u, "full_name", ""),
        "phone_number": lambda u: getattr(u, "phone_number", ""),
    },
    "request": {
        "title": lambda r: r.title,
        "description": lambda r: r.description,
        "type": lambda r: getattr(r, "request_type", ""),
        "status": lambda r: getattr(r, "status", ""),
        "creator_name": lambda r: getattr(r, "creator_name", ""),
        "creator_email": lambda r: getattr(r, "creator_email", ""),
        "creator_phone": lambda r: getattr(r, "creator_phone", ""),
        "ref_number": lambda r: getattr(r, "ref_number", ""),
        "created_at": lambda r: getattr(r, "created_at", ""),
        "approved_at": lambda r: getattr(r, "approved_at", ""),
        "approver_name": lambda r: getattr(getattr(r, "approved_by", None), "full_name", lambda: getattr(getattr(r, "approved_by", None), "name", ""))() if getattr(r, "approved_by", None) else "",
        "department_name": lambda r: getattr(r.department, "name", "") if r.department else "",
        "url": lambda r: getattr(r.business, "support_url", "") + '/req/' + getattr(r, "ref_number", ""),
    },
    "customer": {
        "email": lambda c: c.email,
        "full_name": lambda c: c.full_name() if callable(getattr(c, "full_name", None)) else getattr(c, "full_name", ""),
        "phone_number": lambda c: getattr(c, "phone_number", ""),
    },
    "comment": {
        "ticket_id": lambda c: getattr(c.ticket, "ticket_id", ""),
        "ticket_title": lambda c: getattr(c.ticket, "title", ""),
        "comment_content": lambda c: getattr(c, "content", ""),
        "comment_author_name": lambda c: getattr(c.author, "full_name", lambda: getattr(c.author, "name", ""))() if getattr(c, "author", None) else "Anonymous",
        "liker_name": lambda c: getattr(c, "liker_name", ""),
        "flagger_name": lambda c: getattr(c, "flagger_name", ""),
        "replier_name": lambda c: getattr(c, "replier_name", ""),
        "recipient_name": lambda c: getattr(c, "recipient_name", ""),
        "original_comment_content": lambda c: getattr(c, "original_comment_content", ""),
        "reply_content": lambda c: getattr(c, "reply_content", ""),
        "activity_description": lambda c: getattr(c, "activity_description", ""),
        "url": lambda c: getattr(c.ticket.department.business, "support_url", "") + '/tk/' + getattr(c.ticket, "ticket_id", ""),
    },
}
