from __future__ import annotations

from unittest import mock

from django.contrib.auth.models import Group
from django.http import Http404
from django.test import TestCase

from tenant.models import Department, Ticket, TicketCategories
from tenant.services.tickets.creation import create_ticket_from_payload
from tenant.services.tickets.duplicate_detection import DuplicateDetectionService, DuplicateMatch
from users.models import Business, Users


class TicketCreationScopeTests(TestCase):
    def setUp(self):
        self.business_a = Business.objects.create(name="Business A")
        self.business_b = Business.objects.create(name="Business B")
        self.category_a = TicketCategories.objects.create(
            name="General",
            description="General requests",
            business=self.business_a,
        )
        self.department_b = Department.objects.create(
            name="Support",
            business=self.business_b,
        )

    def test_create_ticket_from_payload_rejects_foreign_department(self):
        with self.assertRaises(Http404):
            create_ticket_from_payload(
                business_id=self.business_a.id,
                data={
                    "title": "Cross-tenant ticket",
                    "description": "Should not be allowed",
                    "category_id": self.category_a.id,
                    "department_id": self.department_b.id,
                    "priority": "medium",
                    "creator_name": "Alice Example",
                    "creator_email": "alice@example.com",
                    "creator_phone": "+254700000001",
                },
                source="chatbot",
            )


class DuplicateDetectionServiceTests(TestCase):
    def setUp(self):
        self.business = Business.objects.create(name="SafariDesk Test")
        self.department = Department.objects.create(name="Support", business=self.business)
        self.category = TicketCategories.objects.create(
            name="Incidents",
            description="Incident management",
            business=self.business,
        )
        self.role = Group.objects.create(name="admin")
        self.actor = Users.objects.create_user(
            username="agent1",
            email="agent1@example.com",
            password="Pass!123",
            role=self.role,
            business=self.business,
            first_name="Agent",
            last_name="One",
        )

    def _make_ticket(self, **overrides) -> Ticket:
        defaults = {
            "business": self.business,
            "title": "VPN access issue",
            "description": "Cannot connect to the office VPN after password reset.",
            "category": self.category,
            "department": self.department,
            "priority": "medium",
            "creator_name": "Jane Doe",
            "creator_email": "jane@example.com",
            "creator_phone": "+254711111111",
            "created_by": self.actor,
            "ticket_id": overrides.pop("ticket_id", None) or f"INC{Ticket.objects.count() + 1:05d}",
            "source": "web",
        }
        defaults.update(overrides)
        return Ticket.objects.create(**defaults)

    @mock.patch("shared.workers.Ticket._send_ticket_notification")
    @mock.patch("tenant.services.tickets.duplicate_detection.NotificationSettingsService.notify_many")
    def test_process_new_ticket_auto_merges_duplicate(self, mock_notify_many, mock_send_email):
        primary = self._make_ticket(ticket_id="INC10001")
        duplicate = self._make_ticket(
            ticket_id="INC10002",
            title="VPN access issue",
            description="Cannot connect to the office VPN after password reset.",
        )

        service = DuplicateDetectionService()
        with mock.patch.object(
            service,
            "_find_best_duplicate",
            return_value=DuplicateMatch(ticket=primary, score=0.95, strategy="embedding"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                result = service.process_new_ticket(duplicate, actor=self.actor)

        duplicate.refresh_from_db()
        primary.refresh_from_db()

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "auto_merged")
        self.assertEqual(result["primary_ticket"]["id"], primary.id)
        self.assertEqual(result["duplicate_ticket"]["id"], duplicate.id)
        self.assertTrue(duplicate.is_merged)
        self.assertEqual(duplicate.merged_into_id, primary.id)
        self.assertEqual(primary.comments.count(), 1)
        mock_notify_many.assert_called()
        mock_send_email.assert_called()

    def test_evaluate_ticket_returns_suggestion_payload(self):
        primary = self._make_ticket(ticket_id="INC10011")
        candidate = self._make_ticket(
            ticket_id="INC10012",
            title="VPN issue after password reset",
            description="VPN keeps rejecting my login after a password reset.",
        )

        service = DuplicateDetectionService()
        with mock.patch.object(
            service,
            "_find_best_duplicate",
            return_value=DuplicateMatch(ticket=primary, score=0.82, strategy="lexical"),
        ):
            result = service.evaluate_ticket(candidate)

        self.assertEqual(result["status"], "suggested")
        self.assertEqual(result["primary_ticket"]["id"], primary.id)
        self.assertEqual(result["duplicate_ticket"]["id"], candidate.id)
        self.assertEqual(result["recommended_action"], "merge_current_into_primary")
        self.assertEqual(result["strategy"], "lexical")
