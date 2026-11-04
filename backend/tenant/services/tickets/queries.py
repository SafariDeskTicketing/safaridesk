from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict

from django.db.models import Count, Q
from django.utils import timezone

from tenant.models import Task, Ticket
from tenant.models.TicketModel import TicketReopen
from tenant.services.labels import apply_label_filter, parse_label_ids
from tenant.services.tickets.shared import parse_date_input
from users.models import Users


def _apply_ticket_ordering(queryset, sort_by: str | None, sort_direction: str | None, *, preserve_existing: bool = False):
    direction = 'desc' if str(sort_direction).lower() == 'desc' else 'asc'
    prefix = '-' if direction == 'desc' else ''
    tie_breaker = '-id' if direction == 'desc' else 'id'

    if not sort_by:
        if preserve_existing:
            return queryset
        return queryset.order_by('-id')

    if sort_by == 'tasks':
        queryset = queryset.annotate(
            sort_linked_tasks_count=Count(
                'related_tasks',
                filter=Q(related_tasks__is_archived=False, related_tasks__is_deleted=False)
                & ~Q(related_tasks__task_status='draft'),
                distinct=True,
            )
        )
        return queryset.order_by(f'{prefix}sort_linked_tasks_count', tie_breaker)

    if sort_by == 'author':
        return queryset.order_by(f'{prefix}creator_name', f'{prefix}creator_email', tie_breaker)

    if sort_by == 'assignee':
        return queryset.order_by(
            f'{prefix}assigned_to__first_name',
            f'{prefix}assigned_to__last_name',
            f'{prefix}assigned_to__email',
            tie_breaker,
        )

    ordering_map = {
        'ticket_id': ('ticket_id', tie_breaker),
        'title': ('title', tie_breaker),
        'status': ('status', tie_breaker),
        'priority': ('priority', tie_breaker),
        'department': ('department__name', tie_breaker),
        'created_at': ('created_at', tie_breaker),
    }

    ordering = ordering_map.get(sort_by)
    if not ordering:
        if preserve_existing:
            return queryset
        return queryset.order_by('-id')

    return queryset.order_by(*(f'{prefix}{field}' if field != tie_breaker else field for field in ordering))


def my_tickets_queryset(*, user: Users, query_params):
    """Build the queryset for 'my tickets' (by departments or as watcher)."""
    user_departments = user.department.all()

    queryset = Ticket.objects.filter(
        Q(department__in=user_departments, business=user.business) |
        Q(watchers__watcher=user, business=user.business)
    ).prefetch_related('labels').filter(is_merged=False).order_by('-id').distinct()

    # Apply search filter
    search_query = query_params.get('search')
    if search_query:
        queryset = queryset.filter(
            Q(ticket_id__icontains=search_query) |
            Q(title__icontains=search_query) |
            Q(description__icontains=search_query) |
            Q(creator_name__icontains=search_query) |
            Q(creator_email__icontains=search_query)
        )

    # Apply field filters (same behavior as list endpoint)
    status_filter = query_params.get('status')
    if status_filter and status_filter != 'all':
        if status_filter in ['closed', 'resolved']:
            queryset = queryset.filter(status__in=['closed', 'resolved'])
        else:
            queryset = queryset.filter(status=status_filter)

    priority_filter = query_params.get('priority')
    if priority_filter and priority_filter != 'all':
        queryset = queryset.filter(priority=priority_filter)

    assigned_to_filter = query_params.get('assigned_to')
    if assigned_to_filter:
        if assigned_to_filter == 'unassigned':
            queryset = queryset.filter(assigned_to__isnull=True)
        elif assigned_to_filter != 'all':
            queryset = queryset.filter(assigned_to_id=assigned_to_filter)

    department_filter = query_params.get('department')
    if department_filter and department_filter != 'all':
        queryset = queryset.filter(department_id=department_filter)

    category_filter = query_params.get('category')
    if category_filter and category_filter != 'all':
        queryset = queryset.filter(category_id=category_filter)

    label_ids = parse_label_ids(query_params.get('label_ids'))
    queryset = apply_label_filter(queryset, label_ids)

    date_from = query_params.get('date_from')
    if date_from:
        from_date = parse_date_input(date_from)
        if from_date:
            queryset = queryset.filter(created_at__date__gte=from_date)

    date_to = query_params.get('date_to')
    if date_to:
        to_date = parse_date_input(date_to)
        if to_date:
            queryset = queryset.filter(created_at__date__lte=to_date)

    # NOTE (pre-existing bug, preserved verbatim): the original
    # TicketView.my_tickets applied this exact same block of search/status/
    # priority/assigned_to/department/category/date filters a second time
    # here (without label filtering). Re-applying identical `.filter(...)`
    # calls is a no-op on the result set, so behavior is unchanged, but it's
    # dead/duplicated work left over from the original code.
    search_query = query_params.get('search')
    if search_query:
        queryset = queryset.filter(
            Q(ticket_id__icontains=search_query) |
            Q(title__icontains=search_query) |
            Q(description__icontains=search_query) |
            Q(creator_name__icontains=search_query) |
            Q(creator_email__icontains=search_query)
        )

    status_filter = query_params.get('status')
    if status_filter and status_filter != 'all':
        if status_filter in ['closed', 'resolved']:
            queryset = queryset.filter(status__in=['closed', 'resolved'])
        else:
            queryset = queryset.filter(status=status_filter)

    priority_filter = query_params.get('priority')
    if priority_filter and priority_filter != 'all':
        queryset = queryset.filter(priority=priority_filter)

    assigned_to_filter = query_params.get('assigned_to')
    if assigned_to_filter:
        if assigned_to_filter == 'unassigned':
            queryset = queryset.filter(assigned_to__isnull=True)
        elif assigned_to_filter != 'all':
            queryset = queryset.filter(assigned_to_id=assigned_to_filter)

    department_filter = query_params.get('department')
    if department_filter and department_filter != 'all':
        queryset = queryset.filter(department_id=department_filter)

    category_filter = query_params.get('category')
    if category_filter and category_filter != 'all':
        queryset = queryset.filter(category_id=category_filter)

    date_from = query_params.get('date_from')
    if date_from:
        from_date = parse_date_input(date_from)
        if from_date:
            queryset = queryset.filter(created_at__date__gte=from_date)

    date_to = query_params.get('date_to')
    if date_to:
        to_date = parse_date_input(date_to)
        if to_date:
            queryset = queryset.filter(created_at__date__lte=to_date)

    return queryset


