"""
Gmail API email sending using OAuth access token.
"""
from __future__ import annotations

import base64
import logging
import mimetypes
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import requests

from tenant.models import MailIntegration
from util.mail.oauth import refresh_google_token

logger = logging.getLogger(__name__)

GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


def _ensure_valid_token(integration: MailIntegration) -> str:
    """
    Get valid access token, refreshing if necessary.
    Returns the access token string.
    """
    from django.utils import timezone
    from datetime import timedelta

    access_token = integration.get_secret("oauth_access_token")
    refresh_token = integration.get_secret("oauth_refresh_token")
    expires_at = integration.oauth_expires_at

    # Refresh if expired or expiring within 5 minutes
    now = timezone.now()
    if not access_token or (expires_at and expires_at - now < timedelta(minutes=5)):
        if not refresh_token:
            raise ValueError(f"No refresh token available for integration {integration.id}")
        
        logger.info("gmail_sender_refreshing_token", extra={"integration_id": integration.id})
        token_data = refresh_google_token(refresh_token)
        access_token = token_data.get("access_token")
        integration.set_secret("oauth_access_token", access_token)
        integration.oauth_expires_at = token_data.get("expires_at")
        integration.save(update_fields=["oauth_access_token_encrypted", "oauth_expires_at"])

    return access_token


def _build_mime_message(
    from_email: str,
    to: list[str],
    cc: Optional[list[str]],
    bcc: Optional[list[str]],
    subject: str,
    text: str,
    html: str,
    headers: Optional[dict] = None,
    attachments: Optional[list[tuple[str, bytes]]] = None,
) -> str:
    """
    Build a MIME message and return as base64url encoded string.
    """
    msg = MIMEMultipart("mixed")

    alt_part = MIMEMultipart("alternative")
    alt_part.attach(MIMEText(text, "plain", "utf-8"))
    alt_part.attach(MIMEText(html, "html", "utf-8"))
    msg.attach(alt_part)

    msg["From"] = from_email
    msg["To"] = ", ".join(to)
    if cc:
        msg["Cc"] = ", ".join(cc)
    msg["Subject"] = subject

    # Add custom headers (Message-ID, In-Reply-To, References)
    if headers:
        for key, value in headers.items():
            if key.lower() not in ("from", "to", "cc", "bcc", "subject"):
                msg[key] = value

    if attachments:
        for filename, content in attachments:
            content_type, encoding = mimetypes.guess_type(filename)
            if content_type is None or encoding is not None:
                content_type = "application/octet-stream"

            main_type, sub_type = content_type.split("/", 1)
            attachment_part = MIMEBase(main_type, sub_type)
            attachment_part.set_payload(content)
            encoders.encode_base64(attachment_part)
            attachment_part.add_header("Content-Disposition", f"attachment; filename={filename}")
            msg.attach(attachment_part)

    # Encode as base64url (Gmail API requirement)
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    return raw


def send_gmail_api_message(
    integration: MailIntegration,
    to: list[str],
    cc: Optional[list[str]] = None,
    bcc: Optional[list[str]] = None,
    subject: str = "",
    text: str = "",
    html: str = "",
    from_email: Optional[str] = None,
    headers: Optional[dict] = None,
    attachments: Optional[list[tuple[str, bytes]]] = None,
) -> bool:
    """
    Send an email via Gmail API using OAuth access token.
    
    Args:
        integration: The MailIntegration with Gmail OAuth credentials
        to: List of recipient emails
        cc: Optional CC recipients
        bcc: Optional BCC recipients  
        subject: Email subject
        text: Plain text body
        html: HTML body
        from_email: From address (defaults to integration email)
        headers: Optional extra headers (Message-ID, In-Reply-To, References)
        attachments: Optional list of (filename, content_bytes)
    
    Returns:
        True if sent successfully, False otherwise
    """
    try:
        access_token = _ensure_valid_token(integration)
        sender = from_email or integration.email_address

        raw_message = _build_mime_message(
            from_email=sender,
            to=to,
            cc=cc,
            bcc=bcc,
            subject=subject,
            text=text,
            html=html,
            headers=headers,
            attachments=attachments,
        )

        response = requests.post(
            GMAIL_SEND_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={"raw": raw_message},
            timeout=30,
        )

        if response.status_code == 200:
            logger.info(
                "gmail_api_send_success",
                extra={
                    "integration_id": integration.id,
                    "to": to,
                    "subject": subject[:50],
                },
            )
            return True
        else:
            # Print detailed error for debugging
            print(f"[GMAIL API ERROR] Status: {response.status_code}")
            print(f"[GMAIL API ERROR] Response: {response.text}")
            logger.error(
                "gmail_api_send_failed",
                extra={
                    "integration_id": integration.id,
                    "status_code": response.status_code,
                    "response": response.text[:500],
                },
            )
            return False

    except Exception as exc:
        print(f"[GMAIL API EXCEPTION] {exc}")
        logger.exception(
            "gmail_api_send_error",
            extra={"integration_id": integration.id, "error": str(exc)},
        )
        return False
