"""Mail utilities (OAuth, forwarding helpers, etc.)."""

from .oauth import (
    GOOGLE_SCOPES,
    MICROSOFT_SCOPES,
    build_google_auth_url,
    build_microsoft_auth_url,
    exchange_google_code,
    exchange_microsoft_code,
    fetch_google_userinfo,
    fetch_microsoft_userinfo,
    refresh_google_token,
    refresh_microsoft_token,
    sign_oauth_state,
    verify_oauth_state,
)  # noqa: F401
from .validator import validate_mail_credentials  # noqa: F401
from .ingestion import MailIngestionCoordinator, MailIntegrationIngestionService  # noqa: F401
