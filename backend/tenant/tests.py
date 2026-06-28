from __future__ import annotations

import base64
import json
from io import StringIO
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest import mock

from django.contrib.auth.models import Group
from django.core.management import call_command, CommandError
from django.db import IntegrityError, transaction
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone as django_timezone
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from shared.tasks import process_incoming_emails
from shared.management.commands.sla import Command as SlaCommand
from shared.workers.Email import process_emails_for_all_businesses
from shared.workers.Ticket import _build_auto_ack_activity_content, _send_ticket_notification
from tenant.models import Contact, Department, EmailMessageRecord, Label, MailIntegration, SLAPolicy, SLATracker, Task, Ticket, TicketCallLog, TicketCategories, TicketConfig, TicketWatchers
from tenant.models.TicketModel import TicketReopen
from tenant.serializers.MailValidationSerializer import MailCredentialValidationSerializer
from tenant.views.TicketView import TicketView, _parse_ai_email_draft
from tenant.views.MailIntegrationView import MailIntegrationViewSet
from tenant.services.contact_linker import link_or_create_contact
from tenant.views.AgentView import AgentView
from tenant.views.ContactView import ContactViewSet
from tenant.views.PublicView import PublicView
from tenant.services.ai.intent_analyzer import IntentAnalyzer
from tenant.services.ai.context_builder import ContextBuilder
from tenant.services.ai.ticket_extractor import TicketExtractor
from tenant.services.tickets.naming import (
    extract_ticket_code,
    render_ticket_title,
    validate_title_format,
)
from users.models import Business, CustomDomains, Customer, Users
from util.EmailTicketService import EmailTicketService
from util.mail.mailgun import send_mailgun_message
from util.mail.oauth import GOOGLE_SCOPES, sign_oauth_state, verify_oauth_state
from util.mail.ingestion import MailIntegrationIngestionService
from util.mail.transport import resolve_imap_transport, resolve_smtp_transport
from shared.workers.email_reply import _format_email_content, send_email_reply_task
from tenant.services.email_activity import build_comment_email_meta
from tenant.services.copilot.context import ContextAssembler
from tenant.services.copilot.handlers import (
    DraftNoteHandler,
    HandlerResult,
    SimilarHandler,
    SuggestKBHandler,
    SummarizeHandler,
    TriageHandler,
)
from tenant.services.copilot.gateway import BlockedLLMResponseError, CopilotGatewayError
from tenant.services.copilot.service import CopilotService
from tenant.models import CopilotAuditLog, CopilotSuggestion
from tenant.views.CopilotView import CopilotInvokeView
from tenant.views.DashboardView import DashView
from tenant.views.ReportsView import ReportsViewSet
from util.Mailer import Mailer


class ContactListArchivePaginationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.business = Business.objects.create(name="Contacts Business", domain="contacts-biz")
        self.role = Group.objects.create(name="contacts-admin")
        self.admin = Users.objects.create(
            username="contacts-admin",
            email="contacts-admin@example.com",
            role=self.role,
            business=self.business,
            first_name="Contact",
            last_name="Admin",
            is_active=True,
        )
        self.view = ContactViewSet.as_view({"get": "list"})

        for idx in range(3):
            Contact.objects.create(
                business=self.business,
                owner=self.admin,
                name=f"Active Contact {idx}",
                email=f"active-{idx}@example.com",
                is_active=True,
            )
        for idx in range(2):
            Contact.objects.create(
                business=self.business,
                owner=self.admin,
                name=f"Archived Contact {idx}",
                email=f"archived-{idx}@example.com",
                is_active=False,
            )

    def _get(self, params):
        request = self.factory.get("/api/v1/contacts/", params)
        force_authenticate(request, user=self.admin)
        return self.view(request)

    def test_active_contacts_paginate_with_page_size(self):
        response = self._get({"page": "2", "page_size": "2", "show_archived": "false"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 3)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertTrue(all(item["is_active"] for item in response.data["results"]))

    def test_show_archived_returns_archived_contacts_only(self):
        response = self._get({"page": "1", "page_size": "10", "show_archived": "true"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertTrue(all(item["is_active"] is False for item in response.data["results"]))


class AgentDeactivationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.business = Business.objects.create(name="Agent Auth Business", domain="agent-auth")
        self.role = Group.objects.create(name="agent-auth-role")
        self.admin = Users.objects.create(
            username="admin-auth",
            email="admin-auth@example.com",
            role=self.role,
            business=self.business,
            first_name="Admin",
            last_name="Auth",
            is_active=True,
        )
        self.agent = Users.objects.create(
            username="agent-auth",
            email="agent-auth@example.com",
            role=self.role,
            business=self.business,
            first_name="Agent",
            last_name="Auth",
            is_active=True,
        )

    def test_deactivation_blacklists_outstanding_refresh_tokens(self):
        RefreshToken.for_user(self.agent)
        self.assertEqual(OutstandingToken.objects.filter(user=self.agent).count(), 1)

        request = self.factory.put(f"/api/v1/agent/status/{self.agent.id}", {}, format="json")
        request.user = self.admin

        response = AgentView.as_view({"put": "deactivate_activate_agent"})(request, id=self.agent.id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["tokens_blacklisted"], 1)
        self.agent.refresh_from_db()
        self.assertFalse(self.agent.is_active)
        self.assertEqual(
            BlacklistedToken.objects.filter(token__user=self.agent).count(),
            1,
        )


class SafariAdminUserCommandTests(TestCase):
    def test_creates_safariadmin_user_with_admin_access_flags(self):
        out = StringIO()

        call_command(
            "safariadmin_user",
            email="ops-admin@safaridesk.io",
            username="ops-admin",
            password="StrongPass123!",
            stdout=out,
        )

        user = Users.objects.get(email="ops-admin@safaridesk.io")
        self.assertEqual(user.username, "ops-admin")
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_active)
        self.assertEqual(user.status, "A")
        self.assertEqual(user.category, "BUSINESS")
        self.assertEqual(user.role.name, "admin")
        self.assertTrue(user.check_password("StrongPass123!"))
        self.assertIn("SafariAdmin user created.", out.getvalue())

    def test_existing_user_is_shown_without_mutation_unless_reset_requested(self):
        role = Group.objects.create(name="support")
        user = Users.objects.create(
            username="existing-admin",
            email="existing-admin@safaridesk.io",
            role=role,
            is_staff=False,
            is_superuser=False,
            is_active=False,
            status="I",
            category="CUSTOMER",
        )
        user.set_password("OldPass123!")
        user.save(update_fields=["password"])

        inspect_out = StringIO()
        call_command("safariadmin_user", email=user.email, password="IgnoredPass123!", stdout=inspect_out)

        user.refresh_from_db()
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_active)
        self.assertEqual(user.status, "I")
        self.assertTrue(user.check_password("OldPass123!"))
        self.assertIn("No changes were made.", inspect_out.getvalue())

        reset_out = StringIO()
        call_command(
            "safariadmin_user",
            email=user.email,
            password="NewPass123!",
            reset_password=True,
            stdout=reset_out,
        )

        user.refresh_from_db()
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_active)
        self.assertEqual(user.status, "A")
        self.assertEqual(user.category, "BUSINESS")
        self.assertEqual(user.role.name, "admin")
        self.assertTrue(user.check_password("NewPass123!"))
        self.assertIn("password reset", reset_out.getvalue())


class GeminiClientTests(SimpleTestCase):
    """Covers regressions we observed when Google SDKs changed their return types."""

    @mock.patch("tenant.services.ai.gemini_client.genai.GenerativeModel")
    @mock.patch("tenant.services.ai.gemini_client.genai.list_models")
    @mock.patch("tenant.services.ai.gemini_client.genai.configure")
    def test_generate_content_handles_usage_metadata_objects(self, mock_configure, mock_list_models, mock_generative_model):
        """Simulate a response where usage_metadata is an object without dict methods."""
        fake_usage = SimpleNamespace(prompt_token_count=11, candidates_token_count=17)
        fake_response = SimpleNamespace(text="Mock reply", usage_metadata=fake_usage)
        mock_generative_model.return_value.generate_content.return_value = fake_response
        mock_list_models.return_value = [
            SimpleNamespace(
                name="projects/demo/models/gemini-flash-latest",
                supported_generation_methods=["generateContent"],
            )
        ]

        def fake_config(key, default=None):
            overrides = {
                "GEMINI_API_KEY": "local-test-key",
                "GEMINI_MODEL": "gemini-flash-latest",
                "GEMINI_MAX_RETRIES": 1,
                "GEMINI_RETRY_DELAY": 0.01,
                "GEMINI_TIMEOUT": 30,
            }
            return overrides.get(key, default)

        with mock.patch("tenant.services.ai.gemini_client.config", side_effect=fake_config):
            from tenant.services.ai.gemini_client import GeminiClient

            client = GeminiClient()
            result = client.generate_content(prompt="Hello SafariDesk")

        self.assertEqual(result["content"], "Mock reply")
        self.assertEqual(result["input_tokens"], 11)
        self.assertEqual(result["output_tokens"], 17)
        mock_configure.assert_called_once_with(api_key="local-test-key")


class EmbeddingServiceTests(SimpleTestCase):
    @mock.patch("tenant.services.ai.embedding_service.genai.configure")
    @mock.patch("tenant.services.ai.embedding_service.genai.embed_content")
    def test_embed_text_supports_list_payloads(self, mock_embed, mock_configure):
        """Ensure we can parse the latest embed_content list responses."""
        mock_embed.return_value = [{"values": [0.1, 0.2, 0.3]}]

        def fake_config(key, default=None):
            overrides = {
                "GEMINI_API_KEY": "local-test-key",
                "EMBEDDING_MODEL": "gemini-embedding-001",
                "EMBEDDING_OUTPUT_DIM": 1536,
            }
            return overrides.get(key, default)

        with mock.patch("tenant.services.ai.embedding_service.config", side_effect=fake_config):
            from tenant.services.ai.embedding_service import EmbeddingService

            service = EmbeddingService()
            vector = service._embed_text("Hello world")

        self.assertEqual(vector, [0.1, 0.2, 0.3])
        mock_configure.assert_called_once_with(api_key="local-test-key")


class AIPipelineSmokeTests(SimpleTestCase):
    def test_rule_based_pipeline_smoke(self):
        """Exercise the intent analyzer, context builder, and ticket extractor together."""
        analyzer = IntentAnalyzer()
        message = "Hi team, please create a high priority ticket for broken Wi-Fi"
        analysis = analyzer.analyze(message)
        self.assertEqual(analysis["intent"], "create_ticket")

        kb_results = [
            {"title": "Wi-Fi Troubleshooting", "excerpt": "Restart the router and check logs."},
        ]
        builder = ContextBuilder()
        system_prompt = builder.build_system_prompt()
        user_prompt = builder.build_user_prompt(message=message, kb_results=kb_results, history=[{"role": "user", "content": "Hello"}])

        extractor = TicketExtractor()
        ticket_payload = extractor.extract(business_id=1, text=message)

        self.assertIn("SafariDesk AI Assistant", system_prompt)
        self.assertIn("Wi-Fi Troubleshooting", user_prompt)
        self.assertTrue(ticket_payload["title"])
        self.assertEqual(ticket_payload["priority"], "high")


