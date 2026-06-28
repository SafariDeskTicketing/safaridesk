from unittest.mock import patch

from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from users.models import Business, Users
from users.views.AuthView import SendPasswordResetLinkView


class PasswordResetTenantScopeTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.role = Group.objects.create(name="password-reset-role")
        self.business_a = Business.objects.create(name="Company A", domain="company-a")
        self.business_b = Business.objects.create(name="Company B", domain="company-b")
        self.shared_email = "shared@example.com"
        self.user_a = Users.objects.create(
            username="shared-a",
            email=self.shared_email,
            role=self.role,
            business=self.business_a,
            first_name="Company",
            last_name="A",
            is_active=True,
        )
        self.user_b = Users.objects.create(
            username="shared-b",
            email=self.shared_email,
            role=self.role,
            business=self.business_b,
            first_name="Company",
            last_name="B",
            is_active=True,
        )

    def test_password_reset_uses_requested_business_scope(self):
        with patch("users.views.AuthView.Mailer.send_password_reset_link") as send_reset:
            request = self.factory.post(
                "/api/v1/auth/send-password-reset/",
                {"identifier": self.shared_email, "business_id": self.business_b.id},
                format="json",
            )
            response = SendPasswordResetLinkView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(send_reset.called)
        reset_url = send_reset.call_args.args[0]
        self.assertIn("company-b.", reset_url)
        self.assertNotIn("company-a.", reset_url)

        self.user_a.refresh_from_db()
        self.user_b.refresh_from_db()
        self.assertIsNone(self.user_a.last_login)
        self.assertIsNotNone(self.user_b.last_login)
