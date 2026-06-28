"""
Tool schemas and dispatchers for Gemini function calling.
Includes KB search, contact validation, and ticket creation helpers.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from tenant.services.ai.agentic_settings import (
    REQUIRED_CONTACT_FIELDS,
    is_valid_email,
    is_valid_name,
    is_valid_phone,
    MAX_TOOL_CALLS_PER_TURN,
    DEFAULT_TOOL_TIMEOUT_SECONDS,
)
from tenant.services.ai.kb_search import KBSearchService
from tenant.services.ai.ticket_extractor import TicketExtractor
from tenant.services.tickets.creation import create_ticket_from_payload
from tenant.services.tickets.reference_resolver import (
    get_ticket_reference_options,
    resolve_assignee,
    resolve_label_ids,
)

logger = logging.getLogger(__name__)


# --- Tool schemas (JSONSchema-like) ---
TOOL_KB_SEARCH = {
    "name": "kb_search",
    "description": "Search the knowledge base for relevant articles. Use to ground answers before responding.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "query": {"type": "STRING", "description": "Search query text"},
            "top_k": {
                "type": "INTEGER",
                "description": "Maximum articles to return",
            },
        },
        "required": ["query"],
    },
}

TOOL_VALIDATE_CONTACT_FIELDS = {
    "name": "validate_contact_fields",
    "description": "Validate required contact fields (name, email, phone) and report missing or invalid entries.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "name": {"type": "STRING", "description": "Full name of the user"},
            "email": {"type": "STRING", "description": "Email address of the user"},
            "phone": {"type": "STRING", "description": "Phone number of the user"},
            "text": {
                "type": "STRING",
                "description": "Latest user message to inspect for contact info if provided inline",
            },
            "history": {
                "type": "ARRAY",
                "items": {"type": "OBJECT", "properties": {}},
                "description": "Optional recent messages for context (not parsed here)",
            },
        },
    },
}

TOOL_CREATE_TICKET = {
    "name": "create_ticket",
    "description": "Create a support ticket after contact fields are validated. Use only IDs returned by ticket_options for routing, labels, and assignee.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "contact": {
                "type": "OBJECT",
                "description": "Validated contact fields",
                "properties": {
                    "name": {"type": "STRING"},
                    "email": {"type": "STRING"},
                    "phone": {"type": "STRING"},
                },
                "required": ["name", "email", "phone"],
            },
            "context_text": {
                "type": "STRING",
                "description": "Problem description gathered from conversation",
            },
            "title": {"type": "STRING", "description": "Optional ticket title"},
            "description": {"type": "STRING", "description": "Optional ticket description"},
            "category_id": {"type": "INTEGER", "description": "Category ID to route the ticket"},
            "department_id": {"type": "INTEGER", "description": "Department ID to assign the ticket"},
            "label_ids": {
                "type": "ARRAY",
                "description": "Optional existing active label IDs from ticket_options. Omit if uncertain.",
                "items": {"type": "INTEGER"},
            },
            "assignee_id": {
                "type": "INTEGER",
                "description": "Optional existing active assignee ID from ticket_options. Omit if uncertain.",
            },
            "priority": {
                "type": "STRING",
                "description": "Ticket priority",
                "enum": ["low", "medium", "high"],
            },
        },
        "required": ["contact", "context_text"],
    },
}

TOOL_TICKET_OPTIONS = {
    "name": "ticket_options",
    "description": "Return valid existing departments, categories, labels, and assignable agents for this business. Call before create_ticket when choosing IDs.",
    "parameters": {
        "type": "OBJECT",
        "properties": {},
    },
}

TOOL_RESOLUTION_STATUS = {
    "name": "resolution_status",
    "description": "Report whether the issue was resolved after KB steps, or if escalation is needed.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "resolved": {"type": "BOOLEAN", "description": "True if the issue is fixed."},
            "reason": {"type": "STRING", "description": "Short reason or remaining blocker."},
        },
        "required": ["resolved"],
    },
}


def get_tool_schemas() -> List[Dict[str, Any]]:
    """Return the list of tool schemas to present to Gemini."""
    return [TOOL_KB_SEARCH, TOOL_VALIDATE_CONTACT_FIELDS, TOOL_TICKET_OPTIONS, TOOL_CREATE_TICKET, TOOL_RESOLUTION_STATUS]


# --- Tool executors ---
def _normalize_top_k(top_k: Optional[int]) -> int:
    if not top_k or top_k <= 0:
        return 5
    return min(top_k, 10)


def kb_search_tool(*, business_id: int, query: str, top_k: Optional[int] = None) -> Dict[str, Any]:
    svc = KBSearchService()
    limit = _normalize_top_k(top_k)
    results = svc.search(int(business_id), query, top_k=limit)
    logger.info(f"[AI] kb_search_tool results={len(results)} business={business_id} query={query}")
    return {
        "query": query,
        "results": results,
        "count": len(results),
    }


def validate_contact_fields_tool(
    *,
    name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    text: Optional[str] = None,
    history: Optional[List[Dict[str, Any]]] = None,  # unused, reserved for future parsing
) -> Dict[str, Any]:
    normalized: Dict[str, Optional[str]] = {
        "name": (name or "").strip() or None,
        "email": (email or "").strip() or None,
        "phone": (phone or "").strip() or None,
    }
    invalid: Dict[str, str] = {}

    if normalized["name"] is not None and not is_valid_name(normalized["name"]):
        invalid["name"] = "Name is required."
    if normalized["email"] is not None and not is_valid_email(normalized["email"]):
        invalid["email"] = "Email format is invalid."
    if normalized["phone"] is not None and not is_valid_phone(normalized["phone"]):
        invalid["phone"] = "Phone format is invalid."

    missing = [
        field for field in REQUIRED_CONTACT_FIELDS
        if normalized.get(field) is None
    ]

    return {
        "normalized": normalized,
        "missing": missing,
        "invalid": invalid,
        "is_complete": not missing and not invalid,
    }


def _merge_ticket_fields(
    inferred: Dict[str, Any],
    overrides: Dict[str, Any],
) -> Dict[str, Any]:
    merged = {**inferred}
    for key, val in overrides.items():
        if val is not None:
            merged[key] = val
    return merged


def ticket_options_tool(*, business_id: int) -> Dict[str, Any]:
    return get_ticket_reference_options(int(business_id))


def _valid_routing_options(business_id: int) -> Dict[str, Any]:
    return get_ticket_reference_options(int(business_id))


def _validate_ticket_route(business_id: int, category_id: Any, department_id: Any) -> Dict[str, Any]:
    options = _valid_routing_options(business_id)
    if not category_id or not department_id:
        return {
            "ok": False,
            "error": "routing_missing",
            "missing": [
                key
                for key, value in {"category_id": category_id, "department_id": department_id}.items()
                if not value
            ],
            "valid_options": options,
        }

    try:
        category_id_int = int(category_id)
        department_id_int = int(department_id)
    except (TypeError, ValueError):
        return {
            "ok": False,
            "error": "routing_invalid",
            "message": "category_id and department_id must be valid IDs from the current business.",
            "valid_options": options,
        }

    category_ids = {item["id"] for item in options["categories"]}
    department_ids = {item["id"] for item in options["departments"]}
    if category_id_int not in category_ids or department_id_int not in department_ids:
        return {
            "ok": False,
            "error": "routing_invalid",
            "message": "AI routing must use a valid category_id and department_id for this business.",
            "valid_options": options,
        }

    return {"ok": True, "category_id": category_id_int, "department_id": department_id_int}


def create_ticket_tool(
    *,
    business_id: int,
    contact: Dict[str, Any],
    context_text: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    category_id: Optional[int] = None,
    department_id: Optional[int] = None,
    label_ids: Optional[List[int]] = None,
    assignee_id: Optional[int] = None,
    priority: Optional[str] = None,
) -> Dict[str, Any]:
    # Validate contact presence
    for field in REQUIRED_CONTACT_FIELDS:
        if not contact.get(field):
            raise ValueError(f"Missing contact field: {field}")

    # Infer ticket fields from context when not provided
    extractor = TicketExtractor()
    context_source = context_text or description or title or ""
    inferred = extractor.extract(int(business_id), context_source)

    # Heuristic defaults for dashboard freeze/stale data
    context_lower = (context_source or "").lower()
    default_title = _best_default_title(context_lower, inferred.get("title"))
    default_description = _best_default_description(context_lower, context_source, inferred.get("description"))

    payload = _merge_ticket_fields(
        inferred,
        {
            "title": title or default_title,
            "description": description or default_description,
            "category_id": category_id,
            "department_id": department_id,
            "priority": priority or inferred.get("priority") or "medium",
        },
    )

    # Map contact fields to ticket payload keys
    payload.update(
        {
            "creator_name": contact.get("name"),
            "creator_email": contact.get("email"),
            "creator_phone": contact.get("phone"),
        }
    )

    # Validate required routing fields
    missing_routing = [
        key for key in ("category_id", "department_id", "priority", "title", "description")
        if not payload.get(key)
    ]
    if missing_routing:
        return {
            "error": "routing_missing",
            "missing": missing_routing,
            "valid_options": _valid_routing_options(int(business_id)),
        }

    route_validation = _validate_ticket_route(int(business_id), payload.get("category_id"), payload.get("department_id"))
    if not route_validation.get("ok"):
        return route_validation
    payload["category_id"] = route_validation["category_id"]
    payload["department_id"] = route_validation["department_id"]

    label_resolution = resolve_label_ids(int(business_id), label_ids or [])
    if label_resolution["invalid"]:
        return {
            "error": "labels_invalid",
            "message": "AI labels must use existing active label IDs for this business.",
            "invalid": label_resolution["invalid"],
            "valid_options": _valid_routing_options(int(business_id)),
        }
    payload["label_ids"] = label_resolution["ids"]

    assignee = None
    if assignee_id is not None:
        assignee = resolve_assignee(int(business_id), assignee_id)
        if not assignee:
            return {
                "error": "assignee_invalid",
                "message": "AI assignee must be an existing active user for this business.",
                "valid_options": _valid_routing_options(int(business_id)),
            }
        payload["assignee_id"] = assignee["id"]

    ticket = create_ticket_from_payload(
        business_id=int(business_id),
        data=payload,
        source="chatbot",
    )
    active_ticket = ticket.merged_into if ticket.is_merged and ticket.merged_into else ticket
    logger.info(f"[AI] create_ticket_tool created ticket_id={ticket.id} business={business_id}")

    return {
        "status": "auto_merged" if ticket.is_merged else "created",
        "ticket_id": active_ticket.id,
        "ticket_ref": getattr(active_ticket, "ticket_id", None),
        "title": active_ticket.title,
        "priority": active_ticket.priority,
        "category_id": active_ticket.category_id,
        "department_id": active_ticket.department_id,
        "label_ids": list(active_ticket.labels.values_list("id", flat=True)),
        "assignee_id": active_ticket.assigned_to_id,
        "duplicate_detection": getattr(ticket, "_duplicate_detection", None),
        "routing_confidence": "high",
    }


def resolution_status_tool(*, resolved: bool, reason: Optional[str] = None) -> Dict[str, Any]:
    return {
        "resolved": resolved,
        "reason": reason or "",
    }


def _best_default_title(context_lower: str, inferred_title: Optional[str]) -> str:
    if inferred_title:
        return inferred_title
    if "dashboard" in context_lower and ("frozen" in context_lower or "stale" in context_lower or "not updating" in context_lower):
        return "Dashboard Data Stale / Frozen"
    return "Support request"


def _best_default_description(context_lower: str, context_source: str, inferred_description: Optional[str]) -> str:
    base = inferred_description or context_source or ""
    if "dashboard" in context_lower and ("frozen" in context_lower or "stale" in context_lower or "not updating" in context_lower):
        return (
            "Dashboard is frozen and data is not updating (stale data error). "
            "User has attempted basic troubleshooting (connection status check, manual refresh, clear cache) without success."
        )
    return base or "Customer reported an issue; details in conversation."


# Dispatcher map
TOOL_DISPATCH_MAP = {
    "kb_search": kb_search_tool,
    "validate_contact_fields": validate_contact_fields_tool,
    "ticket_options": ticket_options_tool,
    "create_ticket": create_ticket_tool,
    "resolution_status": resolution_status_tool,
}


def get_tool_dispatcher() -> Dict[str, Any]:
    """Return mapping of tool name to callable for the orchestrator."""
    return TOOL_DISPATCH_MAP


def get_agentic_limits() -> Dict[str, Any]:
    """Expose loop limits and timeouts to orchestrator."""
    return {
        "max_tool_calls_per_turn": MAX_TOOL_CALLS_PER_TURN,
        "default_tool_timeout_seconds": DEFAULT_TOOL_TIMEOUT_SECONDS,
    }
