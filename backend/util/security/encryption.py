from __future__ import annotations

from functools import lru_cache
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken  # type: ignore
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


@lru_cache(maxsize=1)
def get_cipher() -> Fernet:
    """
    Lazily instantiate a Fernet cipher using SECRET_ENCRYPTION_KEY.

    The key must be a base64-encoded 32-byte string. Raise ImproperlyConfigured
    if the project has not configured one (protects us from silently storing
    secrets in plaintext).
    """
    key = getattr(settings, "SECRET_ENCRYPTION_KEY", None)
    if not key:
        raise ImproperlyConfigured(
            "SECRET_ENCRYPTION_KEY is not configured. "
            "Generate one with `from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())` and add it to the environment."
        )
    if isinstance(key, str):
        key = key.encode("utf-8")
    return Fernet(key)


def encrypt_value(value: Optional[str]) -> str:
    """Encrypt a string; return empty string for None/blank values."""
    if not value:
        return ""
    cipher = get_cipher()
    token = cipher.encrypt(value.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_value(value: Optional[str], *, default: Optional[str] = None) -> Optional[str]:
    """Decrypt a previously encrypted string; return default on errors/empty input."""
    if not value:
        return default
    cipher = get_cipher()
    try:
        return cipher.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return default
