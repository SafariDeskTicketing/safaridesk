from django.db import models
from django.utils.text import slugify

from shared.models.BaseModel import BaseEntity



class Department(BaseEntity):
    name = models.CharField(max_length=100)
    support_email = models.CharField(max_length=255, null=True, blank=True)
    slag = models.CharField(max_length=100, blank=True, editable=False)

    class Meta:
        verbose_name = "Department"
        verbose_name_plural = "departments"
        db_table = "departments"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        # Generate slug from name
        if self.name:
            self.slag = slugify(self.name)
        super().save(*args, **kwargs)

    def get_members(self):
        """
        Returns a queryset of all users who are members of this department.
        """
        from users.models import Users
        return Users.objects.filter(department=self)


class DepartmentEmails(BaseEntity):
    email = models.EmailField(max_length=200, unique=True)
    department = models.ForeignKey("tenant.Department", on_delete=models.CASCADE, related_name="emails")

    # IMAP settings for reading emails
    imap_host = models.CharField(max_length=255, null=True, blank=True, verbose_name="IMAP Host")
    imap_port = models.PositiveIntegerField(verbose_name="IMAP Port", null=True, blank=True, default=993)
    imap_username = models.CharField(max_length=255, null=True, blank=True, verbose_name="IMAP Username")
    imap_password = models.CharField(max_length=255, null=True, blank=True, verbose_name="IMAP Password")
    imap_use_ssl = models.BooleanField(default=True, null=True, blank=True, verbose_name="IMAP Use SSL")

    # SMTP settings for sending emails (keeping existing fields for backward compatibility)
    host = models.CharField(max_length=255, null=True, blank=True, verbose_name="SMTP Host")
    port = models.PositiveIntegerField(verbose_name="SMTP Port", null=True, blank=True,)
    username = models.CharField(max_length=255, null=True, blank=True, verbose_name="SMTP Username")
    password = models.CharField(max_length=255, null=True, blank=True, verbose_name="SMTP Password")
    use_tls = models.BooleanField(default=True, null=True, blank=True, verbose_name="Use TLS")
    use_ssl = models.BooleanField(default=False, null=True, blank=True, verbose_name="Use SSL")

    is_active = models.BooleanField(default=True, verbose_name="Is Active")

    class Meta:
        verbose_name = "Department Emails"
        verbose_name_plural = "department_emails"
        db_table = "department_emails"
        ordering = ["-id"]
