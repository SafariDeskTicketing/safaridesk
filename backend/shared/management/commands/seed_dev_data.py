from __future__ import annotations

import os
from typing import Any

from django.conf import settings
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from tenant.models import Contact, Department, Ticket, TicketCategories
from tenant.services.tickets.naming import generate_ticket_id, render_ticket_title
from users.models import Business, Users

DEFAULT_BUSINESS_NAME = "Dev Test Co"
DEFAULT_DOMAIN = "devtest.local"
DEFAULT_PASSWORD = "DevPass123!"


class Command(BaseCommand):
    help = (
        "Seed a throwaway business with users, departments, contacts, and sample tickets "
        "for local/manual testing. Refuses to run unless DEBUG=True or ALLOW_DEV_SEED=1 is set."
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument("--business-name", default=DEFAULT_BUSINESS_NAME)
        parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Password for all seeded users.")
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete any existing seeded business (and its users) with this name before recreating it.",
        )
        parser.add_argument(
            "--with-slack",
            action="store_true",
            help="Also create a fake SlackIntegration row (team_id=DEVTEST) for webhook testing.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        if not (settings.DEBUG or os.environ.get("ALLOW_DEV_SEED") == "1"):
            raise CommandError(
                "Refusing to run: this command creates fake accounts and sample data and must "
                "never touch a real environment. Set DEBUG=True or ALLOW_DEV_SEED=1 to allow it."
            )

        business_name = options["business_name"]
        password = options["password"]

        if options["reset"]:
            self._reset(business_name)

        with transaction.atomic():
            business = self._create_business(business_name)
            admin_user = self._create_user(
                business, "admin", "Ada", "Admin", password, is_staff=True, is_superuser=True
            )
            business.owner = admin_user
            business.save(update_fields=["owner"])

            agent_one = self._create_user(business, "agent1", "Alex", "Agent", password)
            agent_two = self._create_user(business, "agent2", "Blair", "Agent", password)

            departments = self._create_departments(business, admin_user)
            categories = self._create_categories(business, departments, admin_user)
            contacts = self._create_contacts(business, admin_user)
            tickets = self._create_tickets(
                business, departments, categories, contacts, [agent_one, agent_two], admin_user
            )

            slack_integration = None
            if options["with_slack"]:
                slack_integration = self._create_slack_integration(business, admin_user)

        self._print_summary(business, password, admin_user, [agent_one, agent_two], tickets, slack_integration)

    # -- creation helpers -------------------------------------------------

    def _reset(self, business_name: str) -> None:
        business = Business.objects.filter(name=business_name).first()
        if not business:
            return
        Users.objects.filter(business=business).delete()
        business.delete()  # cascades to Department/Contact/Ticket/SlackIntegration via BaseEntity.business
        self.stdout.write(self.style.WARNING(f"Deleted existing '{business_name}' and its seeded data."))

    def _create_business(self, name: str) -> Business:
        business, _ = Business.objects.get_or_create(
            name=name,
            defaults={
                "domain": DEFAULT_DOMAIN,
                "domain_url": f"https://{DEFAULT_DOMAIN}",
                "is_active": True,
            },
        )
        return business

    def _create_user(
        self,
        business: Business,
        local_part: str,
        first_name: str,
        last_name: str,
        password: str,
        *,
        is_staff: bool = False,
        is_superuser: bool = False,
    ) -> Users:
        email = f"{local_part}@{DEFAULT_DOMAIN}"
        role, _ = Group.objects.get_or_create(name="admin" if is_superuser else "agent")

        user, created = Users.objects.get_or_create(
            email=email,
            defaults={
                "username": email,
                "first_name": first_name,
                "last_name": last_name,
                "role": role,
                "business": business,
                "category": "BUSINESS",
                "is_staff": is_staff,
                "is_superuser": is_superuser,
                "is_active": True,
                "status": "A",
            },
        )
        user.set_password(password)
        user.business = business
        user.is_active = True
        user.save()
        user.groups.add(role)
        return user

    def _create_departments(self, business: Business, admin_user: Users) -> list[Department]:
        names = ["IT Support", "Billing", "General Inquiries"]
        departments = []
        for name in names:
            department, _ = Department.objects.get_or_create(
                business=business,
                name=name,
                defaults={"support_email": f"{name.lower().replace(' ', '-')}@{DEFAULT_DOMAIN}", "created_by": admin_user},
            )
            departments.append(department)
        return departments

    def _create_categories(
        self, business: Business, departments: list[Department], admin_user: Users
    ) -> list[TicketCategories]:
        categories = []
        for department in departments:
            category, _ = TicketCategories.objects.get_or_create(
                business=business,
                name=f"{department.name} - General",
                defaults={"description": f"General requests for {department.name}", "department": department, "created_by": admin_user},
            )
            categories.append(category)
        return categories

    def _create_contacts(self, business: Business, admin_user: Users) -> list[Contact]:
        sample_contacts = [
            ("Chidi Okafor", "chidi.okafor@example.com", "+254700000001"),
            ("Maria Santos", "maria.santos@example.com", "+254700000002"),
            ("Liu Wei", "liu.wei@example.com", "+254700000003"),
        ]
        contacts = []
        for name, email, phone in sample_contacts:
            contact, _ = Contact.objects.get_or_create(
                business=business,
                email=email,
                defaults={"name": name, "phone": phone, "owner": admin_user},
            )
            contacts.append(contact)
        return contacts

    def _create_tickets(
        self,
        business: Business,
        departments: list[Department],
        categories: list[TicketCategories],
        contacts: list[Contact],
        agents: list[Users],
        admin_user: Users,
    ) -> list[Ticket]:
        samples = [
            ("web", "open", "high", "Cannot log into my account", "User reports a 500 error on login."),
            ("email", "in_progress", "medium", "Invoice amount looks wrong", "Customer disputes a charge on invoice #4821."),
            ("api", "pending", "low", "Feature request: dark mode", "Would like a dark theme option in settings."),
            ("chat", "open", "critical", "Production outage for our team", "All users seeing 503 errors since 10am."),
            ("whatsapp", "resolved", "medium", "Password reset not arriving", "Reset email never received, resolved via manual reset."),
            ("slack", "closed", "low", "Question about billing cycle", "Answered via Slack thread, closing ticket."),
            ("customer_portal", "open", "medium", "Need to add a new seat", "Requesting to add 3 more user seats to plan."),
            ("internal", "in_progress", "high", "Migrate legacy data for Dev Test Co", "Internal migration task tracked as a ticket."),
        ]

        tickets = []
        for index, (source, status, priority, title_hint, description) in enumerate(samples):
            department = departments[index % len(departments)]
            category = categories[index % len(categories)]
            contact = contacts[index % len(contacts)]
            agent = agents[index % len(agents)]

            ticket_id_code = generate_ticket_id(business=business)
            title = render_ticket_title(summary=title_hint, ticket_id=ticket_id_code, source=source, business=business)

            ticket = Ticket.objects.create(
                business=business,
                ticket_id=ticket_id_code,
                title=title,
                description=description,
                source=source,
                status=status,
                priority=priority,
                department=department,
                category=category,
                contact=contact,
                creator_name=contact.name,
                creator_email=contact.email,
                creator_phone=contact.phone,
                assigned_to=agent,
                created_by=admin_user,
                customer_tier="standard",
            )
            tickets.append(ticket)
        return tickets

    def _create_slack_integration(self, business: Business, admin_user: Users):
        from shared.models.SlackIntegration import SlackIntegration

        integration, _ = SlackIntegration.objects.get_or_create(
            business=business,
            team_id="DEVTEST",
            defaults={
                "team_name": "Dev Test Workspace",
                "workspace_url": "https://devtest.slack.com",
                "bot_user_id": "UDEVTESTBOT",
                "app_id": "ADEVTEST",
                "scope": "channels:read,chat:write",
                "is_active": True,
                "created_by": admin_user,
            },
        )
        integration.access_token = "xoxb-dev-fake-token-not-real"
        integration.save(update_fields=["access_token_encrypted"])
        return integration

    # -- output -------------------------------------------------------------

    def _print_summary(self, business, password, admin_user, agents, tickets, slack_integration) -> None:
        self.stdout.write(self.style.SUCCESS("\n=== Dev seed complete ==="))
        self.stdout.write(f"Business: {business.name} (id={business.id})")
        self.stdout.write("\nLogin credentials (all users share this password):")
        self.stdout.write(f"  password: {password}")
        self.stdout.write(f"  admin:    {admin_user.email}")
        for agent in agents:
            self.stdout.write(f"  agent:    {agent.email}")
        self.stdout.write(f"\nCreated {len(tickets)} sample tickets:")
        for ticket in tickets:
            self.stdout.write(f"  {ticket.ticket_id}  [{ticket.source:16s}] {ticket.status:12s} {ticket.title}")
        if slack_integration:
            self.stdout.write(f"\nSlack integration: team_id={slack_integration.team_id} (fake token, API calls will fail)")
        self.stdout.write(self.style.SUCCESS("\nRe-run with --reset to wipe and recreate this data.\n"))