def my_customer_tickets_queryset(*, user: Users, query_params):
    """Build the queryset for the authenticated customer's tickets."""
    queryset = Ticket.objects.filter(
        Q(creator_email=getattr(user, 'email', None)) |
        Q(contact__email=getattr(user, 'email', None)),
        business=user.business
    ).filter(is_merged=False).order_by('-id')

    search = query_params.get('search')
    if search:
        queryset = queryset.filter(
            Q(ticket_id__icontains=search) |
            Q(title__icontains=search) |
            Q(description__icontains=search)
        )

    return queryset


def ticket_counts(*, user: Users, query_params) -> Dict[str, Any]:
    """Return counts of tickets for the sidebar views, applying all filters from query params."""
    base_queryset = Ticket.objects.for_business()

    # Apply department-based visibility restrictions for non-admin agents
    if user.role and user.role.name == 'agent':
        agent_departments = user.department.all()
        base_queryset = base_queryset.filter(department__in=agent_departments)

    # Apply filters from query params
    status_filter = query_params.get('status')
    priority_filter = query_params.get('priority')
    assigned_to_filter = query_params.get('assigned_to')
    department_filter = query_params.get('department')
    category_filter = query_params.get('category')
    label_ids = parse_label_ids(query_params.get('label_ids'))
    date_from = query_params.get('date_from')
    date_to = query_params.get('date_to')

    def apply_filters(qs):
        if status_filter and status_filter != 'all':
            if status_filter in ['closed', 'resolved']:
                qs = qs.filter(status__in=['closed', 'resolved'])
            else:
                qs = qs.filter(status=status_filter)
        if priority_filter and priority_filter != 'all':
            qs = qs.filter(priority=priority_filter)
        if assigned_to_filter:
            if assigned_to_filter == 'unassigned':
                qs = qs.filter(assigned_to__isnull=True)
            elif assigned_to_filter != 'all':
                qs = qs.filter(assigned_to_id=assigned_to_filter)
        if department_filter and department_filter != 'all':
            qs = qs.filter(department_id=department_filter)
        if category_filter and category_filter != 'all':
            qs = qs.filter(category_id=category_filter)
        qs = apply_label_filter(qs, label_ids)
        if date_from:
            from_date = parse_date_input(date_from)
            if from_date:
                qs = qs.filter(created_at__date__gte=from_date)
        if date_to:
            to_date = parse_date_input(date_to)
            if to_date:
                qs = qs.filter(created_at__date__lte=to_date)
        return qs

    # Exclude archived, deleted, and merged from active counts to prevent double counting
    active_queryset = base_queryset.filter(is_archived=False, is_deleted=False, is_merged=False)
    my_active_queryset = active_queryset.filter(assigned_to=user)
    archived_queryset = base_queryset.filter(is_archived=True, is_deleted=False)
    trash_queryset = base_queryset.filter(is_deleted=True)

    # Apply filters to all relevant querysets
    filtered_active = apply_filters(active_queryset)
    filtered_my_active = apply_filters(my_active_queryset)
    filtered_archived = apply_filters(archived_queryset)
    filtered_trash = apply_filters(trash_queryset)

    # This is inefficient for SLA breached. A better approach is needed for production.
    sla_breached_count = sum(1 for ticket in filtered_active if ticket.is_sla_breached)

    # Count tickets that have been reopened (tickets with at least one reopen record)
    reopened_ticket_ids = TicketReopen.objects.filter(
        ticket__business=user.business
    ).values_list('ticket_id', flat=True).distinct()
    reopened_count = filtered_active.filter(id__in=reopened_ticket_ids).count()

    counts = {
        'all_tickets': filtered_active.count(),
        'all_unassigned': filtered_active.filter(assigned_to__isnull=True).count(),
        'all_unresolved': filtered_active.exclude(status__in=['closed', 'resolved']).count(),
        'all_resolved': filtered_active.filter(status__in=['closed', 'resolved']).count(),
        'slow_queues': filtered_active.filter(status__in=['closed', 'resolved'], resolved_at__isnull=False).count(),
        'reopened': reopened_count,
        'merged': base_queryset.filter(is_merged=True).count(),
        'my_due_today': filtered_my_active.filter(
            due_date__gte=timezone.now().replace(hour=0, minute=0, second=0, microsecond=0),
            due_date__lt=(timezone.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)),
        ).exclude(status__in=['closed', 'resolved']).count(),
        'my_overdue': filtered_my_active.filter(due_date__lt=timezone.now()).exclude(status__in=['closed', 'resolved']).count(),
        'my_unresolved': filtered_my_active.exclude(status__in=['closed', 'resolved']).count(),
        'my_resolved': filtered_my_active.filter(status__in=['closed', 'resolved']).count(),
        'requested_by_me': filtered_active.filter(created_by=user).count(),
        'sla_breached': sla_breached_count,
        'archived': filtered_archived.count(),
        'trash': filtered_trash.count(),
        'suspended_emails': 0,
        'spam': 0,
    }
    return counts


