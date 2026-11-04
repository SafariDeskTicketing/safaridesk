from __future__ import annotations

from typing import Any, Dict, Optional


class TicketActionError(Exception):
    """
    Raised by tenant.services.tickets.* functions for an expected,
    user-facing failure that the original (pre-extraction) TicketView code
    used to handle with an inline `return Response(payload, status=status_code)`.

    The calling view catches this and does exactly that:
        except TicketActionError as exc:
            return Response(exc.payload, status=exc.status_code)

    This preserves the exact status code / response body the monolithic
    view produced before extraction, without needing bespoke exception
    types per call site.
    """

    def __init__(self, payload: Dict[str, Any], status_code: int):
        self.payload = payload
        self.status_code = status_code
        message: Optional[str] = None
        if isinstance(payload, dict):
            message = payload.get("message") or payload.get("error") or payload.get("detail")
        super().__init__(message or str(payload))
