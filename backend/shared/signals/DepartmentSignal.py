"""
Signal handlers for Department-related events
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction


# Default ticket categories to create for each department
DEFAULT_CATEGORIES = [
    {"name": "General Inquiry", "description": "General questions and inquiries"},
    {"name": "Technical Support", "description": "Technical issues and troubleshooting"},
    {"name": "Billing/Payment", "description": "Billing, payment, and account questions"},
    {"name": "Feature Request", "description": "Feature suggestions and improvements"},
    {"name": "Bug Report", "description": "Report software bugs and issues"},
]


@receiver(post_save, sender='tenant.Department')
def create_default_categories_for_department(sender, instance, created, **kwargs):
    """
    Automatically create 5 default ticket categories when a new department is created.
    Categories are linked to the department and inherit the business from the department.
    """
    if created:
        # Use transaction.on_commit to ensure the department is fully saved
        transaction.on_commit(lambda: _create_categories(instance))


def _create_categories(department):
    """
    Helper function to create default categories.
    Categories are seeded only when the business has no ticket categories yet,
    preventing duplicate seeding as new departments are added.
    """
    from tenant.models.TicketModel import TicketCategories

    if TicketCategories.objects.filter(business=department.business).exists():
        return

    for cat_data in DEFAULT_CATEGORIES:
        TicketCategories.objects.get_or_create(
            name=cat_data["name"].strip(),
            business=department.business,
            defaults={
                "description": cat_data["description"],
                "department": None,
                "created_by": department.created_by,
                "is_active": True,
            }
        )
