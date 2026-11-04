"""
Current-business thread-local context.

Mirrors django_currentuser's exact pattern (same thread-local + context-manager
shape) so the two stay consistent and easy to reason about together. Used by
FilterManager (shared/models/BaseModel.py) to scope the DEFAULT manager on
every tenant-scoped model to the request's business automatically, closing the
"tenant isolation is opt-in" architecture gap: a bare `Model.objects.filter()`
can no longer return another tenant's rows just because a view forgot to call
`.for_business()`.

Two-step resolution, because this app authenticates via DRF/SimpleJWT, not
Django sessions — by the time regular Django middleware runs, `request.user`
is NOT yet the JWT-resolved user (DRF only resolves it later, inside the
view's own dispatch, via CustomerJWTAuthentication). So:

  1. CurrentBusinessMiddleware (this file) sets a *baseline* business from
     `request.tenant` (resolved by CustomDomainMiddleware from the Host
     header) for the whole request, and guarantees cleanup after the view
     returns via the context manager.
  2. CustomerJWTAuthentication.get_user() (shared/authentication.py), the
     single chokepoint where DRF actually resolves the authenticated
     user/customer, OVERRIDES that baseline with the resolved account's real
     `.business` the moment auth succeeds — the authoritative source for any
     authenticated request.

Net effect:
  - Authenticated tenant staff/customer requests -> scoped to their real business.
  - Platform superadmin requests (SafariAdmin console) -> `user.business` is
    None by design for these accounts, so get_user() never overrides the
    baseline away from whatever the host resolved (usually also None for the
    admin console's own domain) -> stays unscoped, matching the console's
    existing explicit per-call `business=` filters, no special-casing needed.
  - Unauthenticated public requests -> scoped from the host-resolved tenant.
  - Management commands, Celery tasks, migrations (no request ever ran) ->
    stays unset, queries remain unscoped by default, matching existing
    behavior for legitimate cross-tenant background jobs.
"""
from threading import local

_thread_locals = local()
BUSINESS_ATTR_NAME = '_current_business'


def _set_current_business(business=None):
    """Sets the current business in the local thread. Usable as a hook for
    shell jobs/management commands that need scoping without a request, and
    called by CustomerJWTAuthentication.get_user() once a user is resolved."""
    setattr(_thread_locals, BUSINESS_ATTR_NAME, lambda: business)


class SetCurrentBusiness:
    def __init__(self, business):
        self.business = business

    def __enter__(self):
        _set_current_business(self.business)

    def __exit__(self, exc_type, exc_value, traceback):
        _set_current_business(None)


class CurrentBusinessMiddleware:
    """Sets the baseline business (from the host-resolved tenant) for the
    duration of the request. Must run after CustomDomainMiddleware (needs
    `request.tenant`)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        with SetCurrentBusiness(getattr(request, 'tenant', None)):
            return self.get_response(request)


def get_current_business():
    current = getattr(_thread_locals, BUSINESS_ATTR_NAME, None)
    if callable(current):
        return current()
    return current
