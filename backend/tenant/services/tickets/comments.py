from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime
from typing import Any, Dict

from django.shortcuts import get_object_or_404
from django.utils import timezone

from RNSafarideskBack import settings
from RNSafarideskBack.settings import FILE_URL
from shared.services.notification_preferences import NotificationSettingsService
from shared.tasks import send_mention_email_notification
from tenant.models import Ticket
from tenant.models.TicketModel import CommentReply, TicketComment, TicketReplayAttachment
from tenant.services.tickets.attachments import _build_storage_paths, _extract_and_save_base64_images
from tenant.services.tickets.errors import TicketActionError
from tenant.services.tickets.shared import (
    display_name,
    extract_mention_tokens,
    resolve_mentioned_users,
    sanitize_text_for_mysql,
)
from users.models import Users

logger = logging.getLogger(__name__)


def add_note(*, ticket_id, data: Dict[str, Any], user: Users) -> Dict[str, Any]:
    if not ticket_id:
        raise TicketActionError({"message": "Ticket ID is required"}, 400)

    ticket = get_object_or_404(Ticket, id=ticket_id, business=user.business)
    note = data.get('note')

    if not note:
        raise TicketActionError({"message": "Note content is required"}, 400)

    # Notes are internal comments
    ticket.comments.create(
        ticket=ticket,
        author=user,
        content=note,
        updated_by=user,
        is_internal=True
    )

    return {"message": "Note added successfully"}


