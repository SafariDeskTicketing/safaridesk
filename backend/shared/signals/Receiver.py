import json

from django.contrib.auth.models import AnonymousUser
from django.contrib.contenttypes.models import ContentType
from django.db.models.signals import post_save, pre_delete, post_delete
from django.dispatch import receiver, Signal
from django_currentuser.middleware import get_current_user


from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Q
from django.db import models

from shared.tasks import create_notification_task
from tenant.models.TicketModel import Ticket, TicketComment
from users.models import Users


login_successful = Signal()
login_failed = Signal()


@receiver(post_save)
def track_user_activity(sender, instance, created, **kwargs):
    if sender.__name__ == 'UserActivity':
        return  # Avoid recursion

    user = get_current_user()

    # Skip logging if user is anonymous or None
    if not user or isinstance(user, AnonymousUser):
        return

    activity_type = 'create' if created else 'update'

    # UserActivity.objects.create(
    #     user=user,
    #     activity_type=activity_type,
    #     content_type=ContentType.objects.get_for_model(sender),  # Save content type
    #     object_id=instance.id,
    #     details=str(instance)
    # )


@receiver(login_successful)
def create_login_trail(sender, user, ip_address, user_agent, status, **kwargs):
    pass
    # LoginTrail.objects.create(
    #     user=user,
    #     ip_address=ip_address,
    #     user_agent=user_agent,
    #     status=status,
    #     business=user.business
    # )


@receiver(login_failed)
def lock_account_and_log_activity(sender, user, ip_address, description, **kwargs):
    pass
    # activity_type, created = SuspiciousActivityType.objects.get_or_create(
    #     type_name="Failed Login Attempt"
    # )
    # SuspiciousActivity.objects.create(
    #     user=user,
    #     activity_type=activity_type,
    #     description=activity_type.description,
    #     ip_address=ip_address
    # )

# @receiver(post_save, sender=Tenant)
# def sendAuthCredentials(sender, instance, created, **kwargs):
#     if created:
#         sendCred.delay(instance.id)




