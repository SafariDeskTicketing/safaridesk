from __future__ import annotations

from typing import Any, Dict, List

from django.shortcuts import get_object_or_404

from tenant.models import Label, Ticket
from tenant.serializers.LabelSerializer import LabelSerializer
from tenant.services.labels import sync_legacy_tag_field
from tenant.services.tickets.errors import TicketActionError
from users.models import Users


def _serialize_labels(labels_queryset):
    return LabelSerializer(labels_queryset.order_by("name"), many=True).data


def _set_ticket_labels(instance, labels):
    instance.labels.set(labels)
    sync_legacy_tag_field(instance)
    instance.save(update_fields=["tags", "updated_at", "updated_by"])
    return labels


def _get_active_business_labels(user: Users, label_ids: List[int]):
    if not label_ids:
        return []

    labels = list(
        Label.objects.for_business(user)
        .filter(id__in=label_ids, is_active=True)
        .order_by("name")
    )
    if len(labels) != len(set(label_ids)):
        raise ValueError("One or more labels are invalid or inactive.")
    return labels


def _get_existing_business_labels_by_names(user: Users, label_names: List[str]):
    cleaned_names = []
    seen = set()
    for raw_name in label_names:
        if not isinstance(raw_name, str):
            continue

        cleaned = raw_name.strip()
        if not cleaned:
            continue

        lowered = cleaned.lower()
        if lowered in seen:
            continue

        seen.add(lowered)
        cleaned_names.append(cleaned)

    if not cleaned_names:
        return []

    labels = []
    missing_names = []
    for name in cleaned_names:
        label = (
            Label.objects.for_business(user)
            .filter(name__iexact=name, is_active=True)
            .first()
        )
        if not label:
            missing_names.append(name)
            continue
        labels.append(label)

    if missing_names:
        missing = ", ".join(missing_names)
        raise ValueError(f"These labels do not exist or are inactive: {missing}")

    return labels


def _assign_labels_by_ids(instance, user: Users, label_ids: List[int]):
    labels = _get_active_business_labels(user, label_ids)
    return _set_ticket_labels(instance, labels)


def _assign_existing_labels_by_names(instance, user: Users, label_names: List[str]):
    labels = _get_existing_business_labels_by_names(user, label_names)
    return _set_ticket_labels(instance, labels)


def add_ticket_tags(*, ticket_id, data: Dict[str, Any], user: Users) -> Dict[str, Any]:
    tags = data.get("tags", [])

    if not isinstance(tags, list):
        raise TicketActionError(
            {"message": "Tags must be a list of strings."}, 400
        )

    ticket = get_object_or_404(Ticket, id=ticket_id, business=user.business)
    if ticket.status == 'closed':
        raise TicketActionError(
            {"message": "Cannot add tags to a closed ticket."}, 400
        )

    existing_tags = list(ticket.labels.order_by("name").values_list("name", flat=True))
    assigned_labels = _assign_existing_labels_by_names(ticket, user, tags)
    final_tags = [label.name for label in assigned_labels]

    # Log activity for each new tag added
    from tenant.models import TicketActivity
    newly_added = [tag for tag in final_tags if tag not in existing_tags]
    for tag in newly_added:
        TicketActivity.objects.create(
            ticket=ticket,
            user=user,
            activity_type='tag_added',
            description=f"Tag Added\n{user.get_full_name()} added tag '{tag}'",
            old_value='',
            new_value=tag
        )

    return {
        "message": "Tags update completed.",
        "labels": _serialize_labels(ticket.labels.all()),
    }


def update_labels(*, ticket_id, label_ids: List[int], user: Users) -> Dict[str, Any]:
    ticket = get_object_or_404(Ticket, id=ticket_id, business=user.business)
    if ticket.status == 'closed':
        raise TicketActionError(
            {"message": "Cannot update labels on a closed ticket."}, 400
        )

        # NOTE (pre-existing bug, left as found): these two lines are unreachable
        # dead code in the original TicketView.update_labels — they sit indented
        # under the `if ticket.status == 'closed':` block, after the `return`
        # above, so they never execute and `actor_user`/`is_customer_session`
        # are never used. Preserved verbatim per refactor scope (no logic fixes).
        actor_user = None
        is_customer_session = actor_user is None
    old_label_names = set(ticket.labels.values_list("name", flat=True))

    try:
        assigned = _assign_labels_by_ids(ticket, user, label_ids)
    except ValueError as exc:
        raise TicketActionError({"message": str(exc)}, 400)

    new_label_names = {label.name for label in assigned}
    added = new_label_names - old_label_names
    removed = old_label_names - new_label_names

    from tenant.models import TicketActivity
    actor = user
    if added:
        TicketActivity.objects.create(
            ticket=ticket,
            user=actor,
            activity_type='label_added',
            description=f"{actor.get_full_name()} added label(s): {', '.join(sorted(added))}",
            old_value='',
            new_value=', '.join(sorted(added)),
        )
    if removed:
        TicketActivity.objects.create(
            ticket=ticket,
            user=actor,
            activity_type='label_removed',
            description=f"{actor.get_full_name()} removed label(s): {', '.join(sorted(removed))}",
            old_value=', '.join(sorted(removed)),
            new_value='',
        )

    return {
        "message": "Labels updated successfully.",
        "labels": _serialize_labels(ticket.labels.all()),
    }


def get_tags(*, ticket_id, user: Users) -> Dict[str, Any]:
    ticket = get_object_or_404(Ticket, id=ticket_id, business=user.business)
    tags = list(ticket.labels.order_by("name").values_list("name", flat=True))

    return {
        "tags": tags,
        "labels": _serialize_labels(ticket.labels.all()),
    }
