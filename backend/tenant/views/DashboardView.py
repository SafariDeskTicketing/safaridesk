from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from tenant.models import Department, Ticket, Task, BusinessHoursx, Holidays, TicketCategories, \
    EmailTemplate, SettingSMTP
from tenant.models.KnowledgeBase import KBArticle
from tenant.serializers.AgentSerializer import AgentSerializer
from tenant.services.dashboard import build_dashboard_payload
from users.models import Users


class DashView(viewsets.ModelViewSet):

    serializer_class = AgentSerializer
    queryset = Users.objects.all()
    permission_classes = [IsAuthenticated]


    def get_started(self, request):
        user = request.user
        business = user.business

        # Step 1: Initial Configurations
        has_business_hours = BusinessHoursx.objects.for_business().exists()
        has_holidays = Holidays.objects.for_business().exists()
        has_ticket_categories = TicketCategories.objects.for_business().exists()
        has_departments = Department.objects.for_business().exists()
        has_email_templates = EmailTemplate.objects.for_business().exists()
        has_email_smtp = SettingSMTP.objects.for_business().exists()

        # Simplified: Only require departments and ticket categories for initial config
        initial_config_complete = has_departments and has_ticket_categories

        # Step 2: Add Agents
        agents_count = Users.objects.filter(business=business, role__name='agent').count()
        has_agents = agents_count > 0  # Any agents including admin

        # Step 3 & 4: Tickets and Tasks
        all_tickets = Ticket.objects.for_business().filter(is_deleted=False).count()
        unassigned_tickets = Ticket.objects.for_business().filter(is_deleted=False, assigned_to__isnull=True).count()
        all_tasks = Task.objects.for_business().filter(is_deleted=False).count()
        unassigned_tasks = Task.objects.for_business().filter(is_deleted=False, assigned_to__isnull=True).count()

        # Step 5: Assign Tasks & Tickets
        has_assigned_items = (all_tickets > 0 and unassigned_tickets < all_tickets) or \
                             (all_tasks > 0 and unassigned_tasks < all_tasks)

        # Step 6: Set Up Knowledge Base (SLA step removed)
        articles_count = KBArticle.objects.filter(business=business).count()
        has_kb = articles_count > 0

        data = {
            "initial_config_complete": initial_config_complete,
            "has_agents": has_agents,
            "all_tickets": all_tickets,
            "all_tasks": all_tasks,
            "has_assigned_items": has_assigned_items,
            "has_reviewed_slas": False,  # SLA step removed, always false
            "has_kb": has_kb,
            "agents_count": agents_count,
            "departments_count": Department.objects.for_business().count(),
            "articles_count": articles_count,
            "unassigned_tickets_count": unassigned_tickets,
            "unassigned_tasks_count": unassigned_tasks,
            "onboarding_skipped": user.onboarding_skipped,
        }
        return Response(data)

    def update_onboarding_state(self, request):
        """PATCH /dashboard/get-started/ — set or reset onboarding_skipped for the current user."""
        skipped = request.data.get('skipped')
        if not isinstance(skipped, bool):
            return Response({"error": "skipped must be a boolean"}, status=400)
        request.user.onboarding_skipped = skipped
        request.user.save(update_fields=['onboarding_skipped'])
        return Response({"onboarding_skipped": skipped})

    def load(self, request):
        data = build_dashboard_payload(request.user, request.GET)
        return Response(data)
