from __future__ import annotations

import re
from datetime import datetime
from typing import Iterable, Optional, Tuple

from tenant.models.ConfigModel import TicketConfig
from util.Helper import Helper

DEFAULT_TICKET_ID_FORMAT = "ITK-{YYYY}-{####}"
DEFAULT_TICKET_TITLE_FORMAT = "{summary}"
DEFAULT_TICKET_SUMMARY = "Support request"

SUPPORTED_TITLE_TOKENS = frozenset(
    {
        "{summary}",
        "{ticket_id}",
        "{source}",
        "{YYYY}",
        "{YY}",
        "{MM}",
        "{DD}",
    }
)

_FORMAT_DATE_TOKEN_PATTERNS = {
    "{YYYY}": r"\d{4}",
    "{YY}": r"\d{2}",
    "{MM}": r"\d{2}",
    "{DD}": r"\d{2}",
}
_TITLE_TOKEN_PATTERN = re.compile(r"\{[^{}]+\}")

_FALLBACK_SUBJECT_PATTERNS: Tuple[re.Pattern, ...] = (
    re.compile(r"\b([A-Z]{2,10}-\d{2,4}-\d{1,12})\b", re.IGNORECASE),
    re.compile(r"#([A-Z0-9][A-Z0-9\-]{1,254})", re.IGNORECASE),
    re.compile(r"\b(INC[0-9A-Z]+)\b", re.IGNORECASE),
)


def _resolve_business(business):
    if business is None:
        return None
    if hasattr(business, "id"):
        return business
    try:
        business_id = int(business)
    except (TypeError, ValueError):
        return None
    try:
        from users.models.BusinessModel import Business

        return Business.objects.filter(id=business_id).first()
    except Exception:
        return None


def get_ticket_config(business=None) -> Optional[TicketConfig]:
    resolved_business = _resolve_business(business)
    if not resolved_business:
        return None
    return TicketConfig.objects.filter(business=resolved_business).first()


def get_ticket_id_format(business=None) -> str:
    config = get_ticket_config(business)
    configured = (config.id_format if config else "") or ""
    return configured.strip() or DEFAULT_TICKET_ID_FORMAT


def get_ticket_title_format(business=None) -> str:
    config = get_ticket_config(business)
    configured = (config.title_format if config else "") or ""
    return configured.strip() or DEFAULT_TICKET_TITLE_FORMAT


def validate_title_format(format_template: str) -> Tuple[bool, list[str]]:
    if not isinstance(format_template, str):
        return False, ["<invalid_type>"]
    template = format_template.strip()
    if not template:
        return False, ["<empty>"]

    found_tokens = set(_TITLE_TOKEN_PATTERN.findall(template))
    invalid_tokens = sorted(token for token in found_tokens if token not in SUPPORTED_TITLE_TOKENS)
    return len(invalid_tokens) == 0, invalid_tokens


def generate_ticket_id(*, business=None) -> str:
    resolved_business = _resolve_business(business)
    return Helper().generate_incident_code(business=resolved_business)


def render_ticket_title(
    *,
    summary: Optional[str],
    ticket_id: Optional[str] = None,
    source: Optional[str] = None,
    business=None,
    format_template: Optional[str] = None,
    now: Optional[datetime] = None,
    max_length: Optional[int] = 200,
) -> str:
    dt = now or datetime.now()
    safe_summary = (summary or "").strip() or DEFAULT_TICKET_SUMMARY
    safe_source = (source or "").strip() or "web"

    template = (format_template or get_ticket_title_format(business) or DEFAULT_TICKET_TITLE_FORMAT).strip()
    if not template:
        template = DEFAULT_TICKET_TITLE_FORMAT

    replacements = {
        "{summary}": safe_summary,
        "{ticket_id}": (ticket_id or "").strip(),
        "{source}": safe_source,
        "{YYYY}": f"{dt.year:04d}",
        "{YY}": f"{dt.year % 100:02d}",
        "{MM}": f"{dt.month:02d}",
        "{DD}": f"{dt.day:02d}",
    }

    title = template
    for token, value in replacements.items():
        title = title.replace(token, value)

    title = _TITLE_TOKEN_PATTERN.sub("", title)
    title = re.sub(r"\s+", " ", title).strip(" -:_")
    title = title or safe_summary
    return title[:max_length] if max_length is not None else title


def build_ticket_id_regex(format_template: str) -> re.Pattern:
    template = (format_template or "").strip() or DEFAULT_TICKET_ID_FORMAT
    pattern_parts = []
    idx = 0

    while idx < len(template):
        current = template[idx]
        if current == "{":
            end = template.find("}", idx + 1)
            if end != -1:
                token = template[idx : end + 1]
                if token in _FORMAT_DATE_TOKEN_PATTERNS:
                    pattern_parts.append(_FORMAT_DATE_TOKEN_PATTERNS[token])
                    idx = end + 1
                    continue

                inner = token[1:-1]
                if inner and set(inner) == {"#"}:
                    # IDs can overflow placeholder width (e.g. {####} -> 10000),
                    # so parse at least the configured width rather than exact width.
                    pattern_parts.append(rf"\d{{{len(inner)},}}")
                    idx = end + 1
                    continue

        pattern_parts.append(re.escape(current))
        idx += 1

    return re.compile("".join(pattern_parts), re.IGNORECASE)


def _clean_ticket_code(code: str) -> str:
    cleaned = (code or "").strip()
    cleaned = cleaned.rstrip(".,;:)]}>\"'")
    cleaned = cleaned.lstrip("<([{\"'")
    return cleaned.strip()


def _find_first_match(subject: str, patterns: Iterable[re.Pattern]) -> Optional[str]:
    for pattern in patterns:
        match = pattern.search(subject)
        if not match:
            continue
        if match.groups():
            return match.group(1)
        return match.group(0)
    return None


def extract_ticket_code(subject: str, *, business=None, id_format: Optional[str] = None) -> Optional[str]:
    if not subject:
        return None

    configured_format = (id_format or "").strip() or get_ticket_id_format(business)
    configured_match = _find_first_match(subject, (build_ticket_id_regex(configured_format),))
    if configured_match:
        return _clean_ticket_code(configured_match)

    fallback_match = _find_first_match(subject, _FALLBACK_SUBJECT_PATTERNS)
    if fallback_match:
        return _clean_ticket_code(fallback_match)
    return None
