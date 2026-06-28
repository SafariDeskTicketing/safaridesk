from unittest.mock import patch

from django.contrib.sessions.middleware import SessionMiddleware
from django.test import TestCase
from django.contrib.auth.models import Group
from rest_framework.test import APIRequestFactory

from shared.authentication import CustomerJWTAuthentication
from tenant.models import Department, Ticket, TicketCategories
from tenant.views.AgentView import AgentView
from tenant.views.TicketView import TicketView
from users.models import Business, Customer, CustomerMagicLinkToken, Users
from users.views.AuthView import LoginInitiateView
from users.views.BusinessView import BusinessRegistrationView
from users.views.CustomerAuthView import CustomerLoginView, CustomerMagicLoginVerifyView


class CustomerPortalAuthTests(TestCase):
	def setUp(self):
		self.factory = APIRequestFactory()
		self.business = Business.objects.create(name='Acme Support', domain='acme')
		self.department = Department.objects.create(name='Support', business=self.business)
		self.category = TicketCategories.objects.create(
			name='General',
			description='General support request',
			business=self.business,
			department=self.department,
		)
		self.customer = Customer.objects.create_user(
			username='customer@example.com',
			email='customer@example.com',
			password='Password123!',
			first_name='Case',
			last_name='Customer',
			business=self.business,
			allow_login=False,
			is_active=False,
		)

	def _add_session(self, request):
		session_middleware = SessionMiddleware(lambda req: None)
		session_middleware.process_request(request)
		request.session.save()
		return request

	def test_magic_login_request_issues_token_and_enables_customer(self):
		with patch('users.views.CustomerAuthView.Mailer.send_customer_magic_link', return_value=True) as send_magic_link:
			request = self.factory.post(
				'/api/v1/auth/customer/login/',
				{'email': self.customer.email, 'business_id': self.business.id},
				format='json',
			)

			response = CustomerLoginView.as_view()(request)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data['message'], 'If an account exists, a login link has been sent.')
		self.assertTrue(send_magic_link.called)

		self.customer.refresh_from_db()
		self.assertTrue(self.customer.allow_login)
		self.assertTrue(self.customer.is_active)

		token_record = CustomerMagicLinkToken.objects.get(customer=self.customer)
		self.assertFalse(token_record.is_used)
		self.assertEqual(token_record.email, self.customer.email)

	def test_magic_login_verify_issues_jwt_and_marks_token_used(self):
		raw_token, token_record = CustomerMagicLinkToken.issue_for_customer(self.customer)
		request = self._add_session(self.factory.get('/api/v1/auth/customer/magic-login/', {'token': raw_token}))

		response = CustomerMagicLoginVerifyView.as_view()(request)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data['user_type'], 'customer')
		self.assertEqual(response.data['redirect_to'], '/helpcenter/dashboard')
		self.assertIn('access', response.data)
		self.assertIn('refresh', response.data)

		token_record.refresh_from_db()
		self.assertTrue(token_record.is_used)
		self.assertIsNotNone(token_record.used_at)
		self.assertEqual(request.session['customer_id'], self.customer.id)
		self.assertEqual(request.session['customer_login_via'], 'magic_link')

		auth_request = self.factory.get(
			'/api/v1/ticket/customer/list/',
			HTTP_AUTHORIZATION=f"Bearer {response.data['access']}",
		)
		user, token = CustomerJWTAuthentication().authenticate(auth_request)

		self.assertEqual(user.email, self.customer.email)
		self.assertEqual(token['user_type'], 'customer')

	def test_magic_login_token_is_single_use(self):
		raw_token, _ = CustomerMagicLinkToken.issue_for_customer(self.customer)

		first_request = self._add_session(self.factory.get('/api/v1/auth/customer/magic-login/', {'token': raw_token}))
		first_response = CustomerMagicLoginVerifyView.as_view()(first_request)
		self.assertEqual(first_response.status_code, 200)

		second_request = self._add_session(self.factory.get('/api/v1/auth/customer/magic-login/', {'token': raw_token}))
		second_response = CustomerMagicLoginVerifyView.as_view()(second_request)

		self.assertEqual(second_response.status_code, 400)
		self.assertIn('already been used', second_response.data['message'])

	def test_magic_login_request_keeps_response_generic_for_unknown_email(self):
		request = self.factory.post(
			'/api/v1/auth/customer/login/',
			{'email': 'missing@example.com', 'business_id': self.business.id},
			format='json',
		)

		response = CustomerLoginView.as_view()(request)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data['message'], 'If an account exists, a login link has been sent.')
		self.assertFalse(Customer.objects.filter(email='missing@example.com').exists())

	def test_customer_ticket_listing_only_returns_own_tickets(self):
		own_ticket = Ticket.objects.create(
			business=self.business,
			title='Need help',
			description='Customer issue',
			category=self.category,
			department=self.department,
			creator_email=self.customer.email,
			ticket_id='TCK-0001',
		)
		Ticket.objects.create(
			business=self.business,
			title='Other request',
			description='Another issue',
			category=self.category,
			department=self.department,
			creator_email='someone-else@example.com',
			ticket_id='TCK-0002',
		)

		request = self.factory.get('/api/v1/ticket/customer/list/?pagination=no')
		request.user = self.customer

		response = TicketView.as_view({'get': 'my_customer_tickets'})(request)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]['ticket_id'], own_ticket.ticket_id)


