from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable

from django.db.models import Avg, Count, Q, QuerySet
from django.utils import timezone

from tenant.models import Department, MailIntegration, Ticket
from tenant.models.TicketModel import TicketReopen
from users.models import Users


CLOSED_STATUSES = ["resolved", "closed"]
ACTIVE_STATUSES = ["open", "in_progress", "pending", "on_hold"]


@dataclass(frozen=True)
class DashboardWindow:
    period: str
    start: datetime
    end: datetime
    group_by: str
    label: str


def build_dashboard_payload(user: Users, params: dict[str, str]) -> dict:
    role = _resolve_dashboard_role(user)
    window = _resolve_window(params)

    scoped_tickets = _scoped_tickets(user, role)
    period_scoped_tickets = scoped_tickets.filter(created_at__gte=window.start, created_at__lt=window.end)
    resolved_in_window = scoped_tickets.filter(resolved_at__gte=window.start, resolved_at__lt=window.end)

    payload = {
        "role": role,
        "filter": {
            "period": window.period,
            "label": window.label,
            "start_date": window.start.isoformat(),
            "end_date": window.end.isoformat(),
            "group_by": window.group_by,
        },
        "admin_dashboard": None,
        "agent_dashboard": None,
    }

    if role == "agent":
        payload["agent_dashboard"] = _build_agent_dashboard(user, scoped_tickets, period_scoped_tickets, window)
    else:
        payload["admin_dashboard"] = _build_admin_dashboard(
            user,
            scoped_tickets,
            period_scoped_tickets,
            resolved_in_window,
            window,
        )

    return payload


def _resolve_dashboard_role(user: Users) -> str:
    role_name = (getattr(getattr(user, "role", None), "name", "") or "").strip().lower()
    return "agent" if role_name == "agent" else "admin"


def _resolve_window(params: dict[str, str]) -> DashboardWindow:
    period = params.get("q", "week")
    now = timezone.now()

    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        group_by = "day"
        label = "Today"
    elif period == "week":
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=7)
        group_by = "day"
        label = "This Week"
    elif period == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = _next_month(start)
        group_by = "week"
        label = "This Month"
    elif period == "year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end = start.replace(year=start.year + 1)
        group_by = "month"
        label = "This Year"
    elif period == "range":
        start = _parse_date(params.get("start"), default=now.replace(hour=0, minute=0, second=0, microsecond=0))
        raw_end = _parse_date(params.get("end"), default=start)
        end = raw_end.replace(hour=23, minute=59, second=59, microsecond=999999) + timedelta(microseconds=1)
        days = max(1, int((end - start).total_seconds() / 86400))
        group_by = params.get("groupby") or ("day" if days <= 14 else "week" if days <= 60 else "month")
        label = "Custom Range"
    else:
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=7)
        group_by = "day"
        label = "This Week"

    return DashboardWindow(period=period, start=start, end=end, group_by=group_by, label=label)


