import logging
from collections import OrderedDict
from dataclasses import dataclass
from datetime import timedelta

from django.apps import apps
from django.contrib.sessions.models import Session
from django.core.exceptions import FieldDoesNotExist
from django.db import models, transaction
from django.db.models import Max, Q
from django.utils import timezone

logger = logging.getLogger(__name__)

INACTIVITY_DAYS = 30
SCRUBBED_VALUE = "[purged]"
SYSTEM_AUDIT_MODELS = {("users", "BusinessDeletionRequest")}
TENANT_IDENTITY_MODELS = {("users", "Users"), ("users", "Customer")}


class TenantPurgeError(Exception):
    """Raised when a tenant purge leaves tenant-owned data behind."""


@dataclass(frozen=True)
class TenantActivity:
    business_id: int
    last_activity_at: object
    source: str


def _business_model():
    return apps.get_model("users", "Business")


def _users_model():
    return apps.get_model("users", "Users")


def _customers_model():
    return apps.get_model("users", "Customer")


def _business_deletion_model():
    return apps.get_model("users", "BusinessDeletionRequest")


def _direct_business_fields():
    business_model = _business_model()
    for model in apps.get_models():
        if model._meta.abstract or model._meta.proxy or model._meta.auto_created:
            continue
        try:
            field = model._meta.get_field("business")
        except FieldDoesNotExist:
            continue
        if not getattr(field, "remote_field", None):
            continue
        if field.remote_field.model != business_model:
            continue
        yield model, field


def _model_label(model) -> str:
    return f"{model._meta.app_label}.{model.__name__}"


def _is_system_audit_model(model) -> bool:
    return (model._meta.app_label, model.__name__) in SYSTEM_AUDIT_MODELS


def _is_tenant_identity_model(model) -> bool:
    return (model._meta.app_label, model.__name__) in TENANT_IDENTITY_MODELS


def collect_tenant_resources(business_id: int) -> OrderedDict:
    """
    Count tenant-owned rows by model.

    The retained BusinessDeletionRequest shell is reported as audit_shell, not
    tenant_data, because it is scrubbed and kept as a platform audit record.
    """
    resources = OrderedDict()
    for model, _field in sorted(_direct_business_fields(), key=lambda item: _model_label(item[0])):
        count = model.objects.filter(business_id=business_id).count()
        if count:
            resources[_model_label(model)] = {
                "count": count,
                "kind": "audit_shell" if _is_system_audit_model(model) else "tenant_data",
            }

    user_count = _users_model().objects.filter(business_id=business_id).count()
    if user_count:
        resources["users.Users"] = {"count": user_count, "kind": "tenant_identity"}

    customer_count = _customers_model().objects.filter(business_id=business_id).count()
    if customer_count:
        resources["users.Customer"] = {"count": customer_count, "kind": "tenant_identity"}

    return resources


def _delete_tenant_sessions(user_ids: list[int], customer_ids: list[int]) -> int:
    if not user_ids and not customer_ids:
        return 0

    deleted = 0
    user_id_set = {str(user_id) for user_id in user_ids}
    customer_id_set = {str(customer_id) for customer_id in customer_ids}
    for session in Session.objects.all().only("session_key", "session_data"):
        try:
            data = session.get_decoded()
        except Exception:
            continue
        auth_user_id = str(data.get("_auth_user_id", ""))
        customer_id = str(data.get("customer_id", ""))
        if auth_user_id in user_id_set or customer_id in customer_id_set:
            session.delete()
            deleted += 1
    return deleted


def _delete_user_tokens(user_ids: list[int]) -> int:
    if not user_ids:
        return 0
    try:
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
    except Exception:
        return 0
    deleted, _details = OutstandingToken.objects.filter(user_id__in=user_ids).delete()
    return deleted


def _delete_optional_user_related(user_ids: list[int]) -> int:
    if not user_ids:
        return 0

    deleted = 0
    optional_models = [
        ("otp_totp", "TOTPDevice", "user_id"),
        ("otp_static", "StaticDevice", "user_id"),
    ]
    for app_label, model_name, field_name in optional_models:
        try:
            model = apps.get_model(app_label, model_name)
        except LookupError:
            continue
        count, _details = model.objects.filter(**{f"{field_name}__in": user_ids}).delete()
        deleted += count
    return deleted


