from __future__ import annotations

import re

from django.db.models import Q
from django.utils.dateparse import parse_date, parse_datetime

from RNSafarideskBack import settings
from shared.models.BaseModel import BaseEntity
from users.models import Users

MENTION_PATTERN = re.compile(r'(?<![\w@])@([A-Za-z0-9._-]+(?:\s+[A-Za-z0-9._-]+)*)')


def extract_mention_tokens(text: str) -> list[str]:
    if not text:
        return []
    tokens = [token.strip(".,:;!?()[]{}\"' ").strip() for token in MENTION_PATTERN.findall(text)]
    # Keep order while removing duplicates
    return list(dict.fromkeys(token for token in tokens if token))


def display_name(user: Users) -> str:
    first = (getattr(user, 'first_name', '') or '').strip()
    last = (getattr(user, 'last_name', '') or '').strip()
    full = f"{first} {last}".strip()
    if full:
        return full

    username = (getattr(user, 'username', '') or '').strip()
    if username:
        return username

    email = (getattr(user, 'email', '') or '').strip()
    if email and '@' in email:
        return email.split('@')[0]
    return email or str(getattr(user, 'id', 'User'))


def resolve_staff_user(user):
    return user if BaseEntity._is_auth_user_instance(user) else None


def resolve_mentioned_users(mention_token: str, business=None):
    """
    Resolve mention tokens against likely user identifiers.
    Priority is exact username/email-prefix/name match, then broader contains.
    """
    normalized = mention_token.strip()
    if not normalized:
        return Users.objects.none()

    parts = [p for p in normalized.split() if p]
    name_match = Q()
    if len(parts) >= 2:
        # Handle "First Last" style mentions without relying on non-model fields.
        name_match = Q(first_name__iexact=parts[0], last_name__iexact=' '.join(parts[1:]))

    exact_qs = Users.objects.filter(
        Q(username__iexact=normalized)
        | Q(email__istartswith=f"{normalized}@")
        | Q(first_name__iexact=normalized)
        | Q(last_name__iexact=normalized)
        | name_match
    )

    if business:
        exact_qs = exact_qs.filter(business=business)

    if exact_qs.exists():
        return exact_qs.distinct()

    fuzzy_qs = Users.objects.filter(
        Q(username__istartswith=normalized)
        | Q(email__istartswith=f"{normalized}@")
        | Q(first_name__istartswith=normalized)
        | Q(last_name__istartswith=normalized)
    )

    if business:
        fuzzy_qs = fuzzy_qs.filter(business=business)

    return fuzzy_qs.distinct()


def sanitize_text_for_mysql(text: str) -> str:
    """
    Remove 4-byte Unicode characters (like emojis) when the database engine
    is MySQL and the connection isn't configured to use utf8mb4. This prevents
    MySQL errors like "Incorrect string value: '\xF0\x9F...'" on insert.

    We only sanitize when a non-utf8mb4 MySQL is used; otherwise, return text unchanged.
    """
    try:
        engine = settings.DATABASES.get('default', {}).get('ENGINE', '')
    except Exception:
        engine = ''

    # Only apply for MySQL with incompatible charset
    if 'mysql' in engine.lower():
        opts = settings.DATABASES.get('default', {}).get('OPTIONS', {}) or {}
        charset = opts.get('charset', '')
        if charset and charset.lower() == 'utf8mb4':
            return text

        # Remove non-BMP characters (codepoints > 0xFFFF) - emojis are outside BMP
        if text:
            try:
                # Keep BMP (<= 0xFFFF) characters only
                return ''.join(ch for ch in text if ord(ch) <= 0xFFFF)
            except Exception:
                # Fallback: replace unknown chars to avoid crash
                return text.encode('utf-8', errors='replace').decode('utf-8')

    return text


def parse_date_input(value: str):
    if not value:
        return None
    parsed_datetime = parse_datetime(value.replace('Z', '+00:00'))
    if parsed_datetime:
        return parsed_datetime.date()
    return parse_date(value)
