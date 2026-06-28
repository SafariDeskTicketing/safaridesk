from django.db import models


class LicenseStatus(models.Model):
    """
    Singleton runtime advisory license state for this SafariDesk installation.
    """

    singleton_key = models.CharField(max_length=32, unique=True, default="default")
    instance_id = models.CharField(max_length=100, blank=True, default="")
    license_valid = models.BooleanField(default=False)
    features = models.JSONField(default=list, blank=True)
    customer_name = models.CharField(max_length=255, null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    checked_at = models.DateTimeField(null=True, blank=True)
    unlicensed_since = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True, default="")
    license_response = models.JSONField(default=dict, blank=True)
    signature = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "license_status"
        verbose_name = "License Status"
        verbose_name_plural = "License Status"

    def __str__(self):
        return f"LicenseStatus(valid={self.license_valid}, instance_id={self.instance_id})"