def add_comment(*, ticket_id, data: Dict[str, Any], user: Users, files) -> Dict[str, Any]:
    if not ticket_id:
        raise TicketActionError({"message": "Ticket ID is required"}, 400)

    ticket = get_object_or_404(Ticket, id=ticket_id, business=user.business)
    comment = data.get('comment')
    # Sanitize comment for MySQL if necessary
    comment = sanitize_text_for_mysql(comment) if comment else comment
    is_internal = str(data.get("is_internal", "false")).lower() == "true"

    # Only staff Users can be stored in TicketComment.author/updated_by.
    author = user if isinstance(user, Users) else None
    print(f"Author set to: {author}")
    # Customer portal users are separate Customer records, so fall back to a system staff user.
    updated_by = author or Users.objects.filter(first_name="System").first()

    com = ticket.comments.create(
        ticket=ticket,
        author=author,
        content=comment,
        updated_by=updated_by,
        is_internal=is_internal
    )

    # ========== EXTRACT AND SAVE BASE64 IMAGES ==========
    # Extract embedded base64 images from HTML content and save as attachments
    try:
        if comment and '<img' in comment and 'base64' in comment:
            updated_content = _extract_and_save_base64_images(
                html_content=comment,
                comment=com,
                business=ticket.business
            )
            # Update comment content with file URLs instead of base64
            if updated_content != comment:
                com.content = updated_content
                com.save(update_fields=['content'])
    except Exception as img_error:
        logger.error(f"Failed to extract base64 images from comment: {img_error}")
    # =====================================================

    # ========== SET HAS_NEW_REPLY BADGE ==========
    # If the comment is from someone other than the assigned agent, set has_new_reply
    try:
        if not is_internal:  # Only for non-internal (public) comments
            # If author is None (anonymous/customer) or author is not the assigned agent
            if author is None or (ticket.assigned_to_id and author.id != ticket.assigned_to_id):
                ticket.has_new_reply = True
                ticket.save(update_fields=['has_new_reply'])
    except Exception as badge_error:
        logger.error(f"Failed to set has_new_reply badge: {badge_error}")
    # =====================================================

    # ========== AUTO STATUS TRANSITION ==========
    # When agent replies to ticket in 'open' status, auto-change to 'in_progress'
    try:
        if author and ticket.status == 'open':
            old_status = ticket.status
            ticket.status = 'in_progress'
            ticket.updated_at = datetime.now()
            ticket.updated_by = author
            ticket.save(update_fields=['status', 'updated_at', 'updated_by'])

            # Log the auto-transition in activity stream
            from tenant.models import TicketActivity
            TicketActivity.objects.create(
                ticket=ticket,
                user=author,
                activity_type='status_changed',
                description="System changed the ticket status to In Progress",
                old_value=old_status,
                new_value='in_progress'
            )
            logger.info(f"Auto-transitioned ticket {ticket.ticket_id} from 'open' to 'in_progress' on first agent reply")
    except Exception as auto_status_error:
        logger.error(f"Failed to auto-transition ticket status: {auto_status_error}")
    # =====================================================

    # ========== DETECT @ MENTIONS AND CREATE NOTIFICATIONS ==========
    # Wrapped in try-except to prevent comment creation from failing if notification fails
    try:
        # Detect @ mentions and create notifications
        if comment and author:
            mention_tokens = extract_mention_tokens(comment)

            for mention_name in mention_tokens:
                if not mention_name:
                    continue

                mentioned_users = resolve_mentioned_users(mention_name, business=author.business)

                # Create notification for each matched user
                for mentioned_user in mentioned_users:
                    # Don't notify the author about their own mention
                    if mentioned_user.id != author.id:
                        try:
                            # Resolve a human-friendly display name for the author
                            author_name = display_name(author)

                            NotificationSettingsService.create_in_app_notification(
                                user=mentioned_user,
                                ticket=ticket,
                                message=f"{author_name} mentioned you in ticket #{ticket.ticket_id}",
                                notification_type='ticket_mention',
                                metadata={
                                    # Backwards-compatible keys
                                    'comment_id': com.id,
                                    'mentioned_by': author.id,
                                    'mentioned_by_name': author_name,
                                    # Normalised keys for new consumers
                                    'mentioned_by_id': author.id,
                                    'mentioned_by_display': author_name,
                                }
                            )

                            # ========== Send Email Notification (async) ==========
                            try:
                                send_mention_email_notification.delay(
                                    mentioned_user_id=mentioned_user.id,
                                    ticket_id=ticket.id,
                                    mentioned_by_id=author.id,
                                    comment_text=comment
                                )
                            except Exception as email_error:
                                logger.error(f"Failed to queue mention email: {email_error}")
                            # ====================================================

                        except Exception as notif_error:
                            logger.error(f"Failed to create mention notification: {notif_error}")

    except Exception as mention_error:
        # Log the error but don't fail the comment creation
        logger.error(f"Failed to process @ mentions, but comment was saved: {mention_error}")
        import traceback
        logger.error(traceback.format_exc())
    # ===================================================================

    # ========== CREATE REGULAR COMMENT NOTIFICATIONS ==========
    # Notify assigned agent, ticket creator, watchers, and department members
    # Using NotificationSettingsService for proper in-app notifications
    try:
        if author:
            recipients = []

            # Notify assigned agent (if exists and not author)
            if (
                NotificationSettingsService.is_delivery_eligible_user(ticket.assigned_to)
                and ticket.assigned_to != author
            ):
                recipients.append(ticket.assigned_to)

            # If no assignee and ticket has department, notify all department members (admins)
            if not ticket.assigned_to and ticket.department:
                dept_members = NotificationSettingsService.active_department_members(ticket.department).exclude(id=author.id)
                recipients.extend(list(dept_members))

            # Notify ticket creator (if not author/assignee and not internal note)
            if (not is_internal and ticket.created_by and
                ticket.created_by != author and
                ticket.created_by != ticket.assigned_to):
                recipients.append(ticket.created_by)

            # Notify watchers (if not author)
            for watcher in NotificationSettingsService.active_ticket_watchers(ticket):
                if watcher != author:
                    recipients.append(watcher)

            # Remove duplicates while preserving order
            seen = set()
            unique_recipients = []
            for recipient in recipients:
                if recipient.id not in seen:
                    seen.add(recipient.id)
                    unique_recipients.append(recipient)

            # Create notifications for all recipients
            comment_preview = comment[:100] + "..." if len(comment) > 100 else comment

            message = (
                f"New internal note added to ticket #{ticket.ticket_id}"
                if is_internal else
                f"New comment on ticket #{ticket.ticket_id}: {comment_preview}"
            )

            # Resolve a consistent author name/id for metadata
            if author:
                if hasattr(author, "full_name") and callable(author.full_name):
                    author_name = author.full_name()
                else:
                    author_name = getattr(author, "email", str(author))
                author_id = author.id
            else:
                author_name = "Anonymous"
                author_id = None

            NotificationSettingsService.notify_many(
                users=unique_recipients,
                ticket=ticket,
                message=message,
                notification_type="ticket_comment",
                metadata={
                    "comment_id": com.id,
                    # Backwards-compatible key
                    "author": author_name,
                    # Normalised keys for new consumers
                    "author_id": author_id,
                    "author_name": author_name,
                    "is_internal": is_internal,
                    "activity_type": "comment",
                }
            )

    except Exception as comment_notif_error:
        # Log the error but don't fail the comment creation
        logger.error(f"Failed to process regular comment notifications: {comment_notif_error}")
        import traceback
        logger.error(traceback.format_exc())
    # ==========================================================

    if files:
        uploaded_files = files

        for uploaded_file_name, uploaded_file in uploaded_files.items():
            try:
                file_extension = os.path.splitext(uploaded_file.name)[1].lower()

                # Generate unique filename
                unique_filename = f"{uuid.uuid4()}{file_extension}"

                # Create directory (scoped by business)
                properties_dir, url_base = _build_storage_paths(ticket.business, subfolder='files')

                # Full file path
                file_path = os.path.join(properties_dir, unique_filename)

                # Save file
                with open(file_path, 'wb+') as destination:
                    for chunk in uploaded_file.chunks():
                        destination.write(chunk)

                # Generate URL (be defensive: FILE_URL may be empty in some envs)
                file_url_base = url_base or FILE_URL or getattr(settings, 'FILE_BASE_URL', '')
                if file_url_base:
                    file_url = f"{file_url_base.rstrip('/')}/{unique_filename}"
                else:
                    # fallback to relative path if no base URL configured
                    file_url = unique_filename

                # Create attachment
                TicketReplayAttachment.objects.create(
                    comment=com,
                    file_url=file_url,
                    filename=uploaded_file.name  # Save original filename
                )

            except Exception as file_error:
                logger.exception("Error saving uploaded file %s", uploaded_file_name)
                raise TicketActionError(
                    {
                        "message": f"Failed to save file {uploaded_file_name}",
                        "details": str(file_error)
                    },
                    400,
                )

    return {"message": "Comment added successfully"}


