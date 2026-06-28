from django.contrib.auth.models import AbstractUser
from django.db import models


class BaseUser(AbstractUser):
    phone_number = models.CharField(max_length=15, null=True, blank=True)
    first_login = models.BooleanField(default=True)
    gender = models.CharField(max_length=10, null=True, blank=True)

    class Meta:
        abstract = True
        app_label = 'shared'
