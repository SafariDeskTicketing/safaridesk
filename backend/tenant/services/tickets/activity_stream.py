from __future__ import annotations

from types import SimpleNamespace
from typing import Any, Dict, List

from tenant.models import EmailMessageRecord, Ticket
from tenant.models.TicketModel import TicketCallLog
from tenant.services.email_activity import build_comment_email_meta
from tenant.services.tickets.shared import resolve_staff_user


def _serialize_activity_author(user):
    if user:
        return {
            "id": user.id,
            "avatar": user.avatar_url,
            "name": user.full_name() if hasattr(user, "full_name") else str(user),
            "email": user.email,
            "is_active": user.is_active,
        }
    return {
        "id": 0,
        "avatar": "",
        "name": "System",
        "email": "",
        "is_active": None,
    }


def _serialize_call_log_activity(call_log: TicketCallLog, src_ticket: Ticket | None = None) -> dict:
    contact = call_log.contact
    return {
        "id": call_log.id,
        "type": "call_log",
        "author": _serialize_activity_author(call_log.logged_by),
        "created_at": call_log.created_at,
        "updated_at": call_log.updated_at,
        "subject": call_log.subject,
        "content": call_log.content,
        "contact_name": call_log.contact_name or (contact.name if contact else ""),
        "contact_email": call_log.contact_email or (contact.email if contact and contact.email else ""),
        "duration": call_log.duration or None,
        "is_internal": call_log.is_internal,
        "_sort_timestamp": call_log.created_at,
        "source_ticket": {
            "id": (src_ticket or call_log.ticket).id,
            "ticket_id": (src_ticket or call_log.ticket).ticket_id,
            "title": (src_ticket or call_log.ticket).title,
        },
    }


