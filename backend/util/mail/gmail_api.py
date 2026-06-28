from __future__ import annotations

from typing import Any

import requests

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


class GmailHistoryExpiredError(RuntimeError):
    """Raised when Gmail rejects a stale history cursor."""


def _gmail_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def get_gmail_profile(access_token: str) -> dict[str, Any]:
    resp = requests.get(
        f"{GMAIL_API_BASE}/profile",
        headers=_gmail_headers(access_token),
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()


def get_gmail_history(
    access_token: str,
    start_history_id: int,
    *,
    label_id: str = "INBOX",
) -> dict[str, Any]:
    history: list[dict[str, Any]] = []
    page_token: str | None = None
    latest_history_id: int | None = None

    while True:
        params: dict[str, Any] = {
            "startHistoryId": str(start_history_id),
            "labelId": label_id,
            "historyTypes": ["messageAdded"],
        }
        if page_token:
            params["pageToken"] = page_token

        resp = requests.get(
            f"{GMAIL_API_BASE}/history",
            headers=_gmail_headers(access_token),
            params=params,
            timeout=20,
        )
        if resp.status_code == 404:
            raise GmailHistoryExpiredError("Gmail history cursor expired")
        resp.raise_for_status()

        data = resp.json()
        if data.get("historyId") is not None:
            latest_history_id = int(data["historyId"])
        history.extend(data.get("history", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            return {
                "history": history,
                "history_id": latest_history_id,
            }


def get_gmail_message_raw(access_token: str, message_id: str) -> dict[str, Any]:
    resp = requests.get(
        f"{GMAIL_API_BASE}/messages/{message_id}",
        headers=_gmail_headers(access_token),
        params={"format": "raw"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def mark_gmail_message_read(access_token: str, message_id: str) -> None:
    resp = requests.post(
        f"{GMAIL_API_BASE}/messages/{message_id}/modify",
        headers={
            **_gmail_headers(access_token),
            "Content-Type": "application/json",
        },
        json={"removeLabelIds": ["UNREAD"]},
        timeout=20,
    )
    resp.raise_for_status()
