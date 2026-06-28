import logging
import json

from django.contrib.auth.models import AnonymousUser
from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_save, pre_delete, post_delete
from django.dispatch import receiver, Signal
from django_currentuser.middleware import get_current_user
from django.db.models import Q
from django.db import models

from shared.services.notification_preferences import NotificationSettingsService
from tenant.models.TicketModel import Ticket, TicketComment
from users.models import Users

logger = logging.getLogger(__name__)


def is_internal_user(user):
    return user and user.is_authenticated and user.role and user.role.name in ['agent', 'admin', 'superuser']


"""
==============================================================================
NOTIFICATION SIGNALS DISABLED
==============================================================================
All in-app notifications are now handled directly in TicketView.py to avoid
duplicate notifications. Email notifications are handled by ticketSignal.py
via Celery tasks.

Previously, these signals were creating duplicate in-app notifications because:
1. TicketView.add_comment() creates notifications when comments are added
2. TicketView.assign() creates notifications when tickets are assigned
3. TicketView.update_status() creates notifications when status changes

The signal handlers have been removed to eliminate duplication.
See NOTIFICATION_SYSTEM_ARCHITECTURE.md for full details.
==============================================================================
"""
# This prevents duplicate emails being sent to assignees and creators who weren't mentioned
#
# @receiver(post_save, sender=TicketComment)
# def handle_ticket_comment_notifications(sender, instance, created, **kwargs):
#     """Handle ticket comment and internal note notifications"""
#     if not created:
#         return

#     ticket = instance.ticket
#     author = instance.author
#     comment_preview = instance.content[:100] + "..." if len(instance.content) > 100 else instance.content
#     is_internal = instance.is_internal
#     is_solution = instance.is_solution

#     # logger.info(f"Processing comment notification for ticket #{ticket.ticket_id} by {author} (ID: {author.id if author else 'N/A'})")

#     # Step 1: Build mentioned_users set
#     mentioned_users = set()
#     if "@" in instance.content:
#         for word in instance.content.split():
#             if word.startswith("@"):
#                 username_or_email = word[1:].rstrip('.,!?;:')
#                 user = Users.objects.filter(
#                     Q(username=username_or_email) | Q(email=username_or_email)
#                 ).first()
#                 if user and user != author:
#                     mentioned_users.add(user)

#     # Step 2: Notify assignee (if not author and not mentioned)
#     if (
#         ticket.assigned_to and
#         ticket.assigned_to != author and
#         ticket.assigned_to not in mentioned_users
#     ):
#         message = (
#             f"New internal note added to your assigned ticket #{ticket.ticket_id}"
#             if is_internal else
#             f"New comment has been added to your assigned ticket #{ticket.ticket_id}"
#         )
#         # logger.info(f"Notifying assignee ({ticket.assigned_to.email}): {message}")
#         create_notification_task.delay(
#             user_id=ticket.assigned_to.id,
#             ticket_id=ticket.id,
#             message=message,
#             notification_type="ticket_comment",
#             metadata={
#                 "comment_id": instance.id,
#                 "author": author.get_full_name() if author else "Anonymous",
#                 "is_internal": is_internal,
#                 "is_solution": is_solution,
#             }
#         )

#     # Step 3: Notify ticket creator (if not author/assignee/mentioned and comment not internal)
#     if (
#         not is_internal and
#         ticket.created_by and
#         ticket.created_by != author and
#         ticket.created_by != ticket.assigned_to and
#         ticket.created_by not in mentioned_users
#     ):
#         message = f"New comment added on your ticket #{ticket.ticket_id}: {comment_preview}"
#         # logger.info(f"Notifying ticket creator ({ticket.created_by.email}): {message}")
#         create_notification_task.delay(
#             user_id=ticket.created_by.id,
#             ticket_id=ticket.id,
#             message=message,
#             notification_type="ticket_comment",
#             metadata={
#                 "comment_id": instance.id,
#                 "author": author.get_full_name() if author else "Anonymous",
#                 "is_creator_notification": True,
#             }
#         )

#     # Step 4: Notify the author (confirmation)
#     # if author:
#     #     author_message = (
#     #         f"Your internal note was added to ticket #{ticket.ticket_id}"
#     #         if is_internal else
#     #         f"Your comment was added to ticket #{ticket.ticket_id}"
#     #     )
#     #     # logger.info(f"Notifying author ({author.email}): {author_message}")
#     #     create_notification_task.delay(
#     #         user_id=author.id,
#     #         ticket_id=ticket.id,
#     #         message=author_message,
#     #         notification_type="ticket_comment",
#     #         metadata={
#     #             "comment_id": instance.id,
#     #             "is_author_notification": True,
#     #             "is_internal": is_internal,
#     #         }
#     #     )

#     # Step 5: Notify mentioned users
#     for user in mentioned_users:
#         mention_message = (
#             f"You were mentioned in ticket #{ticket.ticket_id}: {comment_preview}"
#             if not is_internal else
#             f"You were mentioned in an internal note on ticket #{ticket.ticket_id}: {comment_preview}"
#         )
#         # logger.info(f"Mention notification to {user.email}: {mention_message}")
#         create_notification_task.delay(
#             user_id=user.id,
#             ticket_id=ticket.id,
#             message=mention_message,
#             notification_type="ticket_mention",
#             metadata={
#                 "comment_id": instance.id,
#                 "mentioned_by": author.get_full_name() if author else "Anonymous",
#                 "mention_text": f"@{user.username or user.email}",
#                 "is_internal": is_internal,
#             }
#         )