def _parse_date(value: str | None, default: datetime) -> datetime:
    if not value:
        return default

    parsed = datetime.strptime(value, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
    return timezone.make_aware(parsed, timezone.get_current_timezone())


def _next_month(date_value: datetime) -> datetime:
    if date_value.month == 12:
        return date_value.replace(year=date_value.year + 1, month=1)
    return date_value.replace(month=date_value.month + 1)


def _scoped_tickets(user: Users, role: str) -> QuerySet[Ticket]:
    queryset = Ticket.objects.for_business(user).filter(is_deleted=False, is_merged=False)
    if role != "agent":
        return queryset

    department_ids = list(user.department.values_list("id", flat=True))
    if not department_ids:
        return queryset.none()
    return queryset.filter(department_id__in=department_ids)


def _visible_departments(user: Users, role: str) -> QuerySet[Department]:
    queryset = Department.objects.for_business(user)
    if role != "agent":
        return queryset

    department_ids = list(user.department.values_list("id", flat=True))
    if not department_ids:
        return queryset.none()
    return queryset.filter(id__in=department_ids)


def _bucket_ranges(window: DashboardWindow) -> list[dict[str, datetime | str]]:
    buckets: list[dict[str, datetime | str]] = []
    current = window.start

    if window.group_by == "month":
        while current < window.end:
            bucket_end = min(_next_month(current), window.end)
            buckets.append(
                {
                    "label": current.strftime("%b"),
                    "start": current,
                    "end": bucket_end,
                }
            )
            current = bucket_end
        return buckets

    if window.group_by == "week":
        week_index = 1
        while current < window.end:
            bucket_end = min(current + timedelta(days=7), window.end)
            buckets.append(
                {
                    "label": f"W{week_index}",
                    "start": current,
                    "end": bucket_end,
                }
            )
            current = bucket_end
            week_index += 1
        return buckets

    while current < window.end:
        bucket_end = min(current + timedelta(days=1), window.end)
        buckets.append(
            {
                "label": current.strftime("%a") if window.period in {"week", "range"} else current.strftime("%d %b"),
                "start": current,
                "end": bucket_end,
            }
        )
        current = bucket_end

    return buckets


def _sla_breached_queryset(queryset: QuerySet[Ticket]) -> QuerySet[Ticket]:
    return queryset.exclude(status="closed").filter(
        Q(sla_tracker__first_response_status="breached")
        | Q(sla_tracker__resolution_status="breached")
    )


def _backlog_queryset(queryset: QuerySet[Ticket]) -> QuerySet[Ticket]:
    return queryset.exclude(status__in=CLOSED_STATUSES)


def _count_sla_breached(queryset: QuerySet[Ticket]) -> int:
    return _sla_breached_queryset(queryset).count()


def _compute_sla_compliance(queryset: QuerySet[Ticket]) -> float:
    with_sla = queryset.filter(sla_tracker__isnull=False)
    total = with_sla.count()
    if total == 0:
        return 0.0
    compliant = with_sla.exclude(sla_tracker__first_response_status="breached").exclude(
        sla_tracker__resolution_status="breached"
    ).count()
    return round((compliant / total) * 100, 1)


def _series_meta(series: list[int | float], *, trend_label: str = "vs period start") -> dict:
    if not series:
        series = [0]

    numeric = [float(value) for value in series]
    start = numeric[0]
    end = numeric[-1]

    if start == 0:
        delta = 100.0 if end > 0 else 0.0
    else:
        delta = round(((end - start) / abs(start)) * 100, 1)

    if delta > 0.1:
        direction = "up"
    elif delta < -0.1:
        direction = "down"
    else:
        direction = "flat"

    return {
        "sparkline": [round(value, 1) for value in numeric],
        "trend_delta_pct": round(abs(delta), 1),
        "trend_direction": direction,
        "trend_label": trend_label,
    }


def _count_by_field_in_bucket(
    queryset: QuerySet[Ticket],
    field_name: str,
    start: datetime,
    end: datetime,
) -> int:
    lookup = {f"{field_name}__gte": start, f"{field_name}__lt": end}
    return queryset.filter(**lookup).count()


def _count_series(
    queryset: QuerySet[Ticket],
    window: DashboardWindow,
    *,
    field_name: str = "created_at",
) -> list[int]:
    series: list[int] = []
    for bucket in _bucket_ranges(window):
        series.append(_count_by_field_in_bucket(queryset, field_name, bucket["start"], bucket["end"]))
    return series


def _sla_compliance_series(queryset: QuerySet[Ticket], window: DashboardWindow) -> list[float]:
    series: list[float] = []
    for bucket in _bucket_ranges(window):
        bucket_queryset = queryset.filter(created_at__gte=bucket["start"], created_at__lt=bucket["end"])
        series.append(_compute_sla_compliance(bucket_queryset))
    return series


def _series_points_for_tickets(
    source_queryset: QuerySet[Ticket],
    window: DashboardWindow,
    primary_filter: Q,
    secondary_filter: Q,
    primary_label: str = "primary",
    secondary_label: str = "secondary",
) -> list[dict[str, int | str]]:
    points: list[dict[str, int | str]] = []
    for bucket in _bucket_ranges(window):
        start = bucket["start"]
        end = bucket["end"]
        primary_count = source_queryset.filter(primary_filter, created_at__gte=start, created_at__lt=end).count()
        secondary_count = source_queryset.filter(secondary_filter, created_at__gte=start, created_at__lt=end).count()
        points.append(
            {
                "label": bucket["label"],
                primary_label: primary_count,
                secondary_label: secondary_count,
            }
        )
    return points


def _created_vs_resolved_points(queryset: QuerySet[Ticket], window: DashboardWindow) -> list[dict[str, int | str]]:
    points: list[dict[str, int | str]] = []
    for bucket in _bucket_ranges(window):
        start = bucket["start"]
        end = bucket["end"]
        points.append(
            {
                "label": bucket["label"],
                "created": queryset.filter(created_at__gte=start, created_at__lt=end).count(),
                "resolved": queryset.filter(resolved_at__gte=start, resolved_at__lt=end).count(),
            }
        )
    return points


def _reopened_points(user: Users, role: str, window: DashboardWindow) -> list[dict[str, int | str]]:
    queryset = TicketReopen.objects.filter(ticket__business=user.business)
    if role == "agent":
        department_ids = list(user.department.values_list("id", flat=True))
        if not department_ids:
            queryset = queryset.none()
        else:
            queryset = queryset.filter(ticket__department_id__in=department_ids)

    points: list[dict[str, int | str]] = []
    for bucket in _bucket_ranges(window):
        start = bucket["start"]
        end = bucket["end"]
        points.append(
            {
                "label": bucket["label"],
                "value": queryset.filter(created_at__gte=start, created_at__lt=end).count(),
            }
        )
    return points


def _csat_points(queryset: QuerySet[Ticket], window: DashboardWindow) -> list[dict[str, float | str]]:
    points: list[dict[str, float | str]] = []
    for bucket in _bucket_ranges(window):
        start = bucket["start"]
        end = bucket["end"]
        average = queryset.filter(
            resolved_at__gte=start,
            resolved_at__lt=end,
            csat_score__isnull=False,
        ).aggregate(avg=Avg("csat_score"))["avg"]
        points.append(
            {
                "label": bucket["label"],
                "value": round(float(average), 1) if average is not None else 0.0,
            }
        )
    return points


def _group_counts_by_department(
    queryset: QuerySet[Ticket],
    *,
    include_no_department: bool = True,
) -> list[dict[str, int | str | None]]:
    rows = list(
        queryset.exclude(department__isnull=True)
        .values("department_id", "department__name")
        .annotate(value=Count("id"))
        .order_by("-value", "department__name")
    )
    items = [
        {
            "label": row["department__name"],
            "value": row["value"],
            "department_id": row["department_id"],
        }
        for row in rows
    ]

    if include_no_department:
        no_department_count = queryset.filter(department__isnull=True).count()
        if no_department_count > 0:
            items.append(
                {
                    "label": "No department",
                    "value": no_department_count,
                    "department_id": None,
                }
            )

    return items


def _workload_status_counts(queryset: QuerySet[Ticket]) -> list[dict[str, int | str]]:
    counts = queryset.values("status").annotate(value=Count("id")).order_by("status")
    ordered_statuses = ["open", "pending", "in_progress", "on_hold", "resolved", "closed"]
    value_map = {row["status"]: row["value"] for row in counts}
    return [
        {"label": status.replace("_", " ").title(), "value": value_map.get(status, 0)}
        for status in ordered_statuses
        if value_map.get(status, 0) > 0 or status in {"open", "pending", "in_progress", "resolved"}
    ]


def _mailbox_health(user: Users) -> dict:
    integrations = MailIntegration.objects.for_business(user)
    summary = {
        "connected": integrations.filter(connection_status=MailIntegration.ConnectionStatus.CONNECTED).count(),
        "error": integrations.filter(connection_status=MailIntegration.ConnectionStatus.ERROR).count(),
        "disconnected": integrations.filter(connection_status=MailIntegration.ConnectionStatus.DISCONNECTED).count(),
    }

    items = []
    for integration in integrations.select_related("department").order_by("department__name", "email_address")[:6]:
        detail = (
            integration.connection_status_detail
            or integration.last_error_message
            or ("Healthy" if integration.connection_status == MailIntegration.ConnectionStatus.CONNECTED else "Needs attention")
        )
        items.append(
            {
                "id": integration.id,
                "label": integration.display_name or integration.email_address or integration.provider.title(),
                "department": integration.department.name if integration.department else None,
                "status": integration.connection_status,
                "detail": detail,
                "last_success_at": integration.last_success_at.isoformat() if integration.last_success_at else None,
                "last_error_at": integration.last_error_at.isoformat() if integration.last_error_at else None,
            }
        )

    return {
        **summary,
        "total": sum(summary.values()),
        "integrations": items,
    }


def _operational_blockers(backlog_queryset: QuerySet[Ticket], user: Users) -> list[dict]:
    failed_mail_sync = MailIntegration.objects.for_business(user).filter(
        connection_status=MailIntegration.ConnectionStatus.ERROR
    ).count()

    blockers = [
        {
            "key": "no_assignee",
            "label": "No assignee",
            "count": backlog_queryset.filter(assigned_to__isnull=True).count(),
            "tone": "warning",
            "description": "Backlog tickets still waiting for ownership.",
        },
        {
            "key": "no_department",
            "label": "No department",
            "count": backlog_queryset.filter(department__isnull=True).count(),
            "tone": "danger",
            "description": "Tickets without department routing.",
        },
        {
            "key": "no_category",
            "label": "No category",
            "count": backlog_queryset.filter(category__isnull=True).count(),
            "tone": "warning",
            "description": "Tickets missing categorization.",
        },
        {
            "key": "no_sla",
            "label": "No SLA",
            "count": backlog_queryset.filter(sla__isnull=True).count(),
            "tone": "neutral",
            "description": "Backlog tickets outside any SLA policy.",
        },
        {
            "key": "failed_mail_sync",
            "label": "Failed mail sync",
            "count": failed_mail_sync,
            "tone": "danger",
            "description": "Mailbox integrations reporting an error state.",
        },
    ]
    return blockers


def _top_slow_queues(queryset: QuerySet[Ticket]) -> list[dict]:
    resolved = queryset.filter(resolved_at__isnull=False, category__isnull=False).select_related("category")
    grouped: dict[int, dict[str, int | str | list[float]]] = {}
    for ticket in resolved:
        if not ticket.resolved_at or not ticket.category_id or not ticket.category:
            continue
        hours = (ticket.resolved_at - ticket.created_at).total_seconds() / 3600
        entry = grouped.setdefault(
            ticket.category_id,
            {
                "label": ticket.category.name,
                "category_id": ticket.category_id,
                "values": [],
            },
        )
        entry["values"].append(hours)

    rows = []
    for entry in grouped.values():
        values = entry["values"]
        if not values:
            continue
        rows.append(
            {
                "label": entry["label"],
                "category_id": entry["category_id"],
                "value": round(sum(values) / len(values), 1),
                "volume": len(values),
            }
        )
    rows.sort(key=lambda item: item["value"], reverse=True)
    return rows[:5]


def _team_workload(queryset: QuerySet[Ticket]) -> list[dict]:
    rows = (
        queryset.filter(assigned_to__isnull=False)
        .values("assigned_to_id", "assigned_to__first_name", "assigned_to__last_name", "status")
        .annotate(value=Count("id"))
        .order_by("assigned_to__first_name", "assigned_to__last_name")
    )

    grouped: dict[int, dict] = {}
    for row in rows:
        agent_id = row["assigned_to_id"]
        agent_name = " ".join(filter(None, [row["assigned_to__first_name"], row["assigned_to__last_name"]])).strip() or "Unknown"
        entry = grouped.setdefault(
            agent_id,
            {"label": agent_name, "open": 0, "pending": 0, "in_progress": 0, "resolved": 0},
        )
        status = row["status"]
        if status == "pending":
            entry["pending"] += row["value"]
        elif status == "in_progress":
            entry["in_progress"] += row["value"]
        elif status in CLOSED_STATUSES:
            entry["resolved"] += row["value"]
        else:
            entry["open"] += row["value"]

    return sorted(grouped.values(), key=lambda item: item["label"])[:8]


def _workload_distribution(queryset: QuerySet[Ticket]) -> list[dict]:
    rows = (
        queryset.filter(assigned_to__isnull=False)
        .exclude(department__isnull=True)
        .values("department__name")
        .annotate(value=Count("id"))
        .order_by("-value", "department__name")
    )
    return [{"label": row["department__name"], "value": row["value"]} for row in rows[:6]]


def _department_heatmap(queryset: QuerySet[Ticket], departments: Iterable[Department]) -> list[dict]:
    rows = []
    for department in departments:
        department_queryset = queryset.filter(department=department)
        rows.append(
            {
                "label": department.name,
                "open": department_queryset.filter(status="open").count(),
                "pending": department_queryset.filter(status="pending").count(),
                "unassigned": department_queryset.filter(assigned_to__isnull=True).exclude(status__in=CLOSED_STATUSES).count(),
                "breached": _count_sla_breached(department_queryset),
            }
        )
    return rows[:8]


def _summary_metric(key: str, label: str, value: int | float, tone: str, subtitle: str) -> dict:
    return {
        "key": key,
        "label": label,
        "value": value,
        "tone": tone,
        "subtitle": subtitle,
    }


def _with_metric_trend(metric: dict, series: list[int | float], *, trend_label: str = "vs period start") -> dict:
    metric.update(_series_meta(series, trend_label=trend_label))
    return metric


def _at_risk_agents(scoped_tickets: QuerySet[Ticket]) -> list[dict]:
    open_tickets = list(
        _backlog_queryset(scoped_tickets)
        .filter(assigned_to__isnull=False)
        .select_related("assigned_to", "department")
        .order_by("assigned_to_id", "created_at")
    )
    if not open_tickets:
        return []

    grouped: dict[int, dict] = {}
    for ticket in open_tickets:
        if not ticket.assigned_to_id or not ticket.assigned_to:
            continue
        entry = grouped.setdefault(
            ticket.assigned_to_id,
            {
                "agent_id": ticket.assigned_to_id,
                "name": ticket.assigned_to.full_name().strip() or ticket.assigned_to.email,
                "department_names": [],
                "open_tickets": 0,
                "breached_tickets": 0,
                "age_hours_total": 0.0,
            },
        )
        entry["open_tickets"] += 1
        entry["age_hours_total"] += (timezone.now() - ticket.created_at).total_seconds() / 3600
        if ticket.is_sla_breached:
            entry["breached_tickets"] += 1
        if ticket.department:
            entry["department_names"].append(ticket.department.name)

    average_open = sum(entry["open_tickets"] for entry in grouped.values()) / max(len(grouped), 1)

    rows: list[dict] = []
    for agent_id, entry in grouped.items():
        agent_queryset = scoped_tickets.filter(assigned_to_id=agent_id)
        avg_age = round(entry["age_hours_total"] / max(entry["open_tickets"], 1), 1)
        sla_compliance = _compute_sla_compliance(agent_queryset)
        departments = Counter(entry["department_names"])
        primary_department = departments.most_common(1)[0][0] if departments else "Shared queue"

        if entry["breached_tickets"] > 0 and entry["open_tickets"] > average_open:
            risk_level = "At Risk"
            tone = "danger"
        elif entry["open_tickets"] > average_open * 1.3:
            risk_level = "Overloaded"
            tone = "warning"
        else:
            risk_level = "Stable"
            tone = "success"

        rows.append(
            {
                "agent_id": agent_id,
                "name": entry["name"],
                "department": primary_department,
                "status": risk_level,
                "tone": tone,
                "open_tickets": entry["open_tickets"],
                "breached_tickets": entry["breached_tickets"],
                "avg_age_hours": avg_age,
                "sla_compliance_pct": sla_compliance,
            }
        )

    rows.sort(key=lambda item: (item["tone"] != "danger", item["tone"] != "warning", -item["breached_tickets"], -item["open_tickets"]))
    return rows[:4]


def _build_admin_dashboard(
    user: Users,
    scoped_tickets: QuerySet[Ticket],
    period_scoped_tickets: QuerySet[Ticket],
    resolved_in_window: QuerySet[Ticket],
    window: DashboardWindow,
) -> dict:
    backlog_queryset = _backlog_queryset(period_scoped_tickets)
    unassigned_queryset = backlog_queryset.filter(assigned_to__isnull=True)
    breached_queryset = _sla_breached_queryset(period_scoped_tickets)
    blockers = _operational_blockers(backlog_queryset, user)
    visible_departments = list(_visible_departments(user, "admin"))
    created_vs_resolved = _created_vs_resolved_points(scoped_tickets, window)
    backlog_series = _count_series(backlog_queryset, window)
    unassigned_series = _count_series(unassigned_queryset, window)
    breached_series = _count_series(breached_queryset, window)
    sla_compliance_series = _sla_compliance_series(period_scoped_tickets, window)

    return {
        "summary": [
            _with_metric_trend(
                _summary_metric("backlog", "Total Backlog", backlog_queryset.count(), "success", "Active tickets still in queue."),
                backlog_series,
            ),
            _with_metric_trend(
                _summary_metric("unassigned_tickets", "Unassigned Tickets", unassigned_queryset.count(), "info", "Tickets waiting for ownership."),
                unassigned_series,
            ),
            _with_metric_trend(
                _summary_metric("breached", "SLA Breached", breached_queryset.count(), "warning", "Tickets currently outside SLA."),
                breached_series,
            ),
            _with_metric_trend(
                _summary_metric(
                    "sla_compliance_pct",
                    "SLA Compliance %",
                    _compute_sla_compliance(period_scoped_tickets),
                    "info",
                    "Share of tracked tickets still within SLA.",
                ),
                sla_compliance_series,
            ),
        ],
        "created_vs_resolved": created_vs_resolved,
        "team_workload": _team_workload(backlog_queryset),
        "workload_distribution": _workload_distribution(backlog_queryset),
        "unassigned_by_department": _group_counts_by_department(unassigned_queryset),
        "breached_by_department": _group_counts_by_department(breached_queryset),
        "department_heatmap": _department_heatmap(backlog_queryset, visible_departments),
        "mailbox_health": _mailbox_health(user),
        "operational_blockers": blockers,
        "csat_trend": _csat_points(scoped_tickets, window),
        "reopened_trend": _reopened_points(user, "admin", window),
        "top_slow_queues": _top_slow_queues(resolved_in_window),
        "risk_agents": _at_risk_agents(period_scoped_tickets),
    }


def _build_agent_dashboard(
    user: Users,
    scoped_tickets: QuerySet[Ticket],
    period_scoped_tickets: QuerySet[Ticket],
    window: DashboardWindow,
) -> dict:
    assigned_queryset = scoped_tickets.filter(assigned_to=user)
    period_assigned_queryset = period_scoped_tickets.filter(assigned_to=user)
    assigned_backlog = _backlog_queryset(period_assigned_queryset)
    department_backlog = _backlog_queryset(period_scoped_tickets)
    breached_assigned_queryset = _sla_breached_queryset(period_assigned_queryset)

    queue_trend = []
    for bucket in _bucket_ranges(window):
        start = bucket["start"]
        end = bucket["end"]
        queue_trend.append(
            {
                "label": bucket["label"],
                "assigned": assigned_queryset.filter(created_at__gte=start, created_at__lt=end).count(),
                "resolved": assigned_queryset.filter(
                    resolved_at__gte=start,
                    resolved_at__lt=end,
                ).count(),
            }
        )

    now = timezone.now()
    due_today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    due_today_end = due_today_start + timedelta(days=1)

    oldest_tickets = []
    for ticket in assigned_backlog.select_related("department").order_by("created_at")[:5]:
        oldest_tickets.append(
            {
                "id": ticket.id,
                "ticket_id": ticket.ticket_id,
                "title": ticket.title,
                "status": ticket.status,
                "department": ticket.department.name if ticket.department else None,
                "due_date": ticket.due_date.isoformat() if ticket.due_date else None,
                "age_hours": round((now - ticket.created_at).total_seconds() / 3600, 1),
                "is_breached": ticket.is_sla_breached,
            }
        )

    my_open_series = _count_series(assigned_backlog, window)
    due_today_series = _count_series(
        assigned_backlog.filter(due_date__isnull=False),
        window,
        field_name="due_date",
    )
    breached_series = _count_series(breached_assigned_queryset, window)
    resolved_series = _count_series(
        assigned_queryset.filter(resolved_at__isnull=False),
        window,
        field_name="resolved_at",
    )

    return {
        "summary": [
            _with_metric_trend(
                _summary_metric("my_open_tickets", "My Open Tickets", assigned_backlog.count(), "info", "Tickets currently assigned to you."),
                my_open_series,
            ),
            _with_metric_trend(
                _summary_metric(
                    "due_today",
                    "Due Today",
                    assigned_backlog.filter(due_date__gte=due_today_start, due_date__lt=due_today_end).count(),
                    "info",
                    "Assigned work that needs attention today.",
                ),
                due_today_series,
            ),
            _with_metric_trend(
                _summary_metric(
                    "sla_at_risk",
                    "SLA At Risk",
                    breached_assigned_queryset.count(),
                    "warning",
                    "Assigned tickets already outside SLA.",
                ),
                breached_series,
            ),
            _with_metric_trend(
                _summary_metric(
                    "resolved_today",
                    "Resolved Today",
                    assigned_queryset.filter(resolved_at__gte=due_today_start, resolved_at__lt=due_today_end).count(),
                    "success",
                    "Tickets you closed out today.",
                ),
                resolved_series,
            ),
        ],
        "queue_trend": queue_trend,
        "workload_breakdown": _workload_status_counts(period_assigned_queryset),
        "unassigned_by_department": _group_counts_by_department(department_backlog.filter(assigned_to__isnull=True)),
        "breached_by_department": _group_counts_by_department(_sla_breached_queryset(period_scoped_tickets)),
        "oldest_assigned_tickets": oldest_tickets,
    }
