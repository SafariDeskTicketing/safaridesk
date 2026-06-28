from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime, timedelta
from io import StringIO
from typing import Iterable

from django.db.models import Q, QuerySet
from django.http import HttpResponse
from django.utils import timezone

from tenant.models import Department, Task, Ticket, TicketCategories
from tenant.services.exports import ExportDataset, build_export_file, export_file_response
from users.models import Business, Users


TICKET_CLOSED_STATUSES = {"resolved", "closed"}
TASK_OPEN_STATUSES = {"open", "in_progress", "hold", "draft", "breached"}
TASK_COMPLETED_STATUS = "completed"
DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100
PDF_ROW_LIMIT = 200


@dataclass(frozen=True)
class ReportWindow:
    period: str
    start: datetime
    end: datetime
    label: str


def build_ticket_report(user: Users, params) -> dict:
    window = _resolve_window(params)
    queryset = _ticket_queryset(user, params, window)
    rows = [_serialize_ticket_row(ticket) for ticket in queryset]
    summary = _ticket_summary(queryset)

    columns = _ticket_columns()

    page, page_size, paginated_rows, total_count, total_pages = _paginate_rows(rows, params)
    return {
        "report_type": "tickets",
        "title": "Tickets Report",
        "window": _window_payload(window),
        "summary": summary,
        "columns": columns,
        "rows": paginated_rows,
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "filter_options": _ticket_filter_options(user),
        "applied_filters": _common_applied_filters(params, window) | _ticket_applied_filters(params),
    }


def build_task_report(user: Users, params) -> dict:
    window = _resolve_window(params)
    queryset = _task_queryset(user, params, window)
    rows = [_serialize_task_row(task) for task in queryset]
    summary = _task_summary(queryset)

    columns = _task_columns()

    page, page_size, paginated_rows, total_count, total_pages = _paginate_rows(rows, params)
    return {
        "report_type": "tasks",
        "title": "Tasks Report",
        "window": _window_payload(window),
        "summary": summary,
        "columns": columns,
        "rows": paginated_rows,
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "filter_options": _task_filter_options(user),
        "applied_filters": _common_applied_filters(params, window) | _task_applied_filters(params),
    }


def build_agent_report(user: Users | None, params, *, business: Business | None = None) -> dict:
    window = _resolve_window(params)
    users_queryset = _agent_queryset(user, params, business=business)
    ticket_queryset = _ticket_queryset(user, params, window, business=business)
    task_queryset = _task_queryset(user, params, window, business=business)

    tickets_by_agent: dict[int, list[Ticket]] = {}
    for ticket in ticket_queryset:
        if ticket.assigned_to_id:
            tickets_by_agent.setdefault(ticket.assigned_to_id, []).append(ticket)

    tasks_by_agent: dict[int, list[Task]] = {}
    for task in task_queryset:
        if task.assigned_to_id:
            tasks_by_agent.setdefault(task.assigned_to_id, []).append(task)

    rows = []
    for agent in users_queryset:
        assigned_tickets = tickets_by_agent.get(agent.id, [])
        assigned_tasks = tasks_by_agent.get(agent.id, [])
        open_tickets = [ticket for ticket in assigned_tickets if ticket.status not in TICKET_CLOSED_STATUSES]
        completed_tasks = [task for task in assigned_tasks if task.task_status == TASK_COMPLETED_STATUS]
        first_response_durations = [
            ticket.first_response_at - ticket.created_at
            for ticket in assigned_tickets
            if ticket.first_response_at and ticket.created_at
        ]
        resolution_durations = [
            ticket.resolved_at - ticket.created_at
            for ticket in assigned_tickets
            if ticket.resolved_at and ticket.created_at
        ]
        csat_scores = [ticket.csat_score for ticket in assigned_tickets if ticket.csat_score is not None]
        sla_breach_count = sum(1 for ticket in assigned_tickets if _ticket_has_sla_breach(ticket))
        backlog_count = len(open_tickets)
        workload_total = backlog_count + sum(
            1 for task in assigned_tasks if task.task_status in TASK_OPEN_STATUSES
        )

        row = {
            "id": agent.id,
            "agent_name": _user_display_name(agent),
            "email": agent.email or "—",
            "departments": ", ".join(
                department.name for department in agent.department.all().order_by("name")
            ) or "—",
            "active_status": "Active" if agent.status == "A" else "Inactive",
            "open_tickets": backlog_count,
            "resolved_tickets": sum(1 for ticket in assigned_tickets if ticket.status in TICKET_CLOSED_STATUSES),
            "assigned_tasks": len(assigned_tasks),
            "completed_tasks": len(completed_tasks),
            "avg_first_response": _format_duration(_average_duration(first_response_durations)),
            "avg_resolution": _format_duration(_average_duration(resolution_durations)),
            "sla_breach_count": sla_breach_count,
            "avg_csat": _format_decimal(_average_number(csat_scores)),
            "backlog_count": backlog_count,
            "workload_total": workload_total,
        }
        if _agent_matches_workload_band(row["workload_total"], params.get("workload_band")):
            rows.append(row)

    rows.sort(key=lambda row: (-row["workload_total"], row["agent_name"].lower()))

    summary = [
        _metric("active_agents", "Active Agents", sum(1 for agent in users_queryset if agent.status == "A")),
        _metric("open_workload", "Open Workload", sum(row["workload_total"] for row in rows)),
        _metric("resolved_tickets", "Resolved Tickets", sum(row["resolved_tickets"] for row in rows)),
        _metric("completed_tasks", "Completed Tasks", sum(row["completed_tasks"] for row in rows)),
        _metric(
            "avg_first_response",
            "Avg First Response",
            _format_duration(
                _average_duration(
                    [
                        ticket.first_response_at - ticket.created_at
                        for ticket in ticket_queryset
                        if ticket.assigned_to_id and ticket.first_response_at and ticket.created_at
                    ]
                )
            ),
        ),
        _metric(
            "avg_resolution",
            "Avg Resolution",
            _format_duration(
                _average_duration(
                    [
                        ticket.resolved_at - ticket.created_at
                        for ticket in ticket_queryset
                        if ticket.assigned_to_id and ticket.resolved_at and ticket.created_at
                    ]
                )
            ),
        ),
        _metric(
            "avg_csat",
            "Avg CSAT",
            _format_decimal(
                _average_number(
                    [
                        ticket.csat_score
                        for ticket in ticket_queryset
                        if ticket.assigned_to_id and ticket.csat_score is not None
                    ]
                )
            ),
        ),
        _metric(
            "sla_breach_count",
            "SLA Breach Count",
            sum(row["sla_breach_count"] for row in rows),
        ),
    ]

    columns = _agent_columns()

    page, page_size, paginated_rows, total_count, total_pages = _paginate_rows(rows, params)
    return {
        "report_type": "agents",
        "title": "Agents Report",
        "window": _window_payload(window),
        "summary": summary,
        "columns": columns,
        "rows": paginated_rows,
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "filter_options": _agent_filter_options(user) if user else {},
        "applied_filters": _common_applied_filters(params, window) | _agent_applied_filters(params),
    }


