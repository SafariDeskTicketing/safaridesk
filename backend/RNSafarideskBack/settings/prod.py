import os
from decouple import config
from .base import *

DEBUG = config("DEBUG", default=False, cast=bool)
SECRET_KEY = config("SECRET_KEY")

DATABASES = {
    'default': {
        'ENGINE': config("DB_ENGINE", default='django.db.backends.postgresql'),
        'NAME': config("DB_NAME"),
        'USER': config("DB_USER"),
        'PASSWORD': config("DB_PASSWORD"),
        'HOST': config("DB_HOST"),
        'PORT': config("DB_PORT"),
        'OPTIONS': {},
    }
}

HOST_IP = config("REDIS_HOST")
REDIS_PORT = config("REDIS_PORT", cast=int)
REDIS_PASSWORD = config("REDIS_PASSWORD", default="")

if REDIS_PASSWORD:
    REDIS_URL = f'redis://:{REDIS_PASSWORD}@{HOST_IP}:{REDIS_PORT}'
else:
    REDIS_URL = f'redis://{HOST_IP}:{REDIS_PORT}'

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [f"{REDIS_URL}/0"] if REDIS_PASSWORD else [(HOST_IP, REDIS_PORT)],
            "capacity": 1500,
            "expiry": 10,
        },
    },
}

# Celery settings
CELERY_BROKER_URL = f'{REDIS_URL}/0'
CELERY_RESULT_BACKEND = f'{REDIS_URL}/0'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True

FILE_BASE_URL = config("FILE_BASE_URL")
FILE_URL = config("FILE_URL")
AVATARS_URL = config("AVATARS_URL")
TASK_FILE_URL = config("TASK_FILE_URL")
KB_IMAGE_URL = config("KB_IMAGE_URL")

MEDIA_URL = config("MEDIA_URL")
MEDIA_ROOT = config("MEDIA_ROOT")

FRONTEND_URL = config("FRONTEND_URL")
FRONTEND_URL_BASE = config("FRONTEND_URL_BASE")
API_BASE_URL = config("API_BASE_URL", default="https://api.safaridesk.io")
DOMAIN_NAME = config("DOMAIN_NAME")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"{REDIS_URL}/1",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "IGNORE_EXCEPTIONS": True,
        }
    }
}


# Logger
import structlog

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": structlog.stdlib.ProcessorFormatter,
            "processors": [
                structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
                structlog.processors.JSONRenderer(),
            ],
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        "tenant": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "shared": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "util": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        # AI subsystems stay verbose
        "tenant.services.ai": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
        "tenant.consumers.ChatConsumer": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)
