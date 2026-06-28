from datetime import datetime, time

from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError

from tenant.models import TenantAuditLog
from tenant.serializers.AuditLogSerializer import TenantAuditLogSerializer
from tenant.services.audit import AUDIT_EVENT_TYPE_GROUPS

ALLOWED_ORDERING = {
    "timestamp",
    "-timestamp",
    "event_type",
    "-event_type",
    "entity_type",
    "-entity_type",
    "actor_name",
    "-actor_name",
    "ip_address",
    "-ip_address",
}


def _parse_audit_datetime(value: str | None, *, end_of_day: bool = False):
    raw_value = (value or "").strip()
    if not raw_value:
        return None

    parsed = parse_datetime(raw_value)
    if parsed is None:
        parsed_date = parse_date(raw_value)
        if parsed_date:
            parsed = datetime.combine(parsed_date, time.max if end_of_day else time.min)

    if parsed and timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


class TenantAuditLogPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class TenantAuditLogListView(ListAPIView):
    serializer_class = TenantAuditLogSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = TenantAuditLogPagination

    def _is_admin(self) -> bool:
        user = self.request.user
        role_name = getattr(getattr(user, "role", None), "name", "").lower()
        group_names = {g.name.lower() for g in user.groups.all()} if user.is_authenticated else set()
        return bool(getattr(user, "is_superuser", False) or role_name == "admin" or "admin" in group_names)

    def list(self, request, *args, **kwargs):
        if not self._is_admin():
            return Response({"detail": "Audit logs are available to admins only."}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        queryset = TenantAuditLog.objects.filter(business=self.request.user.business).select_related("actor")
        params = self.request.query_params

        search = (params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(activity__icontains=search)
                | Q(actor_name__icontains=search)
                | Q(actor_email__icontains=search)
                | Q(ip_address__icontains=search)
                | Q(entity_id__icontains=search)
                | Q(entity_label__icontains=search)
            )

        group = params.get("group")
        if group and group in AUDIT_EVENT_TYPE_GROUPS:
            queryset = queryset.filter(event_type__in=AUDIT_EVENT_TYPE_GROUPS[group])

        event_type = params.get("event_type")
        if event_type and event_type != "all":
            queryset = queryset.filter(event_type=event_type)

        entity_type = params.get("entity_type")
        if entity_type and entity_type != "all":
            queryset = queryset.filter(entity_type=entity_type)

        actor = params.get("actor")
        if actor and actor != "all":
            try:
                actor = int(actor)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"actor": "Actor filter must be a numeric user id."}) from exc
            queryset = queryset.filter(actor_id=actor)

        date_from = _parse_audit_datetime(params.get("date_from"))
        if date_from:
            queryset = queryset.filter(timestamp__gte=date_from)

        date_to = _parse_audit_datetime(params.get("date_to"), end_of_day=True)
        if date_to:
            queryset = queryset.filter(timestamp__lte=date_to)

        ordering = params.get("ordering") or "-timestamp"
        if ordering not in ALLOWED_ORDERING:
            ordering = "-timestamp"
        return queryset.order_by(ordering, "-id")