def export_ticket_report(user: Users, params, export_format: str) -> HttpResponse:
    return export_file_response(build_export_file(build_report_export_dataset(user, "tickets", params), export_format))


def export_task_report(user: Users, params, export_format: str) -> HttpResponse:
    return export_file_response(build_export_file(build_report_export_dataset(user, "tasks", params), export_format))


def export_agent_report(user: Users, params, export_format: str) -> HttpResponse:
    return export_file_response(build_export_file(build_report_export_dataset(user, "agents", params), export_format))


def build_report_export_dataset(
    user: Users | None,
    report_type: str,
    params,
    *,
    stream: bool = False,
    business: Business | None = None,
) -> ExportDataset:
    if report_type == "tickets":
        window = _resolve_window(params)
        if stream:
            summary_queryset = _ticket_queryset_for_report(user, params, window, business=business)
            queryset = _ticket_queryset_for_report(user, params, window, business=business)
            rows = (
                _serialize_ticket_export_row(_serialize_ticket_row(ticket))
                for ticket in queryset.iterator(chunk_size=1000)
            )
            summary = _ticket_summary(summary_queryset.iterator(chunk_size=1000))
        else:
            if business is not None:
                queryset = list(_ticket_queryset_for_report(user, params, window, business=business))
                rows = [_serialize_ticket_export_row(_serialize_ticket_row(ticket)) for ticket in queryset]
                summary = _ticket_summary(queryset)
            else:
                report = build_ticket_report(user, {**params, "page": "1", "page_size": str(MAX_PAGE_SIZE)})
                rows = [_serialize_ticket_export_row(row) for row in _ticket_rows_for_export(user, params)]
                summary = report["summary"]
        filename_prefix = "tickets-report"
        title = "Tickets Report"
        columns = _ticket_columns()
        applied_filters = _common_applied_filters(params, window) | _ticket_applied_filters(params)
        window_payload = _window_payload(window)
    elif report_type == "tasks":
        window = _resolve_window(params)
        if stream:
            summary_queryset = _task_queryset_for_report(user, params, window, business=business)
            queryset = _task_queryset_for_report(user, params, window, business=business)
            rows = (
                _serialize_task_export_row(_serialize_task_row(task))
                for task in queryset.iterator(chunk_size=1000)
            )
            summary = _task_summary(summary_queryset.iterator(chunk_size=1000))
        else:
            if business is not None:
                queryset = list(_task_queryset_for_report(user, params, window, business=business))
                rows = [_serialize_task_export_row(_serialize_task_row(task)) for task in queryset]
                summary = _task_summary(queryset)
            else:
                report = build_task_report(user, {**params, "page": "1", "page_size": str(MAX_PAGE_SIZE)})
                rows = [_serialize_task_export_row(row) for row in _task_rows_for_export(user, params)]
                summary = report["summary"]
        filename_prefix = "tasks-report"
        title = "Tasks Report"
        columns = _task_columns()
        applied_filters = _common_applied_filters(params, window) | _task_applied_filters(params)
        window_payload = _window_payload(window)
    elif report_type == "agents":
        report = build_agent_report(user, {**params, "page": "1", "page_size": str(MAX_PAGE_SIZE)}, business=business)
        rows = (
            _serialize_agent_export_row(row)
            for row in _agent_rows_for_export(user, params, business=business)
        ) if stream else [
            _serialize_agent_export_row(row) for row in _agent_rows_for_export(user, params, business=business)
        ]
        filename_prefix = "agents-report"
        title = report["title"]
        columns = report["columns"]
        summary = report["summary"]
        applied_filters = report["applied_filters"]
        window_payload = report["window"]
    else:
        raise ValueError("Unsupported report type.")

    return ExportDataset(
        title=title,
        report_type=report_type,
        columns=columns,
        rows=rows,
        filename_prefix=filename_prefix,
        summary=summary,
        applied_filters=applied_filters,
        window=window_payload,
        row_count=report_export_row_count(user, report_type, params, business=business),
    )


