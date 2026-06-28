import logging
from urllib.parse import urlparse

from django.core.cache import cache
from django.db import transaction
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from RNSafarideskBack.settings import DOMAIN_NAME
from tenant.services.audit import actor_name, log_audit_event
from users.models import Business, Customer, CustomerMagicLinkToken, CustomDomains
from users.serializers.CustomerAuthSerializer import (
    CustomerMagicLinkRequestSerializer,
    CustomerMagicLinkVerifySerializer,
)
from util.Mailer import Mailer

logger = logging.getLogger(__name__)

LOGIN_LINK_EXPIRY_MINUTES = 15
RATE_LIMIT_WINDOW_SECONDS = LOGIN_LINK_EXPIRY_MINUTES * 60
RATE_LIMIT_MAX_ATTEMPTS = 5


def _get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _rate_limit_key(scope: str, value: str | None, ip_address: str | None):
    return f'helpcenter_magic_login:{scope}:{value or "unknown"}:{ip_address or "unknown"}'


def _increment_rate_limit(scope: str, value: str | None, ip_address: str | None):
    key = _rate_limit_key(scope, value, ip_address)
    current = cache.get(key, 0)
    if current >= RATE_LIMIT_MAX_ATTEMPTS:
        return False
    cache.set(key, current + 1, RATE_LIMIT_WINDOW_SECONDS)
    return True


def _generic_success_message():
    return {
        'message': 'If an account exists, a login link has been sent.',
    }


