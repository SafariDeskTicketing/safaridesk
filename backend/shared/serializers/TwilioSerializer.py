from rest_framework import serializers
from shared.models.TwilioSMSMessage import TwilioSMSMessage


class TwilioSMSMessageSerializer(serializers.ModelSerializer):
    """Serializer for TwilioSMSMessage model"""
    
    class Meta:
        model = TwilioSMSMessage
        fields = [
            'id',
            'twilio_sid',
            'from_number',
            'to_number',
            'body',
            'direction',
            'message_status',
            'price',
            'price_unit',
            'error_code',
            'error_message',
            'ticket',
            'contact',
            'sent_at',
            'delivered_at',
            'callback_received',
            'last_callback_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'twilio_sid', 'direction', 'message_status',
            'price', 'price_unit', 'error_code', 'error_message',
            'sent_at', 'delivered_at', 'callback_received',
            'last_callback_at', 'created_at', 'updated_at',
        ]


class SendSMSSerializer(serializers.Serializer):
    """Serializer for sending a single SMS"""
    to = serializers.CharField(
        required=True,
        help_text="Recipient phone number (E.164 format recommended, e.g., +1234567890)"
    )
    body = serializers.CharField(
        required=True,
        max_length=1600,  # Twilio allows up to 1600 characters
        help_text="Message content (max 1600 characters)"
    )
    from_number = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Sender phone number (defaults to configured Twilio number)"
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
        cleaned = ''.join(filter(str.isdigit, value.replace('+', '')))
        if len(cleaned) < 10:
            raise serializers.ValidationError(
                "Phone number must have at least 10 digits"
            )
        return value.strip()
    
    def validate_body(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Message body cannot be empty")
        return value.strip()


class BulkSendSMSSerializer(serializers.Serializer):
    """Serializer for sending bulk SMS"""
    recipients = serializers.ListField(
        child=serializers.CharField(),
        min_length=1,
        max_length=100,  # Limit to 100 recipients per request
        help_text="List of recipient phone numbers"
    )
    body = serializers.CharField(
        required=True,
        max_length=1600,
        help_text="Message content"
    )
    from_number = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Sender phone number (defaults to configured Twilio number)"
    )
    
    def validate_recipients(self, value):
        cleaned_recipients = []
        for phone in value:
            cleaned = ''.join(filter(str.isdigit, phone.replace('+', '')))
            if len(cleaned) < 10:
                raise serializers.ValidationError(
                    f"Invalid phone number: {phone}"
                )
            cleaned_recipients.append(phone.strip())
        return cleaned_recipients


class TwilioStatusCallbackSerializer(serializers.Serializer):
    """Serializer for Twilio status callback webhook"""
    MessageSid = serializers.CharField(required=True)
    MessageStatus = serializers.CharField(required=True)
    To = serializers.CharField(required=False, allow_blank=True)
    From = serializers.CharField(required=False, allow_blank=True)
    Body = serializers.CharField(required=False, allow_blank=True)
    ErrorCode = serializers.CharField(required=False, allow_blank=True)
    ErrorMessage = serializers.CharField(required=False, allow_blank=True)
    AccountSid = serializers.CharField(required=False, allow_blank=True)
    ApiVersion = serializers.CharField(required=False, allow_blank=True)
    NumSegments = serializers.CharField(required=False, allow_blank=True)
    RawDlrDoneDate = serializers.CharField(required=False, allow_blank=True)
    SmsStatus = serializers.CharField(required=False, allow_blank=True)
    SmsSid = serializers.CharField(required=False, allow_blank=True)


class TwilioInboundSMSSerializer(serializers.Serializer):
    """Serializer for Twilio inbound SMS webhook"""
    MessageSid = serializers.CharField(required=True)
    AccountSid = serializers.CharField(required=True)
    From = serializers.CharField(required=True)
    To = serializers.CharField(required=True)
    Body = serializers.CharField(required=False, allow_blank=True, default='')
    NumMedia = serializers.CharField(required=False, default='0')
    FromCity = serializers.CharField(required=False, allow_blank=True)
    FromState = serializers.CharField(required=False, allow_blank=True)
    FromZip = serializers.CharField(required=False, allow_blank=True)
    FromCountry = serializers.CharField(required=False, allow_blank=True)
    ToCity = serializers.CharField(required=False, allow_blank=True)
    ToState = serializers.CharField(required=False, allow_blank=True)
    ToZip = serializers.CharField(required=False, allow_blank=True)
    ToCountry = serializers.CharField(required=False, allow_blank=True)


class TwilioConfigStatusSerializer(serializers.Serializer):
    """Serializer for Twilio configuration status response"""
    is_configured = serializers.BooleanField()
    phone_number = serializers.CharField(allow_blank=True)
    account_status = serializers.CharField(allow_blank=True, allow_null=True)
    account_name = serializers.CharField(allow_blank=True, allow_null=True)


class PhoneLookupSerializer(serializers.Serializer):
    """Serializer for phone number lookup"""
    phone = serializers.CharField(
        required=True,
        help_text="Phone number to lookup"
    )


class PhoneLookupResponseSerializer(serializers.Serializer):
    """Serializer for phone number lookup response"""
    phone_number = serializers.CharField()
    country_code = serializers.CharField()
    national_format = serializers.CharField()
    valid = serializers.BooleanField()
    validation_errors = serializers.ListField(
        child=serializers.CharField(),
        required=False
    )
