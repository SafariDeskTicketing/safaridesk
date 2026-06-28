from django.db import migrations


def convert_old_statuses(apps, schema_editor):
    """
    Convert old ticket statuses to new ones:
    - created -> open
    - assigned -> in_progress
    - hold -> on_hold
    """
    Ticket = apps.get_model('tenant', 'Ticket')
    
    # created -> open
    Ticket.objects.filter(status='created').update(status='open')
    
    # assigned -> in_progress
    Ticket.objects.filter(status='assigned').update(status='in_progress')
    
    # hold -> on_hold
    Ticket.objects.filter(status='hold').update(status='on_hold')


def reverse_statuses(apps, schema_editor):
    """Reverse migration - convert back to old statuses"""
    Ticket = apps.get_model('tenant', 'Ticket')
    
    # open -> created
    Ticket.objects.filter(status='open').update(status='created')
    
    # pending -> created (no direct equivalent)
    Ticket.objects.filter(status='pending').update(status='created')
    
    # on_hold -> hold
    Ticket.objects.filter(status='on_hold').update(status='hold')
    
    # resolved -> closed (no direct equivalent)
    Ticket.objects.filter(status='resolved').update(status='closed')


class Migration(migrations.Migration):

    dependencies = [
        ('tenant', '0024_add_email_recipient_fields_to_ticketcomment'),
    ]

    operations = [
        migrations.RunPython(convert_old_statuses, reverse_statuses),
    ]
