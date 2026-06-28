from __future__ import annotations

from typing import Any

from django.db.models import Q

from tenant.models import Department, Label, TicketCategories
from users.models import Users


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _int_or_none(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _user_label(user: Users) -> str:
    return user.full_name().strip() or user.email


def get_ticket_reference_options(business_id: int) -> dict[str, list[dict[str, Any]]]:
    """Return AI-safe ticket references scoped to one business."""
    departments = Department.objects.filter(business_id=business_id).order_by("name", "id")
    categories = TicketCategories.objects.filter(
        business_id=business_id,
        is_active=True,
    ).order_by("name", "id")
    labels = Label.objects.filter(
        business_id=business_id,
        is_active=True,
    ).order_by("name", "id")
    assignees = Users.objects.filter(
        business_id=business_id,
        is_active=True,
    ).order_by("first_name", "last_name", "email", "id")

    return {
        "departments": [{"id": item.id, "name": item.name} for item in departments],
        "categories": [{"id": item.id, "name": item.name} for item in categories],
        "labels": [{"id": item.id, "name": item.name} for item in labels],
        "assignees": [{"id": item.id, "name": _user_label(item), "email": item.email} for item in assignees],
    }


def resolve_category(business_id: int, raw_value: Any) -> dict[str, Any] | None:
    value = _clean(raw_value)
    if not value:
        return None

    query = TicketCategories.objects.filter(business_id=business_id, is_active=True)
    value_id = _int_or_none(value)
    category = query.filter(id=value_id).first() if value_id is not None else query.filter(name__iexact=value).first()
    if not category and value:
        category = query.filter(name__icontains=value).order_by("name", "id").first()
    if not category:
        return None
    return {"id": category.id, "label": category.name}


def resolve_department(business_id: int, raw_value: Any) -> dict[str, Any] | None:
    value = _clean(raw_value)
    if not value:
        return None

    query = Department.objects.filter(business_id=business_id)
    value_id = _int_or_none(value)
    department = query.filter(id=value_id).first() if value_id is not None else query.filter(name__iexact=value).first()
    if not department and value:
        department = query.filter(name__icontains=value).order_by("name", "id").first()
    if not department:
        return None
    return {"id": department.id, "label": department.name}


def resolve_assignee(business_id: int, raw_value: Any) -> dict[str, Any] | None:
    value = _clean(raw_value)
    if not value:
        return None

    query = Users.objects.filter(business_id=business_id, is_active=True)
    value_id = _int_or_none(value)
    assignee = query.filter(id=value_id).first() if value_id is not None else None
    if not assignee:
        assignee = query.filter(email__iexact=value).first()
    if not assignee:
        assignee = query.filter(first_name__iexact=value).first()
    if not assignee:
        assignee = query.filter(last_name__iexact=value).first()
    if not assignee:
        names = value.split()
        if len(names) >= 2:
            assignee = query.filter(first_name__iexact=names[0], last_name__iexact=names[-1]).first()
    if not assignee and value:
        assignee = query.filter(
            Q(first_name__icontains=value) | Q(last_name__icontains=value) | Q(email__icontains=value)
        ).order_by("first_name", "last_name", "email", "id").first()
    if not assignee:
        return None
    return {"id": assignee.id, "label": _user_label(assignee)}


def resolve_label_ids(business_id: int, raw_values: Any) -> dict[str, Any]:
    if raw_values in (None, ""):
        raw_values = []
    if not isinstance(raw_values, list):
        raw_values = [raw_values]

    requested_ids: list[int] = []
    invalid_values: list[Any] = []
    for raw_value in raw_values:
        value_id = _int_or_none(raw_value)
        if value_id is None:
            invalid_values.append(raw_value)
            continue
        requested_ids.append(value_id)

    labels = list(
        Label.objects.filter(
            business_id=business_id,
            is_active=True,
            id__in=requested_ids,
        ).order_by("name", "id")
    )
    found_ids = {label.id for label in labels}
    invalid_values.extend([value_id for value_id in requested_ids if value_id not in found_ids])

    return {
        "labels": labels,
        "ids": [label.id for label in labels],
        "names": [label.name for label in labels],
        "invalid": invalid_values,
    }


def resolve_label_names(business_id: int, raw_values: Any) -> dict[str, Any]:
    if raw_values in (None, ""):
        raw_values = []
    if isinstance(raw_values, str):
        raw_values = [part.strip() for part in raw_values.split(",")]
    if not isinstance(raw_values, list):
        raw_values = [raw_values]

    requested_names = [_clean(value) for value in raw_values if _clean(value)]
    labels = list(Label.objects.filter(business_id=business_id, is_active=True))
    by_name = {label.name.strip().casefold(): label for label in labels}
    resolved = []
    invalid = []
    seen_ids: set[int] = set()

    for name in requested_names:
        label = by_name.get(name.casefold())
        if not label:
            invalid.append(name)
            continue
        if label.id in seen_ids:
            continue
        resolved.append(label)
        seen_ids.add(label.id)

    return {
        "labels": resolved,
        "ids": [label.id for label in resolved],
        "names": [label.name for label in resolved],
        "invalid": invalid,
    }
