from django.apps import AppConfig


class SharedConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'shared'


    def ready(self):
        import shared.signals.notifications
        import shared.signals.ticketSignal
        import shared.signals.RequestReceiver
        import shared.signals.TaskSignal
        import shared.signals.BusinessSignal
