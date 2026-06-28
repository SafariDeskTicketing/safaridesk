from __future__ import annotations

import base64
import email
import imaplib
import logging
from datetime import datetime, timedelta
import os
import re
import uuid
import mimetypes
from email.header import decode_header
from typing import Dict, Iterable, Optional, Tuple

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from tenant.models import (
    EmailMessageRecord,
    EmailTicketMapping,
    MailFetchLog,
    MailIntegration,
    Ticket,
    TicketAttachment,
    TicketComment,
    TicketReplayAttachment,
)
from tenant.services.tickets.duplicate_detection import DuplicateDetectionService
from .gmail_api import (
    GmailHistoryExpiredError,
    get_gmail_history,
    get_gmail_message_raw,
    get_gmail_profile,
    mark_gmail_message_read,
)
from .oauth import refresh_google_token, refresh_microsoft_token
from util.mail.filter_engine import is_blocked as email_is_blocked
from .transport import resolve_imap_transport
from users.models import Users
from tenant.services.contact_linker import link_or_create_contact
from tenant.services.tickets.naming import extract_ticket_code, generate_ticket_id, render_ticket_title

logger = logging.getLogger(__name__)


def _exc_str(exc: BaseException) -> str:
    """
    Return a clean string for an exception, decoding bytes args that imaplib
    passes through (e.g. b'[UNAVAILABLE] Account is temporarily unavailable.')
    """
    msg = str(exc)
    # imaplib stores the raw server response as bytes inside the exception args;
    # str() renders it as b'...' — decode it so the UI shows readable text.
    if msg.startswith("b'") or msg.startswith('b"'):
        try:
            msg = exc.args[0].decode("utf-8", errors="replace") if exc.args and isinstance(exc.args[0], bytes) else msg
        except Exception:
            pass
    return msg


ALLOWED_ATTACHMENT_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".txt", ".csv", ".rtf", ".md",
    ".zip", ".rar", ".7z", ".tar", ".gz",
    ".mp3", ".wav", ".mp4", ".mov", ".avi", ".webm",
    ".json", ".xml", ".yaml", ".yml", ".eml"
}


def _extract_new_content_cids(html_body: str) -> set:
    """
    Extract CID references from the NEW content of an email, excluding quoted content.
    
    Gmail and other email clients include ALL images from a thread as attachments,
    but we only want to save images from the NEW message, not quoted replies.
    
    This parses the HTML and finds CIDs that are NOT inside <blockquote> elements.
    """
    if not html_body:
        return set()
    
    try:
        from bs4 import BeautifulSoup
        
        soup = BeautifulSoup(html_body, 'html.parser')
        
        # Remove all blockquote elements (quoted content)
        for blockquote in soup.find_all('blockquote'):
            blockquote.decompose()
        
        # Also remove elements with gmail_quote class (Gmail's quote indicator)
        for quote in soup.find_all(class_=re.compile(r'gmail_quote')):
            quote.decompose()
        
        # Now find all img tags in the remaining (new) content
        new_cids = set()
        for img in soup.find_all('img'):
            src = img.get('src', '')
            if src.startswith('cid:'):
                cid = src[4:]  # Remove 'cid:' prefix
                new_cids.add(cid)
        
        return new_cids
        
    except ImportError:
        # Fallback: if BeautifulSoup not available, use regex
        # This is less accurate but better than nothing
        logger.warning("BeautifulSoup not available, using regex fallback for CID extraction")
        
        # Simple approach: find content before first blockquote
        blockquote_match = re.search(r'<blockquote', html_body, re.IGNORECASE)
        if blockquote_match:
            new_content = html_body[:blockquote_match.start()]
        else:
            new_content = html_body
        
        # Extract CIDs from new content only
        cid_pattern = re.compile(r'cid:([^\"\'\>\s]+)', re.IGNORECASE)
        return set(cid_pattern.findall(new_content))


def _strip_quoted_html(html_body: str) -> str:
    """
    Strip quoted email content from HTML for activity stream display.
    
    Removes:
    - <blockquote> elements (standard email quotes)
    - Elements with gmail_quote class (Gmail's quote indicator)
    - "On ... wrote:" prefixes before quotes
    
    This ensures activity stream shows only the NEW reply, not the entire thread.
    """
    if not html_body:
        return ""
    
    try:
        from bs4 import BeautifulSoup
        
        soup = BeautifulSoup(html_body, 'html.parser')
        
        # Remove all blockquote elements (quoted content)
        for blockquote in soup.find_all('blockquote'):
            blockquote.decompose()
        
        # Remove gmail_quote divs (Gmail's quote container)
        for quote in soup.find_all(class_=re.compile(r'gmail_quote')):
            quote.decompose()
        
        # Remove gmail_attr divs (the "On ... wrote:" prefix)
        for attr in soup.find_all(class_=re.compile(r'gmail_attr')):
            attr.decompose()
        
        # Clean up the result
        result = str(soup)
        
        # Remove empty paragraphs and excessive whitespace
        result = re.sub(r'<p>\s*</p>', '', result)
        result = re.sub(r'\n\s*\n', '\n', result)
        
        return result.strip()
        
    except ImportError:
        # Fallback: use regex to strip blockquotes
        logger.warning("BeautifulSoup not available, using regex fallback for quote stripping")
        
        # Simple approach: find content before first blockquote
        blockquote_match = re.search(r'<blockquote', html_body, re.IGNORECASE)
        if blockquote_match:
            return html_body[:blockquote_match.start()].strip()
        
        return html_body

