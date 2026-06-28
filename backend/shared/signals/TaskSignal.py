from django.db import transaction
from django.db.models.signals import post_save, post_init
from django.dispatch import receiver

from tenant.models import Task, TaskComment
from shared.workers.Task import (
    task_created_agent_notification,
    task_assigned_notification,
    task_status_changed_notification,
    new_public_reply_agent_notification,
    private_note_added_notification,
)
from shared.services.ticket_broadcast import broadcast_task_event

@receiver(post_init, sender=Task)
def store_initial_task_state(sender, instance, **kwargs):
    """
    Store the initial state of the task instance to detect changes on save.
    """
    instance._original_status = instance.task_status
    instance._original_assigned_to = instance.assigned_to

@receiver(post_save, sender=Task)
def handle_task_notifications(sender, instance, created, **kwargs):
    """
    Handles notifications for task creation and updates.
    """
    business_id = getattr(instance, 'business_id', None)

    if created:
        transaction.on_commit(lambda: task_created_agent_notification.delay(instance.id))
        if business_id:
            transaction.on_commit(lambda: broadcast_task_event(business_id, {'action': 'created', 'task_id': instance.id}))
    else:
        status_changed = instance.task_status != instance._original_status
        assignment_changed = instance.assigned_to != instance._original_assigned_to

        if assignment_changed:
            transaction.on_commit(lambda: task_assigned_notification.delay(instance.id))

        if status_changed:
            transaction.on_commit(lambda: task_status_changed_notification.delay(instance.id))

        if business_id:
            transaction.on_commit(lambda: broadcast_task_event(business_id, {'action': 'updated', 'task_id': instance.id}))

@receiver(post_save, sender=TaskComment)
def handle_comment_notifications(sender, instance, created, **kwargs):
    """
    Handles notifications when a new comment is added to a task.
    """
    if created:
        if instance.is_internal:
            transaction.on_commit(lambda: private_note_added_notification.delay(instance.task.id, instance.id))
        else:
            transaction.on_commit(lambda: new_public_reply_agent_notification.delay(instance.task.id, instance.id))
