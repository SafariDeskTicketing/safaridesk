import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def purge_expired_deletion_requests():
    """
    Runs daily. Finds pending agent deletion requests whose grace period has
    elapsed and finalises the soft-delete audit status.

    The user row and assignment foreign keys are intentionally preserved so
    tickets, tasks, SLA reports, and historical accountability remain intact.
    """
    from users.models.DeletionModel import AccountDeletionRequest

    expired = AccountDeletionRequest.objects.filter(
        status=AccountDeletionRequest.STATUS_PENDING,
        grace_period_end__lte=timezone.now(),
    ).select_related('user')

    purged_count = 0
    for deletion in expired:
        try:
            _finalize_soft_deleted_agent(deletion)
            purged_count += 1
        except Exception as e:
            logger.error(
                "[AccountDeletion] Failed to purge deletion_id=%s: %s",
                deletion.id, e, exc_info=True,
            )

    logger.info("[AccountDeletion] Purged %d expired deletion requests", purged_count)
    return purged_count


def _finalize_soft_deleted_agent(deletion):
    from users.models.DeletionModel import AccountDeletionRequest

    user = deletion.user
    if user:
        user.is_active = False
        user.status = 'D'
        user.save(update_fields=['is_active', 'status'])

        try:
            user.notification_preferences.delete()
        except Exception:
            pass

        logger.info(
            "[AccountDeletion] Finalised soft-delete for user_id=%s email=%s",
            user.id, deletion.user_email,
        )

    deletion.status = AccountDeletionRequest.STATUS_PURGED
    deletion.purged_at = timezone.now()
    deletion.save(update_fields=['status', 'purged_at'])
    logger.info("[AccountDeletion] Soft-delete finalised for %s (deletion_id=%s)", deletion.user_email, deletion.id)