def build_selected_ticket_export_dataset(
    user: Users | None,
    ticket_ids: list[int],
    *,
    stream: bool = False,
    business: Business | None = None,
) -> ExportDataset:
    tickets = (
        _ticket_base_queryset(user, business=business)
        .filter(id__in=ticket_ids, is_deleted=False)
        .select_related("department", "category", "assigned_to", "contact", "sla_tracker")
        .prefetch_related("labels")
        .order_by("-created_at", "-id")
    )
    row_count = tickets.count()
    rows = (
        _serialize_ticket_export_row(_serialize_ticket_row(ticket))
        for ticket in tickets.iterator(chunk_size=1000)
    ) if stream else [_serialize_ticket_export_row(_serialize_ticket_row(ticket)) for ticket in tickets]
    return ExportDataset(
        title="Selected Tickets Export",
        report_type="tickets",
        columns=_ticket_columns(),
        rows=rows,
        filename_prefix="tickets-export",
        applied_filters={"selected_count": row_count},
        row_count=row_count,
    )


def build_selected_task_export_dataset(
    user: Users | None,
    task_ids: list[int],
    *,
    stream: bool = False,
    business: Business | None = None,
) -> ExportDataset:
    tasks = (
        _task_base_queryset(user, business=business)
        .filter(id__in=task_ids, is_deleted=False)
        .select_related("department", "assigned_to", "linked_ticket")
        .prefetch_related("labels")
        .order_by("-created_at", "-id")
    )
    row_count = tasks.count()
    rows = (
        _serialize_task_export_row(_serialize_task_row(task))
        for task in tasks.iterator(chunk_size=1000)
    ) if stream else [_serialize_task_export_row(_serialize_task_row(task)) for task in tasks]
    return ExportDataset(
        title="Selected Tasks Export",
        report_type="tasks",
        columns=_task_columns(),
        rows=rows,
        filename_prefix="tasks-export",
        applied_filters={"selected_count": row_count},
        row_count=row_count,
    )


def report_export_row_count(user: Users | None, report_type: str, params, *, business: Business | None = None) -> int:
    window = _resolve_window(params)
    if report_type == "tickets":
        return _ticket_queryset_for_report(user, params, window, business=business).count()
    if report_type == "tasks":
        return _task_queryset_for_report(user, params, window, business=business).count()
    if report_type == "agents":
        return _agent_export_row_count(user, params, window, business=business)
    raise ValueError("Unsupported report type.")


def selected_ticket_export_row_count(
    user: Users | None,
    ticket_ids: list[int],
    *,
    business: Business | None = None,
) -> int:
    return _ticket_base_queryset(user, business=business).filter(id__in=ticket_ids, is_deleted=False).count()


def selected_task_export_row_count(
    user: Users | None,
    task_ids: list[int],
    *,
    business: Business | None = None,
) -> int:
    return _task_base_queryset(user, business=business).filter(id__in=task_ids, is_deleted=False).count()


def pdf_limit_error_message() -> str:
    return f"PDF export is limited to {PDF_ROW_LIMIT} rows. Narrow the report filters or use CSV."


def _ticket_columns() -> list[dict[str, str]]:
    return [
        {"key": "ticket_id", "label": "Ticket ID"},
        {"key": "subject", "label": "Subject"},
        {"key": "customer", "label": "Customer"},
        {"key": "department", "label": "Department"},
        {"key": "category", "label": "Category"},
        {"key": "priority", "label": "Priority"},
        {"key": "status", "label": "Status"},
        {"key": "source", "label": "Source"},
        {"key": "assigned_agent", "label": "Assigned Agent"},
        {"key": "created_at", "label": "Created"},
        {"key": "first_response_at", "label": "First Response"},
        {"key": "resolved_at", "label": "Resolved"},
        {"key": "first_response_time", "label": "First Response Time"},
        {"key": "resolution_time", "label": "Resolution Time"},
        {"key": "sla_status", "label": "SLA Status"},
        {"key": "csat_score", "label": "CSAT"},
        {"key": "labels_text", "label": "Labels"},
    ]


def _task_columns() -> list[dict[str, str]]:
    return [
        {"key": "task_id", "label": "Task ID"},
        {"key": "title", "label": "Title"},
        {"key": "linked_ticket", "label": "Linked Ticket"},
        {"key": "department", "label": "Department"},
        {"key": "assigned_agent", "label": "Assigned Agent"},
        {"key": "priority", "label": "Priority"},
        {"key": "status", "label": "Status"},
        {"key": "due_date", "label": "Due Date"},
        {"key": "created_at", "label": "Created"},
        {"key": "completed_at", "label": "Completed"},
        {"key": "completion_time", "label": "Completion Time"},
        {"key": "overdue", "label": "Overdue"},
        {"key": "labels_text", "label": "Labels"},
    ]


def _agent_columns() -> list[dict[str, str]]:
    return [
        {"key": "agent_name", "label": "Agent Name"},
        {"key": "email", "label": "Email"},
        {"key": "departments", "label": "Departments"},
        {"key": "active_status", "label": "Status"},
        {"key": "open_tickets", "label": "Open Tickets"},
        {"key": "resolved_tickets", "label": "Resolved Tickets"},
        {"key": "assigned_tasks", "label": "Assigned Tasks"},
        {"key": "completed_tasks", "label": "Completed Tasks"},
        {"key": "avg_first_response", "label": "Avg First Response"},
        {"key": "avg_resolution", "label": "Avg Resolution"},
        {"key": "sla_breach_count", "label": "SLA Breaches"},
        {"key": "avg_csat", "label": "Avg CSAT"},
        {"key": "backlog_count", "label": "Backlog"},
    ]