class AgentListFilteringTests(TestCase):
	def setUp(self):
		self.factory = APIRequestFactory()
		self.business = Business.objects.create(name='Acme Support', domain='acme')
		self.role = Group.objects.create(name='agent')
		self.active_agent = Users.objects.create_user(
			username='active.agent@example.com',
			email='active.agent@example.com',
			password='Password123!',
			first_name='Active',
			last_name='Agent',
			business=self.business,
			role=self.role,
			category='BUSINESS',
			is_active=True,
			is_staff=True,
			is_superuser=False,
		)
		self.inactive_agent = Users.objects.create_user(
			username='inactive.agent@example.com',
			email='inactive.agent@example.com',
			password='Password123!',
			first_name='Inactive',
			last_name='Agent',
			business=self.business,
			role=self.role,
			category='BUSINESS',
			is_active=False,
			is_staff=True,
			is_superuser=False,
		)

	def test_unpaginated_agent_list_excludes_inactive_agents(self):
		request = self.factory.get('/api/v1/agent/list/?pagination=no')
		request.user = self.active_agent

		response = AgentView.as_view({'get': 'list'})(request)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]['id'], self.active_agent.id)


class MFAAuthDefaultsTests(TestCase):
	def setUp(self):
		self.factory = APIRequestFactory()
		self.business = Business.objects.create(name='MFA Test', domain='mfatest')
		self.admin_role = Group.objects.create(name='admin')
		self.agent_role = Group.objects.create(name='agent')
		self.department = Department.objects.create(name='Support', business=self.business)
		self.user = Users.objects.create_user(
			username='mfa.admin@example.com',
			email='mfa.admin@example.com',
			password='Password123!',
			first_name='MFA',
			last_name='Admin',
			business=self.business,
			role=self.admin_role,
			category='BUSINESS',
			is_active=True,
			is_staff=True,
		)

	def test_business_owner_defaults_to_no_mfa(self):
		request = self.factory.post(
			'/api/v1/business/create/',
			{
				'first_name': 'New',
				'last_name': 'Owner',
				'email': 'owner@example.com',
				'business_name': 'Owner Business',
				'domain': 'owner-business',
				'organization_size': '1-10',
				'website': '',
			},
			format='json',
		)

		with patch('users.views.BusinessView.send_welcome_message.delay'):
			response = BusinessRegistrationView.as_view({'post': 'create'})(request)

		self.assertEqual(response.status_code, 201)
		owner = Users.objects.get(email='owner@example.com')
		self.assertEqual(owner.mfa_method, 'none')

	def test_agent_defaults_to_no_mfa(self):
		request = self.factory.post(
			'/api/v1/agent/create/',
			{
				'name': 'New Agent',
				'email': 'new.agent@example.com',
				'phone_number': '254700000001',
				'departments': [self.department.id],
			},
			format='json',
		)
		request.user = self.user

		with patch('tenant.views.AgentView.send_welcome_message.apply') as send_welcome:
			send_welcome.return_value.get.return_value = None
			response = AgentView.as_view({'post': 'create'})(request)

		self.assertEqual(response.status_code, 201)
		agent = Users.objects.get(email='new.agent@example.com')
		self.assertEqual(agent.mfa_method, 'none')

	def test_login_with_no_mfa_returns_tokens(self):
		response = self._login()

		self.assertEqual(response.status_code, 200)
		self.assertFalse(response.data['mfa_required'])
		self.assertIn('access', response.data)
		self.assertIn('refresh', response.data)

	def test_login_with_email_mfa_requires_fresh_session(self):
		self.user.mfa_method = 'email'
		self.user.save(update_fields=['mfa_method'])

		with patch('users.views.AuthView.Mailer.send_otp', return_value=True):
			response = self._login()

		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.data['mfa_required'])
		self.assertEqual(response.data['mfa_method'], 'email')
		self.assertIn('sessionKey', response.data)
		self.assertNotIn('access', response.data)

	def test_login_with_blank_mfa_method_returns_tokens(self):
		self.user.mfa_method = ''
		self.user.save(update_fields=['mfa_method'])

		response = self._login()

		self.assertEqual(response.status_code, 200)
		self.assertFalse(response.data['mfa_required'])
		self.assertIn('access', response.data)

	def test_login_with_invalid_mfa_method_returns_tokens(self):
		self.user.mfa_method = 'sms'
		self.user.save(update_fields=['mfa_method'])

		response = self._login()

		self.assertEqual(response.status_code, 200)
		self.assertFalse(response.data['mfa_required'])
		self.assertIn('access', response.data)

	def _login(self):
		request = self.factory.post(
			'/api/v1/auth/login/',
			{'username': self.user.email, 'password': 'Password123!'},
			format='json',
		)
		return LoginInitiateView.as_view()(request)
