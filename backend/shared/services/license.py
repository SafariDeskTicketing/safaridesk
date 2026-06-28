from __future__ import annotations

import logging
import socket
import uuid
from datetime import timedelta, timezone as datetime_timezone
from typing import Literal
from urllib.parse import urljoin

import requests
from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import PermissionDenied

from shared.models.LicenseStatus import LicenseStatus
from users.models import Business

logger = logging.getLogger(__name__)

DEPLOYMENT_SELF_HOSTED = "self_hosted"
DEPLOYMENT_CLOUD = "cloud"
EDITION_COMMUNITY = "community"
EDITION_ENTERPRISE = "enterprise"
EDITION_CLOUD = "cloud"
TENANCY_SINGLE = "single"
TENANCY_MULTI = "multi"
DEFAULT_BUSINESS_DOMAIN = "default"
DEFAULT_BUSINESS_NAME = "Default Workspace"


def get_deployment_type() -> Literal["self_hosted", "cloud"]:
    configured = str(
        getattr(settings, "SAFARIDESK_DEPLOYMENT_TYPE", DEPLOYMENT_SELF_HOSTED) or DEPLOYMENT_SELF_HOSTED
    ).lower()
    return DEPLOYMENT_CLOUD if configured == DEPLOYMENT_CLOUD else DEPLOYMENT_SELF_HOSTED


def get_configured_edition() -> Literal["community", "enterprise", "cloud"]:
    if get_deployment_type() == DEPLOYMENT_CLOUD:
        return EDITION_CLOUD

    configured = str(getattr(settings, "SAFARIDESK_EDITION", EDITION_COMMUNITY) or EDITION_COMMUNITY).lower()
    return EDITION_ENTERPRISE if configured == EDITION_ENTERPRISE else EDITION_COMMUNITY


def get_configured_tenancy_mode() -> Literal["single", "multi"]:
    return TENANCY_MULTI if get_deployment_type() == DEPLOYMENT_CLOUD else TENANCY_SINGLE


def get_effective_tenancy_mode() -> Literal["single", "multi"]:
    return get_configured_tenancy_mode()


def license_required() -> bool:
    return get_deployment_type() == DEPLOYMENT_SELF_HOSTED and get_configured_edition() == EDITION_ENTERPRISE


def get_default_business() -> Business:
    business = Business.objects.filter(domain=DEFAULT_BUSINESS_DOMAIN).first()
    if business:
        return business

    existing_business = Business.objects.order_by("id").first()
    if existing_business and Business.objects.count() == 1:
        return existing_business

    business = Business.objects.filter(name=DEFAULT_BUSINESS_NAME).first()
    if business:
        if not business.domain:
            business.domain = DEFAULT_BUSINESS_DOMAIN
            business.save(update_fields=["domain", "updated_at"])
        return business

    return Business.objects.create(
        name=DEFAULT_BUSINESS_NAME,
        domain=DEFAULT_BUSINESS_DOMAIN,
        is_active=True,
    )


def get_current_business(request) -> Business | None:
    user_business = getattr(getattr(request, "user", None), "business", None)
    if user_business:
        return user_business
    if get_effective_tenancy_mode() == TENANCY_SINGLE:
        return get_default_business()
    return None


def _get_status_record() -> LicenseStatus:
    status, _ = LicenseStatus.objects.get_or_create(singleton_key="default")
    if not status.instance_id:
        configured_instance_id = getattr(settings, "SAFARIDESK_INSTANCE_ID", "") or ""
        status.instance_id = configured_instance_id or str(uuid.uuid4())
        status.save(update_fields=["instance_id", "updated_at"])
    return status


def _parse_datetime(value: str | None):
    if not value:
        return None
    parsed = parse_datetime(value)
    if parsed and timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone=datetime_timezone.utc)
    return parsed


def _days_until_violation(status: LicenseStatus) -> int:
    if not status.unlicensed_since:
        return int(getattr(settings, "SAFARIDESK_LICENSE_VIOLATION_DAYS", 5))
    threshold = int(getattr(settings, "SAFARIDESK_LICENSE_VIOLATION_DAYS", 5))
    elapsed_days = (timezone.now() - status.unlicensed_since).days
    return max(threshold - elapsed_days, 0)


def _is_violation(status: LicenseStatus) -> bool:
    if not license_required() or status.license_valid:
        return False
    if not status.unlicensed_since:
        return False
    threshold = int(getattr(settings, "SAFARIDESK_LICENSE_VIOLATION_DAYS", 5))
    return timezone.now() >= status.unlicensed_since + timedelta(days=threshold)


