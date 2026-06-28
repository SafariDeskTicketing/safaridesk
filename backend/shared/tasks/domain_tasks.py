"""
Celery tasks for custom domain verification
"""
import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

from users.models import CustomDomains
from util.DomainVerificationService import DomainVerificationService
from shared.middleware.CustomDomainMiddleware import CustomDomainMiddleware

logger = logging.getLogger(__name__)


@shared_task
def verify_pending_domains():
    """
    Periodic task to verify pending custom domains
    Run this task every hour via Celery Beat
    """
    verification_service = DomainVerificationService()

    # Get pending domains that were created at least 5 minutes ago
    # (to allow time for DNS propagation)
    five_minutes_ago = timezone.now() - timedelta(minutes=5)

    pending_domains = CustomDomains.objects.filter(
        verification_status='pending',
        is_verified=False,
        created_at__lte=five_minutes_ago
    )

    verified_count = 0
    failed_count = 0

    logger.info(f"Checking {pending_domains.count()} pending domains for verification")

    for domain in pending_domains:
        try:
            # Skip if verified recently (within last hour)
            if domain.last_verification_attempt:
                time_since_last_attempt = timezone.now() - domain.last_verification_attempt
                if time_since_last_attempt < timedelta(hours=1):
                    logger.debug(f"Skipping {domain.domain}, verified recently")
                    continue

            logger.info(f"Attempting to verify domain: {domain.domain}")

            if verification_service.verify_domain(domain):
                verified_count += 1
                # Clear cache for newly verified domain
                CustomDomainMiddleware.clear_domain_cache(domain.domain)
                logger.info(f"Successfully verified domain: {domain.domain}")
            else:
                failed_count += 1
                logger.warning(f"Failed to verify domain: {domain.domain}")

        except Exception as e:
            logger.error(f"Error verifying domain {domain.domain}: {str(e)}")
            failed_count += 1

    logger.info(
        f"Domain verification task completed. "
        f"Verified: {verified_count}, Failed: {failed_count}"
    )

    return {
        'verified': verified_count,
        'failed': failed_count,
        'total_checked': verified_count + failed_count
    }


@shared_task
def cleanup_unverified_domains():
    """
    Cleanup domains that have been pending for more than 7 days
    Run this task daily via Celery Beat
    """
    seven_days_ago = timezone.now() - timedelta(days=7)

    old_pending_domains = CustomDomains.objects.filter(
        verification_status='pending',
        is_verified=False,
        created_at__lte=seven_days_ago
    )

    count = old_pending_domains.count()

    if count > 0:
        logger.info(f"Deleting {count} unverified domains older than 7 days")
        old_pending_domains.delete()

    return {'deleted_count': count}

