import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'RNSafarideskBack.settings')

app = Celery('RNSafarideskBack')
# The beat schedule lives entirely in settings.CELERY_BEAT_SCHEDULE. Don't assign
# app.conf.beat_schedule here: settings load lazily and silently replace it.
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
