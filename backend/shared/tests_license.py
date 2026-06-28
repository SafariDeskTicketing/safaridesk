from datetime import timedelta
from unittest import mock

from django.contrib.auth.models import Group
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from shared.models import LicenseStatus
from shared.services.license import (
    get_configured_edition,
    get_current_business,
    get_deployment_type,
    get_effective_tenancy_mode,
    refresh_license_status,
)
from users.models import Business, Users


class LicenseDeploymentServiceTests(TestCase):
    @override_settings(SAFARIDESK_DEPLOYMENT_TYPE="")
    def test_missing_deployment_type_defaults_to_self_hosted(self):
        self.assertEqual(get_deployment_type(), "self_hosted")
        self.assertEqual(get_effective_tenancy_mode(), "single")

    @override_settings(SAFARIDESK_DEPLOYMENT_TYPE="self_hosted", SAFARIDESK_EDITION="")
    def test_self_hosted_community_requires_no_license(self):
        payload = refresh_license_status()

        self.assertEqual(get_configured_edition(), "community")
        self.assertEqual(payload["tenancy_mode"], "single")
        self.assertTrue(payload["license_valid"])
        self.assertFalse(payload["license_warning"])
        self.assertFalse(payload["license_violation"])

    @override_settings(SAFARIDESK_DEPLOYMENT_TYPE="cloud", SAFARIDESK_EDITION="enterprise")
    def test_cloud_is_multi_tenant_and_requires_no_license(self):
        payload = refresh_license_status()

        self.assertEqual(payload["deployment_type"], "cloud")
        self.assertEqual(payload["edition"], "cloud")
        self.assertEqual(payload["tenancy_mode"], "multi")
        self.assertTrue(payload["license_valid"])
        self.assertFalse(payload["license_warning"])

    @override_settings(SAFARIDESK_DEPLOYMENT_TYPE="self_hosted")
    def test_self_hosted_returns_default_business_when_user_has_no_business(self):
        request = mock.Mock()
        request.user = mock.Mock(is_authenticated=True, business=None)

        business = get_current_business(request)

        self.assertEqual(business.domain, "default")
        self.assertEqual(Business.objects.count(), 1)

    @override_settings(SAFARIDESK_DEPLOYMENT_TYPE="self_hosted")
    def test_self_hosted_preserves_user_business_when_present(self):
        business = Business.objects.create(name="Existing Tenant", domain="existing-tenant")
        request = mock.Mock()
        request.user = mock.Mock(is_authenticated=True, business=business)

        self.assertEqual(get_current_business(request), business)

    @override_settings(SAFARIDESK_DEPLOYMENT_TYPE="self_hosted")
    def test_self_hosted_uses_existing_sole_business_as_default(self):
        business = Business.objects.create(name="Existing Tenant", domain="existing-tenant")
        request = mock.Mock()
        request.user = mock.Mock(is_authenticated=True, business=None)

        self.assertEqual(get_current_business(request), business)
        self.assertEqual(Business.objects.count(), 1)

    @override_settings(
        SAFARIDESK_DEPLOYMENT_TYPE="self_hosted",
        SAFARIDESK_EDITION="enterprise",
        SAFARIDESK_LICENSE_KEY="",
        SAFARIDESK_LICENSE_SERVER_URL="",
    )
    def test_self_hosted_enterprise_missing_license_warns_without_enforcement(self):
        payload = refresh_license_status()

        self.assertEqual(payload["deployment_type"], "self_hosted")
        self.assertEqual(payload["edition"], "enterprise")
        self.assertEqual(payload["tenancy_mode"], "single")
        self.assertFalse(payload["license_valid"])
        self.assertTrue(payload["license_warning"])
        self.assertFalse(payload["license_violation"])
        self.assertEqual(payload["days_until_violation"], 5)

    @override_settings(
        SAFARIDESK_DEPLOYMENT_TYPE="self_hosted",
        SAFARIDESK_EDITION="enterprise",
        SAFARIDESK_LICENSE_KEY="",
        SAFARIDESK_LICENSE_SERVER_URL="",
        SAFARIDESK_LICENSE_VIOLATION_DAYS=5,
    )
    def test_self_hosted_enterprise_missing_license_for_five_days_marks_violation(self):
        LicenseStatus.objects.create(
            singleton_key="default",
            instance_id="test-instance",
            license_valid=False,
            unlicensed_since=timezone.now() - timedelta(days=5, minutes=1),
        )

        payload = refresh_license_status()

        self.assertTrue(payload["license_warning"])
        self.assertTrue(payload["license_violation"])
        self.assertEqual(payload["days_until_violation"], 0)

    @override_settings(
        SAFARIDESK_DEPLOYMENT_TYPE="self_hosted",
        SAFARIDESK_EDITION="enterprise",
        SAFARIDESK_LICENSE_KEY="key",
        SAFARIDESK_LICENSE_SERVER_URL="https://license.example.com",
    )
    @mock.patch("shared.services.license.requests.post")
    def test_valid_self_hosted_enterprise_license_clears_warning_state(self, post_mock):
        LicenseStatus.objects.create(
            singleton_key="default",
            instance_id="test-instance",
            license_valid=False,
            unlicensed_since=timezone.now() - timedelta(days=2),
        )
        post_mock.return_value.raise_for_status.return_value = None
        post_mock.return_value.json.return_value = {
            "valid": True,
            "customer_name": "Acme Ltd",
            "edition": "enterprise",
            "features": ["advanced_reports"],
            "expires_at": "2027-01-01T00:00:00Z",
            "signature": "signed-payload",
        }

        payload = refresh_license_status()

        self.assertTrue(payload["license_valid"])
        self.assertFalse(payload["license_warning"])
        self.assertFalse(payload["license_violation"])
        self.assertIsNone(payload["unlicensed_since"])
        request_json = post_mock.call_args.kwargs["json"]
        self.assertEqual(request_json["deployment_type"], "self_hosted")
        self.assertEqual(request_json["edition"], "enterprise")


class LicenseStatusApiTests(APITestCase):
    def setUp(self):
        self.role = Group.objects.create(name="admin")
        self.business = Business.objects.create(name="API Biz", domain="api-biz")
        self.user = Users.objects.create_user(
            username="license-api@example.com",
            email="license-api@example.com",
            password="password",
            role=self.role,
            business=self.business,
            is_active=True,
        )

    def test_license_status_requires_authentication(self):
        response = self.client.get("/api/v1/license/status/")

        self.assertEqual(response.status_code, 401)

    @override_settings(
        SAFARIDESK_DEPLOYMENT_TYPE="self_hosted",
        SAFARIDESK_EDITION="enterprise",
        SAFARIDESK_LICENSE_KEY="",
        SAFARIDESK_LICENSE_SERVER_URL="",
    )
    def test_license_status_returns_expected_shape(self):
        self.client.force_authenticate(self.user)

        response = self.client.get("/api/v1/license/status/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["deployment_type"], "self_hosted")
        self.assertEqual(response.data["edition"], "enterprise")
        self.assertEqual(response.data["tenancy_mode"], "single")
        self.assertFalse(response.data["license_valid"])
        self.assertTrue(response.data["license_warning"])
        self.assertIn("features", response.data)
        self.assertIn("checked_at", response.data)
        self.assertIn("unlicensed_since", response.data)
