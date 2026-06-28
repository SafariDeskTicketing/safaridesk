from __future__ import annotations

import base64
import json as _json
from datetime import timedelta
from typing import Dict
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.core import signing
from django.core.exceptions import ImproperlyConfigured
from django.utils import timezone

GOOGLE_AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token"
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email",
]

MICROSOFT_AUTH_URI = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
MICROSOFT_TOKEN_URI = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
MICROSOFT_SCOPES = [
    "openid",
    "email",
    "profile",
    "offline_access",
    "https://outlook.office.com/IMAP.AccessAsUser.All",
    "https://outlook.office.com/SMTP.Send",
]

STATE_SALT = "mail-integration-oauth"


def sign_oauth_state(data: Dict) -> str:
    return signing.dumps(data, salt=STATE_SALT)


def verify_oauth_state(state: str) -> Dict:
    return signing.loads(state, salt=STATE_SALT, max_age=3600)


def _ensure_google_config():
    if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
        raise ImproperlyConfigured("Google OAuth credentials are not configured.")


def _ensure_ms_config():
    if not settings.MICROSOFT_OAUTH_CLIENT_ID or not settings.MICROSOFT_OAUTH_CLIENT_SECRET:
        raise ImproperlyConfigured("Microsoft OAuth credentials are not configured.")


def build_google_auth_url(state: str) -> str:
    _ensure_google_config()
    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
        "include_granted_scopes": "true",
    }
    return f"{GOOGLE_AUTH_URI}?{urlencode(params)}"


def exchange_google_code(code: str) -> Dict:
    _ensure_google_config()
    payload = {
        "code": code,
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    resp = requests.post(GOOGLE_TOKEN_URI, data=payload, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    expires_in = int(data.get("expires_in", 3600))
    expires_at = timezone.now() + timedelta(seconds=max(expires_in - 60, 60))
    return {
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
        "expires_at": expires_at,
        "scope": data.get("scope"),
        "token_type": data.get("token_type"),
    }


def refresh_google_token(refresh_token: str) -> Dict:
    _ensure_google_config()
    payload = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    resp = requests.post(GOOGLE_TOKEN_URI, data=payload, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    expires_in = int(data.get("expires_in", 3600))
    expires_at = timezone.now() + timedelta(seconds=max(expires_in - 60, 60))
    return {
        "access_token": data.get("access_token"),
        "expires_at": expires_at,
        "scope": data.get("scope"),
        "token_type": data.get("token_type"),
    }


def build_microsoft_auth_url(state: str) -> str:
    _ensure_ms_config()
    params = {
        "client_id": settings.MICROSOFT_OAUTH_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.MICROSOFT_OAUTH_REDIRECT_URI,
        "response_mode": "query",
        "scope": " ".join(MICROSOFT_SCOPES),
        "state": state,
        "prompt": "select_account",
    }
    return f"{MICROSOFT_AUTH_URI}?{urlencode(params)}"


def exchange_microsoft_code(code: str) -> Dict:
    _ensure_ms_config()
    payload = {
        "client_id": settings.MICROSOFT_OAUTH_CLIENT_ID,
        "client_secret": settings.MICROSOFT_OAUTH_CLIENT_SECRET,
        "code": code,
        "redirect_uri": settings.MICROSOFT_OAUTH_REDIRECT_URI,
        "grant_type": "authorization_code",
        "scope": " ".join(MICROSOFT_SCOPES),
    }
    resp = requests.post(MICROSOFT_TOKEN_URI, data=payload, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    expires_in = int(data.get("expires_in", 3600))
    expires_at = timezone.now() + timedelta(seconds=max(expires_in - 60, 60))

    email = None
    id_token = data.get("id_token", "")
    if id_token:
        try:
            padded = id_token.split(".")[1]
            padded += "=" * (4 - len(padded) % 4)
            claims = _json.loads(base64.urlsafe_b64decode(padded))
            email = claims.get("email") or claims.get("preferred_username")
        except Exception:
            pass

    return {
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
        "expires_at": expires_at,
        "scope": data.get("scope"),
        "token_type": data.get("token_type"),
        "email": email,
    }


_MICROSOFT_REFRESH_SCOPES = [
    "offline_access",
    "https://outlook.office.com/IMAP.AccessAsUser.All",
    "https://outlook.office.com/SMTP.Send",
]

_MICROSOFT_GRAPH_SEND_SCOPES = [
    "https://graph.microsoft.com/Mail.Send",
]


def refresh_microsoft_token(refresh_token: str) -> Dict:
    _ensure_ms_config()
    payload = {
        "client_id": settings.MICROSOFT_OAUTH_CLIENT_ID,
        "client_secret": settings.MICROSOFT_OAUTH_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "redirect_uri": settings.MICROSOFT_OAUTH_REDIRECT_URI,
        "grant_type": "refresh_token",
        "scope": " ".join(_MICROSOFT_REFRESH_SCOPES),
    }
    resp = requests.post(MICROSOFT_TOKEN_URI, data=payload, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    expires_in = int(data.get("expires_in", 3600))
    expires_at = timezone.now() + timedelta(seconds=max(expires_in - 60, 60))
    result = {
        "access_token": data.get("access_token"),
        "expires_at": expires_at,
        "scope": data.get("scope"),
        "token_type": data.get("token_type"),
    }
    # Microsoft may rotate the refresh token — capture it if returned
    if data.get("refresh_token"):
        result["refresh_token"] = data.get("refresh_token")
    return result


def refresh_microsoft_graph_send_token(refresh_token: str) -> Dict:
    _ensure_ms_config()
    payload = {
        "client_id": settings.MICROSOFT_OAUTH_CLIENT_ID,
        "client_secret": settings.MICROSOFT_OAUTH_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "redirect_uri": settings.MICROSOFT_OAUTH_REDIRECT_URI,
        "grant_type": "refresh_token",
        "scope": " ".join(_MICROSOFT_GRAPH_SEND_SCOPES),
    }
    resp = requests.post(MICROSOFT_TOKEN_URI, data=payload, timeout=20)
    resp.raise_for_status()
    data = resp.json()
    expires_in = int(data.get("expires_in", 3600))
    expires_at = timezone.now() + timedelta(seconds=max(expires_in - 60, 60))
    result = {
        "access_token": data.get("access_token"),
        "expires_at": expires_at,
        "scope": data.get("scope"),
        "token_type": data.get("token_type"),
    }
    if data.get("refresh_token"):
        result["refresh_token"] = data.get("refresh_token")
    return result


def fetch_google_userinfo(access_token: str) -> Dict:
    """
    Fetch basic profile info (including email) for the authorized Google user.
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = requests.get("https://www.googleapis.com/oauth2/v2/userinfo", headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json()


def fetch_microsoft_userinfo(access_token: str) -> Dict:
    """
    Fetch the signed-in user's profile (including mail/userPrincipalName) via Microsoft Graph.
    Returns a dict with at least 'mail' and 'userPrincipalName'.
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = requests.get("https://graph.microsoft.com/v1.0/me", headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json()