def _delete_explicit_set_null_business_rows(business_id: int) -> int:
    deleted = 0
    for model, field in _direct_business_fields():
        if _is_system_audit_model(model) or _is_tenant_identity_model(model):
            continue
        if field.remote_field.on_delete is not models.SET_NULL:
            continue
        queryset = model.objects.filter(business_id=business_id)
        count, _details = queryset.delete()
        deleted += count
    return deleted


def _delete_user_deletion_requests(user_ids: list[int], business_id: int) -> int:
    model = apps.get_model("users", "AccountDeletionRequest")
    query = Q(business_id=business_id)
    if user_ids:
        query |= Q(user_id__in=user_ids) | Q(requested_by_id__in=user_ids) | Q(cancelled_by_id__in=user_ids)
    deleted, _details = model.objects.filter(query).delete()
    return deleted


def _scrub_business_deletion_request(deletion_request, reason: str) -> None:
    if not deletion_request:
        return
    model = _business_deletion_model()
    deletion_request.business = None
    deletion_request.business_name = SCRUBBED_VALUE
    deletion_request.business_domain = ""
    deletion_request.reason = reason
    deletion_request.status = model.STATUS_PURGED
    deletion_request.purged_at = timezone.now()
    deletion_request.save(
        update_fields=[
            "business",
            "business_name",
            "business_domain",
            "reason",
            "status",
            "purged_at",
        ]
    )


def purge_tenant(business_id: int, reason: str, actor=None, deletion_request=None) -> dict:
    """
    Permanently delete all tenant-owned data for a business.

    The BusinessDeletionRequest audit shell is scrubbed and retained. All other
    rows directly scoped to the business must be deleted or cascaded away.
    """
    Business = _business_model()
    Users = _users_model()
    Customer = _customers_model()
    BusinessDeletionRequest = _business_deletion_model()

    with transaction.atomic():
        business = Business.objects.select_for_update().filter(id=business_id).first()
        if business is None:
            if deletion_request:
                _scrub_business_deletion_request(deletion_request, reason)
            return {"business_id": business_id, "deleted": False, "message": "Business not found"}

        deletion_request = deletion_request or getattr(business, "deletion_request", None)
        if deletion_request is None:
            deletion_request = BusinessDeletionRequest.objects.create(
                business=business,
                business_name=business.name,
                business_domain=business.domain or "",
                requested_by=actor,
                reason=reason,
                grace_period_end=timezone.now(),
            )

        resources_before = collect_tenant_resources(business_id)
        user_ids = list(Users.objects.filter(business_id=business_id).values_list("id", flat=True))
        customer_ids = list(Customer.objects.filter(business_id=business_id).values_list("id", flat=True))

        business.is_active = False
        business.save(update_fields=["is_active"])

        session_count = _delete_tenant_sessions(user_ids, customer_ids)
        token_count = _delete_user_tokens(user_ids)
        optional_user_related_count = _delete_optional_user_related(user_ids)
        account_deletion_count = _delete_user_deletion_requests(user_ids, business_id)
        explicit_set_null_count = _delete_explicit_set_null_business_rows(business_id)

        customer_count, _customer_details = Customer.objects.filter(id__in=customer_ids).delete()
        user_count, _user_details = Users.objects.filter(id__in=user_ids).delete()

        business.delete()
        _scrub_business_deletion_request(deletion_request, reason)
        verify_tenant_purged(business_id, user_ids, customer_ids)

    logger.info(
        "[TenantPurge] Purged business_id=%s users=%s customers=%s resources=%s",
        business_id,
        len(user_ids),
        len(customer_ids),
        list(resources_before.keys()),
    )
    return {
        "business_id": business_id,
        "deleted": True,
        "resources_before": resources_before,
        "deleted_user_ids": user_ids,
        "deleted_customer_ids": customer_ids,
        "deleted_sessions": session_count,
        "deleted_tokens": token_count,
        "deleted_optional_user_related": optional_user_related_count,
        "deleted_account_deletion_requests": account_deletion_count,
        "deleted_explicit_set_null_rows": explicit_set_null_count,
        "deleted_customers": customer_count,
        "deleted_users": user_count,
    }


