# import os
#
# from util.ip import get_windows_ip
#
# from .base import *
#
# import dotenv
# dotenv.load_dotenv()
#
# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.mysql',
#         'NAME': os.getenv('DB_NAME', 'test'),
#         'USER': os.getenv('DB_USER', 'root'),
#         'PASSWORD': os.getenv('DB_PASSWORD', ''),
#         'HOST': os.getenv('DB_HOST', '127.0.0.1'),
#         'PORT': os.getenv('DB_PORT', '3306'),
#         'OPTIONS': {
#             'charset': 'utf8mb4',
#             'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
#         },
#     }
# }
#
# FILE_BASE_URL = os.getenv('FILE_BASE_URL', "http://localhost:8000")
# FRONTEND_URL = os.getenv('FRONTEND_URL', "http://localhost:3600/tickets/")
# FILE_URL = os.getenv('FILE_URL', "http://localhost:8000/uploads/files")
# AVATARS_URL = os.getenv('AVATARS_URL', "http://localhost:8000/uploads/avatars")
# TASK_FILE_URL = os.getenv('TASK_FILE_URL', "http://localhost:8000/uploads/task-files")
# KB_IMAGE_URL = os.getenv('KB_IMAGE_URL', "http://localhost:8000/uploads/kb/images")
#
# FRONTEND_URL_BASE = "http://localhost:3600"
# DOMAIN_NAME = "localhost:3600"
#
#
#
# MEDIA_URL = 'media/'
# MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
#
#
# CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
# CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
# CELERY_ACCEPT_CONTENT = ['json']
# CELERY_TASK_SERIALIZER = 'json'
# CELERY_RESULT_SERIALIZER = 'json'
# CELERY_TIMEZONE = TIME_ZONE
# CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
#
#


import os
from decouple import config
from .base import *

DEBUG = config("DEBUG", default=True, cast=bool)



# Database
DATABASES = {
    'default': {
        'ENGINE': config('DB_ENGINE', default='django.db.backends.postgresql'),
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST', default='db'),
        'PORT': config('DB_PORT', default='5432'),
        'OPTIONS': {},
    }
}

# URLs
FILE_BASE_URL = config('FILE_BASE_URL')
FRONTEND_URL = config('FRONTEND_URL')
FILE_URL = config('FILE_URL')
AVATARS_URL = config('AVATARS_URL')
TASK_FILE_URL = config('TASK_FILE_URL')
KB_IMAGE_URL = config('KB_IMAGE_URL')

FRONTEND_URL_BASE = config('FRONTEND_URL_BASE')
API_BASE_URL = config('API_BASE_URL', default='http://localhost:8100')
DOMAIN_NAME = config('DOMAIN_NAME')

# Media
MEDIA_URL = config('MEDIA_URL')
MEDIA_ROOT = config('MEDIA_ROOT')

# Celery
CELERY_BROKER_URL = config('CELERY_BROKER_URL')
CELERY_RESULT_BACKEND = config('CELERY_RESULT_BACKEND')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True



HOST_IP = config("REDIS_HOST", default="redis")
REDIS_PORT = config("REDIS_PORT", default=6379, cast=int)
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

# Stripe Configuration
STRIPE_SECRET_KEY = config('STRIPE_SECRET_KEY', default='')
STRIPE_PUBLISHABLE_KEY = config('STRIPE_PUBLISHABLE_KEY', default='')
STRIPE_RETURN_URL = config('STRIPE_RETURN_URL', default='')

