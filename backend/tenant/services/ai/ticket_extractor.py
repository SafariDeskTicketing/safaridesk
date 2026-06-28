from __future__ import annotations

from typing import Dict, Any, Optional

from django.db.models import Q

from tenant.models import TicketCategories, Department


class TicketExtractor:
    """
    Extracts basic ticket fields from free text. Minimal, deterministic baseline.
    Fields: title, description, category (optional), department (optional), priority (optional)
    """

    PRIORITY_KEYWORDS = {
        'high': ['urgent', 'critical', 'immediately', 'asap', 'high priority'],
        'medium': ['normal', 'standard', 'medium priority'],
        'low': ['low priority', 'not urgent', 'whenever'],
    }

    def _infer_priority(self, text: str) -> Optional[str]:
        t = text.lower()
        for prio, words in self.PRIORITY_KEYWORDS.items():
            if any(w in t for w in words):
                return prio
        return None

    def _match_category(self, business_id: int, text: str) -> Optional[TicketCategories]:
        t = text.lower()
        # naive name contains matching
        return (
            TicketCategories.objects
            .filter(business_id=business_id)
            .filter(Q(name__icontains=t) | Q(description__icontains=t))
            .first()
        )

    def _match_department(self, business_id: int, text: str) -> Optional[Department]:
        t = text.lower()
        return (
            Department.objects
            .filter(business_id=business_id)
            .filter(Q(name__icontains=t))
            .first()
        )

    def extract(self, business_id: int, text: str) -> Dict[str, Any]:
        title = text.strip().splitlines()[0][:120] if text else 'Support Request'
        description = text.strip()

        category = self._match_category(business_id, text)
        department = self._match_department(business_id, text)
        priority = self._infer_priority(text)

        data: Dict[str, Any] = {
            'title': title,
            'description': description,
            'priority': priority,
        }
        if category:
            data['category_id'] = category.id
        if department:
            data['department_id'] = department.id
        return data