def _resolve_window(params) -> ReportWindow:
    period = (params.get("q") or params.get("period") or "month").strip().lower()
    now = timezone.now()

    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        label = "Today"
    elif period == "week":
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=7)
        label = "This Week"
    elif period == "year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end = start.replace(year=start.year + 1)
        label = "This Year"
    elif period == "range":
        start = _parse_date(params.get("start"), default=now.replace(day=1, hour=0, minute=0, second=0, microsecond=0))
        raw_end = _parse_date(params.get("end"), default=start)
        end = raw_end.replace(hour=23, minute=59, second=59, microsecond=999999) + timedelta(microseconds=1)
        label = "Custom Range"
    else:
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = _next_month(start)
        label = "This Month"
        period = "month"

    return ReportWindow(period=period, start=start, end=end, label=label)


def _parse_date(value: str | None, default: datetime) -> datetime:
    if not value:
        return default
    parsed = datetime.strptime(value, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
    return timezone.make_aware(parsed, timezone.get_current_timezone())


def _next_month(date_value: datetime) -> datetime:
    if date_value.month == 12:
        return date_value.replace(year=date_value.year + 1, month=1)
    return date_value.replace(month=date_value.month + 1)


def _ticket_base_queryset(user: Users | None, *, business: Business | None = None) -> QuerySet[Ticket]:
    if business is not None:
        return Ticket.objects.filter(business=business)
    if user is None:
        raise ValueError("Business scope is required for ticket exports.")
    return Ticket.objects.for_business(user)


def _task_base_queryset(user: Users | None, *, business: Business | None = None) -> QuerySet[Task]:
    if business is not None:
        return Task.objects.filter(business=business)
    if user is None:
        raise ValueError("Business scope is required for task exports.")
    return Task.objects.for_business(user)


def _ticket_queryset(
    user: Users | None,
    params,
    window: ReportWindow,
    *,
    business: Business | None = None,
) -> list[Ticket]:
    return list(_ticket_queryset_for_report(user, params, window, business=business))


def _ticket_queryset_for_report(
    user: Users | None,
    params,
    window: ReportWindow,
    *,
    business: Business | None = None,
) -> QuerySet[Ticket]:
    queryset = (
        _ticket_base_queryset(user, business=business)
        .filter(is_deleted=False, is_merged=False, created_at__gte=window.start, created_at__lt=window.end)
        .select_related("department", "category", "assigned_to", "contact", "sla_tracker")
        .prefetch_related("labels")
        .order_by("-created_at", "-id")
    )
    return _apply_common_ticket_filters(queryset, params)


def _task_queryset(
    user: Users | None,
    params,
    window: ReportWindow,
    *,
    business: Business | None = None,
) -> list[Task]:
    return list(_task_queryset_for_report(user, params, window, business=business))


def _task_queryset_for_report(
    user: Users | None,
    params,
    window: ReportWindow,
    *,
    business: Business | None = None,
) -> QuerySet[Task]:
    queryset = (
        _task_base_queryset(user, business=business)
        .filter(is_deleted=False, created_at__gte=window.start, created_at__lt=window.end)
        .select_related("department", "assigned_to", "linked_ticket")
        .prefetch_related("labels")
        .order_by("-created_at", "-id")
    )
    return _apply_common_task_filters(queryset, params)


def _agent_queryset(user: Users | None, params, *, business: Business | None = None) -> list[Users]:
    return list(_agent_queryset_for_report(user, params, business=business))


def _agent_queryset_for_report(user: Users | None, params, *, business: Business | None = None) -> QuerySet[Users]:
    queryset = (
        _report_agents_queryset(user, business=business)
        .select_related("role")
        .prefetch_related("department")
        .order_by("first_name", "last_name", "email")
        .distinct()
    )

    agent_id = params.get("agent")
    if agent_id:
        queryset = queryset.filter(id=agent_id)

    department_id = params.get("department")
    if department_id:
        queryset = queryset.filter(department__id=department_id)

    active_status = params.get("agent_status")
    if active_status == "active":
        queryset = queryset.filter(status="A")
    elif active_status == "inactive":
        queryset = queryset.exclude(status="A")

    search = (params.get("search") or "").strip()
    if search:
        queryset = queryset.filter(
            Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(email__icontains=search)
            | Q(username__icontains=search)
        )

    return queryset


def _agent_export_row_count(
    user: Users | None,
    params,
    window: ReportWindow,
    *,
    business: Business | None = None,
) -> int:
    workload_band = params.get("workload_band")
    agents = list(_agent_queryset_for_report(user, params, business=business))
    if not workload_band or workload_band == "all":
        return len(agents)

    ticket_queryset = _ticket_queryset_for_report(user, params, window, business=business)
    task_queryset = _task_queryset_for_report(user, params, window, business=business)
    ticket_counts: dict[int, int] = {}
    for assigned_to_id, status_value in ticket_queryset.values_list("assigned_to_id", "status"):
        if assigned_to_id and status_value not in TICKET_CLOSED_STATUSES:
            ticket_counts[assigned_to_id] = ticket_counts.get(assigned_to_id, 0) + 1

    task_counts: dict[int, int] = {}
    for assigned_to_id, task_status in task_queryset.values_list("assigned_to_id", "task_status"):
        if assigned_to_id and task_status in TASK_OPEN_STATUSES:
            task_counts[assigned_to_id] = task_counts.get(assigned_to_id, 0) + 1

    return sum(
        1
        for agent in agents
        if _agent_matches_workload_band(ticket_counts.get(agent.id, 0) + task_counts.get(agent.id, 0), workload_band)
    )


def _apply_common_ticket_filters(queryset: QuerySet[Ticket], params):
    department_id = params.get("department")
    agent_id = params.get("agent")
    status_value = params.get("status")
    priority = params.get("priority")
    category_id = params.get("category")
    source = params.get("source")
    sla_status = params.get("sla_status")
    csat = params.get("csat")
    search = (params.get("search") or "").strip()

    if department_id:
        queryset = queryset.filter(department_id=department_id)
    if agent_id:
        queryset = queryset.filter(assigned_to_id=agent_id)
    if status_value:
        queryset = queryset.filter(status=status_value)
    if priority:
        queryset = queryset.filter(priority=priority)
    if category_id:
        queryset = queryset.filter(category_id=category_id)
    if source:
        queryset = queryset.filter(source=source)
    if sla_status == "breached":
        queryset = queryset.filter(
            Q(sla_tracker__first_response_status="breached") | Q(sla_tracker__resolution_status="breached")
        )
    elif sla_status == "within_sla":
        queryset = queryset.exclude(
            Q(sla_tracker__first_response_status="breached") | Q(sla_tracker__resolution_status="breached")
        )
    if csat == "with_score":
        queryset = queryset.filter(csat_score__isnull=False)
    elif csat == "without_score":
        queryset = queryset.filter(csat_score__isnull=True)
    elif csat == "high":
        queryset = queryset.filter(csat_score__gte=8)
    elif csat == "medium":
        queryset = queryset.filter(csat_score__gte=5, csat_score__lt=8)
    elif csat == "low":
        queryset = queryset.filter(csat_score__lt=5)
    if search:
        queryset = queryset.filter(
            Q(ticket_id__icontains=search)
            | Q(title__icontains=search)
            | Q(creator_name__icontains=search)
            | Q(creator_email__icontains=search)
            | Q(contact__first_name__icontains=search)
            | Q(contact__last_name__icontains=search)
        )
    return queryset


def _apply_common_task_filters(queryset: QuerySet[Task], params):
    department_id = params.get("department")
    agent_id = params.get("agent")
    status_value = params.get("task_status") or params.get("status")
    priority = params.get("priority")
    overdue = params.get("overdue")
    linked_ticket = params.get("linked_ticket")
    search = (params.get("search") or "").strip()

    if department_id:
        queryset = queryset.filter(department_id=department_id)
    if agent_id:
        queryset = queryset.filter(assigned_to_id=agent_id)
    if status_value:
        queryset = queryset.filter(task_status=status_value)
    if priority:
        queryset = queryset.filter(priority=priority)
    if linked_ticket:
        queryset = queryset.filter(linked_ticket__ticket_id__icontains=linked_ticket)
    if overdue == "overdue":
        queryset = queryset.filter(due_date__lt=timezone.now()).exclude(task_status__in=[TASK_COMPLETED_STATUS, "cancelled"])
    elif overdue == "on_track":
        queryset = queryset.exclude(due_date__lt=timezone.now()).exclude(task_status__in=[TASK_COMPLETED_STATUS, "cancelled"])
    if search:
        queryset = queryset.filter(
            Q(task_trackid__icontains=search)
            | Q(title__icontains=search)
            | Q(linked_ticket__ticket_id__icontains=search)
        )
    return queryset


def _serialize_ticket_row(ticket: Ticket) -> dict:
    first_response_duration = (
        ticket.first_response_at - ticket.created_at
        if ticket.first_response_at and ticket.created_at
        else None
    )
    resolution_duration = (
        ticket.resolved_at - ticket.created_at
        if ticket.resolved_at and ticket.created_at
        else None
    )
    labels = [_label_payload(label) for label in ticket.labels.all().order_by("name")]
    return {
        "id": ticket.id,
        "ticket_id": ticket.ticket_id or f"#{ticket.id}",
        "subject": ticket.title,
        "customer": ticket.creator_name or _contact_display_name(ticket.contact) or ticket.creator_email or "—",
        "department": ticket.department.name if ticket.department else "—",
        "category": ticket.category.name if ticket.category else "—",
        "priority": _title_case(ticket.priority),
        "status": _title_case(ticket.status),
        "source": _title_case((ticket.source or "").replace("_", " ")),
        "assigned_agent": _user_display_name(ticket.assigned_to),
        "created_at": _format_datetime(ticket.created_at),
        "first_response_at": _format_datetime(ticket.first_response_at),
        "resolved_at": _format_datetime(ticket.resolved_at),
        "first_response_time": _format_duration(first_response_duration),
        "resolution_time": _format_duration(resolution_duration),
        "sla_status": _ticket_sla_status(ticket),
        "csat_score": ticket.csat_score if ticket.csat_score is not None else "—",
        "labels": labels,
        "labels_text": ", ".join(label["name"] for label in labels) or "—",
    }


def _serialize_task_row(task: Task) -> dict:
    completion_duration = (
        task.completed_at - task.created_at
        if task.completed_at and task.created_at
        else None
    )
    labels = [_label_payload(label) for label in task.labels.all().order_by("name")]
    return {
        "id": task.id,
        "task_id": task.task_trackid or f"TSK-{task.id}",
        "title": task.title,
        "linked_ticket": task.linked_ticket.ticket_id if task.linked_ticket else "—",
        "department": task.department.name if task.department else "—",
        "assigned_agent": _user_display_name(task.assigned_to),
        "priority": _title_case(task.priority),
        "status": _title_case(task.task_status),
        "due_date": _format_datetime(task.due_date),
        "created_at": _format_datetime(task.created_at),
        "completed_at": _format_datetime(task.completed_at),
        "completion_time": _format_duration(completion_duration),
        "overdue": "Yes" if task.is_overdue else "No",
        "labels": labels,
        "labels_text": ", ".join(label["name"] for label in labels) or "—",
    }


def _ticket_rows_for_export(user: Users, params) -> list[dict]:
    window = _resolve_window(params)
    return [_serialize_ticket_row(ticket) for ticket in _ticket_queryset(user, params, window)]


def _task_rows_for_export(user: Users, params) -> list[dict]:
    window = _resolve_window(params)
    return [_serialize_task_row(task) for task in _task_queryset(user, params, window)]


def _agent_rows_for_export(user: Users | None, params, *, business: Business | None = None) -> list[dict]:
    report = build_agent_report(user, {**params, "page": "1", "page_size": "5000"}, business=business)
    return report["rows"] if report["total_pages"] <= 1 else [
        row for row in build_agent_report(user, {**params, "page": "1", "page_size": "5000"}, business=business)["rows"]
    ]


def _serialize_ticket_export_row(row: dict) -> dict:
    export_row = row.copy()
    export_row.pop("labels", None)
    return export_row


def _serialize_task_export_row(row: dict) -> dict:
    export_row = row.copy()
    export_row.pop("labels", None)
    return export_row


def _serialize_agent_export_row(row: dict) -> dict:
    export_row = row.copy()
    export_row.pop("id", None)
    export_row.pop("workload_total", None)
    return export_row


def _paginate_rows(rows: list[dict], params) -> tuple[int, int, list[dict], int, int]:
    page = max(1, _safe_int(params.get("page"), 1))
    page_size = min(MAX_PAGE_SIZE, max(1, _safe_int(params.get("page_size"), DEFAULT_PAGE_SIZE)))
    total_count = len(rows)
    total_pages = max(1, (total_count + page_size - 1) // page_size)
    start = (page - 1) * page_size
    end = start + page_size
    return page, page_size, rows[start:end], total_count, total_pages


def _export_report(filename_prefix: str, report: dict, rows: list[dict], export_format: str) -> HttpResponse:
    export_format = (export_format or "csv").lower()
    if export_format == "pdf":
        if len(rows) > PDF_ROW_LIMIT:
            raise ValueError(pdf_limit_error_message())
        return _pdf_response(filename_prefix, report, rows)
    return _csv_response(filename_prefix, report["columns"], rows)


def _csv_response(filename_prefix: str, columns: list[dict], rows: list[dict]) -> HttpResponse:
    output = StringIO()
    writer = csv.writer(output)
    headers = [column["label"] for column in columns]
    writer.writerow(headers)
    for row in rows:
        writer.writerow([row.get(column["key"], "") for column in columns])

    response = HttpResponse(output.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename_prefix}.csv"'
    return response


def _pdf_response(filename_prefix: str, report: dict, rows: list[dict]) -> HttpResponse:
    lines: list[str] = [
        report["title"],
        f"Date Window: {report['window']['label']}",
        "",
        "Summary",
    ]
    for metric in report["summary"]:
        lines.append(f"- {metric['label']}: {metric['display_value']}")

    lines.extend(["", "Applied Filters"])
    for key, value in report["applied_filters"].items():
        if value in (None, "", "all"):
            continue
        lines.append(f"- {_title_case(str(key).replace('_', ' '))}: {value}")

    lines.extend(["", "Rows"])
    for index, row in enumerate(rows, start=1):
        lines.append(f"{index}. {_primary_row_title(report['report_type'], row)}")
        for column in report["columns"]:
            value = row.get(column["key"], "—")
            lines.append(f"   {column['label']}: {value}")
        lines.append("")

    pdf_bytes = _build_simple_pdf(lines)
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename_prefix}.pdf"'
    return response


def _build_simple_pdf(lines: list[str]) -> bytes:
    max_lines_per_page = 48
    pages: list[list[str]] = [
        lines[index:index + max_lines_per_page]
        for index in range(0, len(lines), max_lines_per_page)
    ] or [[]]

    font_id = 1
    first_content_id = 2
    first_page_id = first_content_id + len(pages)
    pages_id = first_page_id + len(pages)
    catalog_id = pages_id + 1

    objects: dict[int, bytes] = {
        font_id: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    }

    for index, page_lines in enumerate(pages):
        content_id = first_content_id + index
        page_id = first_page_id + index
        stream = _pdf_content_stream(page_lines)
        objects[content_id] = (
            f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1")
            + stream
            + b"\nendstream"
        )
        objects[page_id] = (
            f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_id} 0 R >>"
        ).encode("latin-1")

    kids = " ".join(f"{first_page_id + index} 0 R" for index in range(len(pages)))
    objects[pages_id] = f"<< /Type /Pages /Kids [ {kids} ] /Count {len(pages)} >>".encode("latin-1")
    objects[catalog_id] = f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode("latin-1")

    payload = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0] * (catalog_id + 1)

    for object_id in range(1, catalog_id + 1):
        offsets[object_id] = len(payload)
        payload.extend(f"{object_id} 0 obj\n".encode("latin-1"))
        payload.extend(objects[object_id])
        payload.extend(b"\nendobj\n")

    xref_offset = len(payload)
    payload.extend(f"xref\n0 {catalog_id + 1}\n".encode("latin-1"))
    payload.extend(b"0000000000 65535 f \n")
    for object_id in range(1, catalog_id + 1):
        payload.extend(f"{offsets[object_id]:010d} 00000 n \n".encode("latin-1"))

    payload.extend(
        (
            f"trailer\n<< /Size {catalog_id + 1} /Root {catalog_id} 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF"
        ).encode("latin-1")
    )
    return bytes(payload)


