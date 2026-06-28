from datetime import datetime, time, timedelta

from django.contrib.auth.models import Group
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIRequestFactory, APITestCase, APITransactionTestCase
from rest_framework_simplejwt.tokens import RefreshToken

from tenant.models import Contact, TenantAuditLog
from tenant.models.AssetModel import AuditLog as AssetAuditLog
from tenant.services.audit import log_audit_event
from users.models import Business, Customer, Users


class TenantAuditLogApiTests(APITestCase):
    def setUp(self):
        self.admin_group = Group.objects.create(name="admin")
        self.agent_group = Group.objects.create(name="agent")
        self.business = Business.objects.create(name="Audit Co")
        self.other_business = Business.objects.create(name="Other Co")
        self.admin = Users.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="pass",
            first_name="Ada",
            last_name="Admin",
            business=self.business,
            role=self.admin_group,
            is_staff=True,
            is_active=True,
            category="BUSINESS",
        )
        self.admin.groups.add(self.admin_group)
        self.agent = Users.objects.create_user(
            username="agent",
            email="agent@example.com",
            password="pass",
            first_name="Alex",
            last_name="Agent",
            business=self.business,
            role=self.agent_group,
            is_staff=True,
            is_active=True,
            category="BUSINESS",
        )
        TenantAuditLog.objects.create(
            business=self.business,
            actor=self.admin,
            actor_name="Ada Admin",
            actor_email="admin@example.com",
            event_type="TICKET_CREATED",
            entity_type="ticket",
            entity_id="TCKT-1",
            activity="Ada Admin created Ticket #TCKT-1",
        )
        TenantAuditLog.objects.create(
            business=self.other_business,
            actor_name="Other Admin",
            actor_email="other@example.com",
            event_type="TICKET_CREATED",
            entity_type="ticket",
            entity_id="TCKT-2",
            activity="Other Admin created Ticket #TCKT-2",
        )

    def test_admin_lists_only_own_business_audit_logs(self):
        self.client.force_authenticate(self.admin)

        response = self.client.get("/api/v1/audit-logs/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["entity_id"], "TCKT-1")

    def test_non_admin_cannot_list_audit_logs(self):
        self.client.force_authenticate(self.agent)

        response = self.client.get("/api/v1/audit-logs/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_date_only_filters_include_full_selected_days(self):
        self.client.force_authenticate(self.admin)
        yesterday = TenantAuditLog.objects.create(
            business=self.business,
            actor=self.admin,
            actor_name="Ada Admin",
            actor_email="admin@example.com",
            event_type="TASK_CREATED",
            entity_type="task",
            entity_id="TSK-OLD",
            activity="Old task",
        )
        today = TenantAuditLog.objects.create(
            business=self.business,
            actor=self.admin,
            actor_name="Ada Admin",
            actor_email="admin@example.com",
            event_type="TASK_CREATED",
            entity_type="task",
            entity_id="TSK-TODAY",
            activity="Today task",
        )
        target_day = timezone.localdate()
        TenantAuditLog.objects.filter(id=yesterday.id).update(
            timestamp=timezone.now() - timedelta(days=1)
        )
        TenantAuditLog.objects.filter(id=today.id).update(
            timestamp=timezone.make_aware(datetime.combine(target_day, time.max))
        )

        response = self.client.get(
            "/api/v1/audit-logs/",
            {"date_from": target_day.isoformat(), "date_to": target_day.isoformat(), "page_size": 100},
        )

        entity_ids = {row["entity_id"] for row in response.data["results"]}
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("TSK-TODAY", entity_ids)
        self.assertNotIn("TSK-OLD", entity_ids)

    def test_contact_notes_and_tags_updates_are_audited(self):
        contact = Contact.objects.create(
            business=self.business,
            owner=self.admin,
            name="Alice Customer",
            email="alice@example.com",
            notes="old notes",
            tags=["old"],
        )
        self.client.force_authenticate(self.admin)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                f"/api/v1/contacts/{contact.id}/",
                {"notes": "new notes", "tags": ["vip", "billing"]},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        changed_fields = {
            log.metadata["field_name"]
            for log in TenantAuditLog.objects.filter(
                business=self.business,
                event_type="CONTACT_UPDATED",
                entity_type="contact",
                entity_id=str(contact.id),
            )
        }
        self.assertEqual(changed_fields, {"notes", "tags"})

    def test_logout_logs_only_for_matching_refresh_token(self):
        refresh = RefreshToken.for_user(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/v1/auth/logout/",
                {"refresh": str(refresh)},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            TenantAuditLog.objects.filter(
                business=self.business,
                actor=self.admin,
                event_type="USER_LOGOUT",
            ).exists()
        )

    def test_logout_rejects_refresh_token_for_different_user_without_audit(self):
        other_refresh = RefreshToken.for_user(self.agent)
        admin_refresh = RefreshToken.for_user(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_refresh.access_token}")

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/v1/auth/logout/",
                {"refresh": str(other_refresh)},
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            TenantAuditLog.objects.filter(
                business=self.business,
                event_type="USER_LOGOUT",
            ).exists()
        )


class TenantAuditLogServiceTests(APITransactionTestCase):
    def test_log_audit_event_runs_after_commit(self):
        admin_group = Group.objects.create(name="admin")
        business = Business.objects.create(name="Audit Service Co")
        admin = Users.objects.create_user(
            username="service-admin",
            email="service-admin@example.com",
            password="pass",
            first_name="Sam",
            last_name="Service",
            business=business,
            role=admin_group,
            is_staff=True,
            is_active=True,
            category="BUSINESS",
        )
        request = APIRequestFactory().post("/api/v1/test/").wsgi_request
        request.user = admin
        request.META["REMOTE_ADDR"] = "127.0.0.1"
        request.META["HTTP_USER_AGENT"] = "test-client"

        with transaction.atomic():
            log_audit_event(
                request,
                event_type="USER_UPDATED",
                entity_type="user",
                entity=admin,
                activity="Sam Service updated User 'Sam Service'",
                metadata={"field_name": "name"},
            )
            self.assertFalse(TenantAuditLog.objects.exists())

        log = TenantAuditLog.objects.get(event_type="USER_UPDATED")
        self.assertEqual(log.actor_id, admin.id)

    def test_explicit_business_overrides_actor_business_and_metadata_is_sanitized(self):
        admin_group = Group.objects.create(name="admin")
        actor_business = Business.objects.create(name="Actor Co")
        target_business = Business.objects.create(name="Target Co")
        admin = Users.objects.create_user(
            username="cross-admin",
            email="cross-admin@example.com",
            password="pass",
            first_name="Cross",
            last_name="Admin",
            business=actor_business,
            role=admin_group,
            is_staff=True,
            is_active=True,
            category="BUSINESS",
        )
        target = Users.objects.create_user(
            username="target-user",
            email="target@example.com",
            password="pass",
            first_name="Target",
            last_name="User",
            business=target_business,
            role=admin_group,
            is_staff=True,
            is_active=True,
            category="BUSINESS",
        )
        request = APIRequestFactory().post("/api/v1/admin/users/1/reset-password/").wsgi_request
        request.user = admin

        with transaction.atomic():
            log_audit_event(
                request,
                event_type="SAFARI_ADMIN_RESET_PASSWORD",
                entity_type="safari_admin",
                entity=target,
                activity="SafariAdmin reset password on User 'target@example.com'",
                metadata={"token": "secret-token", "notes": "ok"},
                actor_user=admin,
                business=target_business,
            )
            self.assertFalse(TenantAuditLog.objects.exists())

        log = TenantAuditLog.objects.get(event_type="SAFARI_ADMIN_RESET_PASSWORD")
        self.assertEqual(log.business_id, target_business.id)
        self.assertEqual(log.actor_id, admin.id)
        self.assertEqual(log.metadata["token"], "[redacted]")
        self.assertEqual(log.metadata["notes"], "ok")

    def test_log_audit_event_snapshots_customer_without_actor_fk(self):
        business = Business.objects.create(name="Customer Audit Co")
        customer = Customer.objects.create_user(
            username="customer-audit",
            email="customer@example.com",
            password="pass",
            first_name="Casey",
            last_name="Customer",
            business=business,
            is_active=True,
            category="CUSTOMER",
        )
        request = APIRequestFactory().post("/api/v1/test/").wsgi_request
        request.user = customer

        with transaction.atomic():
            log_audit_event(
                request,
                event_type="TICKET_CREATED",
                entity_type="ticket",
                entity=customer,
                activity="Casey Customer created Ticket #TCKT-1",
            )
            self.assertFalse(TenantAuditLog.objects.exists())

        log = TenantAuditLog.objects.get(event_type="TICKET_CREATED")
        self.assertIsNone(log.actor_id)
        self.assertEqual(log.actor_name, "Casey Customer")
        self.assertEqual(log.actor_email, "customer@example.com")

    def test_asset_audit_model_save_does_not_write_tenant_audit_log(self):
        business = Business.objects.create(name="Asset Audit Co")

        AssetAuditLog.objects.create(
            business=business,
            action_type="created",
            model_name="Asset",
            object_id=123,
            object_name="Laptop",
        )

        self.assertFalse(TenantAuditLog.objects.filter(business=business).exists())
