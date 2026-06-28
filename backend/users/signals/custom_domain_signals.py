"""
Custom Domain Signals
Handles automatic cache clearing when domains are updated
"""
import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from users.models import CustomDomains
from shared.middleware.CustomDomainMiddleware import CustomDomainMiddleware

logger = logging.getLogger(__name__)


@receiver(post_save, sender=CustomDomains)
def clear_domain_cache_on_save(sender, instance, **kwargs):
    """
    Clear domain cache when a custom domain is saved
    This ensures the middleware picks up changes immediately
    """
    if instance.is_verified:
        CustomDomainMiddleware.clear_domain_cache(instance.domain)
        logger.info(f"Cache cleared for domain {instance.domain} after save")


@receiver(post_delete, sender=CustomDomains)
def clear_domain_cache_on_delete(sender, instance, **kwargs):
    """
    Clear domain cache when a custom domain is deleted
    """
    CustomDomainMiddleware.clear_domain_cache(instance.domain)
    logger.info(f"Cache cleared for domain {instance.domain} after deletion")

