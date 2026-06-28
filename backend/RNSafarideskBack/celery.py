import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'RNSafarideskBack.settings')

app = Celery('RNSafarideskBack')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    **getattr(app.conf, 'beat_schedule', {}),
    'purge-expired-deletion-requests-daily': {
        'task': 'shared.workers.Deletion.purge_expired_deletion_requests',
        'schedule': crontab(hour=2, minute=0),  # 02:00 every day
    },
    'purge-expired-business-deletion-requests-daily': {
        'task': 'shared.workers.BusinessDeletion.purge_expired_business_deletion_requests',
        'schedule': crontab(hour=2, minute=15),  # 02:15 every day
    },
    'report-inactive-business-deletion-candidates-weekly': {
        'task': 'shared.workers.BusinessDeletion.report_inactive_business_deletion_candidates',
        'schedule': crontab(day_of_week='mon', hour=0, minute=0),  # Sunday midnight into Monday
        'kwargs': {'days': 30},
    },
}

