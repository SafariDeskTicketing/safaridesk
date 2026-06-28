from rest_framework import serializers
from shared.models.SafariSmsConfigModel import SafariSmsConfig


class SafariSmsConfigSerializer(serializers.ModelSerializer):
    """Serializer for SafariSmsConfig model"""
    
    class Meta:
        model = SafariSmsConfig
        fields = [
            'id',
            'is_activated',
            'sms_enabled',
            'whatsapp_enabled',
            'notify_new_ticket',
            'notify_status_update',
            'notify_ticket_assigned',
            'notify_mention',
            'notify_comment_added',
            'notify_sla_breach',
            'notify_ticket_resolved',
            'template_new_ticket',
            'template_status_update',
            'template_ticket_assigned',
            'template_mention',
            'template_comment_added',
            'template_sla_breach',
            'template_ticket_resolved',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SafariSmsConfigUpdateSerializer(serializers.Serializer):
    """Serializer for updating Safari SMS configuration"""
    
    is_activated = serializers.BooleanField(required=False)
    sms_enabled = serializers.BooleanField(required=False)
    whatsapp_enabled = serializers.BooleanField(required=False)
    
    # Notification toggles
    notify_new_ticket = serializers.BooleanField(required=False)
    notify_status_update = serializers.BooleanField(required=False)
    notify_ticket_assigned = serializers.BooleanField(required=False)
    notify_mention = serializers.BooleanField(required=False)
    notify_comment_added = serializers.BooleanField(required=False)
    notify_sla_breach = serializers.BooleanField(required=False)
    notify_ticket_resolved = serializers.BooleanField(required=False)
    
    # Templates
    template_new_ticket = serializers.CharField(required=False, allow_blank=True)
    template_status_update = serializers.CharField(required=False, allow_blank=True)
    template_ticket_assigned = serializers.CharField(required=False, allow_blank=True)
    template_mention = serializers.CharField(required=False, allow_blank=True)
    template_comment_added = serializers.CharField(required=False, allow_blank=True)
    template_sla_breach = serializers.CharField(required=False, allow_blank=True)
    template_ticket_resolved = serializers.CharField(required=False, allow_blank=True)


class SafariSmsStatusSerializer(serializers.Serializer):
    """Serializer for Safari SMS status response"""
    
    is_activated = serializers.BooleanField()
    is_configured = serializers.BooleanField()
    sms_enabled = serializers.BooleanField()
    whatsapp_enabled = serializers.BooleanField()
    twilio_sms_configured = serializers.BooleanField()
    twilio_whatsapp_configured = serializers.BooleanField()


class SafariSmsActivateSerializer(serializers.Serializer):
    """Serializer for activating/deactivating Safari SMS"""
    
    is_activated = serializers.BooleanField(required=True)
