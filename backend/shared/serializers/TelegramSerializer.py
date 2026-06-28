from rest_framework import serializers
from shared.models.TelegramIntegration import TelegramIntegration, TelegramChat


class TelegramIntegrationSerializer(serializers.ModelSerializer):
    """Serializer for TelegramIntegration model"""
    bot_username = serializers.CharField(read_only=True)
    webhook_url = serializers.SerializerMethodField()
    send_resolution_updates = serializers.BooleanField(source='notify_on_resolved', read_only=True)
    
    class Meta:
        model = TelegramIntegration
        fields = [
            'id',
            'bot_username',
            'bot_id',
            'webhook_configured',
            'webhook_url',
            'auto_create_tickets',
            'default_priority',
            'welcome_message',
            'ticket_created_message',
            'ticket_resolved_message',
            'confirm_ticket_creation',
            'send_resolution_updates',
            'send_agent_replies',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = [
            'id', 'bot_username', 'bot_id', 
            'webhook_configured', 'webhook_url',
            'created_at', 'updated_at'
        ]
    
    def get_webhook_url(self, obj):
        return obj.get_webhook_url()
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Convert priority to lowercase for frontend
        priority_mapping = {
            'Low': 'low',
            'Normal': 'medium',
            'High': 'high',
            'Urgent': 'urgent',
        }
        if data.get('default_priority') in priority_mapping:
            data['default_priority'] = priority_mapping[data['default_priority']]
        return data


class TelegramConnectSerializer(serializers.Serializer):
    """Serializer for connecting Telegram bot"""
    bot_token = serializers.CharField(
        required=True,
        help_text="Bot token from @BotFather"
    )
    
    def validate_bot_token(self, value):
        if not value or ':' not in value:
            raise serializers.ValidationError(
                "Invalid bot token format. Token should be in format: 123456789:ABCdefGhIJKlmNOPQRsTUVwxyZ"
            )
        return value.strip()


class TelegramConfigurationUpdateSerializer(serializers.Serializer):
    """Serializer for updating Telegram integration settings"""
    auto_create_tickets = serializers.BooleanField(required=False)
    default_priority = serializers.ChoiceField(
        required=False,
        choices=['low', 'medium', 'high', 'urgent']
    )
    welcome_message = serializers.CharField(required=False, allow_blank=True)
    ticket_created_message = serializers.CharField(required=False, allow_blank=True)
    ticket_resolved_message = serializers.CharField(required=False, allow_blank=True)
    confirm_ticket_creation = serializers.BooleanField(required=False)
    send_resolution_updates = serializers.BooleanField(required=False)
    send_agent_replies = serializers.BooleanField(required=False)
    is_active = serializers.BooleanField(required=False)


class TelegramTestConnectionSerializer(serializers.Serializer):
    """Serializer for testing Telegram connection"""
    pass  # No input required, just trigger a test


class TelegramChatSerializer(serializers.ModelSerializer):
    """Serializer for TelegramChat model"""
    display_name = serializers.CharField(read_only=True)
    ticket_id = serializers.PrimaryKeyRelatedField(
        source='ticket',
        read_only=True
    )
    
    class Meta:
        model = TelegramChat
        fields = [
            'id',
            'chat_id',
            'chat_type',
            'user_id',
            'username',
            'first_name',
            'last_name',
            'display_name',
            'ticket_id',
            'is_active_conversation',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class TelegramWebhookUpdateSerializer(serializers.Serializer):
    """Serializer for incoming Telegram webhook updates"""
    update_id = serializers.IntegerField()
    message = serializers.DictField(required=False)
    edited_message = serializers.DictField(required=False)
    callback_query = serializers.DictField(required=False)