def profile_ticket_counts(*, user: Users) -> Dict[str, Any]:
    """Return counts of tickets and tasks assigned to or completed by the authenticated user"""

    # Get tickets assigned to the user
    assigned_tickets = Ticket.objects.filter(
        assigned_to=user,
        business=user.business
    ).exclude(status__in=['closed', 'resolved']).count()

    # Get resolved/closed tickets
    resolved_tickets = Ticket.objects.filter(
        Q(created_by=user) | Q(assigned_to=user),
        business=user.business,
        status__in=['closed', 'resolved']
    ).count()

    # Get tasks assigned to the user
    assigned_tasks = Task.objects.filter(
        assigned_to=user,
        business=user.business
    ).exclude(task_status='completed').count()

    # Get completed tasks
    completed_tasks = Task.objects.filter(
        assigned_to=user,
        business=user.business,
        task_status='completed'
    ).count()

    return {
        "assigned_tickets": assigned_tickets,
        "resolved_tickets": resolved_tickets,
        "assigned_tasks": assigned_tasks,
        "completed_tasks": completed_tasks,
    }


def my_customer_dashboard(*, user: Users) -> Dict[str, Any]:
    """List all tickets, optionally without pagination"""
    queryset = Ticket.objects.filter(
        Q(creator_email=getattr(user, 'email', None)) |
        Q(contact__email=getattr(user, 'email', None)),
        business=user.business,
        is_merged=False,
    ).order_by('-id')

    return {
        "all": queryset.count(),
        "pending": queryset.exclude(Q(status__in=["closed", "resolved"]) | Q(status="hold")).count(),
        "resolved": queryset.filter(status__in=["closed", "resolved"]).count(),
    }
