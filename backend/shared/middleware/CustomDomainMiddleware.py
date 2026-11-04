"""
Tenant Resolution Middleware

The single, authoritative mechanism for resolving which business/tenant a
request belongs to, from the request's Host header. Runs on every request
(public or authenticated) and attaches the result as `request.tenant`
(kept as `request.custom_domain_business`/`request.custom_domain` too, for
the handful of existing call sites written against those names).

Resolution order, matching standard multi-tenant SaaS practice:
  1. Verified custom domain (CustomDomains table) — exact host match.
  2. Default subdomain scheme (`<slug>.<root-domain>`) — first label under
     one of the configured root domains (the platform's real domain, plus
     "localhost" so local dev works via `<slug>.localhost` with zero DNS
     or hosts-file setup — Chromium and other modern browsers already
     resolve `*.localhost` to loopback natively).
  3. No match — `request.tenant` is None; callers must handle that case
     explicitly rather than silently querying unscoped.

This intentionally does not trust any client-supplied tenant header (e.g.
a frontend-sent "X-Client-Domain") — the real Host header on the actual
connection is the only input, consistent with standard practice (a client
can lie about a header, it cannot lie about which host it connected to).
"""
import logging
from django.conf import settings
from django.core.cache import cache
from django.utils.deprecation import MiddlewareMixin
from users.models import CustomDomains, Business

logger = logging.getLogger(__name__)

# Bare hosts that never resolve to a tenant, regardless of subdomain parsing.
RESERVED_EXACT_HOSTS = {'127.0.0.1'}

# First-label subdomains reserved for platform infrastructure, never a tenant slug.
RESERVED_SUBDOMAIN_LABELS = {'www', 'api', 'app', 'admin'}


def _root_domains():
    """Root domains under which `<slug>.<root>` is treated as a tenant subdomain."""
    forwarding_domain = getattr(settings, 'SAFARIDESK_FORWARDING_DOMAIN', 'safaridesk.io')
    return [forwarding_domain, 'localhost']


class CustomDomainMiddleware(MiddlewareMixin):
    """Attaches `request.tenant` (and `custom_domain`/`custom_domain_business`
    aliases) by resolving the business for the current request's Host header.
    Caches both positive and negative lookups for performance.
    """

    CACHE_TIMEOUT = 300  # 5 minutes
    CACHE_PREFIX = 'tenant_resolution:'

    def process_request(self, request):
        host = request.get_host().split(':')[0].strip().lower().rstrip('.')
        path = request.path_info

        # Skip for public webhook endpoints — third parties call these directly
        # and have no tenant-identifying host to resolve against.
        if path.startswith('/api/v1/integrations/slack/events/webhook/'):
            return None

        business = self._resolve_tenant(host)

        request.tenant = business
        request.custom_domain_business = business
        request.custom_domain = host if business else None

        if business:
            logger.debug(f"Request routed to business {business.name} via host {host}")

        return None

    def _resolve_tenant(self, host: str):
        if not host or host in RESERVED_EXACT_HOSTS:
            return None

        cache_key = f"{self.CACHE_PREFIX}{host}"
        cached = cache.get(cache_key, 'MISS')
        if cached != 'MISS':
            if cached is None:
                return None
            try:
                return Business.objects.get(id=cached, is_active=True)
            except Business.DoesNotExist:
                cache.delete(cache_key)

        business = self._lookup_custom_domain(host) or self._lookup_subdomain(host)
        cache.set(cache_key, business.id if business else None,
                  self.CACHE_TIMEOUT if business else 60)
        return business

    @staticmethod
    def _lookup_custom_domain(host: str):
        try:
            custom_domain = CustomDomains.objects.select_related('business').get(
                domain__iexact=host,
                is_verified=True,
                business__is_active=True,
            )
            return custom_domain.business
        except CustomDomains.DoesNotExist:
            return None
        except Exception as e:
            logger.error(f"Error looking up custom domain {host}: {str(e)}")
            return None

    @staticmethod
    def _lookup_subdomain(host: str):
        for root in _root_domains():
            if host == root:
                return None  # bare root domain — platform marketing/site, not a tenant
            suffix = f'.{root}'
            if not host.endswith(suffix):
                continue
            label = host[: -len(suffix)]
            if not label or '.' in label or label in RESERVED_SUBDOMAIN_LABELS:
                return None
            return Business.objects.filter(domain__iexact=label, is_active=True).first()
        return None

    @classmethod
    def clear_domain_cache(cls, domain: str):
        """Clear the cached resolution for a host. Call when a custom domain or
        a business's `domain` slug is verified, changed, or deleted."""
        cache_key = f"{cls.CACHE_PREFIX}{domain.strip().lower().rstrip('.')}"
        cache.delete(cache_key)
        logger.info(f"Cleared tenant-resolution cache for host: {domain}")
