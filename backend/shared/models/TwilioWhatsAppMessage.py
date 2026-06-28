from django.db import models
from .BaseModel import BaseEntity


class TwilioWhatsAppMessage(BaseEntity):
    """Model to store WhatsApp messages sent via Twilio"""
    
    MESSAGE_STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('sending', 'Sending'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('read', 'Read'),
        ('undelivered', 'Undelivered'),
        ('failed', 'Failed'),
        ('received', 'Received'),  # For inbound messages
    ]
    
    MESSAGE_DIRECTION_CHOICES = [
        ('outbound', 'Outbound'),
        ('inbound', 'Inbound'),
    ]
    
    MESSAGE_TYPE_CHOICES = [
        ('text', 'Text'),
        ('image', 'Image'),
        ('document', 'Document'),
        ('audio', 'Audio'),
        ('video', 'Video'),
        ('location', 'Location'),
        ('template', 'Template'),
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
        max_length=30,
        help_text="Sender WhatsApp number (format: whatsapp:+1234567890)"
    )
    to_number = models.CharField(
        max_length=30,
        help_text="Recipient WhatsApp number (format: whatsapp:+1234567890)"
    )
    body = models.TextField(
        blank=True,
        default='',
        help_text="Message content"
    )
    
    # Message type and metadata
    message_type = models.CharField(
        max_length=20,
        choices=MESSAGE_TYPE_CHOICES,
        default='text'
    )
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
    
    # Media attachments
    media_url = models.URLField(
        max_length=500,
        null=True,
        blank=True,
        help_text="URL of media attachment"
    )
    media_content_type = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="MIME type of media attachment"
    )
    
    # Template messages (for business-initiated conversations)
    template_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="WhatsApp template name if using templates"
    )
    template_parameters = models.JSONField(
        null=True,
        blank=True,
        help_text="Template parameters as JSON"
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
        related_name='whatsapp_messages',
        help_text="Related ticket if applicable"
    )
    
    # Related contact (optional)
    contact = models.ForeignKey(
        'tenant.Contact',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='whatsapp_messages',
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
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the message was read"
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
    
    # Conversation tracking (WhatsApp has 24-hour session window)
    conversation_id = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        help_text="WhatsApp conversation ID"
    )
    
    class Meta:
        db_table = 'twilio_whatsapp_messages'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['twilio_sid']),
            models.Index(fields=['to_number']),
            models.Index(fields=['from_number']),
            models.Index(fields=['message_status']),
            models.Index(fields=['business', 'created_at']),
            models.Index(fields=['conversation_id']),
        ]
        
    def __str__(self):
        return f"WhatsApp {self.direction} to {self.to_number} - {self.message_status}"
