import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.defaultfilters import linebreaks
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def purge_expired_business_deletion_requests():
    """
    Runs daily. Finds pending business deletion requests whose grace period has elapsed
    and permanently deletes the business and all its data (cascade).
    The BusinessDeletionRequest record is scrubbed and kept as a platform audit shell.
    """
    from users.models.BusinessDeletionModel import BusinessDeletionRequest

    expired = BusinessDeletionRequest.objects.filter(
        status=BusinessDeletionRequest.STATUS_PENDING,
        grace_period_end__lte=timezone.now(),
    ).select_related('business')

    purged_count = 0
    for deletion in expired:
        try:
            _purge_business(deletion)
            purged_count += 1
        except Exception as e:
            logger.error(
                "[BusinessDeletion] Failed to purge deletion_id=%s business='%s': %s",
                deletion.id, deletion.business_name, e, exc_info=True,
            )

    logger.info("[BusinessDeletion] Purged %d expired business deletion requests", purged_count)
    return purged_count


def _purge_business(deletion):
    from users.models.BusinessDeletionModel import BusinessDeletionRequest
    from users.services.tenant_purge import purge_tenant

    business = deletion.business
    business_name = deletion.business_name

    if business is not None:
        logger.info(
            "[BusinessDeletion] Hard-deleting business_id=%s name='%s'",
            business.id, business_name,
        )
        purge_tenant(
            business.id,
            reason=deletion.reason or "Manual business deletion grace period elapsed",
            actor=deletion.requested_by,
            deletion_request=deletion,
        )
    else:
        deletion.status = BusinessDeletionRequest.STATUS_PURGED
        deletion.business_name = "[purged]"
        deletion.business_domain = ""
        deletion.purged_at = timezone.now()
        deletion.save(update_fields=['status', 'business_name', 'business_domain', 'purged_at'])
    logger.info("[BusinessDeletion] Purge complete for '%s' (deletion_id=%s)", business_name, deletion.id)


@shared_task
def report_inactive_business_deletion_candidates(days=30):
    """
    Weekly report-only review for inactive tenants.

    Deletion is intentionally handed to humans via the management command.
    """
    from users.services.tenant_purge import find_inactive_tenants

    candidates = find_inactive_tenants(days=days)
    sent = _send_inactive_business_report(candidates, days)
    logger.info(
        "[BusinessDeletion] Inactive deletion candidate report sent=%s candidates=%d days=%d",
        sent,
        len(candidates),
        days,
    )
    return {
        "candidates": len(candidates),
        "sent": sent,
        "recipient": getattr(settings, "INACTIVE_TENANT_ADMIN_EMAIL", "support@safaridesk.io"),
    }


@shared_task
def purge_inactive_businesses(days=30, dry_run=True):
    """
    Backwards-compatible report-only wrapper.

    The scheduled automation must not delete tenants; use
    `python manage.py purge_inactive_businesses --days <n> --commit` manually
    after reviewing the report.
    """
    return report_inactive_business_deletion_candidates(days=days)


def _send_inactive_business_report(candidates, days):
    recipient = getattr(settings, "INACTIVE_TENANT_ADMIN_EMAIL", "support@safaridesk.io")
    if not recipient:
        logger.warning("[BusinessDeletion] INACTIVE_TENANT_ADMIN_EMAIL is empty; report not sent")
        return False

    command = f"python manage.py purge_inactive_businesses --days {days} --commit"
    generated_at = timezone.now()
    lines = [
        "SafariDesk inactive tenant deletion review",
        "",
        f"Generated at: {generated_at.isoformat()}",
        f"Inactivity threshold: {days} days",
        "",
        "Manual deletion command:",
        command,
        "",
        "Candidates:",
    ]

    if not candidates:
        lines.append("- None")
    else:
        for candidate in candidates:
            business = candidate["business"]
            last_activity_at = candidate["last_activity_at"]
            last_activity = last_activity_at.isoformat() if last_activity_at else "unknown"
            lines.append(
                "- id={id} name={name} domain={domain} last_activity_at={last_activity} source={source}".format(
                    id=candidate["business_id"],
                    name=business.name,
                    domain=business.domain or "",
                    last_activity=last_activity,
                    source=candidate["last_activity_source"],
                )
            )

    body = "\n".join(lines)
    subject = f"SafariDesk inactive tenant deletion review: {len(candidates)} candidate(s)"

    try:
        connection = get_connection(
            host=settings.EMAIL_HOST,
            port=settings.EMAIL_PORT,
            username=settings.EMAIL_HOST_USER,
            password=settings.EMAIL_HOST_PASSWORD,
            use_tls=getattr(settings, "EMAIL_USE_TLS", False),
            use_ssl=getattr(settings, "EMAIL_USE_SSL", False),
        )
        default_name = getattr(settings, "DEFAULT_FROM_NAME", "")
        default_email = settings.DEFAULT_FROM_EMAIL
        from_email = f"{default_name} <{default_email}>" if default_name else default_email
        message = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=from_email,
            to=[recipient],
            connection=connection,
        )
        message.attach_alternative(linebreaks(body), "text/html")
        message.send(fail_silently=False)
        return True
    except Exception as exc:
        logger.error("[BusinessDeletion] Failed sending inactive tenant report to %s: %s", recipient, exc, exc_info=True)
        return False
