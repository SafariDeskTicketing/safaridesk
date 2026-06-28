from datetime import time, timedelta
from django.utils import timezone
from tenant.models import Department, Ticket, TicketCategories, Task
from tenant.models.SettingModel import EmailTemplateCategory, EmailTemplate, EmailConfig
from tenant.models.SlaXModel import SLA, Holidays, SLATarget, BusinessHoursx
from users.models import Users
from util.email.templates import EMAIL_TEMPLATES
from util.Holidays import HOLIDAYS
from util.Helper import Helper


class BusinessSetup:
    def __init__(self, business, user):
        self.business = business
        # Try to use system user, fall back to business owner
        self.user = Users.objects.filter(email="system@safaridesk.io").first()
        if not self.user:
            self.user = user  # Use the business owner if system user doesn't exist

    def run_setup(self):
        if not self.user:
            return  # Do not run setup if there is no owner
        
        self.seed_default_sla()
        self.seed_default_email_templates()
        self.seed_default_email_config()
        self.seed_default_holidays()
        self.seed_default_departments_and_categories()
        # self.create_welcome_ticket()


    def seed_default_sla(self):
        # Create Default SLA
        default_sla = SLA.objects.create(
            name="Default SLA",
            description="Default SLA for all tickets",
            operational_hours="business",
            evaluation_method="ticket_creation",
            is_active=True,
            created_by=self.user,
            business=self.business
        )

        # Create SLA Targets
        priorities = ["urgent", "high", "medium", "low"]
        target_times = {
            "urgent": {"first_response": 1, "first_unit": "hours", "resolution": 4, "resolution_unit": "hours"},
            "high": {"first_response": 2, "first_unit": "hours", "resolution": 8, "resolution_unit": "hours"},
            "medium": {"first_response": 4, "first_unit": "hours", "resolution": 24, "resolution_unit": "hours"},
            "low": {"first_response": 8, "first_unit": "hours", "resolution": 48, "resolution_unit": "hours"},
        }

        for priority in priorities:
            SLATarget.objects.create(
                sla=default_sla,
                priority=priority,
                first_response_time=target_times[priority]["first_response"],
                first_response_unit=target_times[priority]["first_unit"],
                next_response_time=None,  # No next response time for default
                next_response_unit="hours",
                resolution_time=target_times[priority]["resolution"],
                resolution_unit=target_times[priority]["resolution_unit"],
                operational_hours="business",
                reminder_enabled=False,
                escalation_enabled=False
            )

        # Create Business Hours (Monday to Friday, 8 AM - 5 PM)
        for day_of_week in range(5):
            BusinessHoursx.objects.create(
                name=f"{BusinessHoursx.DAYS_OF_WEEK[day_of_week][1]}",
                day_of_week=day_of_week,
                start_time=time(8, 0),
                end_time=time(17, 0),
                is_working_day=True,
                business=self.business
            )

    def seed_default_email_templates(self):
        category, created = EmailTemplateCategory.objects.get_or_create(
            name="Default Email Templates",
            business=self.business
        )

        for template_name, template_data in EMAIL_TEMPLATES.items():
            EmailTemplate.objects.update_or_create(
                name=template_name,
                business=self.business,
                defaults={
                    "description": template_data["description"],
                    "subject": template_data["subject"],
                    "body": template_data["body"],
                    "type": template_data["type"],
                    "category": category,
                }
            )

    def seed_default_email_config(self):
        category = EmailTemplateCategory.objects.get(name="Default Email Templates", business=self.business)
        EmailConfig.objects.create(
            default_template=category,
            email_fetching=True,
            business=self.business
        )

    def seed_default_holidays(self):
        for holiday in HOLIDAYS:
            Holidays.objects.get_or_create(
                name=holiday["name"],
                date=holiday["date"],
                business=self.business,
                defaults={'is_recurring': True}
            )

    def seed_default_departments_and_categories(self):
        """
        Add default departments and ticket categories for the business.
        Note: KB category seeding was removed — categories should not be auto-created on new accounts.
        """
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            # Default departments
            departments_data = [
                {'name': 'Human Resources (HR)', 'support_email': 'hr@example.com'},
                {'name': 'Finance/Accounting', 'support_email': 'finance@example.com'},
                {'name': 'IT/Technology', 'support_email': 'it@example.com'},
                {'name': 'Marketing/Sales', 'support_email': 'marketing@example.com'},
            ]

            # Add departments
            for dept_data in departments_data:
                dept, created = Department.objects.get_or_create(
                    name=dept_data['name'],
                    business=self.business,
                    defaults={'support_email': dept_data['support_email']}
                )
                if created:
                    logger.info(f"Created department: {dept.name} for business: {self.business.name}")

            # Default ticket categories
            ticket_categories_data = [
                {
                    'name': 'Administrations',
                    'description': 'Includes HR, finance, compliance, and internal management tasks.',
                },
                {
                    'name': 'Marketing & Sales',
                    'description': 'Covers promotion, branding, outreach, and customer engagement.',
                },
                {
                    'name': 'Operations',
                    'description': 'Covers day-to-day business processes and workflows.',
                },
                {
                    'name': 'Other / Miscellaneous',
                    'description': 'For anything that doesn\'t fit neatly into the above categories.',
                },
                {
                    'name': 'Technology',
                    'description': 'Encompasses IT support, software, networks, and cybersecurity.',
                },
            ]

            # Add ticket categories
            for cat_data in ticket_categories_data:
                cat = TicketCategories.objects.filter(
                    business=self.business,
                    name__iexact=cat_data['name'].strip()
                ).first()
                created = False
                if not cat:
                    cat = TicketCategories.objects.create(
                        name=cat_data['name'].strip(),
                        business=self.business,
                        description=cat_data['description'],
                        is_active=True,
                        created_by=self.user,
                    )
                    created = True
                if created:
                    logger.info(f"Created ticket category: {cat.name} for business: {self.business.name}")

        except Exception as e:
            logger.error(f"Error seeding default departments and categories for business {self.business.name}: {str(e)}", exc_info=True)

    def create_welcome_ticket(self):
        # Create default department if it doesn't exist
        department, _ = Department.objects.get_or_create(
            name="Support",
            business=self.business
        )

        # Create default category if it doesn't exist
        category = TicketCategories.objects.filter(
            name__iexact="Getting Started",
            business=self.business,
        ).first()
        if not category:
            category = TicketCategories.objects.create(
                name="Getting Started",
                business=self.business,
                description='Initial setup and guidance',
                created_by=self.user,
            )

        html_content = """
<h1>Welcome to SafariDesk!</h1>
<p>Here's a quick guide to get you started:</p>
<ul>
    <li><strong>Set up your departments:</strong> Go to Settings > Departments to organize your support teams.</li>
    <li><strong>Invite your team:</strong> Go to Settings > Agents to add your support staff.</li>
    <li><strong>Configure SLAs:</strong> Define your service level agreements in Settings > SLAs to set response and resolution time targets.</li>
    <li><strong>Customize your support portal:</strong> Go to Settings > Support Portal to customize the look and feel of your customer-facing portal.</li>
</ul>
<p>If you have any questions, feel free to reach out to our support team.</p>
<p>Happy ticketing!</p>
"""
        ticket_id = Helper().generate_incident_code()
        default_sla = SLA.objects.filter(business=self.business, name="Default SLA").first()
        ticket = Ticket.objects.create(
            ticket_id=ticket_id,
            title="Get started",
            description=html_content,
            category=category,
            department=department,
            creator_name=self.user.full_name(),
            creator_email=self.user.email,
            created_by=self.user,
            business=self.business,
            priority="low",
            status="open",
            source='internal',
            sla=default_sla
        )

        # Create individual tasks for the welcome ticket
        tasks_to_create = [
            {
                "title": "Set up your departments",
                "description": "Go to Settings > Departments to organize your support teams."
            },
            {
                "title": "Invite your team",
                "description": "Go to Settings > Agents to add your support staff."
            },
            {
                "title": "Configure SLAs",
                "description": "Define your service level agreements in Settings > SLAs to set response and resolution time targets."
            },
            {
                "title": "Customize your support portal",
                "description": "Go to Settings > Support Portal to customize the look and feel of your customer-facing portal."
            }
        ]

        due_date = timezone.now() + timedelta(days=7)

        for task_data in tasks_to_create:
            Task.objects.create(
                title=task_data["title"],
                description=task_data["description"],
                due_date=due_date,
                assigned_to=self.user,
                task_trackid=Helper().generate_task_code(),
                department=department,
                linked_ticket=ticket,
                business=self.business,
                created_by=self.user
            )