def _normalize_host(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlparse(value if '://' in value else f'https://{value}')
    host = (parsed.hostname or '').strip().lower().rstrip('.')
    return host or None


def _parse_host_parts(value: str | None) -> tuple[str | None, str | None]:
    if not value:
        return None, None
    parsed = urlparse(value if '://' in value else f'https://{value}')
    hostname = (parsed.hostname or '').strip().lower().rstrip('.')
    if not hostname:
        return None, None
    netloc = hostname
    if parsed.port:
        netloc = f'{hostname}:{parsed.port}'
    return hostname, netloc


def _scheme_from_url(value: str | None) -> str:
    if not value:
        return 'https'
    parsed = urlparse(value if '://' in value else f'https://{value}')
    return parsed.scheme if parsed.scheme in {'http', 'https'} else 'https'


def _preferred_scheme_for_host(host: str | None) -> str:
    hostname, _ = _parse_host_parts(host)
    if not hostname:
        return 'https'
    if hostname == 'localhost' or hostname.endswith('.localhost'):
        return 'http'
    if hostname in {'127.0.0.1', '0.0.0.0', '::1'}:
        return 'http'
    return 'https'


def _business_allowed_hosts(business: Business | None):
    if not business:
        return set()

    hosts = set()
    domain_segment = (business.domain or '').strip().lower()
    base_domain = (DOMAIN_NAME or '').strip().lower().rstrip('.')
    if domain_segment and base_domain:
        canonical_host = _normalize_host(f'{domain_segment}.{base_domain}')
        if canonical_host:
            hosts.add(canonical_host)

    custom_domains = CustomDomains.objects.filter(
        business=business,
        is_verified=True,
    ).values_list('domain', flat=True)
    for domain in custom_domains:
        canonical_host = _normalize_host(domain)
        if canonical_host:
            hosts.add(canonical_host)
    return {host for host in hosts if host}


def _build_login_url(token: str, request, customer: Customer):
    business = customer.business
    allowed_hosts = _business_allowed_hosts(business)

    origin = request.META.get('HTTP_ORIGIN')
    referer = request.META.get('HTTP_REFERER')
    origin_host, origin_netloc = _parse_host_parts(origin)
    referer_host, referer_netloc = _parse_host_parts(referer)

    if origin_host and (not allowed_hosts or origin_host in allowed_hosts):
        scheme = _preferred_scheme_for_host(origin_netloc)
        return f'{scheme}://{origin_netloc}/helpcenter/magic-login?token={token}'

    if referer_host and (not allowed_hosts or referer_host in allowed_hosts):
        scheme = _preferred_scheme_for_host(referer_netloc)
        return f'{scheme}://{referer_netloc}/helpcenter/magic-login?token={token}'

    if business and business.domain:
        base_domain = (DOMAIN_NAME or '').strip().lower().rstrip('.')
        if base_domain:
            host = f'{business.domain}.{base_domain}'
            scheme = _preferred_scheme_for_host(host)
            return f'{scheme}://{host}/helpcenter/magic-login?token={token}'

    fallback_host = (DOMAIN_NAME or '').strip().lower().rstrip('.')
    scheme = _preferred_scheme_for_host(fallback_host)
    return f'{scheme}://{fallback_host}/helpcenter/magic-login?token={token}'


class CustomerLoginView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(request_body=CustomerMagicLinkRequestSerializer)
    def post(self, request):
        serializer = CustomerMagicLinkRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(_generic_success_message(), status=status.HTTP_200_OK)

        email = serializer.validated_data['email'].strip().lower()
        business_id = serializer.validated_data.get('business_id')
        ip_address = _get_client_ip(request)

        if not _increment_rate_limit('email', email, ip_address):
            return Response(
                {'message': 'Too many login attempts. Please try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if not _increment_rate_limit('ip', ip_address, email):
            return Response(
                {'message': 'Too many login attempts. Please try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        customer = Customer.objects.filter(email__iexact=email).first()
        business = None
        if business_id:
            business = Business.objects.filter(id=business_id, is_active=True).first()

        with transaction.atomic():
            if customer is None and business is not None:
                customer = Customer.objects.create(
                    email=email,
                    username=email,
                    first_name='',
                    last_name='',
                    business=business,
                    category='CUSTOMER',
                    allow_login=True,
                    is_active=True,
                )
                customer.set_unusable_password()
                customer.save(update_fields=['password'])
            elif customer is not None:
                updates = []
                if business and not customer.business_id:
                    customer.business = business
                    updates.append('business')
                if not customer.allow_login:
                    customer.allow_login = True
                    updates.append('allow_login')
                if not customer.is_active:
                    customer.is_active = True
                    updates.append('is_active')
                if updates:
                    customer.save(update_fields=updates)

            if customer and customer.allow_login and customer.is_active:
                magic_token, token_record = CustomerMagicLinkToken.issue_for_customer(
                    customer,
                    request=request,
                    expires_minutes=LOGIN_LINK_EXPIRY_MINUTES,
                )
                login_url = _build_login_url(magic_token, request, customer)
                sent = Mailer().send_customer_magic_link(
                    login_url,
                    customer.email,
                    business=customer.business,
                    customer_name=(customer.full_name().strip() if hasattr(customer, 'full_name') and callable(customer.full_name) else customer.email) or customer.email,
                    expires_minutes=LOGIN_LINK_EXPIRY_MINUTES,
                )
                if not sent:
                    logger.warning(
                        'Customer magic link email send failed for %s; token id=%s was still issued',
                        customer.email,
                        token_record.id,
                    )
                else:
                    log_audit_event(
                        request,
                        event_type="INVITE_SENT",
                        entity_type="user",
                        entity=customer,
                        activity=f"Magic login link sent to {customer.email}",
                        metadata={"method": "magic_link", "target_customer_id": customer.id, "target_email": customer.email},
                        business=customer.business,
                    )
            else:
                logger.info('Customer login requested for %s but no eligible customer record was available', email)

        return Response(_generic_success_message(), status=status.HTTP_200_OK)


class CustomerMagicLoginVerifyView(APIView):
    permission_classes = [AllowAny]

    @swagger_auto_schema(manual_parameters=[])
    def get(self, request):
        serializer = CustomerMagicLinkVerifySerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response({'message': 'Invalid or missing login token.'}, status=status.HTTP_400_BAD_REQUEST)

        raw_token = serializer.validated_data['token']
        token, error = CustomerMagicLinkToken.consume_token(raw_token)
        if error:
            if error == 'expired':
                message = 'This login link has expired. Please request a new one.'
            elif error == 'used':
                message = 'This login link has already been used. Please request a new one.'
            else:
                message = 'Invalid login link. Please request a new one.'
            return Response({'message': message}, status=status.HTTP_400_BAD_REQUEST)

        customer = token.customer
        if not customer or not customer.allow_login or not customer.is_active:
            return Response(
                {'message': 'Your account is not allowed to log in. Please contact support.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        request.session['customer_id'] = customer.id
        request.session['customer_email'] = customer.email
        request.session['customer_business_id'] = customer.business_id
        request.session['customer_login_via'] = 'magic_link'
        request.session.save()

        refresh = RefreshToken()
        refresh['user_type'] = 'customer'
        refresh['user_id'] = customer.id
        refresh['customer_id'] = customer.id
        refresh['email'] = customer.email
        refresh['first_name'] = customer.first_name or ''
        refresh['last_name'] = customer.last_name or ''
        refresh['first_login'] = getattr(customer, 'first_login', False)
        refresh['phone_number'] = getattr(customer, 'phone_number', '') or ''
        refresh['status'] = getattr(customer, 'status', 'A')
        refresh['is_active'] = customer.is_active
        refresh['is_staff'] = False
        refresh['is_superuser'] = False
        refresh['category'] = customer.category
        refresh['role'] = 'Customer'
        refresh['permissions'] = []

        business = customer.business
        if business:
            business_host = f'{business.domain}.{DOMAIN_NAME}' if business.domain else f'{DOMAIN_NAME}'
            business_scheme = _preferred_scheme_for_host(business_host)
            refresh['business'] = {
                'id': business.id,
                'name': business.name,
                'email': business.email,
                'phone': business.phone,
                'logo_url': business.logo_url,
                'favicon_url': business.favicon_url,
                'auth_backdrop_url': business.auth_backdrop_url,
                'timezone': business.timezone,
                'support_url': business.support_url,
                'domain_url': f'{business_scheme}://{business_host}',
                'owner_id': business.owner_id,
                'allow_idle_logout': business.allow_idle_logout,
                'idle_seconds': business.idle_seconds,
            }

        access = refresh.access_token
        log_audit_event(
            request,
            event_type="USER_LOGIN",
            entity_type="user",
            entity=customer,
            activity=f"{actor_name(customer)} logged in",
            metadata={"method": "magic_link"},
            actor_user=customer,
            business=customer.business,
        )
        return Response(
            {
                'access': str(access),
                'refresh': str(refresh),
                'mfa_required': False,
                'user_type': 'customer',
                'customer': {
                    'id': customer.id,
                    'email': customer.email,
                    'first_name': customer.first_name,
                    'last_name': customer.last_name,
                },
                'redirect_to': '/helpcenter/dashboard',
            },
            status=status.HTTP_200_OK,
        )