def _pdf_content_stream(lines: list[str]) -> bytes:
    chunks = ["BT", "/F1 9 Tf", "40 752 Td"]
    for index, line in enumerate(lines):
        escaped = _escape_pdf_text(line[:180])
        if index == 0:
            chunks.append(f"({escaped}) Tj")
        else:
            chunks.append("0 -14 Td")
            chunks.append(f"({escaped}) Tj")
    chunks.append("ET")
    return "\n".join(chunks).encode("latin-1", errors="replace")


def _escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _primary_row_title(report_type: str, row: dict) -> str:
    if report_type == "tickets":
        return row.get("ticket_id", "Ticket")
    if report_type == "tasks":
        return row.get("task_id", "Task")
    return row.get("agent_name", "Agent")


def _window_payload(window: ReportWindow) -> dict:
    return {
        "period": window.period,
        "label": window.label,
        "start_date": window.start.date().isoformat(),
        "end_date": (window.end - timedelta(microseconds=1)).date().isoformat(),
    }


def _common_applied_filters(params, window: ReportWindow) -> dict:
    return {
        "period": window.label,
        "start_date": window.start.date().isoformat(),
        "end_date": (window.end - timedelta(microseconds=1)).date().isoformat(),
        "department": params.get("department") or "all",
        "agent": params.get("agent") or "all",
        "search": (params.get("search") or "").strip(),
    }


