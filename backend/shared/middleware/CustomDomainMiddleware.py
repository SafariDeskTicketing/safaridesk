"""
Custom Domain Middleware
Routes incoming requests to the correct business based on custom domain
"""
import logging
from django.core.cache import cache
from django.utils.deprecation import MiddlewareMixin
from users.models import CustomDomains, Business

logger = logging.getLogger(__name__)


class CustomDomainMiddleware(MiddlewareMixin):
    """
    Middleware to identify business from custom domain and attach to request
    Caches domain lookups for performance
    """

    CACHE_TIMEOUT = 300  # 5 minutes
    CACHE_PREFIX = 'custom_domain:'

    def process_request(self, request):
        """
        Process incoming request and identify business from custom domain
        """
        host = request.get_host().split(':')[0]  # Remove port if present
        path = request.path_info

        # Skip for public webhook endpoints
        if path.startswith('/api/v1/integrations/slack/events/webhook/'):
            return None

        # Skip for localhost and default domains
        if self._is_excluded_host(host):
            return None

        # Check if this is a custom domain
        business = self._get_business_from_domain(host)

        if business:
            # Attach business to request for easy access in views
            request.custom_domain = host
            request.custom_domain_business = business
            logger.debug(f"Request routed to business {business.name} via custom domain {host}")
        else:
            # Not a custom domain, could be using subdomain or default routing
            request.custom_domain = None
            request.custom_domain_business = None

        return None

    def _is_excluded_host(self, host: str) -> bool:
        """
        Check if host should be excluded from custom domain routing
        """
        excluded_patterns = [
            'localhost',
            '127.0.0.1',
            'safaridesk.io',
            'api.safaridesk.io',
            'app.safaridesk.io',
            'ngrok.io',
            'ngrok-free.app',
        ]

        for pattern in excluded_patterns:
            if pattern in host.lower():
                return True

        return False

    def _get_business_from_domain(self, domain: str):
        """
        Get business associated with custom domain
        Uses caching for performance
        """
        cache_key = f"{self.CACHE_PREFIX}{domain}"

        # Try to get from cache first
        cached_business_id = cache.get(cache_key)
        if cached_business_id:
            try:
                return Business.objects.get(id=cached_business_id)
            except Business.DoesNotExist:
                cache.delete(cache_key)

        # Query database
        try:
            custom_domain = CustomDomains.objects.select_related('business').get(
                domain=domain,
                is_verified=True,
                business__is_active=True
            )

            # Cache the result
            cache.set(cache_key, custom_domain.business.id, self.CACHE_TIMEOUT)

            return custom_domain.business

        except CustomDomains.DoesNotExist:
            # Cache negative result to avoid repeated DB queries
            cache.set(cache_key, None, 60)  # Cache for 1 minute
            return None
        except Exception as e:
            logger.error(f"Error looking up custom domain {domain}: {str(e)}")
            # Cache negative result to avoid repeated DB queries on broken migrations
            cache.set(cache_key, None, 60)
            return None

    @staticmethod
    def clear_domain_cache(domain: str):
        """
        Clear cache for a specific domain
        Call this when a domain is verified, updated, or deleted
        """
        cache_key = f"{CustomDomainMiddleware.CACHE_PREFIX}{domain}"
        cache.delete(cache_key)
        logger.info(f"Cleared cache for domain: {domain}")

    @classmethod
    def clear_domain_cache(cls, domain: str):
        """
        Clear cache for a specific domain
        Call this when domain verification status changes
        """
        cache_key = f"{cls.CACHE_PREFIX}{domain}"
        cache.delete(cache_key)
        logger.info(f"Cleared cache for domain {domain}")

