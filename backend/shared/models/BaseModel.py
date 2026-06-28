from django.db import models
from django.conf import settings
from django.apps import apps
from django_currentuser.middleware import get_current_user

from util.Constants import STATUS_CHOICES


class FilterManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset()

    def for_user(self, user=None, filter_by_client=True):
        user = user or get_current_user()
        queryset = self.get_queryset()
        if filter_by_client and user and user.is_authenticated and hasattr(user, 'business'):
            # queryset = queryset.filter(business=user.business, created_by=user).distinct()
            queryset = queryset.filter(business=user.business).distinct()

        return queryset
    
    def for_business(self, user=None, filter_by_client=True):
        user = user or get_current_user()
        queryset = self.get_queryset()
        if filter_by_client and user and user.is_authenticated and hasattr(user, 'business'):
            queryset = queryset.filter(business=user.business).distinct()

        return queryset
    
    def for_me(self, user=None, filter_by_client=True):
        user = user or get_current_user()
        queryset = self.get_queryset()
        if filter_by_client and user and user.is_authenticated and hasattr(user, 'business'):
            queryset = queryset.filter(business=user.business, created_by=user).distinct()

        return queryset




class BaseEntity(models.Model):

    id = models.BigAutoField(primary_key=True)
    status = models.CharField(max_length=1, choices=STATUS_CHOICES, default='A')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='created_%(class)s_objects',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    date_updated = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='updated_%(class)s_objects',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    business = models.ForeignKey(
        "users.Business",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )

    objects = FilterManager()

    class Meta:
        abstract = True

    @staticmethod
    def _is_auth_user_instance(user):
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        try:
            app_label, model_name = settings.AUTH_USER_MODEL.split('.')
            auth_user_model = apps.get_model(app_label, model_name)
            return isinstance(user, auth_user_model)
        except Exception:
            # Safe fallback: avoid assigning incompatible user instances.
            return False

    def save(self, *args, **kwargs):
        current_user = get_current_user()

        if current_user and getattr(current_user, 'is_authenticated', False):
            # Preserve tenant/business context for both staff and customer sessions.
            if (
                hasattr(current_user, 'business')
                and current_user.business
                and not getattr(self, 'business_id', None)
            ):
                self.business = current_user.business

        if self._is_auth_user_instance(current_user):
            if not self.pk:
                self.created_by = current_user

            self.updated_by = current_user

        super(BaseEntity, self).save(*args, **kwargs)
