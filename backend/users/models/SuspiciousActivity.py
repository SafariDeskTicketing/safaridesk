from django.db import models

class SuspiciousActivityType(models.Model):
    """
    Model to define different types of suspicious activities.
    """
    id = models.BigAutoField(primary_key=True)
    type_name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'suspicious_activity_types'
        verbose_name = 'Suspicious Activity Type'
        verbose_name_plural = 'Suspicious Activity Types'

    def __str__(self):
        return self.type_name


class SuspiciousActivity(models.Model):
    """
    Model to log suspicious activities.
    """
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey("users.Users", on_delete=models.CASCADE, related_name='suspicious_activities', blank=True, null=True)
    activity_type = models.ForeignKey(SuspiciousActivityType, on_delete=models.CASCADE, related_name='activities')
    description = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = 'suspicious_activities'
        verbose_name = 'Suspicious Activity'
        verbose_name_plural = 'Suspicious Activities'
