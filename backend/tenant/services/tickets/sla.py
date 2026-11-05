from __future__ import annotations

from typing import Any, Dict, Iterable

from tenant.models import Ticket
from tenant.models.SlaXModel import BusinessHoursx, Holidays


def get_breached_ticket_ids(tickets: Iterable[Ticket]) -> set[int]:
    """
    Compute SLA-breach status for a batch of tickets without the N+1 query
    `ticket.is_sla_breached` makes per-ticket (a fresh query for the SLA
    target, business hours and holidays each time it's called in a loop).

    Fetches holidays and each distinct business's hours once, then reuses
    them across every ticket. For this to actually save queries, pass a
    queryset with `.select_related('sla')` and
    `.prefetch_related('sla__targets')` already applied — this function
    still returns correct results without that, just without the saving.
    """
    tickets = list(tickets)
    if not tickets:
        return set()

    holidays_cache = set(Holidays.objects.filter(is_active=True).values_list('date', flat=True))

    business_hours_cache: Dict[int, dict] = {}
    for business_id in {t.business_id for t in tickets if t.business_id}:
        hours: dict = {}
        for h in BusinessHoursx.objects.filter(business_id=business_id):
            hours[h.day_of_week] = {
                'start_time': h.start_time,
                'end_time': h.end_time,
                'is_working_day': h.is_working_day,
            }
        business_hours_cache[business_id] = hours

    return {
        t.id for t in tickets
        if t.get_is_sla_breached(
            use_prefetched=True,
            business_hours_cache=business_hours_cache.get(t.business_id),
            holidays_cache=holidays_cache,
        )
    }


def get_sla(*, ticket_id) -> Dict[str, Any]:
    """
    Get comprehensive SLA details for a specific ticket.
    """
    ticket = Ticket.objects.for_business().get(id=ticket_id)
    sla_analysis_data = ticket.sla_analysis()
    sla_status_data = ticket.get_sla_status()

    # Calculate percentages for business hours elapsed and system hours elapsed
    business_hours_elapsed = sla_analysis_data.get('business_hours_elapsed', 0)
    system_hours_elapsed = sla_analysis_data.get('system_hours_elapsed', 0)

    total_business_hours = sla_analysis_data.get('total_business_hours_for_resolution')
    total_system_hours = sla_analysis_data.get('total_system_hours_for_resolution')

    if total_business_hours is not None and total_business_hours > 0:
        sla_analysis_data['business_hours_elapsed_percentage'] = (business_hours_elapsed / total_business_hours) * 100
    else:
        sla_analysis_data['business_hours_elapsed_percentage'] = 0.0  # Ensure float for consistency

    if total_system_hours is not None and total_system_hours > 0:
        sla_analysis_data['system_hours_elapsed_percentage'] = (system_hours_elapsed / total_system_hours) * 100
    else:
        sla_analysis_data['system_hours_elapsed_percentage'] = 0.0  # Ensure float for consistency

    return {
        "ticket_id": ticket.ticket_id,
        "sla_analysis": sla_analysis_data,
        "sla_status": sla_status_data,
        "is_sla_breached": ticket.is_sla_breached,
        "is_sla_paused": ticket.is_sla_paused,
    }
