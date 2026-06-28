"""
Notification Retry Configuration & Utilities

Provides unified retry logic and error handling for all notification tasks
to ensure reliable delivery and proper failure tracking.
"""
import logging
from celery import shared_task
from celery.exceptions import Reject
from typing import Callable, Any

logger = logging.getLogger(__name__)

# Unified retry configuration for all notification tasks
NOTIFICATION_RETRY_CONFIG = {
    'bind': True,
    'max_retries': 5,  # Try up to 5 times
    'default_retry_delay': 60,  # Start with 60 second delay
    'autoretry_for': (Exception,),  # Retry on any exception
    'retry_kwargs': {'max_retries': 5},
    'rate_limit': '100/m',  # 100 tasks per minute
}

# Fast retry config for time-sensitive notifications (Slack, SMS)
FAST_NOTIFICATION_RETRY_CONFIG = {
    'bind': True,
    'max_retries': 3,
    'default_retry_delay': 10,  # Faster retry for real-time notifications
    'autoretry_for': (Exception,),
    'retry_kwargs': {'max_retries': 3},
    'rate_limit': '200/m',
}


class NotificationRetryError(Exception):
    """Raised when a notification task should be retried"""
    pass


class NotificationPermanentError(Exception):
    """Raised when a notification task has permanently failed"""
    pass


def calculate_exponential_backoff(retries_attempted: int, base_delay: int = 60) -> int:
    """
    Calculate exponential backoff delay: base_delay * (2 ^ retries_attempted)
    
    Examples:
    - 0 retries: 60 seconds
    - 1 retry: 120 seconds
    - 2 retries: 240 seconds
    - 3 retries: 480 seconds (max 8 minutes)
    """
    import math
    max_delay = 480  # Cap at 8 minutes
    calculated = base_delay * (2 ** retries_attempted)
    return min(calculated, max_delay)


def retry_notification_task(task_self, exc: Exception, base_delay: int = 60, context_info: str = ""):
    """
    Unified retry handler for notification tasks with exponential backoff.
    
    Args:
        task_self: The Celery task instance (self)
        exc: The exception that occurred
        base_delay: Base delay in seconds for exponential backoff
        context_info: Additional context for logging (e.g., "ticket_id=123")
    
    Raises:
        Reject: Signals Celery to retry the task
    """
    retry_count = task_self.request.retries
    max_retries = task_self.max_retries
    
    # Calculate delay with exponential backoff
    countdown = calculate_exponential_backoff(retry_count, base_delay)
    
    logger.warning(
        f"Notification task retry: attempt={retry_count + 1}/{max_retries} "
        f"countdown={countdown}s {context_info} error={str(exc)[:100]}"
    )
    
    # Retry with exponential backoff
    raise task_self.retry(exc=exc, countdown=countdown, max_retries=max_retries)


def log_notification_failure(task_name: str, context: dict, exc: Exception):
    """
    Log notification failure for debugging and monitoring.
    
    Args:
        task_name: Name of the notification task
        context: Dictionary with task context (ticket_id, user_id, email, etc.)
        exc: The exception that occurred
    """
    logger.error(
        f"Notification task failed: {task_name}",
        extra={
            'task': task_name,
            'context': context,
            'error': str(exc)[:200],
        },
        exc_info=True
    )


def log_notification_success(task_name: str, context: dict):
    """Log successful notification delivery."""
    logger.info(
        f"Notification delivered: {task_name}",
        extra={
            'task': task_name,
            'context': context,
        }
    )


def safe_get_ticket(ticket_id: int):
    """Safely get a ticket, raising NotificationPermanentError if not found."""
    from tenant.models import Ticket
    try:
        return Ticket.objects.select_related('business', 'assigned_to', 'created_by').get(id=ticket_id)
    except Ticket.DoesNotExist:
        raise NotificationPermanentError(f"Ticket with id={ticket_id} not found")


def safe_get_task(task_id: int):
    """Safely get a task, raising NotificationPermanentError if not found."""
    from tenant.models import Task
    try:
        return Task.objects.select_related('business', 'assigned_to').get(id=task_id)
    except Task.DoesNotExist:
        raise NotificationPermanentError(f"Task with id={task_id} not found")


def safe_get_comment(comment_id: int):
    """Safely get a comment, raising NotificationPermanentError if not found."""
    from tenant.models import TicketComment
    try:
        return TicketComment.objects.get(id=comment_id)
    except TicketComment.DoesNotExist:
        raise NotificationPermanentError(f"TicketComment with id={comment_id} not found")
