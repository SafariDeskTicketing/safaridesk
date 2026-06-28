"""
Centralised logger factory for SafariDesk.

Usage (every module):
    from util.log import get_logger
    log = get_logger("mail_sync")          # service name used as a tag
    log.info("ticket_created", ticket_id="INC-0036", business_id=42)

Every call produces a JSON line:
    {"timestamp": "...", "level": "info", "service": "mail_sync",
     "event": "ticket_created", "ticket_id": "INC-0036", "business_id": 42}

Standard field names (follow these everywhere):
    business_id   int   — any tenant-scoped operation
    integration_id int  — mail integration
    ticket_id     str   — ticket reference (INC-xxx)
    task_id       str   — task reference
    user_id       int   — acting user
    service       str   — logical subsystem (mail_sync, celery, api, …)
    event         str   — snake_case verb-noun ("ticket_created_from_email")
    duration_ms   int   — for perf-sensitive operations
    error         str   — exception message (never a full traceback in the field)
"""

import structlog


def get_logger(service: str = "app"):
    """Return a structlog logger pre-bound with *service*."""
    return structlog.get_logger().bind(service=service)