def _ticket_applied_filters(params) -> dict:
    return {
        "status": params.get("status") or "all",
        "priority": params.get("priority") or "all",
        "category": params.get("category") or "all",
        "source": params.get("source") or "all",
        "sla_status": params.get("sla_status") or "all",
        "csat": params.get("csat") or "all",
    }


def _task_applied_filters(params) -> dict:
    return {
        "status": params.get("task_status") or params.get("status") or "all",
        "priority": params.get("priority") or "all",
        "overdue": params.get("overdue") or "all",
        "linked_ticket": params.get("linked_ticket") or "",
    }


def _agent_applied_filters(params) -> dict:
    return {
        "agent_status": params.get("agent_status") or "all",
        "workload_band": params.get("workload_band") or "all",
    }


def _ticket_filter_options(user: Users) -> dict:
    return {
        **_common_filter_options(user),
        "statuses": [{"value": value, "label": _title_case(label)} for value, label in Ticket.STATUS_CHOICES],
        "priorities": [{"value": value, "label": _title_case(label)} for value, label in Ticket._meta.get_field("priority").choices],
        "categories": [
            {"value": str(category.id), "label": category.name}
            for category in TicketCategories.objects.for_business(user).order_by("name")
        ],
        "sources": [{"value": value, "label": label} for value, label in Ticket.TICKET_SOURCE_CHOICES],
        "sla_statuses": [
            {"value": "within_sla", "label": "Within SLA"},
            {"value": "breached", "label": "Breached"},
        ],
        "csat_options": [
            {"value": "with_score", "label": "With Score"},
            {"value": "without_score", "label": "Without Score"},
            {"value": "high", "label": "High (8-10)"},
            {"value": "medium", "label": "Medium (5-7)"},
            {"value": "low", "label": "Low (0-4)"},
        ],
    }


