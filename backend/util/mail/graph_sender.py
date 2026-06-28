"""
Microsoft Graph API email sending using OAuth access token.
"""
from __future__ import annotations

import base64
import logging
import mimetypes
from typing import Optional

import requests

from tenant.models import MailIntegration
from util.mail.oauth import refresh_microsoft_graph_send_token

logger = logging.getLogger(__name__)

GRAPH_SEND_URL = "https://graph.microsoft.com/v1.0/me/sendMail"


def _ensure_graph_send_token(integration: MailIntegration) -> str:
    """
    Get a Microsoft Graph Mail.Send token.

    The stored mailbox access token is used for Outlook IMAP/SMTP. Graph
    /me/sendMail needs a Graph-scoped token, so do not overwrite the stored
    protocol token here.
    """
    refresh_token = integration.get_secret("oauth_refresh_token")
    if not refresh_token:
        raise ValueError(f"No refresh token available for integration {integration.id}")

    logger.info("graph_sender_fetching_graph_send_token", extra={"integration_id": integration.id})
    token_data = refresh_microsoft_graph_send_token(refresh_token)
    access_token = token_data.get("access_token")
    if not access_token:
        raise ValueError(f"No Graph Mail.Send access token returned for integration {integration.id}")

    if token_data.get("refresh_token"):
        integration.set_secret("oauth_refresh_token", token_data["refresh_token"])
        integration.save(update_fields=["oauth_refresh_token_encrypted"])

    return access_token


def _build_recipient_list(emails: list[str]) -> list[dict]:
    """Convert list of emails to Graph API recipient format."""
    return [{"emailAddress": {"address": email}} for email in emails]


def send_microsoft_graph_message(
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
    Send an email via Microsoft Graph API using OAuth access token.
    
    Args:
        integration: The MailIntegration with Office365 OAuth credentials
        to: List of recipient emails
        cc: Optional CC recipients
        bcc: Optional BCC recipients  
        subject: Email subject
        text: Plain text body
        html: HTML body
        from_email: From address (not used - Graph API uses authenticated user)
        headers: Optional extra headers (used for threading)
        attachments: Optional list of (filename, content_bytes)
    
    Returns:
        True if sent successfully, False otherwise
    """
    try:
        access_token = _ensure_graph_send_token(integration)

        # Build message payload
        message = {
            "subject": subject,
            "body": {
                "contentType": "HTML",
                "content": html or text,
            },
            "toRecipients": _build_recipient_list(to),
        }

        if cc:
            message["ccRecipients"] = _build_recipient_list(cc)
        if bcc:
            message["bccRecipients"] = _build_recipient_list(bcc)

        # Add threading headers via internetMessageHeaders
        if headers:
            internet_headers = []
            for key, value in headers.items():
                if key.lower() in ("in-reply-to", "references", "message-id"):
                    internet_headers.append({"name": key, "value": value})
            if internet_headers:
                message["internetMessageHeaders"] = internet_headers

        if attachments:
            graph_attachments = []
            for filename, content in attachments:
                content_type, _ = mimetypes.guess_type(filename)
                graph_attachments.append({
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": filename,
                    "contentType": content_type or "application/octet-stream",
                    "contentBytes": base64.b64encode(content).decode("utf-8"),
                })
            if graph_attachments:
                message["attachments"] = graph_attachments

        payload = {"message": message, "saveToSentItems": True}

        response = requests.post(
            GRAPH_SEND_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )

        # Graph API returns 202 Accepted for successful send
        if response.status_code in (200, 202):
            logger.info(
                "graph_api_send_success",
                extra={
                    "integration_id": integration.id,
                    "to": to,
                    "subject": subject[:50],
                },
            )
            return True
        else:
            logger.error(
                "graph_api_send_failed",
                extra={
                    "integration_id": integration.id,
                    "status_code": response.status_code,
                    "response": response.text[:500],
                },
            )
            return False

    except Exception as exc:
        logger.exception(
            "graph_api_send_error",
            extra={"integration_id": integration.id, "error": str(exc)},
        )
        return False
