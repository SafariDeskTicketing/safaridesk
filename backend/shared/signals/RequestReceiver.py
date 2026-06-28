from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from tenant.models import Ticket, Requests
from shared.tasks import request_notification, notify_admins_of_request


@receiver(post_save, sender=Requests)
def handle_request_create(sender, instance, created, **kwargs):
    if created:
        # Ensure tasks run only after the transaction is committed
        transaction.on_commit(lambda: request_notification.delay(instance.id))
        transaction.on_commit(lambda: notify_admins_of_request.delay(instance.id))