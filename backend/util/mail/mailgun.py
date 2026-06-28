from __future__ import annotations

import hmac
import logging
import time
from hashlib import sha256
from typing import Optional, Dict, Any

from django.conf import settings
import requests

logger = logging.getLogger(__name__)


def verify_mailgun_signature(timestamp: str, token: str, signature: str, *, max_age: int = 300) -> bool:
    """
    Verify Mailgun webhook signature.

    - timestamp: unix epoch string from Mailgun
    - token: random token from Mailgun
    - signature: HMAC hexdigest using the signing key
    - max_age: allowed clock skew in seconds (default 5 minutes)
    """
    try:
        ts = int(timestamp)
    except (TypeError, ValueError):
        return False

    # Reject stale signatures
    if abs(time.time() - ts) > max_age:
        logger.warning("mailgun_signature_stale", extra={"timestamp": timestamp, "max_age": max_age})
        return False

    signing_key: Optional[str] = getattr(settings, "MAILGUN_SIGNING_KEY", None)
    if not signing_key:
        logger.error("mailgun_signing_key_missing")
        return False

    digest = hmac.new(
        key=signing_key.encode("utf-8"),
        msg=f"{timestamp}{token}".encode("utf-8"),
        digestmod=sha256,
    ).hexdigest()

    return hmac.compare_digest(digest, signature or "")


def send_mailgun_message(
    *,
    to: str | list[str],
    subject: str,
    text: str,
    html: Optional[str] = None,
    from_email: Optional[str] = None,
    cc: Optional[list[str]] = None,
    bcc: Optional[list[str]] = None,
    headers: Optional[Dict[str, Any]] = None,
    attachments: Optional[list[tuple[str, bytes]]] = None,
) -> bool:
    """
    Send an email via Mailgun HTTP API.

    Args:
        to: Single email or list of recipient emails
        cc: Optional list of CC recipients
        bcc: Optional list of BCC recipients
        attachments: Optional list of (filename, content_bytes)
    """
    api_key = getattr(settings, "MAILGUN_API_KEY", "")
    domain = getattr(settings, "MAILGUN_DOMAIN", "")
    if not api_key or not domain:
        logger.error("mailgun_send_missing_config")
        return False

    api_base_url = getattr(settings, "MAILGUN_API_BASE_URL", "https://api.eu.mailgun.net").rstrip("/")
    from_email = from_email or f"no-reply@{domain}"
    
    # Normalize 'to' to a list
    to_list = [to] if isinstance(to, str) else list(to)
    
    data = {
        "from": from_email,
        "to": to_list,
        "subject": subject,
        "text": text,
    }
    if html:
        data["html"] = html
    if cc:
        data["cc"] = cc
    if bcc:
        data["bcc"] = bcc

    # Custom headers like Message-ID / In-Reply-To
    if headers:
        for key, value in headers.items():
            data[f"h:{key}"] = value

    files_data = []
    if attachments:
        for filename, content in attachments:
            files_data.append(("attachment", (filename, content)))

    try:
        resp = requests.post(
            f"{api_base_url}/v3/{domain}/messages",
            auth=("api", api_key),
            data=data,
            files=files_data if files_data else None,
            timeout=10,
        )
        resp.raise_for_status()
        logger.info("mailgun_send_success", extra={"to": to_list, "cc": cc, "bcc": bcc, "subject": subject})
        return True
    except Exception as exc:
        response = getattr(exc, "response", None)
        logger.error(
            "mailgun_send_failed",
            extra={
                "to": to_list,
                "subject": subject,
                "from_email": from_email,
                "domain": domain,
                "api_base_url": api_base_url,
                "status_code": getattr(response, "status_code", None),
                "response_text": getattr(response, "text", ""),
                "error": str(exc),
            },
        )
        return False
