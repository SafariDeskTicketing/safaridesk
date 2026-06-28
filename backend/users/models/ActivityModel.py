from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

from shared.models.BaseModel import BaseEntity
from users.models.UserModel import Users


class UserActivity(BaseEntity):
    user = models.ForeignKey(Users, on_delete=models.CASCADE)
    activity_type = models.CharField(max_length=50)

    # Store model reference dynamically
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')

    details = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "user_activities"
        verbose_name = "User Activity"
        verbose_name_plural = "User Activities"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.user} - {self.activity_type} - {self.content_type.model if self.content_type else 'Unknown'} - {self.object_id}"