def _task_filter_options(user: Users) -> dict:
    return {
        **_common_filter_options(user),
        "statuses": [{"value": value, "label": _title_case(label)} for value, label in Task.STATUS_CHOICES],
        "priorities": [{"value": value, "label": _title_case(label)} for value, label in Task._meta.get_field("priority").choices],
        "overdue_options": [
            {"value": "overdue", "label": "Overdue"},
            {"value": "on_track", "label": "On Track"},
        ],
    }


def _agent_filter_options(user: Users) -> dict:
    return {
        **_common_filter_options(user),
        "agent_statuses": [
            {"value": "active", "label": "Active"},
            {"value": "inactive", "label": "Inactive"},
        ],
        "workload_bands": [
            {"value": "low", "label": "Low (0-4)"},
            {"value": "medium", "label": "Medium (5-9)"},
            {"value": "high", "label": "High (10+)"},
        ],
    }


def _common_filter_options(user: Users) -> dict:
    return {
        "periods": [
            {"value": "today", "label": "Today"},
            {"value": "week", "label": "This Week"},
            {"value": "month", "label": "This Month"},
            {"value": "year", "label": "This Year"},
            {"value": "range", "label": "Custom Range"},
        ],
        "departments": [
            {"value": str(department.id), "label": department.name}
            for department in Department.objects.for_business(user).order_by("name")
        ],
        "agents": [
            {"value": str(agent.id), "label": _user_display_name(agent)}
            for agent in _report_agents_queryset(user)
            .order_by("first_name", "last_name", "email")
            .distinct()
        ],
    }


def _report_agents_queryset(user: Users | None, *, business: Business | None = None):
    if business is None:
        if user is None:
            raise ValueError("Business scope is required for agent exports.")
        business = user.business
    return Users.objects.filter(business=business).exclude(is_superuser=True, status="D")


def _ticket_summary(tickets: Iterable[Ticket]) -> list[dict]:
    created_count = 0
    resolved_count = 0
    backlog_count = 0
    unassigned_count = 0
    breached_count = 0
    first_response_total = 0.0
    first_response_count = 0
    resolution_total = 0.0
    resolution_count = 0
    csat_total = 0.0
    csat_count = 0

    for ticket in tickets:
        created_count += 1
        if ticket.resolved_at:
            resolved_count += 1
            if ticket.created_at:
                resolution_total += (ticket.resolved_at - ticket.created_at).total_seconds()
                resolution_count += 1
        if ticket.status not in TICKET_CLOSED_STATUSES:
            backlog_count += 1
        if not ticket.assigned_to_id:
            unassigned_count += 1
        if _ticket_has_sla_breach(ticket):
            breached_count += 1
        if ticket.first_response_at and ticket.created_at:
            first_response_total += (ticket.first_response_at - ticket.created_at).total_seconds()
            first_response_count += 1
        if ticket.csat_score is not None:
            csat_total += ticket.csat_score
            csat_count += 1

    avg_first_response = _average_duration_from_seconds(first_response_total, first_response_count)
    avg_resolution = _average_duration_from_seconds(resolution_total, resolution_count)
    avg_csat = round(csat_total / csat_count, 1) if csat_count else None

    return [
        _metric("created", "Tickets Created", created_count),
        _metric("resolved", "Tickets Resolved", resolved_count),
        _metric("backlog", "Backlog", backlog_count),
        _metric("unassigned", "Unassigned", unassigned_count),
        _metric("sla_breached", "SLA Breached", breached_count),
        _metric(
            "sla_compliance",
            "SLA Compliance",
            _compute_percent(created_count - breached_count, created_count),
            suffix="%",
        ),
        _metric(
            "avg_first_response",
            "Avg First Response",
            _format_duration(avg_first_response),
            raw_value=_duration_minutes(avg_first_response),
        ),
        _metric(
            "avg_resolution",
            "Avg Resolution",
            _format_duration(avg_resolution),
            raw_value=_duration_minutes(avg_resolution),
        ),
        _metric("avg_csat", "Avg CSAT", _format_decimal(avg_csat), raw_value=avg_csat),
    ]


