from rest_framework import serializers
from shared.models.TwilioWhatsAppMessage import TwilioWhatsAppMessage


class TwilioWhatsAppMessageSerializer(serializers.ModelSerializer):
    """Serializer for TwilioWhatsAppMessage model"""
    
    class Meta:
        model = TwilioWhatsAppMessage
        fields = [
            'id',
            'twilio_sid',
            'from_number',
            'to_number',
            'body',
            'message_type',
            'direction',
            'message_status',
            'media_url',
            'media_content_type',
            'template_name',
            'template_parameters',
            'price',
            'price_unit',
            'error_code',
            'error_message',
            'ticket',
            'contact',
            'sent_at',
            'delivered_at',
            'read_at',
            'callback_received',
            'last_callback_at',
            'conversation_id',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'twilio_sid', 'direction', 'message_status',
            'price', 'price_unit', 'error_code', 'error_message',
            'sent_at', 'delivered_at', 'read_at', 'callback_received',
            'last_callback_at', 'conversation_id', 'created_at', 'updated_at',
        ]


class SendWhatsAppMessageSerializer(serializers.Serializer):
    """Serializer for sending a WhatsApp message"""
    to = serializers.CharField(
        required=True,
        help_text="Recipient WhatsApp number (E.164 format, e.g., +1234567890)"
    )
    body = serializers.CharField(
        required=True,
        max_length=4096,  # WhatsApp allows longer messages than SMS
        help_text="Message content (max 4096 characters)"
    )
    from_number = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Sender WhatsApp number (optional, defaults to configured number)"
    )
    media_url = serializers.URLField(
        required=False,
        allow_blank=True,
        help_text="URL of media to attach (image, document, audio, video)"
    )
    ticket_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Related ticket ID (optional)"
    )
    contact_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Related contact ID (optional)"
    )
    
    def validate_to(self, value):
        # Basic phone number validation
        cleaned = ''.join(filter(str.isdigit, value.replace('+', '').replace('whatsapp:', '')))
        if len(cleaned) < 10:
            raise serializers.ValidationError(
                "Phone number must have at least 10 digits"
            )
        return value.strip()
    
    def validate_body(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Message body cannot be empty")
        return value.strip()


class SendWhatsAppMediaSerializer(serializers.Serializer):
    """Serializer for sending a WhatsApp media message"""
    to = serializers.CharField(
        required=True,
        help_text="Recipient WhatsApp number"
    )
    media_url = serializers.URLField(
        required=True,
        help_text="Public URL of the media file (image, document, audio, video)"
    )
    caption = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=1024,
        help_text="Caption for the media (optional)"
    )
    from_number = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Sender WhatsApp number (optional)"
    )
    ticket_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Related ticket ID (optional)"
    )
    contact_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Related contact ID (optional)"
    )
    
    def validate_to(self, value):
        cleaned = ''.join(filter(str.isdigit, value.replace('+', '').replace('whatsapp:', '')))
        if len(cleaned) < 10:
            raise serializers.ValidationError(
                "Phone number must have at least 10 digits"
            )
        return value.strip()


class SendWhatsAppTemplateSerializer(serializers.Serializer):
    """Serializer for sending a WhatsApp template message"""
    to = serializers.CharField(
        required=True,
        help_text="Recipient WhatsApp number"
    )
    template_sid = serializers.CharField(
        required=True,
        help_text="Content SID of the approved WhatsApp template"
    )
    template_variables = serializers.DictField(
        required=False,
        child=serializers.CharField(),
        help_text="Variables to fill in the template (e.g., {'1': 'value1', '2': 'value2'})"
    )
    from_number = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Sender WhatsApp number (optional)"
    )
    ticket_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Related ticket ID (optional)"
    )
    contact_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Related contact ID (optional)"
    )
    
    def validate_to(self, value):
        cleaned = ''.join(filter(str.isdigit, value.replace('+', '').replace('whatsapp:', '')))
        if len(cleaned) < 10:
            raise serializers.ValidationError(
                "Phone number must have at least 10 digits"
            )
        return value.strip()