def load_activity_stream(*, ticket_id, user) -> List[Dict[str, Any]]:
    # Get ticket with related data using select_related and prefetch_related for optimization
    ticket = Ticket.objects.select_related(
        'category',
        'department',
        'assigned_to',
        'contact',
    ).prefetch_related(
        'comments__author',
        'comments__attachment',
        'comments__email_message_record__integration',
        'comments__replies__author',
        'attachments',
        'activities__user',
        'call_logs__logged_by',
        'call_logs__contact',
    ).get(
        id=ticket_id,
        business=user.business,
    )
    merged_children = ticket.merged_children.prefetch_related(
        'comments__author',
        'comments__attachment',
        'comments__email_message_record__integration',
        'comments__replies__author',
        'attachments',
        'activities__user',
        'call_logs__logged_by',
        'call_logs__contact',
    ).all()

    # Collect all activities (comments + system events)
    all_activities = []

    def _append_comments(src_ticket):
        for comment in src_ticket.comments.all():
            attachments = []
            for a in comment.attachment.all():
                attachments.append({
                    "id": a.id,
                    "file_url": a.file_url,
                    "filename": a.filename,  # Include original filename
                })

            replies_data = []
            for reply in comment.replies.all():
                replies_data.append({
                    "id": reply.id,
                    "content": reply.content,
                    "created_at": reply.created_at,
                    "updated_at": reply.updated_at,
                    "is_internal": reply.is_internal,
                    "likes_count": reply.likes_count,
                    "author": {
                        "id": reply.author.id,
                        "avatar": reply.author.avatar_url if reply.author else "",
                        "name": reply.author.full_name() if reply.author else 'Anonymous User',
                        "email": reply.author.email if reply.author else 'Anonymous User',
                        "is_active": reply.author.is_active if reply.author else None,
                    }
                })

            comment_data = {
                "id": comment.id,
                "type": "comment",
                "content": comment.content,
                "created_at": comment.created_at,
                "updated_at": comment.updated_at,
                "is_internal": comment.is_internal,
                "is_solution": comment.is_solution,
                "attachments": attachments if attachments else None,
                "author": {
                    "id": comment.author.id,
                    "avatar": comment.author.avatar_url if comment.author else "",
                    "name": comment.author.full_name() if comment.author else 'Anonymous User',
                    "email": comment.author.email if comment.author else 'Anonymous User',
                    "is_active": comment.author.is_active if comment.author else None,
                } if comment.author else {
                    "id": 0,
                    "avatar": "",
                    "name": src_ticket.creator_name,
                    "email": src_ticket.creator_email,
                },
                "replies": replies_data,
                "_sort_timestamp": comment.created_at,
                "source_ticket": {
                    "id": src_ticket.id,
                    "ticket_id": src_ticket.ticket_id,
                    "title": src_ticket.title,
                },
                # Email recipient fields (for email replies)
                "email_to": comment.email_to,
                "email_cc": comment.email_cc,
                "email_bcc": comment.email_bcc,
            }
            try:
                email_record = comment.email_message_record
            except EmailMessageRecord.DoesNotExist:
                email_record = None

            email_meta = build_comment_email_meta(comment, email_record)
            if email_meta:
                comment_data["email_meta"] = email_meta
            all_activities.append(comment_data)

    def _append_unlinked_outgoing_emails(src_ticket):
        outgoing_records = (
            EmailMessageRecord.objects.filter(
                ticket=src_ticket,
                direction=EmailMessageRecord.Direction.OUTGOING,
                comment__isnull=True,
            )
            .select_related("integration")
            .order_by("received_at", "id")
        )
        for email_record in outgoing_records:
            email_meta = build_comment_email_meta(
                SimpleNamespace(
                    email_to=None,
                    email_cc=None,
                    email_bcc=None,
                    author=None,
                ),
                email_record,
            )
            author_name = (
                email_meta["from"]["name"]
                if email_meta and email_meta.get("from") and email_meta["from"].get("name")
                else (email_meta["from"]["display"] if email_meta and email_meta.get("from") else "SafariDesk")
            )
            author_email = (
                email_meta["from"]["email"]
                if email_meta and email_meta.get("from")
                else ""
            )
            content = email_record.raw_body or email_record.html_body or email_record.subject or "Email sent"
            all_activities.append({
                "id": -email_record.id,
                "type": "comment",
                "content": content,
                "created_at": email_record.received_at,
                "updated_at": email_record.received_at,
                "is_internal": False,
                "is_solution": False,
                "attachments": None,
                "author": {
                    "id": 0,
                    "avatar": "",
                    "name": author_name,
                    "email": author_email,
                    "is_active": None,
                },
                "replies": [],
                "email_to": None,
                "email_cc": None,
                "email_bcc": None,
                "email_meta": email_meta,
                "_sort_timestamp": email_record.received_at,
                "source_ticket": {
                    "id": src_ticket.id,
                    "ticket_id": src_ticket.ticket_id,
                    "title": src_ticket.title,
                },
            })

    def _append_activities(src_ticket):
        for activity in src_ticket.activities.all():
            activity_data = {
                "id": activity.id,
                "type": "system_event",
                "activity_type": activity.activity_type,
                "user": {
                    "id": activity.user.id if activity.user else None,
                    "avatar": activity.user.avatar_url if activity.user else "",
                    "name": activity.user.full_name() if activity.user else 'System',
                    "email": activity.user.email if activity.user else '',
                    "is_active": activity.user.is_active if activity.user else None,
                } if activity.user else {
                    "id": None,
                    "avatar": "",
                    "name": "System",
                    "email": "",
                },
                "timestamp": activity.timestamp,
                "description": activity.description,
                "old_value": activity.old_value,
                "new_value": activity.new_value,
                "_sort_timestamp": activity.timestamp,
                "source_ticket": {
                    "id": src_ticket.id,
                    "ticket_id": src_ticket.ticket_id,
                    "title": src_ticket.title,
                }
            }
            all_activities.append(activity_data)

    def _append_call_logs(src_ticket):
        if not resolve_staff_user(user):
            return
        for call_log in src_ticket.call_logs.all():
            all_activities.append(_serialize_call_log_activity(call_log, src_ticket))

    _append_comments(ticket)
    _append_unlinked_outgoing_emails(ticket)
    _append_activities(ticket)
    _append_call_logs(ticket)
    # Do not append merged child activity streams to avoid duplication/confusion.
    # Users can follow hyperlinks to merged tickets for their history.
    # for child in merged_children:
    #     _append_comments(child)
    #     _append_activities(child)

    # Sort by timestamp (chronological order)
    all_activities.sort(key=lambda x: x['_sort_timestamp'])

    # Remove the _sort_timestamp helper field
    for activity in all_activities:
        del activity['_sort_timestamp']

    return all_activities
