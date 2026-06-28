import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from users.models import Business
from util.BusinessSetup import BusinessSetup

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Business)
def handle_business_creation(sender, instance, created, **kwargs):
    """
    Handles the initial setup for a newly created business.
    """
    logger.info(f"Business signal received - created={created}, business={instance.name}")
    
    if created:
        logger.info(f"Setting up new business: {instance.name} (ID: {instance.id})")
        try:
            # Run initial business setup
            setup = BusinessSetup(instance, instance.owner)
            setup.run_setup()
            logger.info(f"Setup completed for business: {instance.name}")
        except Exception as e:
            logger.error(f"Error setting up business {instance.name}: {str(e)}", exc_info=True)
