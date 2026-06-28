"""
Agentic chatbot baseline rules and limits for Gemini function-calling flows.
Defines required contact fields, validation patterns, and loop caps.
"""

from __future__ import annotations

import re
from typing import Optional

# Contact fields required before creating a ticket
REQUIRED_CONTACT_FIELDS = ("name", "email", "phone")

# Simple, permissive validation patterns
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", re.IGNORECASE)
PHONE_REGEX = re.compile(r"^\+?[0-9\-\s\(\)]{7,20}$")

# Agentic loop safeguards
MAX_TOOL_CALLS_PER_TURN = 4  # cap function-call iterations per user message
DEFAULT_TOOL_TIMEOUT_SECONDS = 5  # per-tool timeout budget
TOTAL_TURN_TIMEOUT_SECONDS = 12  # guardrail for an entire turn
VALIDATION_ATTEMPTS_PER_FIELD = 3  # max retries for a single field before escalation


def is_valid_name(name: Optional[str]) -> bool:
    """Name must be non-empty after stripping."""
    return bool(name and name.strip())


def is_valid_email(email: Optional[str]) -> bool:
    """Email must match a simple RFC-like pattern."""
    if not email:
        return False
    return bool(EMAIL_REGEX.match(email.strip()))


def is_valid_phone(phone: Optional[str]) -> bool:
    """Phone accepts international prefixes and common separators."""
    if not phone:
        return False
    return bool(PHONE_REGEX.match(phone.strip()))