class AITicketFencingTests(TestCase):
    def setUp(self):
        self.business = Business.objects.create(name="AI Fence Biz", domain="ai-fence")
        self.other_business = Business.objects.create(name="Other AI Fence Biz", domain="other-ai-fence")
        self.role = Group.objects.create(name="ai-fence-agent")
        self.agent = Users.objects.create(
            username="ai-fence-agent",
            email="agent@ai-fence.example",
            role=self.role,
            business=self.business,
            first_name="Ada",
            last_name="Agent",
            is_active=True,
        )
        self.inactive_agent = Users.objects.create(
            username="ai-fence-inactive",
            email="inactive@ai-fence.example",
            role=self.role,
            business=self.business,
            first_name="Inactive",
            last_name="Agent",
            is_active=False,
        )
        self.department = Department.objects.create(name="Support", business=self.business)
        self.other_department = Department.objects.create(name="Other Support", business=self.other_business)
        self.category = TicketCategories.objects.create(
            name="Login",
            description="Login issues",
            business=self.business,
            department=self.department,
            is_active=True,
        )
        self.other_category = TicketCategories.objects.create(
            name="Other Login",
            description="Other tenant login issues",
            business=self.other_business,
            department=self.other_department,
            is_active=True,
        )
        self.active_label = Label.objects.create(name="VIP", business=self.business, is_active=True)
        self.inactive_label = Label.objects.create(name="Inactive", business=self.business, is_active=False)

    def _contact(self):
        return {"name": "Jane Customer", "email": "jane@example.com", "phone": "+254712345678"}

    def test_ticket_options_return_only_current_active_references(self):
        from tenant.services.ai.tools import ticket_options_tool

        options = ticket_options_tool(business_id=self.business.id)

        self.assertEqual([item["id"] for item in options["departments"]], [self.department.id])
        self.assertEqual([item["id"] for item in options["categories"]], [self.category.id])
        self.assertEqual([item["id"] for item in options["labels"]], [self.active_label.id])
        self.assertEqual([item["id"] for item in options["assignees"]], [self.agent.id])

    def test_create_ticket_rejects_cross_business_routing(self):
        from tenant.services.ai.tools import create_ticket_tool

        result = create_ticket_tool(
            business_id=self.business.id,
            contact=self._contact(),
            context_text="I cannot log in to SafariDesk.",
            title="Login issue",
            description="Customer cannot log in.",
            category_id=self.category.id,
            department_id=self.other_department.id,
            priority="medium",
        )

        self.assertEqual(result["error"], "routing_invalid")
        self.assertFalse(Ticket.objects.filter(business=self.business).exists())

    @mock.patch("tenant.services.tickets.creation.DuplicateDetectionService.process_new_ticket", return_value=None)
    def test_create_ticket_applies_existing_labels_and_assignee(self, _mock_duplicate_detection):
        from tenant.services.ai.tools import create_ticket_tool

        result = create_ticket_tool(
            business_id=self.business.id,
            contact=self._contact(),
            context_text="I cannot log in to SafariDesk.",
            title="Login issue",
            description="Customer cannot log in.",
            category_id=self.category.id,
            department_id=self.department.id,
            label_ids=[self.active_label.id],
            assignee_id=self.agent.id,
            priority="medium",
        )

        self.assertEqual(result["status"], "created")
        ticket = Ticket.objects.get(id=result["ticket_id"])
        self.assertEqual(ticket.assigned_to_id, self.agent.id)
        self.assertEqual(list(ticket.labels.values_list("id", flat=True)), [self.active_label.id])
        self.assertEqual(ticket.tags, self.active_label.name)

    def test_create_ticket_rejects_invalid_labels_and_assignee(self):
        from tenant.services.ai.tools import create_ticket_tool

        label_result = create_ticket_tool(
            business_id=self.business.id,
            contact=self._contact(),
            context_text="I cannot log in to SafariDesk.",
            title="Login issue",
            description="Customer cannot log in.",
            category_id=self.category.id,
            department_id=self.department.id,
            label_ids=[self.inactive_label.id],
            priority="medium",
        )
        assignee_result = create_ticket_tool(
            business_id=self.business.id,
            contact=self._contact(),
            context_text="I cannot log in to SafariDesk.",
            title="Login issue",
            description="Customer cannot log in.",
            category_id=self.category.id,
            department_id=self.department.id,
            assignee_id=self.inactive_agent.id,
            priority="medium",
        )

        self.assertEqual(label_result["error"], "labels_invalid")
        self.assertEqual(assignee_result["error"], "assignee_invalid")

    @mock.patch("tenant.services.ai.support_guard.GeminiClient")
    def test_support_guard_redirects_off_topic_but_allows_active_ticket_flow(self, mock_gemini_client):
        from tenant.services.ai.support_guard import SupportRelevanceSchema, classify_support_relevance

        mock_gemini_client.return_value.generate_structured_content.side_effect = [
            {
                "parsed": SupportRelevanceSchema(
                    support_related=False,
                    confidence=0.96,
                    allow_ticket_creation=False,
                    reason="General astronomy question.",
                )
            },
            {
                "parsed": SupportRelevanceSchema(
                    support_related=True,
                    confidence=0.93,
                    allow_ticket_creation=True,
                    reason="SafariDesk login issue.",
                )
            },
        ]

        self.assertFalse(classify_support_relevance("Explain the Andromeda galaxy").support_related)
        self.assertTrue(classify_support_relevance("I cannot log in to SafariDesk").support_related)
        self.assertTrue(classify_support_relevance("Explain the Andromeda galaxy", state={"contact_requested": True}).support_related)

    @mock.patch("tenant.services.ai.support_guard.GeminiClient")
    def test_support_guard_rejects_malformed_structured_classifier_output(self, mock_gemini_client):
        from tenant.services.ai.support_guard import classify_support_relevance

        mock_gemini_client.return_value.generate_structured_content.side_effect = [
            {
                "parsed": {
                    "support_related": "false",
                    "confidence": 0.98,
                    "allow_ticket_creation": False,
                    "reason": "String booleans must not be trusted.",
                }
            },
            {
                "parsed": {
                    "support_related": False,
                    "allow_ticket_creation": False,
                    "reason": "Missing confidence.",
                }
            },
            {
                "parsed": {
                    "support_related": False,
                    "confidence": "0.98",
                    "allow_ticket_creation": False,
                    "reason": "String confidence must not be trusted.",
                }
            },
            RuntimeError("Gemini unavailable"),
        ]

        self.assertEqual(classify_support_relevance("Explain relativity").source, "fallback")
        self.assertEqual(classify_support_relevance("Explain astronomy").source, "fallback")
        self.assertEqual(classify_support_relevance("Write a poem").source, "fallback")
        self.assertTrue(classify_support_relevance("General trivia").support_related)

    @mock.patch("tenant.services.ai.support_guard.GeminiClient")
    def test_support_guard_allows_low_confidence_off_topic_classifier_result(self, mock_gemini_client):
        from tenant.services.ai.support_guard import SupportRelevanceSchema, classify_support_relevance

        mock_gemini_client.return_value.generate_structured_content.return_value = {
            "parsed": SupportRelevanceSchema(
                support_related=False,
                confidence=0.40,
                allow_ticket_creation=False,
                reason="Ambiguous support relevance.",
            )
        }

        result = classify_support_relevance("Can you explain my account issue?")

        self.assertTrue(result.support_related)
        self.assertEqual(result.source, "ai_ambiguous_allow")

    def test_copilot_execution_only_applies_existing_active_labels(self):
        from tenant.models import CopilotSuggestion
        from tenant.services.copilot.executor import CopilotToolExecutor

        ticket = Ticket.objects.create(
            business=self.business,
            department=self.department,
            category=self.category,
            title="Login issue",
            description="Customer cannot log in.",
            ticket_id="AI-1001",
        )
        suggestion = CopilotSuggestion.objects.create(
            business=self.business,
            ticket=ticket,
            requested_by=self.agent,
            command="triage",
            suggestion_type="suggested_action",
            payload={"suggested_updates": {"tags": [self.active_label.name, self.inactive_label.name, "made-up"]}},
            idempotency_key="ai-fence-tags",
        )

        applied = CopilotToolExecutor().execute(user=self.agent, suggestion=suggestion)

        ticket.refresh_from_db()
        self.assertEqual(applied["tags"], [self.active_label.name])
        self.assertEqual(ticket.tags, self.active_label.name)
        self.assertEqual(list(ticket.labels.values_list("id", flat=True)), [self.active_label.id])

    def test_copilot_execution_ignores_cross_business_category(self):
        from tenant.models import CopilotSuggestion
        from tenant.services.copilot.executor import CopilotToolExecutor

        ticket = Ticket.objects.create(
            business=self.business,
            department=self.department,
            category=self.category,
            title="Login issue",
            description="Customer cannot log in.",
            ticket_id="AI-1002",
        )
        suggestion = CopilotSuggestion.objects.create(
            business=self.business,
            ticket=ticket,
            requested_by=self.agent,
            command="triage",
            suggestion_type="suggested_action",
            payload={"suggested_updates": {"category_id": self.other_category.id}},
            idempotency_key="ai-fence-cross-business-category",
        )

        applied = CopilotToolExecutor().execute(user=self.agent, suggestion=suggestion)

        ticket.refresh_from_db()
        self.assertNotIn("category_id", applied)
        self.assertEqual(ticket.category_id, self.category.id)


class MailOAuthUtilsTests(SimpleTestCase):
    def test_state_round_trip(self):
        payload = {"integration_id": 7, "provider": "google"}
        state = sign_oauth_state(payload)
        decoded = verify_oauth_state(state)
        self.assertEqual(decoded["integration_id"], 7)
        self.assertEqual(decoded["provider"], "google")

    def test_google_scopes_use_gmail_api_only(self):
        self.assertNotIn("https://mail.google.com/", GOOGLE_SCOPES)
        self.assertIn("https://www.googleapis.com/auth/gmail.modify", GOOGLE_SCOPES)
        self.assertIn("https://www.googleapis.com/auth/gmail.send", GOOGLE_SCOPES)


class MailValidationSerializerTests(SimpleTestCase):
    def test_requires_imap_or_smtp(self):
        serializer = MailCredentialValidationSerializer(data={})
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)

    def test_accepts_imap_only(self):
        serializer = MailCredentialValidationSerializer(
            data={"imap_host": "imap.example.com", "imap_username": "user", "imap_password": "pass"}
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)


class MailIngestionHelpersTests(SimpleTestCase):
    def test_extract_ticket_code(self):
        code = MailIntegrationIngestionService._extract_ticket_code("Re: [#INC123AB] Issue")
        self.assertEqual(code, "INC123AB")

    def test_extract_message_ids(self):
        header = "<abc@example.com> <def@example.com>"
        ids = list(MailIntegrationIngestionService._extract_message_ids(header))
        self.assertEqual(ids, ["<abc@example.com>", "<def@example.com>"])

    def test_imap_port_993_forces_ssl(self):
        port, use_ssl = resolve_imap_transport(993, False)
        self.assertEqual(port, 993)
        self.assertTrue(use_ssl)

    def test_smtp_port_465_forces_ssl(self):
        port, use_ssl, use_tls = resolve_smtp_transport(465, False, False)
        self.assertEqual(port, 465)
        self.assertTrue(use_ssl)
        self.assertFalse(use_tls)

    def test_smtp_port_587_defaults_to_starttls(self):
        port, use_ssl, use_tls = resolve_smtp_transport(587, False, False)
        self.assertEqual(port, 587)
        self.assertFalse(use_ssl)
        self.assertTrue(use_tls)


class MailIntegrationGmailApiTests(TestCase):
    def setUp(self):
        self.business = Business.objects.create(name="Gmail API Biz", domain="gmail-api-biz")
        self.department = Department.objects.create(name="Support", business=self.business)
        self.integration = MailIntegration.objects.create(
            business=self.business,
            department=self.department,
            provider=MailIntegration.Provider.GMAIL,
            direction=MailIntegration.Direction.BOTH,
            connection_status=MailIntegration.ConnectionStatus.CONNECTED,
            is_active=True,
            email_address="support@gmail-api-biz.example",
        )
        self.integration.set_secret("oauth_access_token", "token-123")
        self.integration.oauth_expires_at = datetime(2026, 4, 8, tzinfo=timezone.utc)
        self.integration.save(update_fields=["oauth_access_token_encrypted", "oauth_expires_at"])

    def test_first_gmail_sync_seeds_history_and_skips_existing_mail(self):
        service = MailIntegrationIngestionService(self.integration)

        with mock.patch("util.mail.ingestion.get_gmail_profile", return_value={"historyId": "321"}):
            message_ids, latest_history_id = service._search_gmail_messages("token-123")

        self.integration.refresh_from_db()
        self.assertEqual(message_ids, [])
        self.assertEqual(latest_history_id, 321)
        self.assertEqual(self.integration.provider_metadata["gmail_history_id"], 321)

    def test_gmail_sync_processes_only_unread_messages_and_updates_history(self):
        self.integration.provider_metadata = {"gmail_history_id": 120}
        self.integration.save(update_fields=["provider_metadata"])

        raw_email = (
            "Message-ID: <gmail-1@example.com>\r\n"
            "From: Customer Zero <customer@example.com>\r\n"
            "To: support@gmail-api-biz.example\r\n"
            "Subject: Need help\r\n"
            "\r\n"
            "Hello from Gmail"
        ).encode("utf-8")
        raw_payload = base64.urlsafe_b64encode(raw_email).decode("utf-8").rstrip("=")

        service = MailIntegrationIngestionService(self.integration)

        with mock.patch(
            "util.mail.ingestion.get_gmail_history",
            return_value={
                "history": [
                    {
                        "id": "130",
                        "messagesAdded": [
                            {"message": {"id": "msg-1"}},
                            {"message": {"id": "msg-2"}},
                        ],
                    }
                ],
                "history_id": 130,
            },
        ), mock.patch(
            "util.mail.ingestion.get_gmail_message_raw",
            side_effect=[
                {"id": "msg-1", "labelIds": ["INBOX", "UNREAD"], "raw": raw_payload},
                {"id": "msg-2", "labelIds": ["INBOX"], "raw": raw_payload},
            ],
        ), mock.patch(
            "util.mail.ingestion.mark_gmail_message_read"
        ) as mark_read_mock, mock.patch.object(
            service, "_process_email_message"
        ) as process_message_mock:
            last_message_id = service._process_gmail_messages()

        self.integration.refresh_from_db()
        process_message_mock.assert_called_once()
        mark_read_mock.assert_called_once_with("token-123", "msg-1")
        self.assertEqual(last_message_id, "msg-1")
        self.assertEqual(self.integration.provider_metadata["gmail_history_id"], 130)


class EmailActivityMetadataTests(SimpleTestCase):
    def test_builds_incoming_email_meta_from_headers(self):
        comment = SimpleNamespace(
            email_to=None,
            email_cc=None,
            email_bcc=None,
            author=None,
        )
        integration = SimpleNamespace(
            display_name="Support",
            email_address="support@safaridesk.io",
            forwarding_address="",
        )
        record = SimpleNamespace(
            direction="incoming",
            raw_headers={
                "From": "Nyambura Maina <Nyambura.Maina@jubileekenya.com>",
                "To": "support@safaridesk.io",
                "Subject": "Medical plan",
                "Reply-To": "Nyambura Maina <Nyambura.Maina@jubileekenya.com>",
                "Date": "Tue, 7 Apr 2026 16:35:00 +0300",
                "Message-ID": "<msg-1@example.com>",
                "Authentication-Results": "mx.google.com; spf=pass smtp.mailfrom=jubileekenya.com; dkim=pass header.i=@jubileekenya.com",
            },
            sender="Nyambura Maina <Nyambura.Maina@jubileekenya.com>",
            recipient="support@safaridesk.io",
            subject="Medical plan",
            message_id="<msg-1@example.com>",
            received_at=datetime(2026, 4, 7, 16, 35, tzinfo=timezone.utc),
            integration=integration,
        )

        meta = build_comment_email_meta(comment, record)

        self.assertEqual(meta["direction"], "incoming")
        self.assertEqual(meta["from"]["name"], "Nyambura Maina")
        self.assertEqual(meta["from"]["email"], "Nyambura.Maina@jubileekenya.com")
        self.assertEqual(meta["to"][0]["email"], "support@safaridesk.io")
        self.assertEqual(meta["reply_to"]["email"], "Nyambura.Maina@jubileekenya.com")
        self.assertEqual(meta["subject"], "Medical plan")
        self.assertEqual(meta["message_id"], "<msg-1@example.com>")
        self.assertEqual(meta["provider_metadata"]["mailed_by"], "jubileekenya.com")
        self.assertEqual(meta["provider_metadata"]["signed_by"], "jubileekenya.com")

    def test_builds_outgoing_email_meta_from_comment_when_record_missing(self):
        author = SimpleNamespace(
            full_name=lambda: "Dev Test",
            email="support@safaridesk.io",
        )
        comment = SimpleNamespace(
            email_to=["edwinodero70@gmail.com"],
            email_cc=["manager@example.com"],
            email_bcc=["audit@example.com"],
            author=author,
        )

        meta = build_comment_email_meta(comment, None)

        self.assertEqual(meta["direction"], "outgoing")
        self.assertEqual(meta["from"]["display"], "Dev Test <support@safaridesk.io>")
        self.assertEqual(meta["to"][0]["email"], "edwinodero70@gmail.com")
        self.assertEqual(meta["cc"][0]["email"], "manager@example.com")
        self.assertEqual(meta["bcc"][0]["email"], "audit@example.com")


@override_settings(
    MAILGUN_API_KEY="test-key",
    MAILGUN_DOMAIN="safaridesk.io",
    MAILGUN_API_BASE_URL="https://api.eu.mailgun.net",
)
class MailgunSenderTests(SimpleTestCase):
    @mock.patch("util.mail.mailgun.requests.post")
    def test_send_mailgun_message_uses_configured_eu_api_base_url(self, post_mock):
        post_mock.return_value.raise_for_status.return_value = None

        sent = send_mailgun_message(
            to=["customer@example.com"],
            subject="Reply",
            text="Hello",
            from_email="support@devtest.safaridesk.io",
            headers={"Reply-To": "support@devtest.safaridesk.io"},
        )

        self.assertTrue(sent)
        post_mock.assert_called_once()
        self.assertEqual(
            post_mock.call_args.args[0],
            "https://api.eu.mailgun.net/v3/safaridesk.io/messages",
        )
        self.assertEqual(post_mock.call_args.kwargs["data"]["from"], "support@devtest.safaridesk.io")
        self.assertEqual(
            post_mock.call_args.kwargs["data"]["h:Reply-To"],
            "support@devtest.safaridesk.io",
        )


