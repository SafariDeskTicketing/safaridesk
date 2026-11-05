from __future__ import annotations

from typing import Any, Dict, List

from django.db.utils import IntegrityError
from django.shortcuts import get_object_or_404

from tenant.models import Ticket, TicketWatchers
from tenant.services.tickets.errors import TicketActionError
from users.models import Users


def add_ticket_watchers(*, ticket_id, data: Dict[str, Any], user: Users) -> Dict[str, Any]:
    user_ids = data.get("watchers", [])  # Expecting a list of user IDs

    if not isinstance(user_ids, list):
        raise TicketActionError(
            {"message": "ids must be a list of user IDs."}, 400
        )

    # NOTE (pre-existing behavior, preserved): no explicit business filter here,
    # matching the original TicketView.add_ticket_watchers. Ticket.objects is
    # tenant-scoped by default (see shared/models/BaseModel.py FilterManager).
    ticket = get_object_or_404(Ticket, id=ticket_id)
    if ticket.status == 'closed':
        raise TicketActionError(
            {"message": "Cannot add watchers to a closed ticket."}, 400
        )

    added: List[Any] = []
    skipped: List[Any] = []
    errors: List[Dict[str, Any]] = []

    for user_id in user_ids:
        try:
            watcher_user = Users.objects.filter(id=user_id, business=user.business).first()
            if watcher_user is None:
                errors.append({"id": user_id, "error": "User not found"})
                continue

            # Check if user is already a watcher
            if TicketWatchers.objects.filter(ticket=ticket, watcher=watcher_user).exists():
                skipped.append(user_id)
                continue

            # Create the watcher entry
            TicketWatchers.objects.create(ticket=ticket, watcher=watcher_user)
            added.append(user_id)

            # Log activity for watcher addition
            from tenant.models import TicketActivity
            TicketActivity.objects.create(
                ticket=ticket,
                user=user,
                activity_type='watcher_added',
                description=f"Watcher Added\n{user.get_full_name()} added {watcher_user.get_full_name()} as a watcher",
                old_value='',
                new_value=watcher_user.get_full_name()
            )

            # Notification is now handled by signals

        except Users.DoesNotExist:
            errors.append({"id": user_id, "error": "User not found"})
        except IntegrityError as e:
            errors.append({"id": user_id, "error": str(e)})
        except Exception as e:
            errors.append({"id": user_id, "error": str(e)})

    return {
        "message": "Watcher update completed.",
        "added": added,
        "skipped": skipped,
        "errors": errors,
    }


def get_watchers(*, ticket_id) -> List[Dict[str, Any]]:
    # NOTE (pre-existing bug, preserved): the original TicketView.get_watchers
    # was defined as `def get_watchers(request, *args, **kwargs):` with no
    # `self` parameter, so the bound instance (not the HTTP request) was
    # actually passed in as `request`. It happened to be harmless because the
    # body never used `request`/`self` for anything other than `kwargs['id']`.
    ticket = get_object_or_404(Ticket, id=ticket_id)
    watchers = TicketWatchers.objects.filter(ticket=ticket).select_related("watcher")
    watcher_list = [
        {
            "id": w.watcher.id,
            "name": w.watcher.full_name(),
            "email": w.watcher.email,
            "avatar_url": w.watcher.avatar_url,
            "is_active": w.watcher.is_active,
        }
        for w in watchers
    ]
    return watcher_list
