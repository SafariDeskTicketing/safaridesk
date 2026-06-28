import os

APP_ENV = os.getenv('APP_ENV', 'dev')

if APP_ENV == 'dev':
    from .dev import *
else:
    from .prod import *