def verify_tenant_purged(
    business_id: int,
    deleted_user_ids: list[int] | None = None,
    deleted_customer_ids: list[int] | None = None,
) -> None:
    deleted_user_ids = deleted_user_ids or []
    deleted_customer_ids = deleted_customer_ids or []
    leftovers = OrderedDict()

    if _business_model().objects.filter(id=business_id).exists():
        leftovers["users.Business"] = 1

    for model, _field in sorted(_direct_business_fields(), key=lambda item: _model_label(item[0])):
        if _is_system_audit_model(model):
            continue
        count = model.objects.filter(business_id=business_id).count()
        if count:
            leftovers[_model_label(model)] = count

    if deleted_user_ids:
        count = _users_model().objects.filter(id__in=deleted_user_ids).count()
        if count:
            leftovers["users.Users"] = count
    if deleted_customer_ids:
        count = _customers_model().objects.filter(id__in=deleted_customer_ids).count()
        if count:
            leftovers["users.Customer"] = count

    if leftovers:
        raise TenantPurgeError(f"Tenant purge left resources behind for business_id={business_id}: {dict(leftovers)}")


def _max_dt(model_label: str, field_name: str, **filters):
    try:
        model = apps.get_model(*model_label.split(".", 1))
    except LookupError:
        return None
    return model.objects.filter(**filters).aggregate(value=Max(field_name))["value"]


def get_tenant_last_activity(business) -> TenantActivity:
    candidates = [
        (business.created_at, "business.created_at"),
        (_max_dt("users.Users", "last_login", business_id=business.id), "users.last_login"),
        (_max_dt("tenant.TenantAuditLog", "timestamp", business_id=business.id), "tenant_audit.timestamp"),
        (_max_dt("tenant.Ticket", "date_updated", business_id=business.id), "ticket.date_updated"),
        (_max_dt("tenant.TicketActivity", "timestamp", business_id=business.id), "ticket_activity.timestamp"),
        (_max_dt("tenant.Task", "date_updated", business_id=business.id), "task.date_updated"),
        (_max_dt("tenant.TaskActivity", "timestamp", business_id=business.id), "task_activity.timestamp"),
        (
            _max_dt(
                "tenant.MailFetchLog",
                "checked_at",
                business_id=business.id,
                new_ticket_count__gt=0,
            ),
            "mail_fetch.new_ticket",
        ),
        (
            _max_dt(
                "tenant.MailFetchLog",
                "checked_at",
                business_id=business.id,
                new_reply_count__gt=0,
            ),
            "mail_fetch.new_reply",
        ),
    ]
    latest_at, source = max(
        ((value, source) for value, source in candidates if value is not None),
        key=lambda item: item[0],
        default=(None, "none"),
    )
    return TenantActivity(business_id=business.id, last_activity_at=latest_at, source=source)


def find_inactive_tenants(days: int = INACTIVITY_DAYS) -> list[dict]:
    Business = _business_model()
    BusinessDeletionRequest = _business_deletion_model()
    cutoff = timezone.now() - timedelta(days=days)
    blocked_ids = set(
        BusinessDeletionRequest.objects.filter(
            status__in=[
                BusinessDeletionRequest.STATUS_PENDING,
                BusinessDeletionRequest.STATUS_PURGED,
            ],
            business_id__isnull=False,
        ).values_list("business_id", flat=True)
    )

    inactive = []
    for business in Business.objects.exclude(id__in=blocked_ids).order_by("id"):
        activity = get_tenant_last_activity(business)
        if activity.last_activity_at and activity.last_activity_at <= cutoff:
            inactive.append(
                {
                    "business": business,
                    "business_id": business.id,
                    "business_name": business.name,
                    "last_activity_at": activity.last_activity_at,
                    "last_activity_source": activity.source,
                    "cutoff": cutoff,
                }
            )
    return inactive


def purge_inactive_tenants(days: int = INACTIVITY_DAYS, *, dry_run: bool = False) -> list[dict]:
    results = []
    for candidate in find_inactive_tenants(days=days):
        business = candidate["business"]
        reason = (
            f"Auto-purged after {days} days of inactivity; "
            f"last_activity_at={candidate['last_activity_at'].isoformat()} "
            f"source={candidate['last_activity_source']}"
        )
        if dry_run:
            results.append({**candidate, "dry_run": True, "purged": False})
            continue
        purge_result = purge_tenant(business.id, reason=reason)
        results.append({**candidate, "dry_run": False, "purged": purge_result["deleted"]})
    return results
