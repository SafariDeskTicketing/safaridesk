from django.apps import AppConfig
import logging


class TenantConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tenant'

    def ready(self):
        # Register signals (safe import; ignore errors during certain startup phases)
        try:
            from . import signals  # noqa: F401
        except Exception as e:
            logging.getLogger(__name__).debug(f"Tenant signals not loaded: {e}")