class MailerDeliveryTests(SimpleTestCase):
    def setUp(self):
        self.business = SimpleNamespace(name="Mailer Biz", domain="mailer-biz")
        self.user = SimpleNamespace(
            username="mailer-user",
            email="Agent@Example.com",
            business=self.business,
            first_name="Mailer",
            last_name="User",
            is_active=True,
            status="A",
            full_name=lambda: "Mailer User",
        )
        self.customer = SimpleNamespace(
            email="customer@example.com",
            business=self.business,
            first_name="Case",
            last_name="Customer",
            allow_login=True,
            is_active=True,
            status="A",
            full_name=lambda: "Case Customer",
        )

    @mock.patch("util.Mailer.Mailer.send_rendered_email", return_value=True)
    @mock.patch("util.Mailer.Mailer.get_smtp_connection_for_business")
    @mock.patch("users.models.Users.objects.filter")
    def test_password_reset_uses_case_insensitive_user_lookup(self, users_filter_mock, smtp_mock, send_rendered_email):
        users_filter_mock.return_value.first.return_value = self.user
        smtp_mock.return_value = (mock.sentinel.connection, "Support <support@example.com>")

        sent = Mailer().send_password_reset_link("https://example.com/reset", "agent@example.com")

        self.assertTrue(sent)
        send_rendered_email.assert_called_once()
        self.assertEqual(send_rendered_email.call_args.kwargs["template_name"], "password_reset_link")
        self.assertEqual(send_rendered_email.call_args.kwargs["receiver_email"], "agent@example.com")
        self.assertEqual(send_rendered_email.call_args.kwargs["business"], self.business)

    @mock.patch("util.Mailer.Mailer.send_rendered_email", return_value=True)
    @mock.patch("util.Mailer.Mailer.get_smtp_connection_for_business")
    @mock.patch("users.models.Customer.objects.filter")
    def test_customer_magic_link_uses_shared_sender(self, customer_filter_mock, smtp_mock, send_rendered_email):
        customer_filter_mock.return_value.select_related.return_value.first.return_value = self.customer
        smtp_mock.return_value = (mock.sentinel.connection, "Support <support@example.com>")

        sent = Mailer().send_customer_magic_link(
            "https://example.com/helpcenter/magic-login?token=token",
            self.customer.email,
            business=self.business,
            customer_name="Case Customer",
        )

        self.assertTrue(sent)
        send_rendered_email.assert_called_once()
        self.assertEqual(send_rendered_email.call_args.kwargs["template_name"], "customer_magic_link")
        self.assertEqual(send_rendered_email.call_args.kwargs["receiver_email"], self.customer.email)
        self.assertEqual(send_rendered_email.call_args.kwargs["business"], self.business)


class SlaRecipientCollectionTests(SimpleTestCase):
    def setUp(self):
        self.business = SimpleNamespace(name="SLA Biz", domain="sla-biz")
        self.owner = SimpleNamespace(email="owner@example.com", is_active=True, status="A")
        self.business.owner = self.owner

        self.assigned = SimpleNamespace(email="assigned@example.com", is_active=True, status="A")
        self.group_user = SimpleNamespace(email="group@example.com", is_active=True, status="A")
        self.escalation_agent = SimpleNamespace(email="agent@example.com", is_active=True, status="A")

        self.group = SimpleNamespace(user_set=SimpleNamespace(filter=lambda **kwargs: [self.group_user]))

    def test_collect_recipients_includes_explicit_escalation_emails(self):
        command = SlaCommand()
        item = SimpleNamespace(
            assigned_to=self.assigned,
            business=self.business,
        )
        escalation = SimpleNamespace(
            escalate_to_groups=SimpleNamespace(all=lambda: [self.group]),
            escalate_to_agents=SimpleNamespace(filter=lambda **kwargs: [self.escalation_agent]),
            escalation_emails="ops@example.com,  secondary@example.com\nowner@example.com",
        )

        recipients = command._collect_recipients(item, escalation)

        self.assertCountEqual(
            recipients,
            [
                self.group_user.email,
                self.escalation_agent.email,
                "ops@example.com",
                "secondary@example.com",
                self.assigned.email,
                self.owner.email,
            ],
        )

    @mock.patch("shared.management.commands.sla.send_slack_sla_notification.delay")
    @mock.patch("shared.management.commands.sla.Command._record_escalation_log")
    @mock.patch("shared.management.commands.sla.Command._send_templated_email_to_recipients", return_value=["admin@example.com"])
    @mock.patch("shared.management.commands.sla.NotificationSettingsService.should_send_email_for_template")
    def test_trigger_escalation_action_uses_configured_recipients(self, prefs_mock, send_mock, record_mock, slack_mock):
        prefs_mock.return_value = False

        command = SlaCommand()
        item = SimpleNamespace(
            id=123,
            ticket_id="TCK-123",
            title="SLA breach ticket",
            business=self.business,
            assigned_to=self.assigned,
        )
        escalation = SimpleNamespace(
            escalate_to_groups=SimpleNamespace(all=lambda: []),
            escalate_to_agents=SimpleNamespace(filter=lambda **kwargs: [self.escalation_agent]),
            escalation_emails="",
            escalation_type="resolution",
        )
        sla_status = {
            "resolution": {"due_time": django_timezone.now()},
            "has_sla": True,
        }

        command.trigger_escalation_action(
            item=item,
            escalation=escalation,
            sla_status=sla_status,
            current_time=django_timezone.now(),
            item_type="Ticket",
            sla_target=SimpleNamespace(id=1),
            target_time=django_timezone.now(),
        )

        prefs_mock.assert_not_called()
        send_mock.assert_called_once()
        record_mock.assert_called_once()
        slack_mock.assert_called_once()


@override_settings(SAFARIDESK_FORWARDING_DOMAIN="safaridesk.io")
class MailIntegrationAliasTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = MailIntegrationViewSet.as_view({"post": "generate_alias"})
        self.business = Business.objects.create(name="Mailbox Biz", domain="mailbox-biz")
        self.role = Group.objects.create(name="Admin")
        self.admin = Users.objects.create(
            username="mailbox-admin",
            email="mailbox-admin@example.com",
            role=self.role,
            business=self.business,
            first_name="Mailbox",
            last_name="Admin",
            is_active=True,
            status="A",
        )

    def _create_safaridesk_integration(self, **overrides):
        data = {
            "business": self.business,
            "provider": MailIntegration.Provider.SAFARIDESK,
            "direction": MailIntegration.Direction.BOTH,
            "connection_status": MailIntegration.ConnectionStatus.CONNECTING,
            "is_active": False,
            "display_name": "Support Desk",
        }
        data.update(overrides)
        return MailIntegration.objects.create(**data)

    def test_generate_alias_uses_business_slug_on_root_safaridesk_domain(self):
        integration = self._create_safaridesk_integration()
        request = self.factory.post(f"/api/v1/settings/mail/integrations/{integration.id}/alias/generate/")
        force_authenticate(request, user=self.admin)

        response = self.view(request, pk=integration.id)
        integration.refresh_from_db()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["forwarding_address"], "support@mailbox-biz.safaridesk.io")
        self.assertEqual(integration.forwarding_address, "support@mailbox-biz.safaridesk.io")
        self.assertEqual(integration.email_address, "support@mailbox-biz.safaridesk.io")

    def test_generate_alias_increments_when_business_slug_address_exists(self):
        self._create_safaridesk_integration(
            email_address="support@mailbox-biz.safaridesk.io",
            forwarding_address="support@mailbox-biz.safaridesk.io",
            connection_status=MailIntegration.ConnectionStatus.CONNECTED,
            is_active=True,
        )
        other_business = Business.objects.create(name="Mailbox Biz", domain="mailbox-biz-2")
        other_admin = Users.objects.create(
            username="mailbox-admin-2",
            email="mailbox-admin-2@example.com",
            role=self.role,
            business=other_business,
            is_active=True,
            status="A",
        )
        integration = MailIntegration.objects.create(
            business=other_business,
            provider=MailIntegration.Provider.SAFARIDESK,
            direction=MailIntegration.Direction.BOTH,
            connection_status=MailIntegration.ConnectionStatus.CONNECTING,
            is_active=False,
        )
        request = self.factory.post(f"/api/v1/settings/mail/integrations/{integration.id}/alias/generate/")
        force_authenticate(request, user=other_admin)

        response = self.view(request, pk=integration.id)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["forwarding_address"], "support@mailbox-biz-2.safaridesk.io")


class TicketEmailActivityStreamTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = TicketView.as_view({"get": "loadActivityStream"})
        self.business = Business.objects.create(name="Mailbox Business", domain="mailbox-biz")
        self.department = Department.objects.create(name="Support", business=self.business)
        self.role = Group.objects.create(name="Agent")
        self.agent = Users.objects.create(
            username="agent1",
            email="agent@example.com",
            role=self.role,
            business=self.business,
            first_name="Agent",
            last_name="One",
        )
        self.integration = MailIntegration.objects.create(
            business=self.business,
            department=self.department,
            provider=MailIntegration.Provider.SAFARIDESK,
            direction=MailIntegration.Direction.BOTH,
            connection_status=MailIntegration.ConnectionStatus.CONNECTED,
            is_active=True,
            email_address="support@mailbox-biz.safaridesk.io",
            forwarding_address="support@mailbox-biz.safaridesk.io",
            display_name="Support Desk",
        )
        self.ticket = Ticket.objects.create(
            title="Email-originated ticket",
            creator_name="Customer Zero",
            creator_email="customer@example.com",
            ticket_id="ITK-2026-0001",
            department=self.department,
            business=self.business,
            source="email",
            status="open",
            priority="medium",
            assigned_to=self.agent,
        )
        self.incoming_record = EmailMessageRecord.objects.create(
            integration=self.integration,
            business=self.business,
            ticket=self.ticket,
            message_id="<incoming@example.com>",
            direction=EmailMessageRecord.Direction.INCOMING,
            subject="Need help",
            sender="Customer Zero <customer@example.com>",
            recipient="support@mailbox-biz.safaridesk.io",
            raw_headers={
                "From": "Customer Zero <customer@example.com>",
                "To": "support@mailbox-biz.safaridesk.io",
                "Subject": "Need help",
                "Date": "Tue, 7 Apr 2026 16:35:00 +0300",
                "Message-ID": "<incoming@example.com>",
            },
            raw_body="Need help with account access",
            html_body="",
            received_at=datetime(2026, 4, 7, 13, 35, tzinfo=timezone.utc),
        )


    def test_auto_reply_is_persisted_as_comment_backed_outgoing_email_record(self):
        template = SimpleNamespace(
            name="NEW_TICKET_AUTO_REPLY",
            subject="Ticket {{ ticket_id }} received",
            body="Hello {{ creator_name }}",
        )
        rendered_payload = {
            "connection": object(),
            "from_email": "Support Desk <support@mailbox-biz.safaridesk.io>",
            "receiver_email": "customer@example.com",
            "subject": "Ticket ITK-2026-0001 received",
            "plain_text_body": "Hello Customer Zero",
            "html_body": "<p>Hello Customer Zero</p>",
        }

        with mock.patch("shared.workers.Ticket.get_template", return_value=template), \
             mock.patch("shared.workers.Ticket.NotificationSettingsService.should_send_email_for_template", return_value=True), \
             mock.patch("shared.workers.Ticket.mailer.render_templated_email", return_value=rendered_payload), \
             mock.patch("shared.workers.Ticket.mailer.send_rendered_email", return_value=True) as send_system_email, \
             mock.patch("shared.workers.Ticket._send_email_via_provider", return_value=True) as send_via_provider:
            _send_ticket_notification(self.ticket.id, "NEW_TICKET_AUTO_REPLY", self.ticket.creator_email)

        send_system_email.assert_not_called()
        self.assertEqual(send_via_provider.call_args.kwargs["integration"], self.integration)
        self.assertFalse(send_via_provider.call_args.kwargs["allow_system_smtp_fallback"])

        comment = self.ticket.comments.get(email_to=[self.ticket.creator_email])
        outgoing_record = EmailMessageRecord.objects.get(
            ticket=self.ticket,
            direction=EmailMessageRecord.Direction.OUTGOING,
            comment=comment,
        )
        self.assertEqual(comment.content, _build_auto_ack_activity_content(self.ticket))
        self.assertIn(self.ticket.ticket_id, comment.content)
        self.assertIn(self.ticket.title, comment.content)
        self.assertEqual(comment.author_id, self.agent.id)
        self.assertEqual(comment.email_to, [self.ticket.creator_email])
        self.assertEqual(outgoing_record.integration_id, self.integration.id)
        self.assertEqual(outgoing_record.comment_id, comment.id)
        self.assertEqual(outgoing_record.subject, rendered_payload["subject"])
        self.assertEqual(outgoing_record.sender, rendered_payload["from_email"])
        self.assertEqual(outgoing_record.recipient, self.ticket.creator_email)
        self.assertEqual(outgoing_record.raw_body, rendered_payload["plain_text_body"])
        self.assertEqual(outgoing_record.html_body, rendered_payload["html_body"])
        self.assertTrue(outgoing_record.message_id.startswith("<"))
        self.assertEqual(outgoing_record.raw_headers["In-Reply-To"], self.incoming_record.message_id)
        self.assertEqual(outgoing_record.raw_headers["References"], self.incoming_record.message_id)
        self.assertEqual(outgoing_record.raw_headers["To"], self.ticket.creator_email)

    def test_activity_stream_includes_auto_ack_as_comment_backed_outgoing_email(self):
        template = SimpleNamespace(
            name="NEW_TICKET_AUTO_REPLY",
            subject="Ticket {{ ticket_id }} received",
            body="Hello {{ creator_name }}",
        )
        rendered_payload = {
            "connection": object(),
            "from_email": "Support Desk <support@mailbox-biz.safaridesk.io>",
            "receiver_email": "customer@example.com",
            "subject": "Ticket ITK-2026-0001 received",
            "plain_text_body": "Hello Customer Zero",
            "html_body": "<p>Hello Customer Zero</p>",
        }

        with mock.patch("shared.workers.Ticket.get_template", return_value=template), \
             mock.patch("shared.workers.Ticket.NotificationSettingsService.should_send_email_for_template", return_value=True), \
             mock.patch("shared.workers.Ticket.mailer.render_templated_email", return_value=rendered_payload), \
             mock.patch("shared.workers.Ticket.mailer.send_rendered_email", return_value=True), \
             mock.patch("shared.workers.Ticket._send_email_via_provider", return_value=True):
            _send_ticket_notification(self.ticket.id, "NEW_TICKET_AUTO_REPLY", self.ticket.creator_email)

        response = self.view(self.factory.get(f"/api/v1/ticket/get/activity-stream/{self.ticket.id}"), id=self.ticket.id)
        self.assertEqual(response.status_code, 200)

        comment = self.ticket.comments.get(email_to=[self.ticket.creator_email])
        activity_item = next(item for item in response.data if item["type"] == "comment" and item["id"] == comment.id)
        self.assertEqual(activity_item["email_meta"]["direction"], "outgoing")
        self.assertEqual(activity_item["email_meta"]["subject"], rendered_payload["subject"])
        self.assertEqual(activity_item["content"], _build_auto_ack_activity_content(self.ticket))
        self.assertFalse(any(item["type"] == "comment" and item["id"] < 0 for item in response.data))

    def test_auto_reply_does_not_fallback_without_incoming_email_record(self):
        ticket_without_incoming = Ticket.objects.create(
            title="Legacy email-originated ticket",
            creator_name="Customer Legacy",
            creator_email="legacy@example.com",
            ticket_id="ITK-2026-0002",
            department=self.department,
            business=self.business,
            source="email",
            status="open",
            priority="medium",
            assigned_to=self.agent,
        )
        template = SimpleNamespace(
            name="NEW_TICKET_AUTO_REPLY",
            subject="Ticket {{ ticket_id }} received",
            body="Hello {{ creator_name }}",
        )
        rendered_payload = {
            "connection": object(),
            "from_email": "Support Desk <support@mailbox-biz.safaridesk.io>",
            "receiver_email": "legacy@example.com",
            "subject": "Ticket ITK-2026-0002 received",
            "plain_text_body": "Hello Customer Legacy",
            "html_body": "<p>Hello Customer Legacy</p>",
        }

        with mock.patch("shared.workers.Ticket.get_template", return_value=template), \
             mock.patch("shared.workers.Ticket.NotificationSettingsService.should_send_email_for_template", return_value=True), \
             mock.patch("shared.workers.Ticket.mailer.render_templated_email", return_value=rendered_payload), \
             mock.patch("shared.workers.Ticket.mailer.send_rendered_email", return_value=True) as send_system_email, \
             mock.patch("shared.workers.Ticket._send_email_via_provider", return_value=True) as send_via_provider:
            _send_ticket_notification(ticket_without_incoming.id, "NEW_TICKET_AUTO_REPLY", ticket_without_incoming.creator_email)

        send_system_email.assert_not_called()
        send_via_provider.assert_not_called()
        self.assertFalse(ticket_without_incoming.comments.exists())
        self.assertFalse(
            EmailMessageRecord.objects.filter(
                ticket=ticket_without_incoming,
                direction=EmailMessageRecord.Direction.OUTGOING,
            ).exists()
        )

    def test_email_reply_uses_receiving_mailbox_and_disallows_system_fallback(self):
        comment = self.ticket.comments.create(
            ticket=self.ticket,
            author=self.agent,
            content="Customer-facing reply",
            is_internal=False,
        )

        with mock.patch("shared.workers.email_reply._send_email_via_provider", return_value=True) as send_via_provider:
            result = send_email_reply_task(
                self.ticket.id,
                comment.id,
                [self.ticket.creator_email],
            )

        self.assertTrue(result["success"])
        self.assertEqual(send_via_provider.call_args.kwargs["integration"], self.integration)
        self.assertEqual(send_via_provider.call_args.kwargs["from_email"], self.integration.email_address)
        self.assertFalse(send_via_provider.call_args.kwargs["allow_system_smtp_fallback"])

    def test_email_reply_rejects_a_different_selected_mailbox(self):
        other_integration = MailIntegration.objects.create(
            business=self.business,
            department=self.department,
            provider=MailIntegration.Provider.SAFARIDESK,
            direction=MailIntegration.Direction.BOTH,
            connection_status=MailIntegration.ConnectionStatus.CONNECTED,
            is_active=True,
            email_address="billing@mailbox-biz.safaridesk.io",
            forwarding_address="billing@mailbox-biz.safaridesk.io",
            display_name="Billing Desk",
        )
        comment = self.ticket.comments.create(
            ticket=self.ticket,
            author=self.agent,
            content="Customer-facing reply",
            is_internal=False,
        )

        with mock.patch("shared.workers.email_reply._send_email_via_provider", return_value=True) as send_via_provider:
            result = send_email_reply_task(
                self.ticket.id,
                comment.id,
                [self.ticket.creator_email],
                mailbox_id=other_integration.id,
            )

        self.assertFalse(result["success"])
        self.assertIn("received the ticket email", result["error"])
        send_via_provider.assert_not_called()

    def test_linked_outgoing_email_reply_stays_on_comment_activity(self):
        comment = self.ticket.comments.create(
            ticket=self.ticket,
            author=self.agent,
            content="Customer-facing reply",
            is_internal=False,
        )
        EmailMessageRecord.objects.create(
            integration=self.integration,
            business=self.business,
            ticket=self.ticket,
            comment=comment,
            message_id="<reply@example.com>",
            direction=EmailMessageRecord.Direction.OUTGOING,
            subject="Reply",
            sender="Support Desk <support@mailbox-biz.safaridesk.io>",
            recipient="customer@example.com",
            raw_headers={
                "From": "Support Desk <support@mailbox-biz.safaridesk.io>",
                "To": "customer@example.com",
                "Subject": "Reply",
                "Date": "Tue, 7 Apr 2026 16:50:00 +0300",
                "Message-ID": "<reply@example.com>",
            },
            raw_body="Customer-facing reply",
            html_body="<p>Customer-facing reply</p>",
            received_at=datetime(2026, 4, 7, 13, 50, tzinfo=timezone.utc),
        )

        response = self.view(self.factory.get(f"/api/v1/ticket/get/activity-stream/{self.ticket.id}"), id=self.ticket.id)
        self.assertEqual(response.status_code, 200)

        positive_comment = next(item for item in response.data if item["type"] == "comment" and item["id"] == comment.id)
        self.assertEqual(positive_comment["email_meta"]["direction"], "outgoing")
        self.assertEqual(positive_comment["content"], "Customer-facing reply")
        self.assertFalse(any(item["type"] == "comment" and item["id"] < 0 for item in response.data))


class TicketCallLogTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.log_call_view = TicketView.as_view({"post": "log_call"})
        self.stream_view = TicketView.as_view({"get": "loadActivityStream"})
        self.business = Business.objects.create(name="Call Log Business", domain="call-log-biz")
        self.other_business = Business.objects.create(name="Other Call Log Business", domain="other-call-log-biz")
        self.department = Department.objects.create(name="Support", business=self.business)
        self.role = Group.objects.create(name="Call Log Agent")
        self.agent = Users.objects.create(
            username="call-log-agent",
            email="call-log-agent@example.com",
            role=self.role,
            business=self.business,
            first_name="Call",
            last_name="Agent",
        )
        self.ticket_contact = Contact.objects.create(
            business=self.business,
            name="Ticket Contact",
            email="ticket-contact@example.com",
        )
        self.ticket = Ticket.objects.create(
            title="Call log ticket",
            creator_name="Ticket Contact",
            creator_email="ticket-contact@example.com",
            ticket_id="CALL-1",
            department=self.department,
            business=self.business,
            source="phone",
            status="open",
            priority="medium",
            assigned_to=self.agent,
            contact=self.ticket_contact,
        )

    def test_log_call_persists_and_returns_activity_shape(self):
        request = self.factory.post(
            f"/api/v1/ticket/log-call/{self.ticket.id}/",
            {
                "subject": "Call",
                "content": "<p>Discussed the account issue.</p>",
                "contact_id": self.ticket_contact.id,
                "duration": "5m 30s",
            },
            format="json",
        )
        force_authenticate(request, user=self.agent)

        response = self.log_call_view(request, id=self.ticket.id)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["type"], "call_log")
        self.assertEqual(response.data["contact_name"], self.ticket_contact.name)
        self.assertEqual(TicketCallLog.objects.filter(ticket=self.ticket).count(), 1)

    def test_log_call_rejects_cross_tenant_contact(self):
        other_contact = Contact.objects.create(
            business=self.other_business,
            name="Other Contact",
            email="other-contact@example.com",
        )
        request = self.factory.post(
            f"/api/v1/ticket/log-call/{self.ticket.id}/",
            {
                "subject": "Call",
                "content": "<p>Discussed the account issue.</p>",
                "contact_id": other_contact.id,
            },
            format="json",
        )
        force_authenticate(request, user=self.agent)

        response = self.log_call_view(request, id=self.ticket.id)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(TicketCallLog.objects.filter(ticket=self.ticket).count(), 0)

    def test_activity_stream_includes_persisted_call_logs(self):
        TicketCallLog.objects.create(
            business=self.business,
            ticket=self.ticket,
            contact=self.ticket_contact,
            logged_by=self.agent,
            subject="Left Voicemail",
            content="<p>Left a voicemail.</p>",
            contact_name=self.ticket_contact.name,
            contact_email=self.ticket_contact.email,
        )
        request = self.factory.get(f"/api/v1/ticket/get/activity-stream/{self.ticket.id}")
        force_authenticate(request, user=self.agent)

        response = self.stream_view(request, id=self.ticket.id)

        self.assertEqual(response.status_code, 200)
        call_logs = [item for item in response.data if item["type"] == "call_log"]
        self.assertEqual(len(call_logs), 1)
        self.assertEqual(call_logs[0]["subject"], "Left Voicemail")


class AIEmailDraftFormattingTests(SimpleTestCase):
    def test_parse_ai_email_draft_reads_json_payload(self):
        raw = """```json
{"subject":"Re: Login issue","content":"<p>Thanks for the update.</p>"}
```"""

        payload = _parse_ai_email_draft(raw, "Re: Fallback")

        self.assertEqual(payload["subject"], "Re: Login issue")
        self.assertEqual(payload["content"], "<p>Thanks for the update.</p>")

    def test_parse_ai_email_draft_keeps_subject_empty_when_missing(self):
        payload = _parse_ai_email_draft("<p>Thanks for the update.</p>")

        self.assertEqual(payload["subject"], "")
        self.assertEqual(payload["content"], "<p>Thanks for the update.</p>")

    def test_format_email_content_does_not_append_duplicate_signature(self):
        settings = SimpleNamespace(
            signature_greeting="Regards,",
            get_signature_name=lambda: "Chatgpt",
            use_plain_text=True,
        )
        content = "<p>Hi Edwin,</p><p><br></p><p>Thanks for reaching out.</p><p><br></p><p>Regards,</p><p><strong>Chatgpt</strong></p>"

        plain_text, html_body = _format_email_content(content, settings)

        self.assertEqual(plain_text.count("Regards,"), 1)
        self.assertEqual(plain_text.count("Chatgpt"), 1)
        self.assertEqual(html_body.count("Regards,"), 1)
        self.assertEqual(html_body.count("Chatgpt"), 1)


class NotificationRecipientEligibilityTests(TestCase):
    def setUp(self):
        self.business = Business.objects.create(name="Notification Biz", domain="notify-biz")
        self.department = Department.objects.create(name="Support", business=self.business)
        self.role = Group.objects.create(name="Support Agent")

        self.active_member = Users.objects.create(
            username="active-member",
            email="active.member@example.com",
            role=self.role,
            business=self.business,
            first_name="Active",
            last_name="Member",
            is_active=True,
            status="A",
        )
        self.active_member.department.set([self.department])

        self.inactive_member = Users.objects.create(
            username="inactive-member",
            email="inactive.member@example.com",
            role=self.role,
            business=self.business,
            first_name="Inactive",
            last_name="Member",
            is_active=False,
            status="I",
        )
        self.inactive_member.department.set([self.department])

        self.active_watcher = Users.objects.create(
            username="active-watcher",
            email="active.watcher@example.com",
            role=self.role,
            business=self.business,
            first_name="Active",
            last_name="Watcher",
            is_active=True,
            status="A",
        )

        self.inactive_watcher = Users.objects.create(
            username="inactive-watcher",
            email="inactive.watcher@example.com",
            role=self.role,
            business=self.business,
            first_name="Inactive",
            last_name="Watcher",
            is_active=False,
            status="I",
        )

        self.ticket = Ticket.objects.create(
            business=self.business,
            department=self.department,
            title="Department fan-out check",
            description="Regression coverage for notification recipients",
            creator_name="Customer Zero",
            creator_email="customer@example.com",
            ticket_id="ITK-2026-0999",
            priority="medium",
            status="open",
        )
        TicketWatchers.objects.create(ticket=self.ticket, watcher=self.active_watcher)
        TicketWatchers.objects.create(ticket=self.ticket, watcher=self.inactive_watcher)

    def test_department_get_members_preserves_full_membership(self):
        member_ids = set(self.department.get_members().values_list("id", flat=True))
        self.assertEqual(member_ids, {self.active_member.id, self.inactive_member.id})

    @mock.patch("shared.workers.Ticket._send_ticket_notification")
    def test_ticket_assigned_notification_only_emails_assigned_agent(self, mock_send):
        from shared.workers.Ticket import ticket_assigned_notification

        self.ticket.assigned_to = self.active_member
        self.ticket.save(update_fields=["assigned_to"])

        ticket_assigned_notification(self.ticket.id)

        mock_send.assert_called_once_with(
            self.ticket.id,
            "TICKET_ASSIGNMENT_ALERT",
            self.active_member.email,
        )
        sent_emails = {call.args[2] for call in mock_send.call_args_list}
        self.assertNotIn(self.ticket.creator_email, sent_emails)
        self.assertNotIn(self.active_watcher.email, sent_emails)
        self.assertNotIn(self.inactive_watcher.email, sent_emails)

    @mock.patch("shared.workers.Ticket._send_ticket_notification")
    def test_ticket_status_changed_notification_excludes_inactive_department_members_and_watchers(self, mock_send):
        from shared.workers.Ticket import ticket_status_changed_notification

        ticket_status_changed_notification(self.ticket.id)

        sent_emails = {call.args[2] for call in mock_send.call_args_list}
        self.assertEqual(
            sent_emails,
            {
                "customer@example.com",
                self.active_member.email,
                self.active_watcher.email,
            },
        )
        self.assertNotIn(self.inactive_member.email, sent_emails)
        self.assertNotIn(self.inactive_watcher.email, sent_emails)

    @mock.patch("util.Mailer.Mailer.get_smtp_connection_for_business")
    def test_send_template_email_skips_inactive_internal_recipient(self, mock_get_connection):
        sent = EmailTicketService().send_template_email(
            template_name="COMMENT_REPLY_NOTICE",
            recipient_email=self.inactive_member.email,
            context={
                "ticket_id": self.ticket.ticket_id,
                "ticket_title": self.ticket.title,
                "comment_author_name": "Author",
                "original_comment_content": "Original comment",
                "replier_name": "Agent",
                "reply_content": "Reply text",
                "url": "https://example.com/tickets/1",
            },
            business=self.business,
        )

        self.assertFalse(sent)
        mock_get_connection.assert_not_called()


class LegacyEmailIngestionFenceTests(SimpleTestCase):
    def test_process_incoming_emails_is_disabled(self):
        result = process_incoming_emails()
        self.assertEqual(result["status"], "blocked")
        self.assertIn("sync_mail_integrations", result["message"])

    def test_process_emails_for_all_businesses_is_disabled(self):
        result = process_emails_for_all_businesses()
        self.assertEqual(result["errors"], 1)
        self.assertEqual(result["processed"], 0)

    def test_legacy_emails_command_is_disabled(self):
        with self.assertRaises(CommandError):
            call_command("emails")