def _task_summary(tasks: Iterable[Task]) -> list[dict]:
    created_count = 0
    completed_count = 0
    open_count = 0
    overdue_count = 0
    completion_total = 0.0
    completion_count = 0

    for task in tasks:
        created_count += 1
        if task.task_status == TASK_COMPLETED_STATUS:
            completed_count += 1
            if task.completed_at and task.created_at:
                completion_total += (task.completed_at - task.created_at).total_seconds()
                completion_count += 1
        if task.task_status in TASK_OPEN_STATUSES:
            open_count += 1
        if task.is_overdue:
            overdue_count += 1

    avg_completion = _average_duration_from_seconds(completion_total, completion_count)
    return [
        _metric("created", "Tasks Created", created_count),
        _metric("completed", "Tasks Completed", completed_count),
        _metric("open", "Open Tasks", open_count),
        _metric("overdue", "Overdue Tasks", overdue_count),
        _metric(
            "avg_completion",
            "Avg Completion",
            _format_duration(avg_completion),
            raw_value=_duration_minutes(avg_completion),
        ),
    ]


def _metric(key: str, label: str, value, *, suffix: str = "", raw_value=None) -> dict:
    display_value = value
    if isinstance(value, (int, float)) and suffix:
        display_value = f"{value}{suffix}"
    return {
        "key": key,
        "label": label,
        "value": raw_value if raw_value is not None else value,
        "display_value": display_value,
    }


def _average_duration(values: Iterable[timedelta]) -> timedelta | None:
    values = list(values)
    if not values:
        return None
    total_seconds = sum(value.total_seconds() for value in values)
    return timedelta(seconds=total_seconds / len(values))


def _average_duration_minutes(values: Iterable[timedelta]) -> float | None:
    average = _average_duration(values)
    if average is None:
        return None
    return round(average.total_seconds() / 60, 1)


def _average_duration_from_seconds(total_seconds: float, count: int) -> timedelta | None:
    if count <= 0:
        return None
    return timedelta(seconds=total_seconds / count)


def _duration_minutes(value: timedelta | None) -> float | None:
    if value is None:
        return None
    return round(value.total_seconds() / 60, 1)


def _average_number(values: Iterable[int | float]) -> float | None:
    values = [value for value in values if value is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def _compute_percent(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return round((numerator / denominator) * 100, 1)


def _format_duration(value: timedelta | None) -> str:
    if value is None:
        return "—"
    total_minutes = max(0, int(value.total_seconds() // 60))
    days, remaining_minutes = divmod(total_minutes, 1440)
    hours, minutes = divmod(remaining_minutes, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes or not parts:
        parts.append(f"{minutes}m")
    return " ".join(parts)


def _format_decimal(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value:.1f}"


def _format_datetime(value: datetime | None) -> str:
    if value is None:
        return "—"
    return timezone.localtime(value).strftime("%Y-%m-%d %H:%M")


def _title_case(value: str | None) -> str:
    if not value:
        return "—"
    return str(value).replace("_", " ").title()


def _user_display_name(user: Users | None) -> str:
    if not user:
        return "—"
    first = (getattr(user, "first_name", "") or "").strip()
    last = (getattr(user, "last_name", "") or "").strip()
    full = f"{first} {last}".strip()
    if full:
        return full
    if user.email:
        return user.email
    return getattr(user, "username", "—") or "—"


def _contact_display_name(contact) -> str | None:
    if not contact:
        return None
    first = (getattr(contact, "first_name", "") or "").strip()
    last = (getattr(contact, "last_name", "") or "").strip()
    full = f"{first} {last}".strip()
    return full or None


def _ticket_has_sla_breach(ticket: Ticket) -> bool:
    tracker = getattr(ticket, "sla_tracker", None)
    if not tracker:
        return False
    return tracker.first_response_status == "breached" or tracker.resolution_status == "breached"


def _ticket_sla_status(ticket: Ticket) -> str:
    tracker = getattr(ticket, "sla_tracker", None)
    if not tracker:
        return "No SLA"
    if tracker.first_response_status == "breached" or tracker.resolution_status == "breached":
        return "Breached"
    if tracker.first_response_status == "approaching_breach" or tracker.resolution_status == "approaching_breach":
        return "Approaching Breach"
    return "Within SLA"


def _label_payload(label) -> dict:
    return {
        "id": label.id,
        "name": label.name,
        "color": label.color,
        "text_color": getattr(label, "text_color", "#111827"),
        "is_active": label.is_active,
    }


def _safe_int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _agent_matches_workload_band(workload_total: int, workload_band: str | None) -> bool:
    if not workload_band or workload_band == "all":
        return True
    if workload_band == "low":
        return workload_total <= 4
    if workload_band == "medium":
        return 5 <= workload_total <= 9
    if workload_band == "high":
        return workload_total >= 10
    return True
