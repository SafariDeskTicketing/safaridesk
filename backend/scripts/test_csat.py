#!/usr/bin/env python3
import os
import sys
import uuid

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'RNSafarideskBack.settings')
import django
django.setup()

from users.models import Business
from tenant.models.TicketModel import Ticket
from shared.workers.Ticket import ticket_customer_csat_notification
from tenant.models.SettingModel import CsatSurveyDispatch

b = Business.objects.first()
if not b:
    print('No Business found in DB — cannot run CSAT test')
    sys.exit(2)

# Create a minimal ticket (avoid collisions)
track = f'TEST-CSAT-{uuid.uuid4().hex[:8]}'
try:
    ticket = Ticket.objects.create(
        business=b,
        ticket_id=track,
        title='CSAT test',
        description='CSAT test',
        creator_email='csat_test_customer@example.com',
        status='resolved',
        source='web',
        priority='low',
    )
except Exception as e:
    print('Failed to create ticket:', e)
    sys.exit(2)

print('Created ticket', ticket.ticket_id, 'id=', ticket.id)

# Run CSAT notification synchronously via task.run
try:
    ticket_customer_csat_notification.run(ticket.id, 'resolved')
except Exception as e:
    print('CSAT task raised:', e)
    sys.exit(2)

dispatches = CsatSurveyDispatch.objects.filter(ticket=ticket)
print('CsatSurveyDispatch count:', dispatches.count())
for d in dispatches:
    print('->', d.id, d.token, d.survey_url, d.sent_at)

sys.exit(0 if dispatches.count() > 0 else 1
)
