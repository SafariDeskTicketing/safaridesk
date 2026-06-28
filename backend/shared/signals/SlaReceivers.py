
# Signal to create SLA tracker when ticket is created
from django.dispatch import receiver

from tenant.models.SlaModel import SLAPolicy, SLATracker
from tenant.models.TicketModel import Ticket
from util.SlaUtil import SLACalculator
from django.db.models.signals import post_save



# @receiver(post_save, sender=Ticket)
# def create_sla_tracker(sender, instance, created, **kwargs):
#     """
#     Create SLA tracker when a new ticket is created
#     """
#     if created:

#         print(f"Creating SLA tracker for Ticket #{instance.ticket_id}...")
        
#         # # # Get applicable SLA policy
#         # # sla_policy = instance.get_applicable_sla_policy()
#         # sla_policy = SLAPolicy.objects.filter(
#         #         priority=instance.priority,
#         #         customer_tier=instance.customer_tier,
#         #         # category=self.category,
#         #         is_active=True
#         #     ).first()


#         # print(f"Creating SLA tracker for Ticket #{instance.ticket_id} with policy: {sla_policy}")
        
#         # if sla_policy:
#         #     calculator = SLACalculator()
            
#         #     # Calculate due dates
#         #     first_response_due = calculator.calculate_due_date(
#         #         instance.created_at,
#         #         sla_policy.first_response_time,
#         #         sla_policy.business_hours_only
#         #     )
            
#         #     resolution_due = calculator.calculate_due_date(
#         #         instance.created_at,
#         #         sla_policy.resolution_time,
#         #         sla_policy.business_hours_only
#         #     )
            
#         #     # Create SLA tracker
#         #     SLATracker.objects.create(
#         #         ticket=instance,
#         #         sla_policy=sla_policy,
#         #         first_response_due=first_response_due,
#         #         resolution_due=resolution_due
#         #     )



# Signal to handle status changes
@receiver(post_save, sender=Ticket)
def handle_ticket_status_change(sender, instance, created, **kwargs):
    """
    Handle SLA updates when ticket status changes
    """
    if not created and hasattr(instance, 'sla_tracker'):
        # Auto-pause SLA when ticket is on hold
        if instance.status == 'hold':
            if not instance.sla_tracker.is_paused:
                instance.pause_sla("Ticket on hold")
        
        # Resume SLA when ticket comes off hold
        elif instance.sla_tracker.is_paused and instance.status != 'hold':
            instance.resume_sla()
        
        # Mark as resolved if status changed to resolved/closed
        if instance.status in ['resolved', 'closed'] and not instance.resolved_at:
            instance.mark_resolved()