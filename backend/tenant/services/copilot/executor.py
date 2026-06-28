from __future__ import annotations

from datetime import datetime, time
from typing import Any, Callable

from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from tenant.models import TicketActivity, TicketCategories
from tenant.models.DepartmentModel import Department
from tenant.models.TaskModel import Task, TaskActivity
from tenant.models.TicketModel import TicketComment, TicketReopen
from tenant.services.tickets.reference_resolver import resolve_label_names
from users.models import Users
from util.Helper import Helper


ToolHandler = Callable[..., dict[str, Any] | None]


class CopilotToolExecutor:
    def __init__(self) -> None:
        self.update_registry: dict[str, ToolHandler] = {
            "priority": self._apply_priority_update,
            "status": self._apply_status_update,
            "category_id": self._apply_category_update,
            "assignee_id": self._apply_assignee_update,
            "department_id": self._apply_department_update,
            "tags": self._apply_tags_update,
        }
        self.action_registry: dict[str, ToolHandler] = {
            "create_follow_up_task": self._create_follow_up_task,
            "close_ticket": self._close_ticket,
            "reopen_ticket": self._reopen_ticket,
        }

    def assert_execution_scope(self, *, user, suggestion) -> None:
        ticket = suggestion.ticket
        if not ticket:
            raise ValueError("Suggestion is not linked to a ticket.")
        if suggestion.business_id != user.business_id or ticket.business_id != user.business_id:
            raise ValueError("Copilot execution scope is invalid for this business.")
        if suggestion.requested_by_id and suggestion.requested_by.business_id != user.business_id:
            raise ValueError("Copilot requester scope is invalid for this business.")

    def execute(self, *, user, suggestion) -> dict[str, Any]:
        ticket = suggestion.ticket
        if not ticket:
            return {}

        payload = suggestion.payload or {}
        updates = dict(payload.get("suggested_updates") or {})
        recommended_actions = [item for item in (payload.get("recommended_actions") or []) if isinstance(item, dict)]
        action_types = {
            str(action.get("type") or "").strip()
            for action in recommended_actions
            if action.get("type")
        }
        applied: dict[str, Any] = {}

        for key, handler in self.update_registry.items():
            if key not in updates:
                continue
            value = updates.get(key)
            if value in (None, "", []):
                continue
            result = handler(
                user=user,
                ticket=ticket,
                suggestion=suggestion,
                value=value,
                updates=updates,
                action_types=action_types,
            )
            if result:
                applied.update(result)

        ticket.updated_by = user
        ticket.updated_at = timezone.now()
        ticket.save()

        executed_actions: list[dict[str, Any]] = []
        for action in recommended_actions:
            action_type = str(action.get("type") or "").strip()
            handler = self.action_registry.get(action_type)
            if not handler:
                continue

            result = handler(
                user=user,
                ticket=ticket,
                suggestion=suggestion,
                action=action,
                updates=updates,
                action_types=action_types,
            )
            if result:
                executed_actions.append(result)

        if executed_actions:
            applied["recommended_actions"] = executed_actions

        return applied

    def _apply_priority_update(
        self,
        *,
        user,
        ticket,
        value: str,
        **_: Any,
    ) -> dict[str, Any] | None:
        new_priority = str(value).strip()
        if not new_priority or new_priority == ticket.priority:
            return None

        old_priority = ticket.priority
        ticket.priority = new_priority
        TicketActivity.objects.create(
            business=user.business,
            ticket=ticket,
            user=user,
            activity_type="priority_changed",
            description=f"Copilot updated priority from {old_priority} to {ticket.priority}",
            old_value=old_priority or "",
            new_value=ticket.priority or "",
        )
        return {"priority": new_priority}

    def _apply_status_update(
        self,
        *,
        user,
        ticket,
        value: str,
        action_types: set[str],
        **_: Any,
    ) -> dict[str, Any] | None:
        new_status = str(value).strip()
        if not new_status or new_status == ticket.status:
            return None

        if not (
            (new_status in {"closed", "resolved"} and "close_ticket" in action_types)
            or (ticket.status in {"closed", "resolved"} and new_status == "open" and "reopen_ticket" in action_types)
        ):
            self._apply_status_change(ticket=ticket, user=user, new_status=new_status)
            return {"status": new_status}

        return None

    def _apply_category_update(
        self,
        *,
        user,
        ticket,
        value: int,
        **_: Any,
    ) -> dict[str, Any] | None:
        category = TicketCategories.objects.filter(id=value, business=user.business, is_active=True).first()
        if not category or ticket.category_id == category.id:
            return None

        old_category = ticket.category.name if ticket.category else ""
        ticket.category = category
        TicketActivity.objects.create(
            business=user.business,
            ticket=ticket,
            user=user,
            activity_type="updated",
            description=f"Copilot updated category from {old_category or 'None'} to {category.name}",
            old_value=old_category,
            new_value=category.name,
        )
        return {"category_id": category.id}

    def _apply_assignee_update(
        self,
        *,
        user,
        ticket,
        value: int,
        **_: Any,
    ) -> dict[str, Any] | None:
        assignee = Users.objects.filter(id=value, business=user.business, is_active=True).first()
        if not assignee or ticket.assigned_to_id == assignee.id:
            return None

        old_assignee = ticket.assigned_to.full_name() if ticket.assigned_to else ""
        ticket.assigned_to = assignee
        TicketActivity.objects.create(
            business=user.business,
            ticket=ticket,
            user=user,
            activity_type="assigned",
            description=f"Copilot assigned ticket to {assignee.full_name()}",
            old_value=old_assignee,
            new_value=assignee.full_name(),
        )
        return {"assignee_id": assignee.id}

    def _apply_department_update(
        self,
        *,
        user,
        ticket,
        value: int,
        **_: Any,
    ) -> dict[str, Any] | None:
        department = Department.objects.filter(id=value, business=user.business).first()
        if not department or ticket.department_id == department.id:
            return None

        old_department = ticket.department.name if ticket.department else "None"
        ticket.department = department
        TicketActivity.objects.create(
            business=user.business,
            ticket=ticket,
            user=user,
            activity_type="department_changed",
            description=f"Ticket department changed from {old_department} to {department.name}",
            old_value=old_department,
            new_value=department.name,
        )
        return {"department_id": department.id}

    def _apply_tags_update(
        self,
        *,
        user,
        ticket,
        value: list[str],
        **_: Any,
    ) -> dict[str, Any] | None:
        label_resolution = resolve_label_names(user.business_id, value or [])
        labels = label_resolution["labels"]
        if not labels:
            return None

        tags = label_resolution["names"]
        ticket.tags = ", ".join(tags)
        ticket.save(update_fields=["tags"])
        ticket.labels.set(labels)

        return {"tags": tags, "label_ids": label_resolution["ids"]}

    def _apply_status_change(self, *, ticket, user, new_status: str) -> None:
        if not new_status or new_status == ticket.status:
            return

        old_status = ticket.status
        if old_status == "closed" and new_status != "closed":
            raise ValueError("Cannot modify a closed ticket. Reopen it first.")

        if new_status in {"closed", "resolved"}:
            incomplete_tasks = Task.objects.filter(
                linked_ticket=ticket,
                is_archived=False,
                is_deleted=False,
            ).exclude(task_status__in=["completed", "cancelled"])
            if incomplete_tasks.exists():
                incomplete_count = incomplete_tasks.count()
                raise ValueError(
                    f"Cannot close ticket. There {'is' if incomplete_count == 1 else 'are'} "
                    f"{incomplete_count} incomplete task{'s' if incomplete_count != 1 else ''} linked to this ticket."
                )

        if new_status == "resolved" and old_status != "resolved":
            ticket.resolved_at = timezone.now()
        elif new_status not in {"resolved", "closed"}:
            ticket.resolved_at = None

        ticket.status = new_status
        TicketActivity.objects.create(
            business=user.business,
            ticket=ticket,
            user=user,
            activity_type="status_changed",
            description=f"Copilot updated status from {old_status} to {new_status}",
            old_value=old_status or "",
            new_value=new_status or "",
        )

    def _create_follow_up_task(
        self,
        *,
        user,
        ticket,
        action: dict[str, Any],
        **_: Any,
    ) -> dict[str, Any]:
        task_payload = dict(action.get("task") or {})
        title = str(task_payload.get("title") or "").strip()
        if not title:
            raise ValueError("Follow-up task suggestions must include a title.")

        department_id = task_payload.get("department_id") or ticket.department_id
        department = None
        if department_id:
            department = Department.objects.filter(id=department_id, business=user.business).first()
            if not department:
                raise ValueError("Suggested follow-up task department was not found.")

        assignee_id = task_payload.get("assignee_id")
        assignee = None
        if assignee_id:
            assignee = Users.objects.filter(id=assignee_id, business=user.business, is_active=True).first()
            if not assignee:
                raise ValueError("Suggested follow-up task assignee was not found.")

        due_date = self._normalize_due_date(task_payload.get("due_date"))
        task = Task.objects.create(
            business=user.business,
            created_by=user,
            updated_by=user,
            title=title,
            description=str(task_payload.get("description") or "").strip(),
            due_date=due_date,
            assigned_to=assignee,
            task_trackid=Helper().generate_task_code(business=user.business),
            department=department,
            priority=str(task_payload.get("priority") or ticket.priority or "medium"),
            linked_ticket=ticket if task_payload.get("link_to_ticket", True) else None,
        )

        TaskActivity.objects.create(
            business=user.business,
            task=task,
            user=user,
            activity_type="created",
            description=f"{user.full_name() or user.email} created the task",
            old_value="",
            new_value=task.task_status,
        )

        if task.linked_ticket:
            TaskActivity.objects.create(
                business=user.business,
                task=task,
                user=user,
                activity_type="attached_to_ticket",
                description=f"{user.full_name() or user.email} attached task to ticket #{ticket.ticket_id}",
                old_value="None",
                new_value=ticket.ticket_id,
            )
            TicketActivity.objects.create(
                business=user.business,
                ticket=ticket,
                user=user,
                activity_type="task_linked",
                description=f'Task "{task.title}" was linked to this ticket',
                old_value="",
                new_value=task.task_trackid or "",
            )

        return {
            "type": "create_follow_up_task",
            "task_id": task.id,
            "task_trackid": task.task_trackid,
            "title": task.title,
        }

    def _close_ticket(
        self,
        *,
        user,
        ticket,
        suggestion,
        action: dict[str, Any],
        **_: Any,
    ) -> dict[str, Any]:
        if ticket.status == "closed":
            return {"type": "close_ticket", "status": "closed"}

        if not ticket.assigned_to:
            raise ValueError("Please assign this ticket before changing its status. Use 'Assign to me' to take ownership.")

        incomplete_tasks = Task.objects.filter(
            linked_ticket=ticket,
            is_archived=False,
            is_deleted=False,
        ).exclude(task_status__in=["completed", "cancelled"])
        if incomplete_tasks.exists():
            incomplete_count = incomplete_tasks.count()
            raise ValueError(
                f"Cannot close ticket. There {'is' if incomplete_count == 1 else 'are'} "
                f"{incomplete_count} incomplete task{'s' if incomplete_count != 1 else ''} linked to this ticket."
            )

        old_status = ticket.status
        reason = str(action.get("reason") or suggestion.payload.get("summary") or "").strip()
        ticket.status = "closed"
        ticket.resolved_at = timezone.now()
        ticket.updated_at = timezone.now()
        ticket.updated_by = user
        ticket.save(update_fields=["status", "resolved_at", "updated_at", "updated_by"])

        TicketActivity.objects.create(
            business=user.business,
            ticket=ticket,
            user=user,
            activity_type="status_changed",
            description=f"Copilot closed the ticket. {reason}".strip(),
            old_value=old_status,
            new_value="closed",
        )
        return {"type": "close_ticket", "status": "closed"}

    def _reopen_ticket(
        self,
        *,
        user,
        ticket,
        suggestion,
        action: dict[str, Any],
        **_: Any,
    ) -> dict[str, Any]:
        if ticket.status not in {"closed", "resolved"}:
            raise ValueError("Only closed or resolved tickets can be reopened.")

        reason = str(action.get("reason") or suggestion.payload.get("summary") or "Copilot recommended reopening this ticket.").strip()
        old_status = ticket.status
        ticket.status = "open"
        ticket.resolved_at = None
        ticket.updated_at = timezone.now()
        ticket.updated_by = user
        ticket.save(update_fields=["status", "resolved_at", "updated_at", "updated_by"])

        TicketReopen.objects.create(
            business=user.business,
            ticket=ticket,
            reopened_by=user,
            reason=reason,
        )
        TicketComment.objects.create(
            business=user.business,
            ticket=ticket,
            author=user,
            content=f"**Ticket Reopened**\n\nReason: {reason}",
            is_internal=False,
        )
        TicketActivity.objects.create(
            business=user.business,
            ticket=ticket,
            user=user,
            activity_type="status_changed",
            description=f"Ticket has been reopened by {user.get_full_name() or user.email}\nReason: {reason}",
            old_value=old_status,
            new_value="open",
        )

        return {"type": "reopen_ticket", "status": "open"}

    @staticmethod
    def _normalize_due_date(raw_value: Any) -> datetime | None:
        if raw_value in (None, ""):
            return None

        value = str(raw_value).strip()
        if not value:
            return None

        due_date = parse_datetime(value.replace("Z", "+00:00"))
        if due_date is None:
            parsed_date = parse_date(value)
            if parsed_date is not None:
                due_date = datetime.combine(parsed_date, time.min)

        if due_date is None:
            return None

        if timezone.is_naive(due_date):
            due_date = timezone.make_aware(due_date, timezone.get_current_timezone())

        return due_date
