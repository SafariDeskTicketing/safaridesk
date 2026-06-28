from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import Group
from django.test import TestCase
from django.utils import timezone

from shared.models import LicenseStatus
from tenant.models import Department, Task, TenantAuditLog, Ticket, TicketCategories
from users.models import Business, BusinessDeletionRequest, Customer, Users
from users.services.tenant_purge import (
    collect_tenant_resources,
    find_inactive_tenants,
    purge_inactive_tenants,
    purge_tenant,
    verify_tenant_purged,
)


class TenantPurgeTests(TestCase):
    def setUp(self):
        self.role = Group.objects.create(name="admin")
        self.business = Business.objects.create(name="Purge Co", domain="purge-co")
        self.other_business = Business.objects.create(name="Keep Co", domain="keep-co")
        self.user = Users.objects.create_user(
            username="admin@purge.test",
            email="admin@purge.test",
            password="Password123!",
            role=self.role,
            business=self.business,
            category="BUSINESS",
            is_active=True,
            is_staff=True,
        )
        self.customer = Customer.objects.create_user(
            username="customer@purge.test",
            email="customer@purge.test",
            password="Password123!",
            business=self.business,
            is_active=True,
            allow_login=True,
        )
        self.department = Department.objects.create(name="Support", business=self.business)
        self.category = TicketCategories.objects.create(
            name="General",
            description="General support",
            business=self.business,
            department=self.department,
        )
        self.ticket = Ticket.objects.create(
            business=self.business,
            title="Tenant ticket",
            description="Delete me",
            category=self.category,
            department=self.department,
            ticket_id="TCK-PURGE-1",
            assigned_to=self.user,
        )
        self.task = Task.objects.create(
            business=self.business,
            title="Tenant task",
            description="Delete me",
            department=self.department,
            assigned_to=self.user,
        )
        TenantAuditLog.objects.create(
            business=self.business,
            actor=self.user,
            actor_name="Admin",
            actor_email=self.user.email,
            event_type="TEST_EVENT",
            entity_type="ticket",
            entity_id=str(self.ticket.id),
            entity_label=self.ticket.title,
            activity="Test activity",
        )
        self.other_user = Users.objects.create_user(
            username="admin@keep.test",
            email="admin@keep.test",
            password="Password123!",
            role=self.role,
            business=self.other_business,
            category="BUSINESS",
            is_active=True,
            is_staff=True,
        )
        self.other_department = Department.objects.create(name="Keep Support", business=self.other_business)
        self.other_category = TicketCategories.objects.create(
            name="Keep General",
            description="Keep support",
            business=self.other_business,
            department=self.other_department,
        )
        self.other_ticket = Ticket.objects.create(
            business=self.other_business,
            title="Keep ticket",
            description="Do not delete",
            category=self.other_category,
            department=self.other_department,
            ticket_id="TCK-KEEP-1",
        )
        self.license_status = LicenseStatus.objects.create(singleton_key="default", license_valid=True)

    def _age_business_activity(self, business, user, days=45):
        old_time = timezone.now() - timedelta(days=days)
        Business.objects.filter(id=business.id).update(created_at=old_time, updated_at=old_time)
        Users.objects.filter(id=user.id).update(last_login=None)
        Ticket.objects.filter(business=business).update(created_at=old_time, date_updated=old_time)
        Task.objects.filter(business=business).update(created_at=old_time, date_updated=old_time)
        TenantAuditLog.objects.filter(business=business).update(timestamp=old_time)

    def test_collect_tenant_resources_counts_tenant_data_not_system_resources(self):
        resources = collect_tenant_resources(self.business.id)

        self.assertIn("users.Users", resources)
        self.assertIn("users.Customer", resources)
        self.assertIn("tenant.Ticket", resources)
        self.assertIn("tenant.Task", resources)
        self.assertNotIn("shared.LicenseStatus", resources)

    def test_purge_tenant_deletes_tenant_resources_and_preserves_system_resources(self):
        deletion = BusinessDeletionRequest.create_for_business(
            self.business,
            requested_by=self.user,
            reason="test purge",
        )
        deleted_user_id = self.user.id
        deleted_customer_id = self.customer.id

        result = purge_tenant(
            self.business.id,
            reason="test purge",
            actor=self.user,
            deletion_request=deletion,
        )

        self.assertTrue(result["deleted"])
        self.assertFalse(Business.objects.filter(id=self.business.id).exists())
        self.assertFalse(Users.objects.filter(id=deleted_user_id).exists())
        self.assertFalse(Customer.objects.filter(id=deleted_customer_id).exists())
        self.assertFalse(Ticket.objects.filter(business_id=self.business.id).exists())
        self.assertFalse(Task.objects.filter(business_id=self.business.id).exists())
        self.assertFalse(TenantAuditLog.objects.filter(business_id=self.business.id).exists())
        verify_tenant_purged(self.business.id, [deleted_user_id], [deleted_customer_id])

        self.assertTrue(Business.objects.filter(id=self.other_business.id).exists())
        self.assertTrue(Users.objects.filter(id=self.other_user.id).exists())
        self.assertTrue(Ticket.objects.filter(id=self.other_ticket.id).exists())
        self.assertTrue(Group.objects.filter(id=self.role.id).exists())
        self.assertTrue(LicenseStatus.objects.filter(id=self.license_status.id).exists())

        deletion.refresh_from_db()
        self.assertIsNone(deletion.business_id)
        self.assertEqual(deletion.status, BusinessDeletionRequest.STATUS_PURGED)
        self.assertEqual(deletion.business_name, "[purged]")
        self.assertEqual(deletion.business_domain, "")

    def test_find_inactive_tenants_uses_existing_old_tenants_on_first_run(self):
        self._age_business_activity(self.business, self.user)
        Users.objects.filter(id=self.other_user.id).update(last_login=timezone.now())

        inactive_ids = {item["business_id"] for item in find_inactive_tenants(days=30)}

        self.assertIn(self.business.id, inactive_ids)
        self.assertNotIn(self.other_business.id, inactive_ids)

    def test_purge_inactive_tenants_dry_run_and_commit(self):
        self._age_business_activity(self.business, self.user)
        Users.objects.filter(id=self.other_user.id).update(last_login=timezone.now())

        dry_run = purge_inactive_tenants(days=30, dry_run=True)
        self.assertEqual(len(dry_run), 1)
        self.assertTrue(Business.objects.filter(id=self.business.id).exists())

        committed = purge_inactive_tenants(days=30, dry_run=False)
        self.assertEqual(len(committed), 1)
        self.assertFalse(Business.objects.filter(id=self.business.id).exists())
        self.assertTrue(Business.objects.filter(id=self.other_business.id).exists())

    def test_scheduled_inactive_worker_reports_without_deleting(self):
        from shared.workers.BusinessDeletion import report_inactive_business_deletion_candidates

        self._age_business_activity(self.business, self.user)
        Users.objects.filter(id=self.other_user.id).update(last_login=timezone.now())

        with patch("shared.workers.BusinessDeletion._send_inactive_business_report", return_value=True) as send_report:
            result = report_inactive_business_deletion_candidates(days=30)

        self.assertEqual(result["candidates"], 1)
        self.assertTrue(result["sent"])
        self.assertTrue(Business.objects.filter(id=self.business.id).exists())
        self.assertTrue(Users.objects.filter(id=self.user.id).exists())
        send_report.assert_called_once()
