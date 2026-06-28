from __future__ import annotations

import uuid
from dataclasses import dataclass

from django.utils import timezone

from tenant.models import Ticket
from tenant.models.SettingModel import CsatConfiguration, CsatSurveyDispatch


@dataclass
class CsatApplyResult:
    applied: bool
    reason: str


def get_or_create_csat_config(ticket: Ticket) -> CsatConfiguration:
    config_obj, _ = CsatConfiguration.objects.get_or_create(
        business=ticket.business,
        defaults={'send_on_status': ['closed']},
    )
    return config_obj


def create_external_dispatch_record(
    ticket: Ticket,
    normalized_score: int,
    raw_payload: dict | None = None,
) -> CsatSurveyDispatch:
    """
    Create a CsatSurveyDispatch record when an external provider submits a
    CSAT score via webhook. Records the score and raw payload for audit purposes.
    """
    now = timezone.now()
    dispatch = CsatSurveyDispatch.objects.create(
        ticket=ticket,
        provider=CsatSurveyDispatch.PROVIDER_EXTERNAL,
        token=uuid.uuid4().hex,
        normalized_score=normalized_score,
        raw_payload=raw_payload or {},
        responded_at=now,
        sent_at=now,
        is_active=True,
    )
    return dispatch


def apply_csat_score(
    ticket: Ticket,
    normalized_score: int,
    provider: str = 'external',
) -> CsatApplyResult:
    """Write the normalized CSAT score back to the ticket and return a result object."""
    ticket.csat_score = normalized_score
    ticket.save(update_fields=['csat_score', 'date_updated'])
    return CsatApplyResult(
        applied=True,
        reason=f"Score {normalized_score} applied from {provider}",
    )