class BulkSendWhatsAppSerializer(serializers.Serializer):
    """Serializer for sending bulk WhatsApp messages"""
    recipients = serializers.ListField(
        child=serializers.CharField(),
        min_length=1,
        max_length=100,
        help_text="List of recipient WhatsApp numbers (max 100)"
    )
    body = serializers.CharField(
        required=True,
        max_length=4096,
        help_text="Message content"
    )
    from_number = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Sender WhatsApp number (optional)"
    )
    media_url = serializers.URLField(
        required=False,
        allow_blank=True,
        help_text="Media URL to attach to all messages"
    )
    
    def validate_recipients(self, value):
        cleaned_recipients = []
        for phone in value:
            cleaned = ''.join(filter(str.isdigit, phone.replace('+', '').replace('whatsapp:', '')))
            if len(cleaned) < 10:
                raise serializers.ValidationError(
                    f"Invalid phone number: {phone}"
                )
            cleaned_recipients.append(phone.strip())
        return cleaned_recipients


class WhatsAppStatusCallbackSerializer(serializers.Serializer):
    """Serializer for Twilio WhatsApp status callback webhook"""
    MessageSid = serializers.CharField(required=True)
    MessageStatus = serializers.CharField(required=True)
    To = serializers.CharField(required=False, allow_blank=True)
    From = serializers.CharField(required=False, allow_blank=True)
    Body = serializers.CharField(required=False, allow_blank=True)
    ErrorCode = serializers.CharField(required=False, allow_blank=True)
    ErrorMessage = serializers.CharField(required=False, allow_blank=True)
    AccountSid = serializers.CharField(required=False, allow_blank=True)
    ApiVersion = serializers.CharField(required=False, allow_blank=True)
    SmsStatus = serializers.CharField(required=False, allow_blank=True)
    SmsSid = serializers.CharField(required=False, allow_blank=True)
    ChannelPrefix = serializers.CharField(required=False, allow_blank=True)


class WhatsAppInboundMessageSerializer(serializers.Serializer):
    """Serializer for Twilio inbound WhatsApp webhook"""
    MessageSid = serializers.CharField(required=True)
    AccountSid = serializers.CharField(required=True)
    From = serializers.CharField(required=True)
    To = serializers.CharField(required=True)
    Body = serializers.CharField(required=False, allow_blank=True, default='')
    NumMedia = serializers.CharField(required=False, default='0')
    ProfileName = serializers.CharField(required=False, allow_blank=True)
    WaId = serializers.CharField(required=False, allow_blank=True)
    # Media fields (can have multiple)
    MediaUrl0 = serializers.URLField(required=False, allow_blank=True)
    MediaContentType0 = serializers.CharField(required=False, allow_blank=True)
    MediaUrl1 = serializers.URLField(required=False, allow_blank=True)
    MediaContentType1 = serializers.CharField(required=False, allow_blank=True)
    MediaUrl2 = serializers.URLField(required=False, allow_blank=True)
    MediaContentType2 = serializers.CharField(required=False, allow_blank=True)


class WhatsAppConfigStatusSerializer(serializers.Serializer):
    """Serializer for WhatsApp configuration status response"""
    is_configured = serializers.BooleanField()
    whatsapp_number = serializers.CharField(allow_blank=True)
    account_status = serializers.CharField(allow_blank=True, allow_null=True)
    account_name = serializers.CharField(allow_blank=True, allow_null=True)


class WhatsAppTestSerializer(serializers.Serializer):
    """Serializer for testing WhatsApp configuration"""
    to = serializers.CharField(
        required=True,
        help_text="Phone number to send test WhatsApp message to"
    )
    
    def validate_to(self, value):
        cleaned = ''.join(filter(str.isdigit, value.replace('+', '').replace('whatsapp:', '')))
        if len(cleaned) < 10:
            raise serializers.ValidationError(
                "Phone number must have at least 10 digits"
            )
        return value.strip()