class MailIntegrationIngestionService:
    """
    Fetch unread emails for a MailIntegration, convert them into tickets or replies,
    and log ingestion stats.
    """

    def __init__(self, integration: MailIntegration):
        self.integration = integration
        self.mailbox = None
        self.stats = {
            "processed": 0,
            "tickets_created": 0,
            "replies_added": 0,
            "errors": 0,
        }

    def run(self) -> Dict[str, int]:
        start = timezone.now()
        last_uid = None
        try:
            logger.info(
                "mail_integration_ingest_start",
                extra={
                    "integration_id": self.integration.id,
                    "provider": self.integration.provider,
                    "email": self.integration.email_address,
                },
            )
            if self._should_use_gmail_api():
                last_uid = self._process_gmail_messages()
            else:
                self._connect_imap()
                last_uid = self._process_imap_messages()
            self.integration.mark_success()
            logger.info(
                "mail_integration_ingest_success",
                extra={
                    "integration_id": self.integration.id,
                    "provider": self.integration.provider,
                    "processed": self.stats["processed"],
                    "tickets_created": self.stats["tickets_created"],
                    "replies_added": self.stats["replies_added"],
                },
            )
        except ValueError as exc:
            # Configuration error (e.g. missing host/user) - log without traceback
            logger.error(
                "mail_integration_config_error",
                extra={
                    "integration_id": self.integration.id,
                    "email": self.integration.email_address,
                    "provider": self.integration.provider,
                    "error": _exc_str(exc),
                },
            )
            self.integration.mark_failure(_exc_str(exc))
            self.stats["errors"] += 1
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "mail_integration_ingest_failed",
                extra={
                    "integration_id": self.integration.id,
                    "email": self.integration.email_address,
                    "provider": self.integration.provider,
                    "error": _exc_str(exc),
                },
            )
            self.integration.mark_failure(_exc_str(exc))
            self.stats["errors"] += 1
        finally:
            self._disconnect_imap()
            duration = (timezone.now() - start).total_seconds() * 1000
            if MailIntegration.objects.filter(pk=self.integration.pk).exists():
                MailFetchLog.objects.create(
                    integration=self.integration,
                    business=self.integration.business,
                    duration_ms=int(duration),
                    result="error" if self.stats["errors"] else "success",
                    message_count=self.stats["processed"],
                    new_ticket_count=self.stats["tickets_created"],
                    new_reply_count=self.stats["replies_added"],
                    error_message=self.integration.last_error_message if self.stats["errors"] else "",
                    last_message_uid=last_uid or "",
                )
        return self.stats

    def _should_use_gmail_api(self) -> bool:
        return (
            self.integration.provider == MailIntegration.Provider.GMAIL
            and bool(
                self.integration.get_secret("oauth_access_token")
                or self.integration.get_secret("oauth_refresh_token")
            )
        )

    # ------------------------------------------------------------------ #
    # Gmail API helpers
    # ------------------------------------------------------------------ #
    def _process_gmail_messages(self) -> Optional[str]:
        access_token = self._get_gmail_access_token()
        message_ids, latest_history_id = self._search_gmail_messages(access_token)
        last_message_id = None

        for message_id in message_ids:
            try:
                message_data = get_gmail_message_raw(access_token, message_id)
                label_ids = set(message_data.get("labelIds") or [])
                if "UNREAD" not in label_ids:
                    continue

                raw_value = message_data.get("raw")
                if not raw_value:
                    logger.warning(
                        "gmail_message_missing_raw",
                        extra={"integration_id": self.integration.id, "message_id": message_id},
                    )
                    self.stats["errors"] += 1
                    continue

                raw_email = self._decode_gmail_raw_message(raw_value)
                email_message = email.message_from_bytes(raw_email)

                sender_email, _ = self._extract_sender_info(email_message)
                if (
                    sender_email
                    and self.integration.email_address
                    and sender_email.strip().lower() == self.integration.email_address.strip().lower()
                ):
                    logger.info("Skipping self-sent Gmail message from %s", sender_email)
                    mark_gmail_message_read(access_token, message_id)
                    continue

                self._process_email_message(email_message, raw_email)
                mark_gmail_message_read(access_token, message_id)
                last_message_id = message_id
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "mail_integration_gmail_message_error",
                    extra={"integration_id": self.integration.id, "message_id": message_id, "error": str(exc)},
                )
                self.stats["errors"] += 1

        if latest_history_id is not None:
            self._set_gmail_history_id(latest_history_id)

        return last_message_id or (str(latest_history_id) if latest_history_id is not None else None)

    def _search_gmail_messages(self, access_token: str) -> Tuple[list[str], Optional[int]]:
        anchor = self._get_gmail_history_id()
        if anchor is None:
            return [], self._init_gmail_history_id(access_token)

        try:
            history_data = get_gmail_history(access_token, anchor, label_id="INBOX")
        except GmailHistoryExpiredError:
            logger.warning(
                "gmail_history_anchor_expired",
                extra={"integration_id": self.integration.id, "old_history_id": anchor},
            )
            return [], self._init_gmail_history_id(access_token)

        latest_history_id = history_data.get("history_id")
        collected_ids: list[str] = []
        seen_ids: set[str] = set()

        for history_entry in history_data.get("history", []):
            entry_id = history_entry.get("id")
            if entry_id is not None:
                latest_history_id = max(int(entry_id), int(latest_history_id or 0))

            for added in history_entry.get("messagesAdded", []):
                message = added.get("message") or {}
                message_id = message.get("id")
                if message_id and message_id not in seen_ids:
                    seen_ids.add(message_id)
                    collected_ids.append(message_id)

        return collected_ids, latest_history_id

    def _get_gmail_access_token(self) -> str:
        access_token = self.integration.get_secret("oauth_access_token")
        refresh_token = self.integration.get_secret("oauth_refresh_token")
        expires_at = self.integration.oauth_expires_at

        if self._is_token_expired(expires_at) and refresh_token:
            access_token = self._refresh_google_token(refresh_token)

        if not access_token:
            raise ValueError(
                f"Gmail API configuration incomplete for integration {self.integration.id}: access token missing"
            )
        return access_token

    def _get_gmail_history_id(self) -> Optional[int]:
        metadata = self.integration.provider_metadata or {}
        history_id = metadata.get("gmail_history_id")
        try:
            return int(history_id) if history_id is not None else None
        except (TypeError, ValueError):
            return None

    def _set_gmail_history_id(self, history_id: int) -> None:
        metadata = self.integration.provider_metadata or {}
        metadata["gmail_history_id"] = int(history_id)
        metadata["gmail_history_set_at"] = timezone.now().isoformat()
        self.integration.provider_metadata = metadata
        self.integration.save(update_fields=["provider_metadata"])
        logger.info(
            "gmail_history_anchor_set",
            extra={"integration_id": self.integration.id, "history_id": int(history_id)},
        )

    def _init_gmail_history_id(self, access_token: str) -> Optional[int]:
        try:
            profile = get_gmail_profile(access_token)
            history_id = profile.get("historyId")
            if history_id is None:
                return None
            self._set_gmail_history_id(int(history_id))
            return int(history_id)
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "gmail_history_anchor_init_error",
                extra={"integration_id": self.integration.id, "error": str(exc)},
            )
            return None

    @staticmethod
    def _decode_gmail_raw_message(raw_value: str) -> bytes:
        padding = "=" * (-len(raw_value) % 4)
        return base64.urlsafe_b64decode(raw_value + padding)

    # ------------------------------------------------------------------ #
    # IMAP helpers
    # ------------------------------------------------------------------ #
    def _connect_imap(self) -> None:
        # For OAuth-connected providers, prefer XOAUTH2 over username/password.
        oauth_access = self.integration.get_secret("oauth_access_token")
        oauth_refresh = self.integration.get_secret("oauth_refresh_token")
        if self.integration.provider == MailIntegration.Provider.GMAIL:
            if oauth_access or oauth_refresh:
                self._connect_gmail_imap_oauth()
                return
        elif self.integration.provider == MailIntegration.Provider.OFFICE365:
            if oauth_access or oauth_refresh:
                self._connect_office365_imap_oauth()
                return
        host, port, use_ssl, username, password = self._resolve_imap_credentials()
        if use_ssl:
            self.mailbox = imaplib.IMAP4_SSL(host, port)
        else:
            self.mailbox = imaplib.IMAP4(host, port)
        if username:
            self.mailbox.login(username, password or "")
        self.mailbox.select("INBOX")
        logger.debug(
            "Connected to IMAP host=%s port=%s user=%s for integration %s",
            host,
            port,
            username,
            self.integration.id,
        )

    # Gmail OAuth (XOAUTH2) -------------------------------------------------
    def _connect_gmail_imap_oauth(self) -> None:
        host, port, use_ssl, username, access_token = self._resolve_gmail_oauth_credentials()
        if use_ssl:
            self.mailbox = imaplib.IMAP4_SSL(host, port)
        else:
            self.mailbox = imaplib.IMAP4(host, port)

        def auth_callback(_unused):
            return self._build_xoauth2_auth_string(username, access_token)

        try:
            self.mailbox.authenticate("XOAUTH2", auth_callback)
        except imaplib.IMAP4.error as exc:
            err_upper = str(exc).upper()
            if any(kw in err_upper for kw in ("AUTHENTICATE", "AUTHENTICATIONFAILED", "INVALID CREDENTIALS", "TOKEN")):
                self.integration.is_active = False
                MailIntegration.objects.filter(pk=self.integration.pk).update(is_active=False)
                logger.warning(
                    "mail_integration_deactivated_imap_auth_failure",
                    extra={"integration_id": self.integration.id, "provider": self.integration.provider, "error": str(exc)},
                )
                raise ValueError(
                    f"Gmail IMAP authentication failed for integration {self.integration.id}: re-authorization required"
                ) from exc
            raise
        self.mailbox.select("INBOX")
        logger.debug(
            "Connected to Gmail via XOAUTH2 host=%s port=%s user=%s integration=%s",
            host,
            port,
            username,
            self.integration.id,
        )

    # Office365 OAuth (XOAUTH2) --------------------------------------------
    def _connect_office365_imap_oauth(self) -> None:
        host, port, use_ssl, username, access_token = self._resolve_office365_oauth_credentials()
        if use_ssl:
            self.mailbox = imaplib.IMAP4_SSL(host, port)
        else:
            self.mailbox = imaplib.IMAP4(host, port)

        def auth_callback(_unused):
            return self._build_xoauth2_auth_string(username, access_token)

        try:
            self.mailbox.authenticate("XOAUTH2", auth_callback)
        except imaplib.IMAP4.error as exc:
            err_upper = str(exc).upper()
            if any(kw in err_upper for kw in ("AUTHENTICATE", "AUTHENTICATIONFAILED", "INVALID CREDENTIALS", "TOKEN")):
                self.integration.is_active = False
                MailIntegration.objects.filter(pk=self.integration.pk).update(is_active=False)
                logger.warning(
                    "mail_integration_deactivated_imap_auth_failure",
                    extra={"integration_id": self.integration.id, "provider": self.integration.provider, "error": str(exc)},
                )
                raise ValueError(
                    f"Office365 IMAP authentication failed for integration {self.integration.id}: re-authorization required"
                ) from exc
            raise
        self.mailbox.select("INBOX")
        logger.debug(
            "Connected to Office365 via XOAUTH2 host=%s port=%s user=%s integration=%s",
            host, port, username, self.integration.id,
        )

    def _resolve_office365_oauth_credentials(self) -> Tuple[str, int, bool, str, str]:
        host = self.integration.imap_host or self._default_imap_host(self.integration.provider)
        port, use_ssl = resolve_imap_transport(
            self.integration.imap_port,
            self.integration.imap_use_ssl,
        )
        username = (
            self.integration.get_secret("imap_username")
            or self.integration.email_address
        )
        if not host or not username:
            raise ValueError(
                f"Office365 OAuth configuration incomplete for integration {self.integration.id}: missing host or email/username"
            )

        access_token = self.integration.get_secret("oauth_access_token")
        refresh_token = self.integration.get_secret("oauth_refresh_token")
        expires_at = self.integration.oauth_expires_at

        if self._is_token_expired(expires_at) and refresh_token:
            access_token = self._refresh_microsoft_token(refresh_token)

        if not access_token:
            raise ValueError(
                f"Office365 OAuth configuration incomplete for integration {self.integration.id}: access token missing"
            )

        return host, port, use_ssl, username, access_token

    def _refresh_microsoft_token(self, refresh_token: str):
        try:
            token_data = refresh_microsoft_token(refresh_token)
            access_token = token_data.get("access_token")
            if access_token:
                self.integration.set_secret("oauth_access_token", access_token)
                if token_data.get("refresh_token"):
                    self.integration.set_secret("oauth_refresh_token", token_data["refresh_token"])
                self.integration.oauth_expires_at = token_data.get("expires_at")
                metadata = self.integration.provider_metadata or {}
                oauth_meta = metadata.get("oauth", {})
                oauth_meta.update({
                    "scope": token_data.get("scope"),
                    "token_type": token_data.get("token_type"),
                    "refreshed_at": timezone.now().isoformat(),
                })
                metadata["oauth"] = oauth_meta
                self.integration.provider_metadata = metadata
                save_fields = ["oauth_access_token_encrypted", "oauth_expires_at", "provider_metadata"]
                if token_data.get("refresh_token"):
                    save_fields.append("oauth_refresh_token_encrypted")
                self.integration.save(update_fields=save_fields)
                logger.info(
                    "mail_integration_ms_token_refreshed",
                    extra={
                        "integration_id": self.integration.id,
                        "expires_at": self.integration.oauth_expires_at.isoformat() if self.integration.oauth_expires_at else None,
                    },
                )
            return access_token
        except Exception as exc:
            from requests.exceptions import HTTPError
            if isinstance(exc, HTTPError) and exc.response is not None and exc.response.status_code in (400, 401):
                self.integration.is_active = False
                self.integration.save(update_fields=["is_active"])
                logger.warning(
                    "mail_integration_deactivated_invalid_token",
                    extra={"integration_id": self.integration.id, "provider": self.integration.provider},
                )
                raise ValueError(
                    f"Office365 OAuth token revoked for integration {self.integration.id}: re-authorization required"
                ) from exc
            logger.exception(
                "mail_integration_ms_token_refresh_failed",
                extra={"integration_id": self.integration.id, "error": str(exc)},
            )
            return None

    def _disconnect_imap(self) -> None:
        try:
            if self.mailbox:
                self.mailbox.close()
                self.mailbox.logout()
        except Exception as exc:  # noqa: BLE001
            logger.debug(
                "mail_integration_ingest_disconnect_error",
                exc_info=True,
                extra={"integration_id": self.integration.id, "error": str(exc)},
            )

    def _resolve_imap_credentials(self) -> Tuple[str, int, bool, str, Optional[str]]:
        host = self.integration.imap_host or self._default_imap_host(self.integration.provider)
        port, use_ssl = resolve_imap_transport(
            self.integration.imap_port,
            self.integration.imap_use_ssl,
        )
        username = self.integration.get_secret("imap_username") or self.integration.email_address
        password = self.integration.get_secret("imap_password")
        if not host or not username:
            raise ValueError(f"IMAP configuration incomplete for integration {self.integration.id}")
        return host, port, use_ssl, username, password

    def _resolve_gmail_oauth_credentials(self) -> Tuple[str, int, bool, str, str]:
        host = self.integration.imap_host or self._default_imap_host(self.integration.provider)
        port, use_ssl = resolve_imap_transport(
            self.integration.imap_port,
            self.integration.imap_use_ssl,
        )
        metadata = self.integration.provider_metadata or {}
        oauth_meta = metadata.get("oauth") or {}
        username = (
            self.integration.get_secret("imap_username")
            or self.integration.email_address
            or oauth_meta.get("email")
        )
        if not host or not username:
            raise ValueError(f"Gmail OAuth configuration incomplete for integration {self.integration.id}: missing host or email/username")

        access_token = self.integration.get_secret("oauth_access_token")
        refresh_token = self.integration.get_secret("oauth_refresh_token")
        expires_at = self.integration.oauth_expires_at

        if self._is_token_expired(expires_at) and refresh_token:
            access_token = self._refresh_google_token(refresh_token)

        if not access_token:
            raise ValueError(f"Gmail OAuth configuration incomplete for integration {self.integration.id}: access token missing")

        return host, port, use_ssl, username, access_token

    @staticmethod
    def _build_xoauth2_auth_string(username: str, access_token: str) -> bytes:
        """
        Build the XOAUTH2 SASL string. imaplib will base64-encode the returned bytes.
        """
        return f"user={username}\1auth=Bearer {access_token}\1\1".encode("utf-8")

    def _is_token_expired(self, expires_at: Optional[datetime]) -> bool:
        if not expires_at:
            return True
        return expires_at - timezone.now() < timedelta(minutes=2)

    def _refresh_google_token(self, refresh_token: str) -> Optional[str]:
        try:
            token_data = refresh_google_token(refresh_token)
            access_token = token_data.get("access_token")
            if access_token:
                self.integration.set_secret("oauth_access_token", access_token)
                self.integration.oauth_expires_at = token_data.get("expires_at")
                metadata = self.integration.provider_metadata or {}
                oauth_meta = metadata.get("oauth", {})
                oauth_meta.update(
                    {
                        "scope": token_data.get("scope"),
                        "token_type": token_data.get("token_type"),
                        "refreshed_at": timezone.now().isoformat(),
                    }
                )
                metadata["oauth"] = oauth_meta
                self.integration.provider_metadata = metadata
                self.integration.save(update_fields=["oauth_access_token_encrypted", "oauth_expires_at", "provider_metadata"])
                logger.info(
                    "mail_integration_token_refreshed_on_demand",
                    extra={
                        "integration_id": self.integration.id,
                        "provider": self.integration.provider,
                        "expires_at": self.integration.oauth_expires_at.isoformat() if self.integration.oauth_expires_at else None,
                    },
                )
            return access_token
        except Exception as exc:  # noqa: BLE001
            from requests.exceptions import HTTPError
            if isinstance(exc, HTTPError) and exc.response is not None and exc.response.status_code == 400:
                self.integration.is_active = False
                self.integration.save(update_fields=["is_active"])
                logger.warning(
                    "mail_integration_deactivated_invalid_token",
                    extra={"integration_id": self.integration.id, "provider": self.integration.provider},
                )
                raise ValueError(
                    f"Gmail OAuth token revoked for integration {self.integration.id}: re-authorization required"
                ) from exc
            logger.exception(
                "mail_integration_token_refresh_failed_on_demand",
                extra={"integration_id": self.integration.id, "provider": self.integration.provider, "error": str(exc)},
            )
            return None

    @staticmethod
    def _default_imap_host(provider: str) -> Optional[str]:
        mapping = {
            MailIntegration.Provider.GMAIL: "imap.gmail.com",
            MailIntegration.Provider.OFFICE365: "outlook.office365.com",
            MailIntegration.Provider.SAFARIDESK: "imap.safaridesk.io",
        }
        return mapping.get(provider)

    def _process_imap_messages(self) -> Optional[str]:
        if not self.mailbox:
            return None
        status, messages = self._search_imap_messages()
        if status != "OK":
            raise RuntimeError("Unable to search IMAP inbox")
        message_ids = messages[0].split() if messages and messages[0] else []
        last_uid = None
        for msg_id in message_ids:
            try:
                status, msg_data = self.mailbox.fetch(msg_id, "(RFC822 UID)")
                if status != "OK":
                    logger.warning(
                        "mail_integration_fetch_failed",
                        extra={"integration_id": self.integration.id, "message_id": msg_id.decode()},
                    )
                    self.stats["errors"] += 1
                    continue
                raw_email = msg_data[0][1]
                uid_line = msg_data[0][0].decode()
                last_uid = self._extract_uid(uid_line) or last_uid
                email_message = email.message_from_bytes(raw_email)
                
                # Prevent auto-reply loops: Skip emails sent FROM the integration address
                sender_email, _ = self._extract_sender_info(email_message)
                if sender_email and self.integration.email_address and sender_email.strip().lower() == self.integration.email_address.strip().lower():
                    logger.info("Skipping self-sent email (loop protection) from %s", sender_email)
                    self.mailbox.store(msg_id, "+FLAGS", "\\Seen")
                    continue

                self._process_email_message(email_message, raw_email)
                self.mailbox.store(msg_id, "+FLAGS", "\\Seen")
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "mail_integration_message_error",
                    extra={"integration_id": self.integration.id, "message_id": msg_id.decode(), "error": str(exc)},
                )
                self.stats["errors"] += 1
        if last_uid:
            self._update_imap_anchor(last_uid)
        return last_uid

    @staticmethod
    def _extract_uid(response_line: str) -> Optional[str]:
        match = re.search(r"UID (\d+)", response_line)
        return match.group(1) if match else None

    # ------------------------------------------------------------------ #
    # IMAP search helpers with anchor
    # ------------------------------------------------------------------ #
    def _search_imap_messages(self) -> Tuple[str, list]:
        """
        Search for messages respecting the anchor to avoid ingesting historic unread mail.
        If no anchor exists, set it to the current highest UID and skip processing on this run.
        """
        if not self.mailbox:
            return "NO", []

        anchor = self._get_imap_anchor()
        if anchor is None:
            anchor = self._init_imap_anchor()
            # First run after connect: do not process historical messages.
            return "OK", [b""] if anchor is not None else [b""]

        # Fetch only messages newer than anchor, and still unseen.
        status, messages = self.mailbox.search(None, f"(UNSEEN UID {anchor + 1}:*)")
        if status != "OK":
            return status, messages
        return status, messages

    def _get_imap_anchor(self) -> Optional[int]:
        metadata = self.integration.provider_metadata or {}
        anchor = metadata.get("imap_anchor_uid")
        try:
            return int(anchor) if anchor is not None else None
        except (TypeError, ValueError):
            return None

    def _set_imap_anchor(self, uid: int) -> None:
        metadata = self.integration.provider_metadata or {}
        metadata["imap_anchor_uid"] = uid
        metadata["imap_anchor_set_at"] = timezone.now().isoformat()
        self.integration.provider_metadata = metadata
        self.integration.save(update_fields=["provider_metadata"])
        logger.info(
            "imap_anchor_set",
            extra={"integration_id": self.integration.id, "provider": self.integration.provider, "anchor_uid": uid},
        )

    def _init_imap_anchor(self) -> Optional[int]:
        try:
            status, data = self.mailbox.uid("SEARCH", None, "ALL")
            if status != "OK":
                logger.warning(
                    "imap_anchor_init_failed",
                    extra={"integration_id": self.integration.id, "provider": self.integration.provider, "status": status},
                )
                return None
            uids = data[0].split() if data and data[0] else []
            anchor_uid = int(uids[-1]) if uids else 0
            self._set_imap_anchor(anchor_uid)
            return anchor_uid
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "imap_anchor_init_error",
                extra={"integration_id": self.integration.id, "provider": self.integration.provider, "error": str(exc)},
            )
            return None

    def _update_imap_anchor(self, uid: str) -> None:
        try:
            current = self._get_imap_anchor() or 0
            new_uid = int(uid)
            if new_uid > current:
                self._set_imap_anchor(new_uid)
        except Exception:
            # Non-fatal: best effort anchor update.
            logger.debug(
                "imap_anchor_update_skipped",
                extra={"integration_id": self.integration.id, "uid": uid},
            )

    # ------------------------------------------------------------------ #
    # Email processing
    # ------------------------------------------------------------------ #
    def _process_email_message(self, email_message, raw_bytes: bytes) -> None:
        message_id = (email_message.get("Message-ID") or "").strip()
        if not message_id:
            logger.warning("Skipping email without Message-ID for integration %s", self.integration.id)
            self.stats["errors"] += 1
            return

        if EmailTicketMapping.objects.filter(message_id=message_id).exists():
            logger.debug("Message %s already processed", message_id)
            return

        subject = email_message.get("Subject", "")
        sender_email, sender_name = self._extract_sender_info(email_message)
        text_body, html_body = self._extract_bodies(email_message)
        
        # Strip [image: filename] placeholders that email clients add for inline images
        if text_body:
            text_body = re.sub(r'\[image:\s*[^\]]+\]', '', text_body).strip()

        with transaction.atomic():
            ticket = self._resolve_ticket(email_message, subject)
            comment = None  # Track comment for attachment linking

            # If the resolved ticket is closed and outside the 5-day reopen window,
            # treat the reply as a brand-new ticket instead.
            if ticket and ticket.status == 'closed':
                five_days_ago = timezone.now() - timedelta(days=5)
                if ticket.resolved_at and ticket.resolved_at < five_days_ago:
                    logger.info(
                        "Ticket %s closed > 5 days ago; creating new ticket for email reply",
                        ticket.ticket_id,
                    )
                    ticket = None  # Fall through to new-ticket creation below
                # If resolved_at is None or within 5 days, fall through to reopen below

            # ================================================================
            # PHASE 1: Process attachments FIRST to get CID map for HTML
            # This allows us to rewrite image references before creating ticket
            # ================================================================

            # For new tickets, we need to create ticket first to link attachments
            # For replies, we create comment first
            if ticket:
                # Existing ticket - add comment first, then process attachments
                comment = self._add_comment(ticket, text_body or "", sender_email, sender_name, message_id)
                self.stats["replies_added"] += 1
                
                # Process attachments and get CID map
                cid_map = self._process_attachments(email_message, ticket, comment, html_body)
                rendered_html = self._rewrite_cid_references(html_body, cid_map) if html_body else ""
                
                # Update comment content with rendered HTML if available
                # Strip quoted content so activity stream shows only the NEW reply
                if rendered_html:
                    comment.content = _strip_quoted_html(rendered_html)
                    comment.save(update_fields=['content'])
                
                # AUTO STATUS TRANSITION FOR CUSTOMER REPLIES
                if ticket.status in ['pending', 'resolved']:
                    old_status = ticket.status
                    ticket.status = 'in_progress'
                    ticket.save(update_fields=['status'])

                    from tenant.models import TicketActivity
                    TicketActivity.objects.create(
                        ticket=ticket,
                        user=None,
                        activity_type='status_changed',
                        description="System changed the ticket status to In Progress",
                        old_value=old_status,
                        new_value='in_progress'
                    )
                    logger.info(f"Auto-transitioned ticket {ticket.ticket_id} from '{old_status}' to 'in_progress' on customer reply")
                elif ticket.status == 'closed':
                    # Closed within 5-day window (outside-window case is handled above by
                    # setting ticket = None before we reach this branch).
                    ticket.status = 'open'
                    ticket.resolved_at = None
                    ticket.save(update_fields=['status', 'resolved_at'])

                    from tenant.models import TicketActivity
                    TicketActivity.objects.create(
                        ticket=ticket,
                        user=None,
                        activity_type='status_changed',
                        description="Ticket automatically reopened: customer replied via email",
                        old_value='closed',
                        new_value='open',
                    )
                    logger.info(f"Auto-reopened ticket {ticket.ticket_id} on customer email reply (within 5-day window)")
            else:
                # New ticket - check filter rules first
                _blocked, _rule, _tier = email_is_blocked(sender_email, self.integration.business_id)
                if _blocked:
                    logger.info(
                        "email_blocked_skipping_ticket",
                        extra={"sender": sender_email, "subject": subject[:50], "rule": _rule, "tier": _tier},
                    )
                    try:
                        from tenant.models.MailIntegrationModel import EmailFilterLog
                        EmailFilterLog.objects.create(
                            business_id=self.integration.business_id,
                            sender=sender_email,
                            subject=(subject or "")[:500],
                            rule_matched=_rule,
                            rule_tier=_tier,
                        )
                    except Exception as _log_exc:
                        logger.warning("email_filter_log_failed", extra={"error": str(_log_exc)})
                    return  # Skip ticket creation for blocked senders
                
                # Create with placeholder, process attachments, then update
                # Use text_body initially; we'll update with HTML after attachment processing
                ticket = self._create_ticket(subject, text_body or "", sender_email, sender_name, message_id)
                self.stats["tickets_created"] += 1
                
                # ================================================================
                # Create placeholder comment for attachments
                # We will DELETE this comment if no attachments are actually found
                # ================================================================
                initial_comment = ticket.comments.create(
                    ticket=ticket,
                    content="**Attachments from email**",
                    author=None,
                    is_internal=False,
                )
                
                # Process attachments - pass the initial comment so attachments link to it if found
                cid_map = self._process_attachments(email_message, ticket, initial_comment, html_body)
                rendered_html = self._rewrite_cid_references(html_body, cid_map) if html_body else ""
                
                # Check if any attachments were actually created for this comment (using the related name 'attachment')
                # Note: The related_name in TicketReplayAttachment model is 'attachment' (singular)
                if not initial_comment.attachment.exists():
                    # No attachments found - remove the empty placeholder comment
                    initial_comment.delete()
                    logger.debug(f"Deleted empty initial comment for ticket {ticket.ticket_id} (no attachments)")
                else:
                    logger.info(f"Kept initial comment for ticket {ticket.ticket_id} because attachments were found")
                
                # ================================================================
                # Use HTML for ticket description to preserve email styling
                # This allows rendering in iframe on frontend for full fidelity
                # ================================================================
                if rendered_html:
                    ticket.description = rendered_html
                    ticket.save(update_fields=['description'])
                
                logger.info(f"Created ticket {ticket.ticket_id} from email")
            
            # Create email message record
            EmailMessageRecord.objects.create(
                integration=self.integration,
                business=self.integration.business,
                ticket=ticket,
                comment=comment,
                message_id=message_id,
                direction=EmailMessageRecord.Direction.INCOMING,
                subject=subject[:512],
                sender=sender_email or "",
                recipient=self.integration.email_address
                or self.integration.forwarding_address
                or "",
                raw_headers=dict(email_message.items()),
                raw_body=text_body or "",
                html_body=rendered_html or "",
                received_at=timezone.now(),
            )
        self.stats["processed"] += 1

    def _extract_sender_info(self, email_message) -> Tuple[Optional[str], Optional[str]]:
        from_header = email_message.get("From", "")
        
        # First, decode MIME-encoded header (e.g., =?UTF-8?B?...?=)
        decoded_parts = decode_header(from_header)
        decoded_from = ""
        for part, charset in decoded_parts:
            if isinstance(part, bytes):
                decoded_from += part.decode(charset or "utf-8", errors="ignore")
            else:
                decoded_from += part
        decoded_from = decoded_from.strip()
        
        # Now extract email and name from decoded header
        match = re.search(r'["\']?([^"\']+)["\']?\s*<(.+?)>', decoded_from)
        if match:
            return match.group(2), match.group(1).strip()
        simple_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", decoded_from)
        return (simple_match.group() if simple_match else None), None

    def _extract_bodies(self, email_message) -> Tuple[Optional[str], Optional[str]]:
        text_body = None
        html_body = None

        def _decode(part):
            payload = part.get_payload(decode=True)
            charset = part.get_content_charset() or "utf-8"
            return payload.decode(charset, errors="ignore") if payload else ""

        if email_message.is_multipart():
            for part in email_message.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain" and text_body is None:
                    text_body = _decode(part)
                elif content_type == "text/html" and html_body is None:
                    html_body = _decode(part)
        else:
            content_type = email_message.get_content_type()
            decoded = _decode(email_message)
            if content_type == "text/html":
                html_body = decoded
            else:
                text_body = decoded

        text_body = (text_body or "").strip()
        # strip quoted replies by common markers (plaintext only)
        for marker in ["\nOn ", "\rOn ", "\n> "]:
            idx = text_body.find(marker)
            if idx > 0:
                text_body = text_body[:idx].strip()
                break

        html_body = (html_body or "").strip()
        return text_body, html_body

    def _resolve_ticket(self, email_message, subject: str) -> Optional[Ticket]:
        headers = [
            email_message.get("In-Reply-To"),
            email_message.get("References"),
        ]
        header_ids = self._extract_message_ids(" ".join(filter(None, headers)))
        if header_ids:
            mapping = EmailTicketMapping.objects.filter(message_id__in=header_ids).select_related("ticket").first()
            if mapping:
                return mapping.ticket

        ticket_code = self._extract_ticket_code(subject, business=self.integration.business)
        if ticket_code:
            return Ticket.objects.filter(ticket_id__iexact=ticket_code, business=self.integration.business).first()
        return None

    @staticmethod
    def _extract_message_ids(header_value: Optional[str]) -> Iterable[str]:
        if not header_value:
            return []
        return re.findall(r"<[^>]+>", header_value)

    @staticmethod
    def _extract_ticket_code(subject: str, business=None) -> Optional[str]:
        return extract_ticket_code(subject, business=business)

    def _create_ticket(
        self,
        subject: str,
        body: Optional[str],
        sender_email: Optional[str],
        sender_name: Optional[str],
        message_id: str,
    ) -> Ticket:
        ticket_code = generate_ticket_id(business=self.integration.business)
        ticket_title = render_ticket_title(
            summary=subject or f"Email from {sender_email or 'Unknown'}",
            ticket_id=ticket_code,
            source="email",
            business=self.integration.business,
        )
        user = None
        if sender_email:
            user = Users.objects.filter(email__iexact=sender_email, business=self.integration.business).first()

        ticket = Ticket.objects.create(
            title=ticket_title,
            description=body or "",
            creator_name=sender_name,
            creator_email=sender_email,
            ticket_id=ticket_code,
            department=self.integration.department,
            business=self.integration.business,
            created_by=user,
            assigned_to=self.integration.default_assignee,
            source="email",
            priority="medium",
            is_public=False,
        )

        EmailTicketMapping.objects.create(message_id=message_id, ticket=ticket)
        
        # Auto-create or link contact
        if sender_email or sender_name:
            contact = link_or_create_contact(
                business=self.integration.business,
                name=sender_name,
                email=sender_email,
                phone=None,
                owner=user,
            )
            if contact:
                ticket.contact = contact
                ticket.save(update_fields=["contact"])
                logger.info(f"Linked contact {contact.id} to ticket {ticket.ticket_id}")
        
        duplicate_detection = DuplicateDetectionService().process_new_ticket(ticket, actor=user)
        if duplicate_detection:
            setattr(ticket, "_duplicate_detection", duplicate_detection)
            ticket.refresh_from_db()
            if duplicate_detection.get("status") == "auto_merged" and ticket.merged_into_id:
                EmailTicketMapping.objects.filter(message_id=message_id).update(ticket_id=ticket.merged_into_id)
                return Ticket.objects.get(id=ticket.merged_into_id)

        logger.info("Created ticket %s from email", ticket.ticket_id)
        return ticket

    def _add_comment(
        self,
        ticket: Ticket,
        body: Optional[str],
        sender_email: Optional[str],
        sender_name: Optional[str],
        message_id: str,
    ) -> TicketComment:
        user = None
        if sender_email:
            user = Users.objects.filter(email__iexact=sender_email, business=ticket.business).first()

        comment = ticket.comments.create(
            ticket=ticket,
            content=body or "Email reply",
            author=user,
            is_internal=False,
        )
        EmailTicketMapping.objects.create(message_id=message_id, ticket=ticket)
        
        # Set has_new_reply badge if reply is from someone other than the assigned agent
        if ticket.assigned_to_id is None or (user and user.id != ticket.assigned_to_id) or user is None:
            ticket.has_new_reply = True
            ticket.save(update_fields=['has_new_reply'])
        
        logger.info("Added email reply to ticket %s", ticket.ticket_id)
        return comment

    def _process_attachments(self, email_message, ticket: Ticket, comment: Optional[TicketComment] = None, html_body: Optional[str] = None) -> Dict[str, str]:
        """
        Process email attachments per RFC 2183 standard.
        Only parts with Content-Disposition: attachment are real attachments.
        """
        cid_map: Dict[str, str] = {}
        if not email_message.is_multipart():
            return cid_map
        
        for part in email_message.walk():
            if part.get_content_maintype() == "multipart":
                continue
            
            # RFC 2183: Only process parts with Content-Disposition: attachment
            # This is the STANDARD way attachments are marked in emails
            disposition = part.get_content_disposition()
            filename = part.get_filename()

            # Relaxed Detection Logic:
            # check 1: Explicitly marked as attachment
            is_explicit_attachment = (disposition == "attachment")
            
            # check 2: Has a filename (and is not just the body text)
            # Some clients send inline images without disposition but WITH filename
            has_filename = bool(filename)
            
            if not is_explicit_attachment and not has_filename:
                # Neither an explicit attachment nor something with a filename -> Skip
                continue
            
            if filename:
                decoded = decode_header(filename)[0]
                if isinstance(decoded, tuple):
                    filename = decoded[0].decode(decoded[1] or "utf-8") if decoded[1] else decoded[0]
            else:
                # Attachment without filename - try to guess extension from content type
                content_type = part.get_content_type()
                ext = mimetypes.guess_extension(content_type)
                if not ext:
                    # Fallback to subtype if guessing fails
                    ext = f".{part.get_content_subtype()}" if part.get_content_subtype() else ".bin"
                
                filename = f"attachment-{uuid.uuid4()}{ext}"
                print(f"[ATTACHMENT DEBUG] Generated filename for unnamed part: {filename} (Content-Type: {content_type})")

            extension = os.path.splitext(filename)[1].lower()
            if extension and extension not in ALLOWED_ATTACHMENT_EXTENSIONS:
                print(f"[ATTACHMENT DEBUG] Skipping attachment {filename} due to extension filter ({extension})")
                logger.debug("Skipping attachment %s due to extension filter", filename)
                continue
            
            print(f"[ATTACHMENT DEBUG] Processing attachment: {filename} (Size: {len(part.get_payload())} bytes)")

            data = part.get_payload(decode=True)
            if not data:
                continue

            unique_filename = f"{uuid.uuid4()}{extension}"
            business_id = self.integration.business.id if self.integration and self.integration.business else None
            files_dir = os.path.join(settings.MEDIA_ROOT, "files", str(business_id)) if business_id else os.path.join(settings.MEDIA_ROOT, "files")
            os.makedirs(files_dir, exist_ok=True)
            file_path = os.path.join(files_dir, unique_filename)

            with open(file_path, "wb") as fp:
                fp.write(data)

            base_url = f"{settings.FILE_URL}/{business_id}" if business_id else settings.FILE_URL
            file_url = f"{base_url}/{unique_filename}"
            
            # Always create ticket-level attachment for the Attachments tab
            TicketAttachment.objects.create(
                ticket=ticket,
                file_url=file_url,
                filename=filename,
                description=f"Email attachment: {filename}",
            )
            
            # Also create comment-level attachment for activity stream display
            if comment:
                TicketReplayAttachment.objects.create(
                    comment=comment,
                    file_url=file_url,
                    filename=filename,
                )

            if content_id := part.get("Content-ID"):
                cid_clean = content_id.strip("<>")
                cid_map[cid_clean] = file_url

        return cid_map

    def _rewrite_cid_references(self, html_body: str, cid_map: Dict[str, str]) -> str:
        if not cid_map:
            return html_body

        def _replace(match):
            cid = match.group(1)
            return cid_map.get(cid, f"cid:{cid}")

        pattern = re.compile(r"cid:([^\"'>\s]+)", re.IGNORECASE)
        return pattern.sub(_replace, html_body)


class MailIngestionCoordinator:
    """Run ingestion for all active mail integrations."""

    def run(self, exclude_providers: Optional[list] = None) -> Dict[str, int]:
        summary = {"integrations": 0, "processed": 0, "tickets_created": 0, "replies_added": 0, "errors": 0}
        exclude_providers = exclude_providers or []
        integrations = (
            MailIntegration.objects.filter(
                is_active=True,
                connection_status=MailIntegration.ConnectionStatus.CONNECTED,
                direction__in=[MailIntegration.Direction.INCOMING, MailIntegration.Direction.BOTH],
            )
            .exclude(provider__in=exclude_providers)
            .select_related("department", "business")
        )
        for integration in integrations:
            service = MailIntegrationIngestionService(integration)
            stats = service.run()
            summary["integrations"] += 1
            summary["processed"] += stats["processed"]
            summary["tickets_created"] += stats["tickets_created"]
            summary["replies_added"] += stats["replies_added"]
            summary["errors"] += stats["errors"]
        return summary