class TicketNamingServiceTests(SimpleTestCase):
    def test_render_title_default_summary(self):
        title = render_ticket_title(summary="", ticket_id="ITK-2026-0001", source="web", format_template="{summary}")
        self.assertEqual(title, "Support request")

    def test_render_title_with_tokens(self):
        title = render_ticket_title(
            summary="VPN broken",
            ticket_id="ITK-2026-0007",
            source="email",
            format_template="{ticket_id} - {summary} ({source})",
        )
        self.assertEqual(title, "ITK-2026-0007 - VPN broken (email)")

    def test_render_title_truncates_to_max(self):
        long_summary = "X" * 300
        title = render_ticket_title(summary=long_summary, format_template="{summary}")
        self.assertEqual(len(title), 200)

    def test_render_title_can_return_untruncated_value_for_validation(self):
        long_summary = "X" * 300
        title = render_ticket_title(summary=long_summary, format_template="{summary}", max_length=None)
        self.assertEqual(len(title), 300)

    def test_validate_title_format_rejects_invalid_tokens(self):
        valid, invalid = validate_title_format("{summary} - {unknown}")
        self.assertFalse(valid)
        self.assertIn("{unknown}", invalid)

    def test_extract_ticket_code_from_configured_pattern(self):
        code = extract_ticket_code("Re: Ticket #ITK-2026-0042 - Login issue", id_format="ITK-{YYYY}-{####}")
        self.assertEqual(code, "ITK-2026-0042")

    def test_extract_ticket_code_handles_sequence_overflow(self):
        code = extract_ticket_code("Re: ITK-2026-10000 - Login issue", id_format="ITK-{YYYY}-{####}")
        self.assertEqual(code, "ITK-2026-10000")


class TicketConfigEndpointTests(SimpleTestCase):
    def test_update_config_rejects_invalid_title_tokens(self):
        view = TicketView()
        request = SimpleNamespace(
            user=SimpleNamespace(role=SimpleNamespace(name="admin"), business=SimpleNamespace(id=1)),
            data={"id_format": "ITK-{YYYY}-{####}", "title_format": "{summary}-{bad}"},
        )

        response = view.update_config(request)
        self.assertEqual(response.status_code, 400)
        self.assertIn("invalid_tokens", response.data)

    def test_get_config_returns_title_format(self):
        view = TicketView()
        request = SimpleNamespace(
            user=SimpleNamespace(role=SimpleNamespace(name="admin"), business=SimpleNamespace(id=1)),
            data={},
        )

        config = SimpleNamespace(id_format="ITK-{YYYY}-{####}", title_format="{ticket_id} - {summary}")
        chain = mock.Mock()
        chain.first.return_value = config

        with mock.patch("tenant.views.TicketView.TicketConfig.objects.for_business", return_value=chain):
            response = view.get_config(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id_format"], "ITK-{YYYY}-{####}")
        self.assertEqual(response.data["title_format"], "{ticket_id} - {summary}")


class PublicViewDomainValidationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = PublicView.as_view({"post": "validate"})
        self.business = Business.objects.create(name="Acme", domain="acme")
        self.department = Department.objects.create(name="Support", business=self.business)
        self.category = TicketCategories.objects.create(
            name="General Inquiry",
            description="General public support inquiries.",
            business=self.business,
            is_active=True,
        )

    def test_validate_resolves_subdomain_business(self):
        request = self.factory.post(
            "/api/v1/public/validate/",
            {"url": "https://acme.safaridesk.io/helpcenter"},
            format="json",
        )
        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["business_id"], self.business.id)
        self.assertEqual(len(response.data["departments"]), 1)
        self.assertEqual(len(response.data["ticket_categories"]), 1)

    def test_validate_resolves_verified_custom_domain(self):
        CustomDomains.objects.create(
            business=self.business,
            domain="support.acme.com",
            is_verified=True,
        )
        request = self.factory.post(
            "/api/v1/public/validate/",
            {"url": "https://support.acme.com/helpcenter"},
            format="json",
        )
        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["business_id"], self.business.id)
        self.assertEqual(len(response.data["departments"]), 1)
        self.assertEqual(len(response.data["ticket_categories"]), 1)

    def test_validate_rejects_unknown_domain(self):
        request = self.factory.post(
            "/api/v1/public/validate/",
            {"url": "https://unknown.safaridesk.io/helpcenter"},
            format="json",
        )
        response = self.view(request)
        self.assertEqual(response.status_code, 403)


class PublicViewCreateValidationTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = PublicView.as_view({"post": "create"})
        self.business_a = Business.objects.create(name="Business A", domain="biz-a")
        self.business_b = Business.objects.create(name="Business B", domain="biz-b")
        self.category_a = TicketCategories.objects.create(
            name="Billing",
            description="Billing and payment issues",
            business=self.business_a,
            is_active=True,
        )
        self.department_a = Department.objects.create(name="Support A", business=self.business_a)
        self.department_b = Department.objects.create(name="Support B", business=self.business_b)

    def test_create_rejects_cross_business_category_department(self):
        request = self.factory.post(
            "/api/v1/public/create/",
            {
                "title": "Need help",
                "description": "Customer needs support right away",
                "category_id": self.category_a.id,
                "department_id": self.department_b.id,
                "priority": "medium",
            },
            format="multipart",
        )
        response = self.view(request)
        self.assertEqual(response.status_code, 400)
        self.assertIn("same business", response.data["message"])

    def test_create_rejects_title_longer_than_summary_limit(self):
        request = self.factory.post(
            "/api/v1/public/create/",
            {
                "title": "X" * 121,
                "description": "Customer needs support right away",
                "category_id": self.category_a.id,
                "department_id": self.department_a.id,
                "priority": "medium",
            },
            format="multipart",
        )
        response = self.view(request)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["message"], "Ticket title is too long. Maximum 120 characters allowed.")

    def test_create_rejects_formatted_title_longer_than_storage_limit(self):
        TicketConfig.objects.create(
            business=self.business_a,
            title_format="{summary} " + ("X" * 90),
        )
        request = self.factory.post(
            "/api/v1/public/create/",
            {
                "title": "Y" * 120,
                "description": "Customer needs support right away",
                "category_id": self.category_a.id,
                "department_id": self.department_a.id,
                "priority": "medium",
            },
            format="multipart",
        )
        response = self.view(request)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["message"],
            "Formatted ticket title is too long. Please shorten the title to fit within 200 characters.",
        )


class CustomerPortalTicketCreateTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = TicketView.as_view({"post": "create"})
        self.business = Business.objects.create(name="Customer Ticket Biz", domain="customer-ticket-biz")
        self.customer = Customer.objects.create(
            email="nyalikotieno@gmail.com",
            business=self.business,
            first_name="Nyalik",
            last_name="Otieno",
            allow_login=True,
            is_active=True,
        )
        self.department = Department.objects.create(name="Support", business=self.business)
        self.category = TicketCategories.objects.create(
            name="General Support",
            description="General issues",
            business=self.business,
            department=self.department,
        )

    def test_customer_portal_create_does_not_assign_customer_to_contact_owner(self):
        request = self.factory.post(
            "/api/v1/ticket/",
            {
                "title": "Portal ticket",
                "description": "Please help",
                "creator_name": "Nyalik Otieno",
                "creator_email": self.customer.email,
                "category_id": self.category.id,
                "department_id": self.department.id,
                "priority": "medium",
                "source": "customer_portal",
                "is_public": True,
            },
            format="multipart",
        )
        request.user = self.customer

        response = self.view(request)

        self.assertIn(response.status_code, (200, 201))
        ticket_id = response.data.get("ticket_id")
        self.assertIsNotNone(ticket_id)

        ticket = Ticket.objects.get(ticket_id=ticket_id)
        self.assertIsNotNone(ticket.contact)
        self.assertEqual(ticket.contact.email, self.customer.email)
        self.assertIsNone(ticket.contact.owner)

    def test_customer_portal_create_reuses_soft_deleted_contact(self):
        deleted_contact = link_or_create_contact(
            business=self.business,
            name="Old Contact",
            email=self.customer.email,
            phone="0700000000",
            owner=None,
        )
        deleted_contact.is_deleted = True
        deleted_contact.is_active = False
        deleted_contact.save(update_fields=["is_deleted", "is_active"])

        request = self.factory.post(
            "/api/v1/ticket/",
            {
                "title": "Portal ticket after delete",
                "description": "Please help again",
                "creator_name": "Nyalik Otieno",
                "creator_email": self.customer.email,
                "creator_phone": "0701111111",
                "category_id": self.category.id,
                "department_id": self.department.id,
                "priority": "medium",
                "source": "customer_portal",
                "is_public": True,
            },
            format="multipart",
        )
        request.user = self.customer

        response = self.view(request)

        self.assertIn(response.status_code, (200, 201))
        ticket = Ticket.objects.get(ticket_id=response.data["ticket_id"])
        self.assertEqual(ticket.contact.id, deleted_contact.id)
        self.assertFalse(ticket.contact.is_deleted)
        self.assertTrue(ticket.contact.is_active)


class EmailTicketServiceReplyTests(SimpleTestCase):
    def test_unresolved_reply_does_not_create_ticket_and_stays_unread(self):
        service = EmailTicketService()
        service._last_reply_failure_reason = "tenant_unresolved"

        fake_mail = mock.Mock()
        fake_mail.search.return_value = ("OK", [b"1"])
        raw_message = (
            b"Subject: Re: ITK-2026-0001 Login issue\r\n"
            b"From: customer@example.com\r\n"
            b"Message-ID: <msg-1@example.com>\r\n"
            b"\r\n"
            b"follow-up\r\n"
        )
        fake_mail.fetch.return_value = ("OK", [(None, raw_message)])

        service.connect_to_email = mock.Mock(return_value=fake_mail)
        service.extract_ticket_id_from_subject = mock.Mock(return_value="ITK-2026-0001")
        service.add_comment_to_ticket = mock.Mock(return_value=None)
        service.create_ticket_from_email = mock.Mock()

        exists_chain = mock.Mock()
        exists_chain.exists.return_value = False
        with mock.patch("util.EmailTicketService.EmailTicketMapping.objects.filter", return_value=exists_chain):
            service.process_emails()

        service.create_ticket_from_email.assert_not_called()
        fake_mail.store.assert_not_called()


