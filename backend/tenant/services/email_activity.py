from __future__ import annotations

import re
from email.utils import getaddresses, parsedate_to_datetime
from typing import Any, Optional

from django.utils import timezone


def _header_value(headers: dict[str, Any], key: str) -> str:
    target = key.lower()
    for header_key, value in (headers or {}).items():
        if str(header_key).lower() == target:
            return str(value or "").strip()
    return ""


def _parse_addresses(value: str | list[str] | tuple[str, ...] | None) -> list[dict[str, str]]:
    if not value:
        return []

    raw_values = list(value) if isinstance(value, (list, tuple)) else [value]
    parsed: list[dict[str, str]] = []

    for name, email in getaddresses(raw_values):
        clean_name = (name or "").strip().strip('"')
        clean_email = (email or "").strip()

        if not clean_email and clean_name and "@" in clean_name:
            clean_email = clean_name
            clean_name = ""

        if not clean_name and not clean_email:
            continue

        display = (
            f"{clean_name} <{clean_email}>"
            if clean_name and clean_email
            else clean_email or clean_name
        )
        parsed.append(
            {
                "name": clean_name,
                "email": clean_email,
                "display": display,
            }
        )

    return parsed


def _first_address(value: str | list[str] | tuple[str, ...] | None) -> Optional[dict[str, str]]:
    addresses = _parse_addresses(value)
    return addresses[0] if addresses else None


def _format_identity(name: str | None, email: str | None) -> dict[str, str]:
    clean_name = (name or "").strip()
    clean_email = (email or "").strip()
    display = (
        f"{clean_name} <{clean_email}>"
        if clean_name and clean_email
        else clean_email or clean_name
    )
    return {
        "name": clean_name,
        "email": clean_email,
        "display": display,
    }


def _parse_header_date(value: str) -> Optional[str]:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
        if parsed is None:
            return None
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed.isoformat()
    except Exception:
        return None


def _derive_provider_metadata(headers: dict[str, Any]) -> dict[str, str]:
    auth_results = _header_value(headers, "Authentication-Results")
    received = _header_value(headers, "Received")
    combined = " ".join(part for part in [auth_results, received] if part)
    provider_metadata: dict[str, str] = {}

    mailed_by_match = re.search(
        r"(?:smtp\.mailfrom|header\.from)=([^\s;>]+)",
        auth_results,
        re.IGNORECASE,
    )
    if mailed_by_match:
        provider_metadata["mailed_by"] = mailed_by_match.group(1)

    signed_by_match = re.search(
        r"header\.i=@?([^\s;>]+)",
        auth_results,
        re.IGNORECASE,
    )
    if signed_by_match:
        provider_metadata["signed_by"] = signed_by_match.group(1)

    if re.search(r"\bTLS\b|ESMTPS|SMTPS", combined, re.IGNORECASE):
        provider_metadata["security_summary"] = "Standard encryption (TLS)"

    return provider_metadata


def build_comment_email_meta(comment, email_record=None) -> Optional[dict[str, Any]]:
    if not email_record and not (
        getattr(comment, "email_to", None)
        or getattr(comment, "email_cc", None)
        or getattr(comment, "email_bcc", None)
    ):
        return None

    headers = getattr(email_record, "raw_headers", {}) or {}
    direction = getattr(email_record, "direction", None)
    if not direction:
        direction = "outgoing" if getattr(comment, "email_to", None) else None
    if not direction:
        return None

    fallback_author = getattr(comment, "author", None)
    fallback_name = None
    fallback_email = None
    if fallback_author is not None:
        fallback_name = getattr(fallback_author, "full_name", lambda: "")().strip()
        fallback_email = getattr(fallback_author, "email", "")

    from_address = (
        _first_address(_header_value(headers, "From"))
        or _first_address(getattr(email_record, "sender", ""))
        or _format_identity(fallback_name, fallback_email)
    )

    to_addresses = _parse_addresses(_header_value(headers, "To")) or _parse_addresses(
        getattr(comment, "email_to", None) or getattr(email_record, "recipient", "")
    )
    cc_addresses = _parse_addresses(_header_value(headers, "Cc")) or _parse_addresses(
        getattr(comment, "email_cc", None)
    )
    bcc_addresses = _parse_addresses(_header_value(headers, "Bcc")) or _parse_addresses(
        getattr(comment, "email_bcc", None)
    )
    reply_to = _first_address(_header_value(headers, "Reply-To"))

    subject = (
        _header_value(headers, "Subject")
        or getattr(email_record, "subject", "")
        or ""
    )
    message_id = (
        _header_value(headers, "Message-ID")
        or getattr(email_record, "message_id", "")
        or ""
    )

    header_date = _parse_header_date(_header_value(headers, "Date"))
    record_time = getattr(email_record, "received_at", None)
    record_time_iso = record_time.isoformat() if record_time else None

    mailbox_label = None
    integration = getattr(email_record, "integration", None)
    if integration is not None:
        mailbox_label = (
            getattr(integration, "display_name", "")
            or getattr(integration, "email_address", "")
            or getattr(integration, "forwarding_address", "")
        )

    provider_metadata = _derive_provider_metadata(headers)

    return {
        "direction": direction,
        "from": from_address,
        "to": to_addresses,
        "cc": cc_addresses,
        "bcc": bcc_addresses,
        "reply_to": reply_to,
        "subject": subject,
        "message_id": message_id,
        "sent_at": (header_date or record_time_iso) if direction == "outgoing" else None,
        "received_at": (header_date or record_time_iso) if direction == "incoming" else None,
        "mailbox_label": mailbox_label,
        "provider_metadata": provider_metadata or {},
    }
