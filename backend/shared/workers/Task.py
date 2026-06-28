from celery import shared_task
from tenant.models import Task, TaskComment
from util.Mailer import Mailer
from util.email.parser import TemplateParser
from util.email.templates import get_system_template, get_template
from shared.services.notification_preferences import NotificationSettingsService
import logging

logger = logging.getLogger(__name__)
mailer = Mailer()

def _send_task_notification(task_id, template_name, recipient_email, comment_id=None):
    """
    Helper function to send task-related notifications.
    """
    try:
        task = Task.objects.get(id=task_id)
        template = get_template(template_name, business=task.business)

        if not template:
            logger.error(f"Email template '{template_name}' not found in system templates")
            return

        objects = {"task": task}
        if comment_id:
            try:
                comment = TaskComment.objects.get(id=comment_id)
                objects["comment"] = comment
            except TaskComment.DoesNotExist:
                logger.error(f"Comment with id {comment_id} not found.")
        
        parser = TemplateParser(objects=objects)
        context = parser.build_context(template)

        if not NotificationSettingsService.should_send_email_for_template(
            recipient_email, template_name, task.business
        ):
            logger.info(
                "[Task] Email '%s' suppressed for %s by notification preferences",
                template_name, recipient_email,
            )
            return

        mailer.send_templated_email(
            template=template,
            context=context,
            receiver_email=recipient_email,
            business=task.business,
        )
        logger.info(f"Successfully sent '{template_name}' notification for task {task_id} to {recipient_email}")

    except Task.DoesNotExist:
        logger.error(f"Task with id {task_id} not found.")
    except Exception as e:
        logger.error(f"Error sending task notification for task {task_id}: {e}", exc_info=True)


@shared_task
def task_created_agent_notification(task_id):
    task = Task.objects.get(id=task_id)
    # Notify all members of the department
    for member in NotificationSettingsService.active_department_members(task.department):
        if member.email:
            _send_task_notification(task_id, "NEW_TASK_ALERT", member.email)

@shared_task
def task_assigned_notification(task_id):
    task = Task.objects.get(id=task_id)
    
    # 1. Notify the assigned agent specifically
    if NotificationSettingsService.is_delivery_eligible_user(task.assigned_to):
        _send_task_notification(task_id, "TASK_ASSIGNMENT_ALERT", task.assigned_to.email)

@shared_task
def task_status_changed_notification(task_id):
    task = Task.objects.get(id=task_id)
    recipients = set()

    # Add department members
    for member in NotificationSettingsService.active_department_members(task.department):
        if member.email:
            recipients.add(member.email)
    
    for email in recipients:
        _send_task_notification(task_id, "TASK_NEW_ACTIVITY_NOTICE", email)

@shared_task
def new_public_reply_agent_notification(task_id, comment_id):
    task = Task.objects.get(id=task_id)
    if NotificationSettingsService.is_delivery_eligible_user(task.assigned_to):
        _send_task_notification(task_id, "TASK_NEW_ACTIVITY_ALERT", task.assigned_to.email, comment_id=comment_id)


@shared_task
def private_note_added_notification(task_id, comment_id):
    task = Task.objects.get(id=task_id)
    if NotificationSettingsService.is_delivery_eligible_user(task.assigned_to):
        _send_task_notification(task_id, "TASK_NEW_ACTIVITY_ALERT", task.assigned_to.email, comment_id=comment_id)
