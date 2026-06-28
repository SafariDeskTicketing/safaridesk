from django.db import transaction
from django.db.models.signals import post_save, post_init
from django.dispatch import receiver

from tenant.models import Ticket, TicketComment, TicketWatchers
from tenant.models.TicketModel import TicketActivity
from shared.workers.Ticket import (
    ticket_created_customer_notification,
    ticket_created_agent_notification,
    ticket_assigned_notification,
    ticket_status_changed_notification,
    ticket_reopened_notification,
    new_public_reply_customer_notification,
    new_public_reply_agent_notification,
    private_note_added_notification,
    ticket_closed_customer_notification,
    watcher_added_notification,
)
from shared.workers.Ticket import send_slack_ticket_notification
from shared.tasks.teams_tasks import notify_teams_ticket_update
from shared.workers.sms_notifications import (
    send_new_ticket_sms_notification,
    send_ticket_on_hold_sms_notification,
    send_ticket_resolved_sms_notification,
    send_ticket_assigned_sms_notification,
)
from shared.workers.safari_sms_notifications import (
    send_safari_sms_status_update,
    send_safari_sms_ticket_assigned,
    send_safari_sms_comment_added,
)

@receiver(post_init, sender=Ticket)
def store_initial_ticket_state(sender, instance, **kwargs):
    """
    Store the initial state of the ticket instance to detect changes on save.
    """
    instance._original_status = instance.status
    instance._original_assigned_to = instance.assigned_to

@receiver(post_save, sender=Ticket)
def handle_ticket_notifications(sender, instance, created, **kwargs):
    """
    Handles notifications for ticket creation and updates.
    """
    if created:
        # New ticket created - Only notify customer
        transaction.on_commit(lambda: ticket_created_customer_notification.delay(instance.id))
        # Also notify department agents of a new ticket
        transaction.on_commit(lambda: ticket_created_agent_notification.delay(instance.id))
        # Send Slack notification for new ticket
        transaction.on_commit(lambda: send_slack_ticket_notification.delay(instance.id, 'new_ticket'))
        # Send Teams notification for new ticket
        transaction.on_commit(lambda: notify_teams_ticket_update.delay(instance.id, 'new_ticket'))
        # Send SMS notification to department agents
        transaction.on_commit(lambda: send_new_ticket_sms_notification.delay(instance.id))
    else:
        # Ticket updated, check for changes
        original_status = getattr(instance, '_original_status', None)
        original_assigned_to = getattr(instance, '_original_assigned_to', None)
        
        status_changed = instance.status != original_status
        assignment_changed = instance.assigned_to != original_assigned_to
        
        if assignment_changed and instance.assigned_to:
            # Send Slack notification for assignment
            transaction.on_commit(lambda: send_slack_ticket_notification.delay(instance.id, 'assignment'))
            # Send Teams notification for assignment
            transaction.on_commit(lambda: notify_teams_ticket_update.delay(instance.id, 'assignment'))
            # Send assignment email to the newly assigned agent
            transaction.on_commit(lambda: ticket_assigned_notification.delay(instance.id))
            # Send SMS notification to newly assigned agent
            transaction.on_commit(lambda: send_ticket_assigned_sms_notification.delay(instance.id))
            # Send Safari SMS notification to assigned agent
            assigned_to_id = instance.assigned_to.id if instance.assigned_to else None
            if assigned_to_id:
                transaction.on_commit(lambda: send_safari_sms_ticket_assigned.delay(instance.id, assigned_to_id))

        if status_changed:
            # Send Slack notification for status update
            transaction.on_commit(lambda: send_slack_ticket_notification.delay(instance.id, 'status_update'))
            # Send Teams notification for status update
            transaction.on_commit(lambda: notify_teams_ticket_update.delay(instance.id, 'status_update'))
            # Send email notifications for status change to interested parties
            transaction.on_commit(lambda: ticket_status_changed_notification.delay(instance.id))
            # Send Safari SMS status update notification
            old_status = original_status or ''
            new_status = instance.status or ''
            transaction.on_commit(lambda: send_safari_sms_status_update.delay(instance.id, old_status, new_status))
            
            # Send SMS for specific status changes (legacy)
            if instance.status == 'on_hold':
                transaction.on_commit(lambda: send_ticket_on_hold_sms_notification.delay(instance.id))
            elif instance.status == 'resolved':
                transaction.on_commit(lambda: send_ticket_resolved_sms_notification.delay(instance.id))
            # Trigger CSAT only when the ticket is closed.
            if instance.status == 'closed':
                transaction.on_commit(lambda: ticket_closed_customer_notification.delay(instance.id))

@receiver(post_save, sender=TicketComment)
def handle_comment_notifications(sender, instance, created, **kwargs):
    """
    Handles notifications when a new comment is added to a ticket.
    """
    if created:
        # Send Slack notification for new comment (for both public and internal comments)
        _ticket_id = instance.ticket.id
        _comment_id = instance.id
        transaction.on_commit(lambda tid=_ticket_id, cid=_comment_id: send_slack_ticket_notification.delay(tid, 'comment', cid))
        transaction.on_commit(lambda tid=_ticket_id, cid=_comment_id: notify_teams_ticket_update.delay(tid, 'comment', cid))
        
        # Send Safari SMS notification for public comments only
        if not instance.is_internal:
            ticket_id = instance.ticket.id
            commenter_id = instance.author.id if instance.author else None
            comment_text = instance.content or ''
            if commenter_id:
                # Use default arguments to capture values at definition time (closure fix)
                transaction.on_commit(
                    lambda tid=ticket_id, cid=commenter_id, txt=comment_text: send_safari_sms_comment_added.delay(tid, cid, txt)
                )

        # Real-time broadcast to all agents on this business
        business = getattr(instance.ticket, 'business', None)
        if business:
            from shared.services.ticket_broadcast import broadcast_ticket_event
            ticket_id = instance.ticket.id
            ticket_ref = instance.ticket.ticket_id
            comment_id = instance.id
            is_internal = bool(instance.is_internal)
            actor = instance.author.get_full_name() if instance.author else "Unknown"
            created_at = instance.created_at.isoformat() if instance.created_at else None
            transaction.on_commit(lambda: broadcast_ticket_event(business.id, {
                "event_type": "comment_added",
                "ticket_id": ticket_id,
                "ticket_ref": ticket_ref,
                "comment_id": comment_id,
                "is_internal": is_internal,
                "actor": actor,
                "created_at": created_at,
                "content": instance.content,
            }))
