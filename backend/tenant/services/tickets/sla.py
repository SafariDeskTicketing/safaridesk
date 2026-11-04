from __future__ import annotations

from typing import Any, Dict

from tenant.models import Ticket


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
