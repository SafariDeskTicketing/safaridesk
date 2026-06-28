from __future__ import annotations

import imaplib
import smtplib
import socket
from typing import Dict, Optional

from .transport import resolve_imap_transport, resolve_smtp_transport


def _imap_connect(host: str, port: Optional[int], username: str, password: str, use_ssl: bool, timeout: int):
    port, use_ssl = resolve_imap_transport(port, use_ssl)
    if use_ssl:
        client = imaplib.IMAP4_SSL(host, port, timeout=timeout)
    else:
        client = imaplib.IMAP4(host, port, timeout=timeout)
    if username:
        client.login(username, password)
    client.logout()


def _smtp_connect(host: str, port: Optional[int], username: str, password: str, use_ssl: bool, use_tls: bool, timeout: int):
    port, use_ssl, use_tls = resolve_smtp_transport(port, use_ssl, use_tls)
    if use_ssl:
        server = smtplib.SMTP_SSL(host, port, timeout=timeout)
    else:
        server = smtplib.SMTP(host, port, timeout=timeout)
        if use_tls:
            server.ehlo()
            server.starttls()
            server.ehlo()
    if username:
        server.login(username, password)
    server.noop()
    server.quit()


def validate_mail_credentials(payload: Dict) -> Dict:
    timeout = payload.get("timeout", 20)
    result = {
        "imap": {"status": "skipped", "message": "Not provided"},
        "smtp": {"status": "skipped", "message": "Not provided"},
    }

    if payload.get("imap_host"):
        try:
            _imap_connect(
                host=payload["imap_host"],
                port=payload.get("imap_port"),
                username=payload.get("imap_username", ""),
                password=payload.get("imap_password", ""),
                use_ssl=payload.get("imap_use_ssl", True),
                timeout=timeout,
            )
            result["imap"] = {"status": "success", "message": "IMAP connection verified"}
        except (imaplib.IMAP4.error, socket.error, socket.timeout, Exception) as exc:
            result["imap"] = {"status": "error", "message": str(exc)}

    if payload.get("smtp_host"):
        try:
            _smtp_connect(
                host=payload["smtp_host"],
                port=payload.get("smtp_port"),
                username=payload.get("smtp_username", ""),
                password=payload.get("smtp_password", ""),
                use_ssl=payload.get("smtp_use_ssl", True),
                use_tls=payload.get("smtp_use_tls", False),
                timeout=timeout,
            )
            result["smtp"] = {"status": "success", "message": "SMTP connection verified"}
        except (smtplib.SMTPException, socket.error, socket.timeout, Exception) as exc:
            result["smtp"] = {"status": "error", "message": str(exc)}

    return result
