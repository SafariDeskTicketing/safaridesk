from rest_framework import serializers
from shared.models.SlackIntegration import SlackIntegration


class SlackIntegrationSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(read_only=True)
    workspace_url = serializers.URLField(read_only=True)
    default_channel_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = SlackIntegration
        fields = [
            'id', 
            'team_id', 
            'team_name', 
            'workspace_url',
            'default_channel',
            'default_channel_name',
            'notify_new_tickets',
            'notify_assignments', 
            'notify_status_updates',
            'notify_sla_breaches',
            'notify_comments',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'team_id', 'team_name', 'workspace_url', 'created_at', 'updated_at']


class SlackChannelSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    is_private = serializers.BooleanField()
    is_member = serializers.BooleanField()


class SlackTestNotificationSerializer(serializers.Serializer):
    channel_id = serializers.CharField(required=True)
    
    def validate_channel_id(self, value):
        if not value:
            raise serializers.ValidationError("Channel ID is required")
        return value


class SlackConfigurationUpdateSerializer(serializers.Serializer):
    default_channel = serializers.CharField(required=False, allow_blank=True)
    default_channel_name = serializers.CharField(required=False, allow_blank=True)
    notify_new_tickets = serializers.BooleanField(required=False)
    notify_assignments = serializers.BooleanField(required=False)
    notify_status_updates = serializers.BooleanField(required=False)
    notify_sla_breaches = serializers.BooleanField(required=False)
    notify_comments = serializers.BooleanField(required=False)