from django.db import models
from .BaseModel import BaseEntity


class TwilioSMSMessage(BaseEntity):
    """Model to store SMS messages sent via Twilio"""
    
    MESSAGE_STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('sending', 'Sending'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('undelivered', 'Undelivered'),
        ('failed', 'Failed'),
        ('received', 'Received'),  # For inbound messages
    ]
    
    MESSAGE_DIRECTION_CHOICES = [
        ('outbound', 'Outbound'),
        ('inbound', 'Inbound'),
    ]
    
    # Twilio message identifiers
    twilio_sid = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        help_text="Twilio Message SID"
    )
    
    # Message details
    from_number = models.CharField(
        max_length=64,
        help_text="Sender phone number, Sender ID, or Messaging Service SID"
    )
    to_number = models.CharField(
        max_length=20,
        help_text="Recipient phone number"
    )
    body = models.TextField(
        help_text="Message content"
    )
    
    # Message metadata
    direction = models.CharField(
        max_length=10,
        choices=MESSAGE_DIRECTION_CHOICES,
        default='outbound'
    )
    message_status = models.CharField(
        max_length=20,
        choices=MESSAGE_STATUS_CHOICES,
        default='queued'
    )
    
    # Pricing and accounting (from Twilio callbacks)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Message cost"
    )
    price_unit = models.CharField(
        max_length=10,
        default='USD',
        help_text="Currency of the price"
    )
    
    # Error handling
    error_code = models.CharField(
        max_length=10,
        null=True,
        blank=True,
        help_text="Twilio error code if failed"
    )
    error_message = models.TextField(
        null=True,
        blank=True,
        help_text="Error description if failed"
    )
    
    # Related ticket (optional)
    ticket = models.ForeignKey(
        'tenant.Ticket',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sms_messages',
        help_text="Related ticket if applicable"
    )
    
    # Related contact (optional)
    contact = models.ForeignKey(
        'tenant.Contact',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sms_messages',
        help_text="Related contact"
    )
    
    # Timestamps
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the message was sent"
    )
    delivered_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the message was delivered"
    )
    
    # Callback tracking
    callback_received = models.BooleanField(
        default=False,
        help_text="Whether a status callback was received"
    )
    last_callback_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last status callback timestamp"
    )
    
    class Meta:
        db_table = 'twilio_sms_messages'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['twilio_sid']),
            models.Index(fields=['to_number']),
            models.Index(fields=['from_number']),
            models.Index(fields=['message_status']),
            models.Index(fields=['business', 'created_at']),
        ]
        
    def __str__(self):
        return f"SMS {self.direction} to {self.to_number} - {self.message_status}"
