from django.db import models
from shared.models.BaseModel import BaseEntity


class Payment(BaseEntity):
    """
    Model to store Stripe payment information
    """
    
    PAYMENT_STATUS_CHOICES = [
        ('paid', 'Paid'),
        ('unpaid', 'Unpaid'),
        ('no_payment_required', 'No Payment Required'),
        ('pending', 'Pending'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    # Stripe identifiers
    session_id = models.CharField(max_length=255, unique=True, db_index=True)
    payment_intent_id = models.CharField(max_length=255, null=True, blank=True)
    
    # Payment details
    payment_status = models.CharField(
        max_length=50, 
        choices=PAYMENT_STATUS_CHOICES,
        default='pending'
    )
    amount_total = models.IntegerField(help_text="Amount in smallest currency unit (e.g., cents)")
    currency = models.CharField(max_length=3, default='usd')
    
    # Customer information
    customer_email = models.EmailField(null=True, blank=True)
    
    # Metadata (stored as JSON)
    metadata = models.JSONField(default=dict, blank=True)
    
    # Full response from Stripe (for debugging/auditing)
    stripe_response = models.JSONField(default=dict, blank=True)
    
    # Additional tracking
    return_url_hit_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'payments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['payment_status']),
            models.Index(fields=['session_id']),
        ]
    
    def __str__(self):
        return f"Payment {self.session_id} - {self.payment_status} - ${self.amount_total/100:.2f}"
    
    @property
    def amount_in_dollars(self):
        """Return amount in dollars (or main currency unit)"""
        return self.amount_total / 100
