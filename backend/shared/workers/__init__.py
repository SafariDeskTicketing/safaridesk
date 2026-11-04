"""Worker package initializer.

Import modules that register Celery tasks so workers pick them up on startup.
"""

# Ensure Sla tasks are imported and registered by Celery
from .Sla import check_sla_breaches, check_sla_for_business_task  # noqa: F401

# Beat-scheduled only, so nothing else imports these modules; without this the
# worker rejects them as unregistered when beat sends them.
from . import BusinessDeletion, Deletion  # noqa: F401,E402
