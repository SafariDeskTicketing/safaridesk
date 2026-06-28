from django.core.management.base import BaseCommand
from django.utils.text import slugify

from tenant.models.DepartmentModel import Department
from tenant.models.KnowledgeBase import KBCategory


class Command(BaseCommand):
    help = "Add default departments and knowledge base categories (no default ticket categories)."

    def handle(self, *args, **options):
        # Default departments
        departments_data = [
            {"name": "Human Resources (HR)", "support_email": "hr@example.com"},
            {"name": "Finance/Accounting", "support_email": "finance@example.com"},
            {"name": "IT/Technology", "support_email": "it@example.com"},
            {"name": "Marketing/Sales", "support_email": "marketing@example.com"},
        ]

        for dept_data in departments_data:
            dept, created = Department.objects.get_or_create(
                name=dept_data["name"],
                defaults={"support_email": dept_data["support_email"]},
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'✔ Created department: {dept.name}'))
            else:
                self.stdout.write(f"~ Department already exists: {dept.name}")

        # Default KB categories removed - users should create custom categories
        # KB categories can be created through the CategoryManager UI
        self.stdout.write(self.style.WARNING("⚠ No default KB categories created - users must create custom categories"))

        self.stdout.write(self.style.SUCCESS("\n✔ Default departments added (KB categories skipped)."))