def edit_comment(*, pk, comment_id, data: Dict[str, Any], user: Users) -> Dict[str, Any]:
    comment = get_object_or_404(TicketComment, id=comment_id, ticket_id=pk, author=user)
    content = data.get('content')

    if not content:
        raise TicketActionError({"message": "Comment content is required"}, 400)

    comment.content = content
    comment.updated_at = timezone.now()
    comment.save()

    return {
        "message": "Comment updated successfully",
        "comment": {
            "id": comment.id,
            "content": comment.content,
            "updated_at": comment.updated_at
        }
    }


def delete_comment(*, pk, comment_id, user: Users) -> Dict[str, Any]:
    comment = get_object_or_404(TicketComment, id=comment_id, ticket_id=pk, author=user)
    comment.delete()

    return {"message": "Comment deleted successfully"}


def reply_to_comment(*, pk, comment_id, data: Dict[str, Any], user: Users) -> Dict[str, Any]:
    parent_comment = get_object_or_404(TicketComment, id=comment_id, ticket_id=pk)
    content = data.get('content')
    is_internal = data.get('is_internal', False)

    if not content:
        raise TicketActionError({"message": "Reply content is required"}, 400)

    reply = CommentReply.objects.create(
        parent_comment=parent_comment,
        author=user,
        content=content,
        is_internal=is_internal
    )

    # Send notification email for new reply
    from shared.tasks import send_comment_reply_notification
    send_comment_reply_notification.delay(
        ticket_id=pk,
        comment_id=comment_id,
        reply_id=reply.id,
        replier_id=user.id
    )

    return {
        "message": "Reply added successfully",
        "reply": {
            "id": reply.id,
            "content": reply.content,
            "author": {
                "id": reply.author.id,
                "name": reply.author.full_name(),
                "email": reply.author.email
            },
            "created_at": reply.created_at,
            "is_internal": reply.is_internal,
            "likes_count": reply.likes_count
        }
    }
