from django.apps import AppConfig

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

    def ready(self):
        """Import signals when app is ready"""
        try:
            import users.signals.custom_domain_signals  # noqa: F401
        except ImportError:
            pass