class TicketCategoryUniquenessTests(TestCase):
    def test_unique_constraint_is_case_and_whitespace_insensitive(self):
        business = Business.objects.create(name="Uniq Business", domain="uniqbiz")
        TicketCategories.objects.create(
            name="Billing",
            description="Primary billing category",
            business=business,
            is_active=True,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                TicketCategories.objects.create(
                    name=" billing ",
                    description="Duplicate billing category",
                    business=business,
                    is_active=True,
                )


class CopilotServiceTests(TestCase):
    def setUp(self):
        self.business = Business.objects.create(name="Copilot Biz", domain="copilot-biz")
        self.department = Department.objects.create(name="Support", business=self.business)
        self.role = Group.objects.create(name="Agent")
        self.agent = Users.objects.create(
            username="copilot-agent",
            email="copilot.agent@example.com",
            role=self.role,
            business=self.business,
            first_name="Co",
            last_name="Pilot",
        )
        self.category = TicketCategories.objects.create(
            name="Billing",
            description="Billing related",
            business=self.business,
            department=self.department,
            is_active=True,
        )
        self.ticket = Ticket.objects.create(
            business=self.business,
            department=self.department,
            category=self.category,
            title="Customer cannot pay invoice",
            description="Payment fails on checkout",
            creator_name="Customer Zero",
            creator_email="customer@example.com",
            ticket_id="ITK-2026-0501",
            priority="medium",
            status="open",
        )
        self.delay_patcher = mock.patch("tenant.tasks.process_copilot_suggestion.delay")
        self.mock_process_delay = self.delay_patcher.start()
        self.addCleanup(self.delay_patcher.stop)

    def _complete_queued_suggestion(self, service: CopilotService, suggestion: CopilotSuggestion) -> CopilotSuggestion:
        service.process_queued_suggestion(suggestion_id=suggestion.id)
        suggestion.refresh_from_db()
        return suggestion

    @mock.patch("tenant.services.copilot.service.CopilotCommandRouter.invoke")
    def test_invoke_is_idempotent_for_repeated_request(self, mock_invoke):
        mock_invoke.return_value = (
            "summarize",
            HandlerResult(
                suggestion_type="informational",
                payload={
                    "summary": "Billing issue summary",
                    "key_facts": ["Checkout fails", "Customer blocked"],
                    "thread_recap": "Customer reported payment failure.",
                },
                confidence_score=0.81,
                metadata={"model": "test"},
            ),
        )
        service = CopilotService()

        first = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="summarize",
            query="Summarize this ticket",
        )
        second = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="summarize",
            query="Summarize this ticket",
        )

        self.assertEqual(first.id, second.id)
        self.assertEqual(CopilotSuggestion.objects.count(), 1)
        self.assertEqual(first.status, "queued")
        self.assertEqual(first.payload["message"], "Copilot is preparing a response.")
        self.mock_process_delay.assert_called_once_with(first.id)
        mock_invoke.assert_not_called()

    @mock.patch("tenant.services.copilot.service.CopilotCommandRouter.invoke")
    def test_confirm_applies_triage_updates_and_audits(self, mock_invoke):
        mock_invoke.return_value = (
            "triage",
            HandlerResult(
                suggestion_type="suggested_action",
                payload={
                    "summary": "Urgent billing issue",
                    "next_step": "Assign and mark pending while finance investigates",
                    "missing_info": ["invoice number"],
                    "suggested_updates": {
                        "priority": "high",
                        "status": "pending",
                        "category_id": self.category.id,
                        "category_label": self.category.name,
                        "assignee_id": self.agent.id,
                        "assignee_label": self.agent.full_name(),
                        "tags": ["billing"],
                    },
                    "rationale": ["Customer is blocked from payment"],
                    "sources": [{"type": "current_thread", "label": "Current thread", "detail": "1 recent message"}],
                    "confidence_label": "medium",
                },
                confidence_score=0.73,
                metadata={"model": "test"},
            ),
        )
        service = CopilotService()
        suggestion = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="triage",
            query="What should happen next?",
        )
        suggestion = self._complete_queued_suggestion(service, suggestion)
        updated = service.confirm(user=self.agent, suggestion_id=suggestion.id)
        self.ticket.refresh_from_db()

        self.assertEqual(updated.status, "executed")
        self.assertEqual(updated.metadata["execution"]["state"], "executed")
        self.assertEqual(self.ticket.priority, "high")
        self.assertEqual(self.ticket.status, "pending")
        self.assertEqual(self.ticket.assigned_to_id, self.agent.id)
        self.assertIn("billing", self.ticket.tags)
        self.assertTrue(
            CopilotAuditLog.objects.filter(suggestion=suggestion, event_type="confirm").exists()
        )

    @mock.patch("tenant.services.copilot.service.CopilotCommandRouter.invoke")
    def test_confirm_applies_department_and_creates_follow_up_task(self, mock_invoke):
        fulfillment = Department.objects.create(name="Fulfillment", business=self.business)
        mock_invoke.return_value = (
            "triage",
            HandlerResult(
                suggestion_type="suggested_action",
                payload={
                    "summary": "Needs routing to fulfillment and a follow-up task",
                    "next_step": "Route to fulfillment and schedule follow-up",
                    "missing_info": [],
                    "suggested_updates": {
                        "department_id": fulfillment.id,
                        "department_label": fulfillment.name,
                    },
                    "recommended_actions": [
                        {
                            "type": "create_follow_up_task",
                            "label": "Create a finance follow-up task",
                            "reason": "A linked task is needed for manual verification.",
                            "requires_confirmation": True,
                            "task": {
                                "title": "Verify invoice payment manually",
                                "description": "Check the finance system and update the customer.",
                                "priority": "high",
                                "department_id": fulfillment.id,
                                "department_label": fulfillment.name,
                                "link_to_ticket": True,
                            },
                        }
                    ],
                    "rationale": ["Manual verification is required before closure."],
                    "sources": [{"type": "current_thread", "label": "Current thread", "detail": "1 recent message"}],
                    "confidence_label": "medium",
                },
                confidence_score=0.7,
                metadata={"model": "test"},
            ),
        )

        service = CopilotService()
        suggestion = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="triage",
            query="Triage this ticket",
        )
        suggestion = self._complete_queued_suggestion(service, suggestion)
        service.confirm(user=self.agent, suggestion_id=suggestion.id)
        self.ticket.refresh_from_db()
        linked_task = Task.objects.get(linked_ticket=self.ticket)

        self.assertEqual(self.ticket.department_id, fulfillment.id)
        self.assertEqual(linked_task.title, "Verify invoice payment manually")
        self.assertEqual(linked_task.department_id, fulfillment.id)
        self.assertTrue(
            CopilotAuditLog.objects.filter(suggestion=suggestion, event_type="execute").exists()
        )

    @mock.patch("tenant.services.copilot.service.CopilotCommandRouter.invoke")
    def test_confirm_blocks_low_confidence_actions(self, mock_invoke):
        mock_invoke.return_value = (
            "triage",
            HandlerResult(
                suggestion_type="suggested_action",
                payload={
                    "summary": "Low evidence action",
                    "next_step": "Do not auto-apply",
                    "missing_info": [],
                    "suggested_updates": {"status": "pending"},
                    "recommended_actions": [],
                    "rationale": ["Evidence is weak."],
                    "sources": [{"type": "current_thread", "label": "Current thread", "detail": "1 recent message"}],
                    "confidence_label": "low",
                },
                confidence_score=0.42,
                metadata={"model": "test"},
            ),
        )

        service = CopilotService()
        suggestion = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="triage",
            query="Triage this ticket",
        )
        suggestion = self._complete_queued_suggestion(service, suggestion)

        with self.assertRaisesMessage(ValueError, "low confidence"):
            service.confirm(user=self.agent, suggestion_id=suggestion.id)

    @mock.patch("tenant.services.copilot.service.CopilotCommandRouter.invoke")
    def test_confirm_reopens_ticket_through_recommended_action(self, mock_invoke):
        self.ticket.status = "resolved"
        self.ticket.save(update_fields=["status"])
        mock_invoke.return_value = (
            "triage",
            HandlerResult(
                suggestion_type="suggested_action",
                payload={
                    "summary": "Reopen so engineering can verify the regression",
                    "next_step": "Reopen the ticket and resume work",
                    "missing_info": [],
                    "suggested_updates": {},
                    "recommended_actions": [
                        {
                            "type": "reopen_ticket",
                            "label": "Reopen ticket",
                            "reason": "The customer reported the problem is back.",
                            "requires_confirmation": True,
                        }
                    ],
                    "rationale": ["The issue recurred after resolution."],
                    "sources": [{"type": "current_thread", "label": "Current thread", "detail": "1 recent message"}],
                    "confidence_label": "medium",
                },
                confidence_score=0.68,
                metadata={"model": "test"},
            ),
        )

        service = CopilotService()
        suggestion = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="triage",
            query="Should this be reopened?",
        )
        suggestion = self._complete_queued_suggestion(service, suggestion)
        service.confirm(user=self.agent, suggestion_id=suggestion.id)
        self.ticket.refresh_from_db()

        self.assertEqual(self.ticket.status, "open")
        self.assertTrue(TicketReopen.objects.filter(ticket=self.ticket).exists())

    @mock.patch("shared.signals.ticketSignal.ticket_closed_customer_notification.delay")
    @mock.patch("tenant.services.copilot.service.CopilotCommandRouter.invoke")
    def test_confirm_close_requires_assignment_and_triggers_csat(self, mock_invoke, mock_csat_delay):
        mock_invoke.return_value = (
            "triage",
            HandlerResult(
                suggestion_type="suggested_action",
                payload={
                    "summary": "Safe to close after resolution confirmation",
                    "next_step": "Close the ticket",
                    "missing_info": [],
                    "suggested_updates": {},
                    "recommended_actions": [
                        {
                            "type": "close_ticket",
                            "label": "Close ticket",
                            "reason": "The customer confirmed the issue is resolved.",
                            "requires_confirmation": True,
                        }
                    ],
                    "rationale": ["The issue is resolved and no linked tasks remain."],
                    "sources": [{"type": "current_thread", "label": "Current thread", "detail": "1 recent message"}],
                    "confidence_label": "medium",
                },
                confidence_score=0.68,
                metadata={"model": "test"},
            ),
        )

        service = CopilotService()
        suggestion = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="triage",
            query="Can this be closed?",
        )
        suggestion = self._complete_queued_suggestion(service, suggestion)

        with self.assertRaisesMessage(ValueError, "Please assign this ticket before changing its status."):
            service.confirm(user=self.agent, suggestion_id=suggestion.id)

        suggestion.refresh_from_db()
        self.assertEqual(suggestion.status, "pending_review")
        self.assertEqual(suggestion.metadata["execution"]["state"], "failed")
        self.assertEqual(suggestion.metadata["execution"]["error_type"], "validation_error")
        self.assertIsNone(suggestion.confirmed_at)

        self.ticket.assigned_to = self.agent
        self.ticket.save(update_fields=["assigned_to"])

        with self.captureOnCommitCallbacks(execute=True):
            service.confirm(user=self.agent, suggestion_id=suggestion.id)
        self.ticket.refresh_from_db()

        self.assertEqual(self.ticket.status, "closed")
        mock_csat_delay.assert_called_once_with(self.ticket.id)

    @mock.patch("tenant.services.copilot.service.CopilotCommandRouter.invoke")
    def test_rejected_suggestion_does_not_block_retry(self, mock_invoke):
        mock_invoke.side_effect = [
            (
                "summarize",
                HandlerResult(
                    suggestion_type="informational",
                    payload={
                        "summary": "First summary",
                        "key_facts": ["First attempt"],
                        "thread_recap": "Initial response.",
                    },
                    confidence_score=0.8,
                    metadata={"model": "test"},
                ),
            ),
            (
                "summarize",
                HandlerResult(
                    suggestion_type="informational",
                    payload={
                        "summary": "Retry summary",
                        "key_facts": ["Retry attempt"],
                        "thread_recap": "Second response.",
                    },
                    confidence_score=0.82,
                    metadata={"model": "test"},
                ),
            ),
        ]
        service = CopilotService()

        first = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="summarize",
            query="Summarize this ticket",
        )
        first = self._complete_queued_suggestion(service, first)
        service.reject(user=self.agent, suggestion_id=first.id)
        second = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="summarize",
            query="Summarize this ticket",
        )
        second = self._complete_queued_suggestion(service, second)

        self.assertNotEqual(first.id, second.id)
        self.assertEqual(second.payload["summary"], "Retry summary")
        self.assertEqual(mock_invoke.call_count, 2)

    def test_similar_search_only_returns_resolved_cases(self):
        resolved_ticket = Ticket.objects.create(
            business=self.business,
            department=self.department,
            category=self.category,
            title="Resolved billing issue",
            description="Customer payment recovered",
            creator_name="Customer Zero",
            creator_email="customer@example.com",
            ticket_id="ITK-2026-0502",
            priority="medium",
            status="resolved",
        )
        Ticket.objects.create(
            business=self.business,
            department=self.department,
            category=self.category,
            title="Open billing investigation",
            description="Finance still checking",
            creator_name="Customer Zero",
            creator_email="customer@example.com",
            ticket_id="ITK-2026-0503",
            priority="medium",
            status="open",
        )

        assembler = ContextAssembler()
        results = assembler.find_similar_tickets(ticket=self.ticket, query="billing payment", top_k=5)

        self.assertEqual([item["id"] for item in results], [resolved_ticket.id])

    @mock.patch("tenant.services.copilot.service.CopilotCommandRouter.invoke")
    def test_invoke_rejects_cross_business_ticket_access(self, mock_invoke):
        other_business = Business.objects.create(name="Other Biz", domain="other-biz")
        other_department = Department.objects.create(name="Other Support", business=other_business)
        other_ticket = Ticket.objects.create(
            business=other_business,
            department=other_department,
            title="Other ticket",
            description="Should not be visible",
            creator_name="Other",
            creator_email="other@example.com",
            ticket_id="ITK-2026-9999",
        )

        service = CopilotService()
        with self.assertRaisesMessage(Exception, "No Ticket matches the given query."):
            service.invoke(
                user=self.agent,
                ticket_id=other_ticket.id,
                command="summarize",
                query="Summarize",
            )

    @mock.patch("tenant.services.copilot.service.CopilotCommandRouter.invoke")
    def test_process_queued_suggestion_marks_invalid_json_as_failed(self, mock_invoke):
        mock_invoke.side_effect = CopilotGatewayError(
            "invalid_json",
            "No JSON object found in LLM response",
            user_message="Copilot returned an unreadable structured response. Please try again.",
        )

        service = CopilotService()
        suggestion = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="triage",
            query="Triage this ticket",
        )
        suggestion = self._complete_queued_suggestion(service, suggestion)

        self.assertEqual(suggestion.status, "failed")
        self.assertEqual(suggestion.metadata["error_type"], "invalid_json")
        self.assertEqual(suggestion.payload["title"], "Triage recommendation unavailable")
        self.assertEqual(suggestion.payload["message"], "Copilot could not prepare a triage recommendation right now. Try again.")
        self.assertTrue(suggestion.payload["retryable"])
        self.assertEqual(
            suggestion.payload["message"],
            "Copilot could not prepare a triage recommendation right now. Try again.",
        )

    @mock.patch("tenant.services.copilot.service.CopilotCommandRouter.invoke")
    def test_process_queued_suggestion_transitions_to_pending_review(self, mock_invoke):
        mock_invoke.return_value = (
            "summarize",
            HandlerResult(
                suggestion_type="informational",
                payload={
                    "summary": "Billing issue summary",
                    "key_facts": ["Checkout fails", "Customer blocked"],
                    "thread_recap": "Customer reported payment failure.",
                },
                confidence_score=0.81,
                metadata={"model": "test"},
            ),
        )

        service = CopilotService()
        suggestion = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="summarize",
            query="Summarize this ticket",
        )
        suggestion = self._complete_queued_suggestion(service, suggestion)

        self.assertEqual(suggestion.status, "pending_review")
        self.assertEqual(suggestion.payload["summary"], "Billing issue summary")
        self.assertEqual(suggestion.confidence_score, 0.81)

    @mock.patch("tenant.services.copilot.service.CopilotCommandRouter.invoke")
    def test_confirm_creates_timezone_aware_follow_up_task_due_date(self, mock_invoke):
        fulfillment = Department.objects.create(name="Ops", business=self.business)
        mock_invoke.return_value = (
            "triage",
            HandlerResult(
                suggestion_type="suggested_action",
                payload={
                    "summary": "Create a follow-up task with a due date",
                    "next_step": "Create the task",
                    "missing_info": [],
                    "suggested_updates": {},
                    "recommended_actions": [
                        {
                            "type": "create_follow_up_task",
                            "label": "Create follow-up task",
                            "reason": "Track manual verification.",
                            "requires_confirmation": True,
                            "task": {
                                "title": "Check payment manually",
                                "description": "Review finance logs.",
                                "priority": "high",
                                "department_id": fulfillment.id,
                                "department_label": fulfillment.name,
                                "due_date": "2026-04-22",
                                "link_to_ticket": True,
                            },
                        }
                    ],
                    "rationale": ["Manual verification is required."],
                    "sources": [{"type": "current_thread", "label": "Current thread", "detail": "1 recent message"}],
                    "confidence_label": "medium",
                },
                confidence_score=0.71,
                metadata={"model": "test"},
            ),
        )

        service = CopilotService()
        suggestion = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="triage",
            query="Create a task",
        )
        suggestion = self._complete_queued_suggestion(service, suggestion)
        service.confirm(user=self.agent, suggestion_id=suggestion.id)

        task = Task.objects.get(linked_ticket=self.ticket)
        self.assertIsNotNone(task.due_date)
        self.assertTrue(django_timezone.is_aware(task.due_date))

    @mock.patch("tenant.services.copilot.service.CopilotCommandRouter.invoke")
    def test_confirm_does_not_duplicate_follow_up_task_after_execution(self, mock_invoke):
        fulfillment = Department.objects.create(name="Batch 2 Ops", business=self.business)
        mock_invoke.return_value = (
            "triage",
            HandlerResult(
                suggestion_type="suggested_action",
                payload={
                    "summary": "Create one follow-up task",
                    "next_step": "Create the task once",
                    "missing_info": [],
                    "suggested_updates": {},
                    "recommended_actions": [
                        {
                            "type": "create_follow_up_task",
                            "label": "Create follow-up task",
                            "reason": "Track manual verification.",
                            "requires_confirmation": True,
                            "task": {
                                "title": "Only one task should exist",
                                "description": "Review finance logs.",
                                "priority": "high",
                                "department_id": fulfillment.id,
                                "department_label": fulfillment.name,
                                "link_to_ticket": True,
                            },
                        }
                    ],
                    "rationale": ["Manual verification is required."],
                    "sources": [{"type": "current_thread", "label": "Current thread", "detail": "1 recent message"}],
                    "confidence_label": "medium",
                },
                confidence_score=0.71,
                metadata={"model": "test"},
            ),
        )

        service = CopilotService()
        suggestion = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="triage",
            query="Create a task",
        )
        suggestion = self._complete_queued_suggestion(service, suggestion)
        first = service.confirm(user=self.agent, suggestion_id=suggestion.id)
        second = service.confirm(user=self.agent, suggestion_id=suggestion.id)

        self.assertEqual(first.status, "executed")
        self.assertEqual(second.status, "executed")
        self.assertEqual(Task.objects.filter(linked_ticket=self.ticket, title="Only one task should exist").count(), 1)

    @mock.patch("tenant.services.copilot.service.CopilotCommandRouter.invoke")
    def test_invoke_sync_unexpected_error_returns_failed_suggestion(self, mock_invoke):
        mock_invoke.side_effect = RuntimeError("search backend unavailable")

        service = CopilotService()
        suggestion = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="similar",
            query="Find similar tickets",
        )

        self.assertEqual(suggestion.status, "failed")
        self.assertEqual(suggestion.command, "similar")
        self.assertEqual(suggestion.payload["title"], "Similar tickets unavailable")
        self.assertEqual(suggestion.payload["error_type"], "provider_error")

    @mock.patch("tenant.services.copilot.service.CopilotCommandRouter.invoke")
    def test_invoke_sync_unexpected_kb_error_returns_failed_suggestion(self, mock_invoke):
        mock_invoke.side_effect = RuntimeError("kb search unavailable")

        service = CopilotService()
        suggestion = service.invoke(
            user=self.agent,
            ticket_id=self.ticket.id,
            command="suggest-kb",
            query="Suggest knowledge",
        )

        self.assertEqual(suggestion.status, "failed")
        self.assertEqual(suggestion.command, "suggest-kb")
        self.assertEqual(suggestion.payload["title"], "Knowledge suggestions unavailable")
        self.assertEqual(suggestion.payload["error_type"], "provider_error")