def _as_payload(status: LicenseStatus) -> dict:
    required = license_required()
    license_valid = bool(status.license_valid) if required else True
    license_warning = required and not status.license_valid

    return {
        "deployment_type": get_deployment_type(),
        "edition": get_configured_edition(),
        "tenancy_mode": get_effective_tenancy_mode(),
        "license_valid": license_valid,
        "license_warning": license_warning,
        "license_violation": _is_violation(status),
        "unlicensed_since": status.unlicensed_since.isoformat() if status.unlicensed_since else None,
        "days_until_violation": _days_until_violation(status) if license_warning else None,
        "features": status.features or [],
        "customer_name": status.customer_name,
        "checked_at": status.checked_at.isoformat() if status.checked_at else None,
        "expires_at": status.expires_at.isoformat() if status.expires_at else None,
        "instance_id": status.instance_id,
        "last_error": status.last_error,
    }


def _clear_unlicensed_tracking(status: LicenseStatus) -> LicenseStatus:
    status.unlicensed_since = None
    return status


def _mark_unlicensed(status: LicenseStatus, error_message: str = "") -> LicenseStatus:
    now = timezone.now()
    update_fields = [
        "license_valid",
        "checked_at",
        "last_error",
        "updated_at",
    ]
    status.license_valid = False
    status.checked_at = now
    status.last_error = error_message

    if license_required():
        if not status.unlicensed_since:
            status.unlicensed_since = now
            update_fields.append("unlicensed_since")
    elif status.unlicensed_since:
        status.unlicensed_since = None
        update_fields.append("unlicensed_since")

    status.save(update_fields=update_fields)
    return status


def refresh_license_status() -> dict:
    status = _get_status_record()

    if not license_required():
        status.license_valid = True
        status.features = []
        status.customer_name = None
        status.expires_at = None
        status.signature = ""
        status.license_response = {}
        status.checked_at = timezone.now()
        status.last_error = ""
        _clear_unlicensed_tracking(status)
        status.save()
        return _as_payload(status)

    license_key = getattr(settings, "SAFARIDESK_LICENSE_KEY", "") or ""
    server_url = (getattr(settings, "SAFARIDESK_LICENSE_SERVER_URL", "") or "").rstrip("/")

    if not license_key or not server_url:
        status.features = []
        status.customer_name = None
        status.expires_at = None
        status.signature = ""
        status.license_response = {}
        status.save(update_fields=[
            "features",
            "customer_name",
            "expires_at",
            "signature",
            "license_response",
            "updated_at",
        ])
        return _as_payload(_mark_unlicensed(status, "License key or server URL is not configured."))

    validate_url = urljoin(f"{server_url}/", "v1/licenses/validate")
    request_payload = {
        "instance_id": status.instance_id,
        "product": "safaridesk",
        "deployment_type": get_deployment_type(),
        "edition": get_configured_edition(),
        "version": getattr(settings, "SAFARIDESK_VERSION", "dev"),
        "hostname": socket.gethostname(),
    }

    try:
        response = requests.post(
            validate_url,
            json=request_payload,
            headers={"Authorization": f"Bearer {license_key}"},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
    except Exception as exc:
        logger.warning("License validation request failed: %s", exc)
        status.checked_at = timezone.now()
        status.last_error = str(exc)
        status.save(update_fields=["checked_at", "last_error", "updated_at"])
        if not status.license_valid:
            _mark_unlicensed(status, str(exc))
        return _as_payload(status)

    features = data.get("features") if isinstance(data.get("features"), list) else []
    status.license_valid = bool(data.get("valid"))
    status.features = [str(feature) for feature in features]
    status.customer_name = data.get("customer_name") or None
    status.expires_at = _parse_datetime(data.get("expires_at"))
    status.checked_at = timezone.now()
    status.license_response = data
    status.signature = data.get("signature") or ""
    status.last_error = ""

    if status.license_valid:
        status.unlicensed_since = None
    elif not status.unlicensed_since:
        status.unlicensed_since = timezone.now()

    status.save()
    return _as_payload(status)


def get_license_status() -> dict:
    return _as_payload(_get_status_record())


def has_feature(feature_code: str) -> bool:
    if not license_required():
        return False
    status = _get_status_record()
    return bool(status.license_valid and feature_code in (status.features or []))


def require_feature(feature_code: str) -> None:
    if not has_feature(feature_code):
        raise PermissionDenied(f"Feature '{feature_code}' requires a valid license.")