class CopilotHandlerReliabilityTests(TestCase):
    def setUp(self):
        self.business = Business.objects.create(name="Copilot Handler Biz", domain="copilot-handler-biz")
        self.department = Department.objects.create(name="Support", business=self.business)
        self.category = TicketCategories.objects.create(name="Billing", business=self.business)
        self.role = Group.objects.create(name="Handler Agent")
        self.agent = Users.objects.create(
            username="copilot-handler-agent",
            email="handler.agent@example.com",
            first_name="Handler",
            last_name="Agent",
            role=self.role,
            business=self.business,
            is_active=True,
        )
        self.ticket = Ticket.objects.create(
            business=self.business,
            department=self.department,
            category=self.category,
            title="Unable to process invoice payment",
            description="Customer cannot pay for the invoice and needs help.",
            creator_name="Customer",
            creator_email="customer@example.com",
            ticket_id="ITK-2026-0701",
            priority="medium",
            status="open",
        )

    def test_summarize_handler_normalizes_plain_text_response(self):
        handler = SummarizeHandler(context_assembler=ContextAssembler(), llm_gateway=mock.Mock())
        handler.llm_gateway.generate_content.return_value = {
            "content": "Customer cannot pay the invoice.\n\n- Payment fails at checkout\n- Customer is blocked today",
            "model": "test-model",
        }
        handler.llm_gateway.build_meta.return_value = {"model": "test-model"}
        handler.llm_gateway._looks_blocked_response.return_value = False

        result = handler.run(ticket=self.ticket, query="Summarize this ticket")

        self.assertEqual(result.suggestion_type, "informational")
        self.assertTrue(result.payload["summary"])
        self.assertGreater(len(result.payload["key_facts"]), 0)
        self.assertEqual(result.metadata["fallback"], "summary_normalized")

    def test_draft_note_handler_normalizes_plain_text_response(self):
        handler = DraftNoteHandler(context_assembler=ContextAssembler(), llm_gateway=mock.Mock())
        handler.llm_gateway.generate_content.return_value = {
            "content": "Internal handoff:\nCustomer cannot pay the invoice.\nFinance review is still needed.",
            "model": "test-model",
        }
        handler.llm_gateway.build_meta.return_value = {"model": "test-model"}
        handler.llm_gateway._looks_blocked_response.return_value = False

        result = handler.run(ticket=self.ticket, query="Draft a handoff note")

        self.assertEqual(result.suggestion_type, "draft")
        self.assertIn("Customer cannot pay the invoice.", result.payload["content"])
        self.assertEqual(result.metadata["fallback"], "note_normalized")

    def test_summarize_handler_raises_for_blocked_response(self):
        handler = SummarizeHandler(context_assembler=ContextAssembler(), llm_gateway=mock.Mock())
        handler.llm_gateway.generate_content.return_value = {
            "content": "I can't help with that request because it violates policy.",
            "model": "test-model",
        }
        handler.llm_gateway._looks_blocked_response.return_value = True

        with self.assertRaises(BlockedLLMResponseError):
            handler.run(ticket=self.ticket, query="Summarize this ticket")

    def test_draft_note_handler_raises_for_blocked_response(self):
        handler = DraftNoteHandler(context_assembler=ContextAssembler(), llm_gateway=mock.Mock())
        handler.llm_gateway.generate_content.return_value = {
            "content": "I can't help with that request because it violates policy.",
            "model": "test-model",
        }
        handler.llm_gateway._looks_blocked_response.return_value = True

        with self.assertRaises(BlockedLLMResponseError):
            handler.run(ticket=self.ticket, query="Draft a handoff note")

    def test_similar_handler_propagates_search_error(self):
        assembler = mock.Mock()
        assembler.find_similar_tickets.side_effect = RuntimeError("vector search down")
        handler = SimilarHandler(context_assembler=assembler, llm_gateway=mock.Mock())

        with self.assertRaisesMessage(RuntimeError, "vector search down"):
            handler.run(ticket=self.ticket, query="Find similar tickets")

    def test_suggest_kb_handler_propagates_search_error(self):
        assembler = mock.Mock()
        assembler.search_kb.side_effect = RuntimeError("kb search down")
        handler = SuggestKBHandler(context_assembler=assembler, llm_gateway=mock.Mock())

        with self.assertRaisesMessage(RuntimeError, "kb search down"):
            handler.run(ticket=self.ticket, query="Suggest knowledge")

    def test_triage_handler_resolves_named_targets_into_allowed_updates(self):
        ops = Department.objects.create(name="Ops", business=self.business)
        handler = TriageHandler(context_assembler=ContextAssembler(), llm_gateway=mock.Mock())
        handler.llm_gateway.generate_content.return_value = {
            "content": json.dumps(
                {
                    "summary": "Billing issue needs finance review",
                    "next_step": "Route to billing support and create a follow-up task",
                    "missing_info": ["invoice number"],
                    "suggested_updates": {
                        "priority": "high",
                        "status": "pending",
                        "category": "Billing",
                        "department": "Ops",
                        "assignee": self.agent.email,
                        "tags": ["billing", "invoice"],
                    },
                    "recommended_actions": [
                        {
                            "type": "create_follow_up_task",
                            "label": "Create finance follow-up",
                            "reason": "Manual verification is required.",
                            "task": {
                                "title": "Verify invoice payment",
                                "department": "Ops",
                                "assignee": self.agent.email,
                                "priority": "high",
                            },
                        }
                    ],
                    "rationale": ["The customer is blocked from payment."],
                }
            ),
            "model": "test-model",
        }
        handler.llm_gateway.build_meta.return_value = {"model": "test-model"}
        handler.llm_gateway._looks_blocked_response.return_value = False

        result = handler.run(ticket=self.ticket, query="Triage this ticket")
        updates = result.payload["suggested_updates"]
        actions = result.payload["recommended_actions"]

        self.assertEqual(updates["category_id"], self.category.id)
        self.assertEqual(updates["department_id"], ops.id)
        self.assertEqual(updates["assignee_id"], self.agent.id)
        self.assertEqual(actions[0]["task"]["department_id"], ops.id)
        self.assertEqual(actions[0]["task"]["assignee_id"], self.agent.id)


class CopilotInvokeViewTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = CopilotInvokeView.as_view()
        self.business = Business.objects.create(name="Copilot View Biz", domain="copilot-view-biz")
        self.department = Department.objects.create(name="Support", business=self.business)
        self.role = Group.objects.create(name="Agent")
        self.agent = Users.objects.create(
            username="copilot-view-agent",
            email="copilot.view.agent@example.com",
            role=self.role,
            business=self.business,
        )
        self.ticket = Ticket.objects.create(
            business=self.business,
            department=self.department,
            title="Copilot view ticket",
            description="Testing",
            creator_name="Customer",
            creator_email="customer@example.com",
            ticket_id="ITK-2026-0601",
        )

    @mock.patch("tenant.views.CopilotView.CopilotService.invoke")
    def test_post_returns_200_for_failed_suggestion_payload(self, mock_invoke):
        suggestion = CopilotSuggestion.objects.create(
            business=self.business,
            ticket=self.ticket,
            requested_by=self.agent,
            command="triage",
            request_text="Triage this ticket",
            suggestion_type="informational",
            status="failed",
            payload={
                "title": "Triage recommendation unavailable",
                "message": "Copilot could not prepare a triage recommendation right now. Try again.",
                "retryable": True,
                "error_type": "invalid_json",
            },
            metadata={"error_type": "invalid_json"},
            idempotency_key="failed-suggestion",
            surface="rail",
        )
        mock_invoke.return_value = suggestion

        request = self.factory.post(
            "/api/v1/copilot/invoke/",
            {"ticket_id": self.ticket.id, "command": "triage", "query": "Triage this ticket"},
            format="json",
        )
        request.user = self.agent
        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["suggestion"]["status"], "failed")
        self.assertEqual(response.data["suggestion"]["payload"]["title"], "Triage recommendation unavailable")


class DashboardViewTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = DashView.as_view({"get": "load"})
        self.business = Business.objects.create(name="Dashboard Biz", domain="dashboard-biz")
        self.admin_role = Group.objects.create(name="admin")
        self.agent_role = Group.objects.create(name="agent")
        self.admin = Users.objects.create(
            username="dashboard-admin",
            email="admin@dashboard.test",
            role=self.admin_role,
            business=self.business,
        )
        self.agent = Users.objects.create(
            username="dashboard-agent",
            email="agent@dashboard.test",
            role=self.agent_role,
            business=self.business,
        )
        self.other_agent = Users.objects.create(
            username="dashboard-agent-2",
            email="agent2@dashboard.test",
            role=self.agent_role,
            business=self.business,
        )

        self.support = Department.objects.create(name="Support", business=self.business)
        self.billing = Department.objects.create(name="Billing", business=self.business)
        self.agent.department.add(self.support)
        self.other_agent.department.add(self.billing)

        self.category = TicketCategories.objects.create(
            name="General",
            description="General requests",
            business=self.business,
            department=self.support,
        )
        self.sla_policy = SLAPolicy.objects.create(
            name="Default SLA",
            business=self.business,
            response_time=60,
            resolution_time=240,
            is_active=True,
        )

        Ticket.objects.create(
            business=self.business,
            department=self.support,
            category=self.category,
            assigned_to=self.agent,
            title="Assigned support ticket",
            description="Needs work",
            creator_name="Customer One",
            creator_email="one@example.com",
            ticket_id="TKT-1001",
            status="open",
        )
        Ticket.objects.create(
            business=self.business,
            department=self.support,
            category=self.category,
            title="Unassigned support ticket",
            description="Waiting for assignment",
            creator_name="Customer Two",
            creator_email="two@example.com",
            ticket_id="TKT-1002",
            status="open",
        )
        Ticket.objects.create(
            business=self.business,
            department=self.billing,
            category=self.category,
            assigned_to=self.other_agent,
            title="Billing ticket",
            description="Billing queue item",
            creator_name="Customer Three",
            creator_email="three@example.com",
            ticket_id="TKT-1003",
            status="open",
        )

    def _mark_ticket_breached(self, ticket: Ticket) -> None:
        SLATracker.objects.create(
            ticket=ticket,
            sla_policy=self.sla_policy,
            first_response_due=django_timezone.now() - timedelta(hours=2),
            resolution_due=django_timezone.now() - timedelta(hours=1),
            first_response_status="breached",
            resolution_status="breached",
        )

    def test_admin_dashboard_payload_returns_admin_sections(self):
        request = self.factory.get("/api/v1/dashboard/data/?q=week")
        request.user = self.admin

        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], "admin")
        self.assertIsNotNone(response.data["admin_dashboard"])
        self.assertIsNone(response.data["agent_dashboard"])
        self.assertEqual(response.data["admin_dashboard"]["summary"][0]["value"], 3)

    def test_agent_dashboard_payload_is_scoped_to_agent_departments(self):
        request = self.factory.get("/api/v1/dashboard/data/?q=week")
        request.user = self.agent

        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["role"], "agent")
        self.assertIsNone(response.data["admin_dashboard"])
        self.assertIsNotNone(response.data["agent_dashboard"])
        self.assertEqual(response.data["agent_dashboard"]["summary"][0]["value"], 1)

        unassigned_departments = response.data["agent_dashboard"]["unassigned_by_department"]
        self.assertEqual(len(unassigned_departments), 1)
        self.assertEqual(unassigned_departments[0]["label"], "Support")

    def test_admin_top_slow_queues_include_tickets_resolved_in_window(self):
        now = django_timezone.now()
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)

        slow_ticket = Ticket.objects.create(
            business=self.business,
            department=self.support,
            category=self.category,
            assigned_to=self.agent,
            title="Long running support ticket",
            description="Closed this week after a long time",
            creator_name="Customer Four",
            creator_email="four@example.com",
            ticket_id="TKT-1004",
            status="closed",
        )
        Ticket.objects.filter(pk=slow_ticket.pk).update(
            created_at=week_start - timedelta(days=5),
            resolved_at=week_start + timedelta(days=1),
        )

        request = self.factory.get("/api/v1/dashboard/data/?q=week")
        request.user = self.admin

        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["admin_dashboard"]["top_slow_queues"]), 1)
        self.assertEqual(response.data["admin_dashboard"]["top_slow_queues"][0]["label"], "General")
        self.assertEqual(response.data["admin_dashboard"]["top_slow_queues"][0]["category_id"], self.category.id)

    def test_agent_queue_trend_counts_resolved_tickets_after_later_updates(self):
        now = django_timezone.now()
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)

        resolved_ticket = Ticket.objects.create(
            business=self.business,
            department=self.support,
            category=self.category,
            assigned_to=self.agent,
            title="Resolved support ticket",
            description="Resolved and later edited",
            creator_name="Customer Five",
            creator_email="five@example.com",
            ticket_id="TKT-1005",
            status="closed",
        )
        Ticket.objects.filter(pk=resolved_ticket.pk).update(
            created_at=week_start,
            resolved_at=week_start + timedelta(days=2),
            updated_by=self.other_agent,
        )

        request = self.factory.get("/api/v1/dashboard/data/?q=week")
        request.user = self.agent

        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        resolved_total = sum(point["resolved"] for point in response.data["agent_dashboard"]["queue_trend"])
        self.assertEqual(resolved_total, 1)

    def test_admin_unassigned_breakdown_matches_summary_including_no_department(self):
        Ticket.objects.create(
            business=self.business,
            category=self.category,
            title="Unrouted backlog ticket",
            description="Still missing a department",
            creator_name="Customer Six",
            creator_email="six@example.com",
            ticket_id="TKT-1006",
            status="open",
        )

        request = self.factory.get("/api/v1/dashboard/data/?q=week")
        request.user = self.admin

        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        unassigned_summary = next(
            metric["value"] for metric in response.data["admin_dashboard"]["summary"] if metric["key"] == "unassigned_tickets"
        )
        breakdown = response.data["admin_dashboard"]["unassigned_by_department"]
        self.assertEqual(sum(item["value"] for item in breakdown), unassigned_summary)
        self.assertTrue(any(item["label"] == "No department" for item in breakdown))

    def test_admin_breached_breakdown_uses_selected_period_scope(self):
        now = django_timezone.now()
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)

        old_ticket = Ticket.objects.create(
            business=self.business,
            department=self.support,
            category=self.category,
            assigned_to=self.agent,
            title="Older breached ticket",
            description="Outside selected week",
            creator_name="Customer Eleven",
            creator_email="eleven@example.com",
            ticket_id="TKT-1007",
            status="open",
        )
        recent_ticket = Ticket.objects.create(
            business=self.business,
            department=self.billing,
            category=self.category,
            assigned_to=self.other_agent,
            title="Recent breached ticket",
            description="Inside selected week",
            creator_name="Customer Twelve",
            creator_email="twelve@example.com",
            ticket_id="TKT-1008",
            status="open",
        )
        Ticket.objects.filter(pk=old_ticket.pk).update(created_at=week_start - timedelta(days=10))
        self._mark_ticket_breached(old_ticket)
        self._mark_ticket_breached(recent_ticket)

        request = self.factory.get("/api/v1/dashboard/data/?q=week")
        request.user = self.admin

        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        breakdown = response.data["admin_dashboard"]["breached_by_department"]
        self.assertEqual(sum(item["value"] for item in breakdown), 1)
        self.assertEqual(breakdown[0]["label"], "Billing")

    def test_admin_blockers_use_selected_period_scope_but_mailbox_health_stays_live(self):
        now = django_timezone.now()
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)

        old_unrouted = Ticket.objects.create(
            business=self.business,
            category=self.category,
            title="Older unrouted ticket",
            description="Outside selected week",
            creator_name="Customer Thirteen",
            creator_email="thirteen@example.com",
            ticket_id="TKT-1009",
            status="open",
        )
        recent_unrouted = Ticket.objects.create(
            business=self.business,
            category=self.category,
            title="Recent unrouted ticket",
            description="Inside selected week",
            creator_name="Customer Fourteen",
            creator_email="fourteen@example.com",
            ticket_id="TKT-1010",
            status="open",
        )
        Ticket.objects.filter(pk=old_unrouted.pk).update(created_at=week_start - timedelta(days=10))

        MailIntegration.objects.create(
            business=self.business,
            department=self.support,
            provider=MailIntegration.Provider.SAFARIDESK,
            direction=MailIntegration.Direction.BOTH,
            connection_status=MailIntegration.ConnectionStatus.ERROR,
            is_active=True,
            email_address="alerts@dashboard-biz.safaridesk.io",
        )

        week_request = self.factory.get("/api/v1/dashboard/data/?q=week")
        week_request.user = self.admin
        week_response = self.view(week_request)

        year_request = self.factory.get("/api/v1/dashboard/data/?q=year")
        year_request.user = self.admin
        year_response = self.view(year_request)

        week_blockers = {item["key"]: item["count"] for item in week_response.data["admin_dashboard"]["operational_blockers"]}
        year_mailbox = year_response.data["admin_dashboard"]["mailbox_health"]
        week_mailbox = week_response.data["admin_dashboard"]["mailbox_health"]

        self.assertEqual(week_blockers["no_department"], 1)
        self.assertEqual(week_mailbox["error"], year_mailbox["error"])
        self.assertEqual(week_mailbox["total"], year_mailbox["total"])

    def test_admin_risk_agents_use_selected_period_scope(self):
        now = django_timezone.now()
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)

        old_agent_ticket = Ticket.objects.create(
            business=self.business,
            department=self.support,
            category=self.category,
            assigned_to=self.agent,
            title="Older agent load",
            description="Outside selected week",
            creator_name="Customer Fifteen",
            creator_email="fifteen@example.com",
            ticket_id="TKT-1011",
            status="open",
        )
        recent_agent_ticket = Ticket.objects.create(
            business=self.business,
            department=self.billing,
            category=self.category,
            assigned_to=self.other_agent,
            title="Recent agent load",
            description="Inside selected week",
            creator_name="Customer Sixteen",
            creator_email="sixteen@example.com",
            ticket_id="TKT-1012",
            status="open",
        )
        Ticket.objects.filter(pk=old_agent_ticket.pk).update(created_at=week_start - timedelta(days=10))
        self._mark_ticket_breached(recent_agent_ticket)

        request = self.factory.get("/api/v1/dashboard/data/?q=week")
        request.user = self.admin

        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        risk_rows = {item["name"]: item for item in response.data["admin_dashboard"]["risk_agents"]}
        self.assertEqual(risk_rows[self.agent.email]["open_tickets"], 1)
        self.assertEqual(risk_rows[self.other_agent.email]["open_tickets"], 2)

    def test_agent_period_scoped_department_cards_exclude_older_tickets(self):
        now = django_timezone.now()
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)

        old_unassigned = Ticket.objects.create(
            business=self.business,
            department=self.support,
            category=self.category,
            title="Older support unassigned",
            description="Outside selected week",
            creator_name="Customer Seventeen",
            creator_email="seventeen@example.com",
            ticket_id="TKT-1013",
            status="open",
        )
        old_breached = Ticket.objects.create(
            business=self.business,
            department=self.support,
            category=self.category,
            assigned_to=self.agent,
            title="Older support breached",
            description="Outside selected week",
            creator_name="Customer Eighteen",
            creator_email="eighteen@example.com",
            ticket_id="TKT-1014",
            status="open",
        )
        Ticket.objects.filter(pk__in=[old_unassigned.pk, old_breached.pk]).update(created_at=week_start - timedelta(days=10))
        self._mark_ticket_breached(old_breached)

        request = self.factory.get("/api/v1/dashboard/data/?q=week")
        request.user = self.agent

        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        unassigned_departments = response.data["agent_dashboard"]["unassigned_by_department"]
        breached_departments = response.data["agent_dashboard"]["breached_by_department"]
        self.assertEqual(sum(item["value"] for item in unassigned_departments), 1)
        self.assertEqual(sum(item["value"] for item in breached_departments), 0)


class ReportsViewTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.tickets_view = ReportsViewSet.as_view({"get": "tickets"})
        self.export_tickets_view = ReportsViewSet.as_view({"get": "export_tickets"})
        self.agents_view = ReportsViewSet.as_view({"get": "agents"})
        self.business = Business.objects.create(name="Reports Biz", domain="reports-biz")
        self.other_business = Business.objects.create(name="Other Biz", domain="other-biz")
        self.admin_role = Group.objects.create(name="admin")
        self.agent_role = Group.objects.create(name="agent")

        self.admin = Users.objects.create(
            username="reports-admin",
            email="reports-admin@example.com",
            role=self.admin_role,
            business=self.business,
            category="BUSINESS",
        )
        self.agent = Users.objects.create(
            username="reports-agent",
            email="reports-agent@example.com",
            role=self.agent_role,
            business=self.business,
            category="BUSINESS",
            first_name="Ada",
            last_name="Support",
        )
        self.legacy_agent = Users.objects.create(
            username="reports-legacy-agent",
            email="reports-legacy-agent@example.com",
            role=self.agent_role,
            business=self.business,
            category="CUSTOMER",
            first_name="Ben",
            last_name="Legacy",
        )
        self.foreign_admin = Users.objects.create(
            username="foreign-admin",
            email="foreign-admin@example.com",
            role=self.admin_role,
            business=self.other_business,
            category="BUSINESS",
        )

        self.support = Department.objects.create(name="Support", business=self.business)
        self.other_department = Department.objects.create(name="Other", business=self.other_business)
        self.agent.department.add(self.support)
        self.category = TicketCategories.objects.create(
            name="Product",
            description="Product issues",
            business=self.business,
            department=self.support,
        )
        self.other_category = TicketCategories.objects.create(
            name="Foreign",
            description="Other tenant",
            business=self.other_business,
            department=self.other_department,
        )

        self.ticket = Ticket.objects.create(
            business=self.business,
            department=self.support,
            category=self.category,
            assigned_to=self.agent,
            title="Customer cannot log in",
            creator_name="John Doe",
            creator_email="john@example.com",
            ticket_id="RPT-1001",
            status="resolved",
            source="email",
            csat_score=9,
        )
        Ticket.objects.filter(pk=self.ticket.pk).update(
            first_response_at=django_timezone.now() - timedelta(hours=2),
            resolved_at=django_timezone.now() - timedelta(hours=1),
        )
        self.ticket.refresh_from_db()

        Task.objects.create(
            business=self.business,
            department=self.support,
            assigned_to=self.agent,
            title="Investigate login failure",
            task_trackid="TSK-1001",
            task_status="completed",
            linked_ticket=self.ticket,
            completed_at=django_timezone.now(),
        )

        Ticket.objects.create(
            business=self.other_business,
            department=self.other_department,
            category=self.other_category,
            assigned_to=self.foreign_admin,
            title="Foreign tenant ticket",
            creator_name="Other Person",
            creator_email="other@example.com",
            ticket_id="RPT-9999",
            status="open",
        )

    def test_reports_require_admin_role(self):
        request = self.factory.get("/api/v1/reports/tickets/")
        request.user = self.agent

        response = self.tickets_view(request)

        self.assertEqual(response.status_code, 403)

    def test_ticket_report_is_tenant_scoped(self):
        request = self.factory.get("/api/v1/reports/tickets/?q=month")
        request.user = self.admin

        response = self.tickets_view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_count"], 1)
        self.assertEqual(response.data["rows"][0]["ticket_id"], "RPT-1001")

    def test_ticket_report_supports_department_and_search_filters(self):
        request = self.factory.get(
            f"/api/v1/reports/tickets/?q=month&department={self.support.id}&search=log%20in"
        )
        request.user = self.admin

        response = self.tickets_view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_count"], 1)
        self.assertEqual(response.data["rows"][0]["customer"], "John Doe")

    def test_ticket_export_returns_csv(self):
        request = self.factory.get("/api/v1/reports/tickets/export/?q=month&format=csv")
        request.user = self.admin

        response = self.export_tickets_view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv")
        self.assertIn("RPT-1001", response.content.decode("utf-8"))

    def test_agent_report_returns_summary_rows(self):
        request = self.factory.get("/api/v1/reports/agents/?q=month")
        request.user = self.admin

        response = self.agents_view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["rows"][0]["agent_name"], "Ada Support")
        self.assertEqual(response.data["rows"][0]["resolved_tickets"], 1)

    def test_agent_report_includes_legacy_business_users(self):
        request = self.factory.get("/api/v1/reports/agents/?q=month")
        request.user = self.admin

        response = self.agents_view(request)

        self.assertEqual(response.status_code, 200)
        returned_names = {row["agent_name"] for row in response.data["rows"]}
        self.assertIn("Ben Legacy", returned_names)


class TicketListDrilldownTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = TicketView.as_view({"get": "list"})
        self.business = Business.objects.create(name="Ticket View Biz", domain="ticket-view-biz")
        self.admin_role = Group.objects.create(name="admin")
        self.admin = Users.objects.create(
            username="ticket-admin",
            email="ticket-admin@example.com",
            role=self.admin_role,
            business=self.business,
        )
        self.support = Department.objects.create(name="Support", business=self.business)
        self.billing = Department.objects.create(name="Billing", business=self.business)
        self.support_category = TicketCategories.objects.create(
            name="Support Queue",
            description="Support work",
            business=self.business,
            department=self.support,
        )
        self.billing_category = TicketCategories.objects.create(
            name="Billing Queue",
            description="Billing work",
            business=self.business,
            department=self.billing,
        )

    def test_slow_queues_orders_longest_resolution_time_first(self):
        base_time = django_timezone.now() - timedelta(days=10)
        slow_ticket = Ticket.objects.create(
            business=self.business,
            department=self.support,
            category=self.support_category,
            title="Slow resolution ticket",
            description="Took the longest",
            creator_name="Customer Seven",
            creator_email="seven@example.com",
            ticket_id="TKT-2001",
            status="closed",
        )
        fast_ticket = Ticket.objects.create(
            business=self.business,
            department=self.billing,
            category=self.billing_category,
            title="Fast resolution ticket",
            description="Closed quickly",
            creator_name="Customer Eight",
            creator_email="eight@example.com",
            ticket_id="TKT-2002",
            status="closed",
        )
        Ticket.objects.filter(pk=slow_ticket.pk).update(
            created_at=base_time,
            resolved_at=base_time + timedelta(hours=72),
        )
        Ticket.objects.filter(pk=fast_ticket.pk).update(
            created_at=base_time,
            resolved_at=base_time + timedelta(hours=4),
        )

        request = self.factory.get("/api/v1/ticket/?view=slow_queues&pagination=no")
        request.user = self.admin

        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["ticket_id"], "TKT-2001")
        self.assertEqual(response.data[1]["ticket_id"], "TKT-2002")

    def test_slow_queues_respects_category_filter(self):
        base_time = django_timezone.now() - timedelta(days=5)
        support_ticket = Ticket.objects.create(
            business=self.business,
            department=self.support,
            category=self.support_category,
            title="Support resolution ticket",
            description="Support category result",
            creator_name="Customer Nine",
            creator_email="nine@example.com",
            ticket_id="TKT-2003",
            status="closed",
        )
        Ticket.objects.create(
            business=self.business,
            department=self.billing,
            category=self.billing_category,
            title="Billing resolution ticket",
            description="Billing category result",
            creator_name="Customer Ten",
            creator_email="ten@example.com",
            ticket_id="TKT-2004",
            status="closed",
        )
        Ticket.objects.filter(pk=support_ticket.pk).update(
            created_at=base_time,
            resolved_at=base_time + timedelta(hours=24),
        )

        request = self.factory.get(
            f"/api/v1/ticket/?view=slow_queues&category={self.support_category.id}&pagination=no"
        )
        request.user = self.admin

        response = self.view(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["ticket_id"], "TKT-2003")


class CustomerPortalCommentTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.business = Business.objects.create(name="Customer Portal Biz", domain="customer-portal-biz")
        self.role = Group.objects.create(name="customer-portal-system")
        self.system_user = Users.objects.create(
            username="system.user@example.com",
            email="system.user@example.com",
            role=self.role,
            business=self.business,
            first_name="System",
            last_name="User",
            is_active=True,
        )
        self.customer = Customer.objects.create(
            email="innonyalik579@gmail.com",
            business=self.business,
            first_name="Inno",
            last_name="Nyalik",
            allow_login=True,
            is_active=True,
        )
        self.department = Department.objects.create(name="Support", business=self.business)
        self.category = TicketCategories.objects.create(
            name="General Support",
            description="General customer support",
            business=self.business,
            department=self.department,
        )
        self.ticket = Ticket.objects.create(
            business=self.business,
            department=self.department,
            category=self.category,
            title="Portal comment ticket",
            description="Customer needs help",
            creator_name="Inno Nyalik",
            creator_email=self.customer.email,
            ticket_id="TKT-3001",
            status="open",
        )

    def test_customer_portal_comment_uses_system_updated_by_and_no_staff_author(self):
        request = self.factory.post(
            "/api/v1/ticket/comment/add/3001",
            {"comment": "<p>Hello from the customer portal</p>", "is_internal": False},
            format="json",
        )
        request.user = self.customer

        response = TicketView.as_view({"post": "add_comment"})(request, id=self.ticket.id)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["message"], "Note added successfully")

        comment = self.ticket.comments.get()
        self.assertIsNone(comment.author)
        self.assertEqual(comment.updated_by, self.system_user)
        self.assertEqual(comment.content, "<p>Hello from the customer portal</p>")
