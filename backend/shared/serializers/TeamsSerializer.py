from rest_framework import serializers
from shared.models.TeamsIntegration import TeamsIntegration


class TeamsIntegrationSerializer(serializers.ModelSerializer):
    """Serializer for Teams integration details"""
    tenant_name = serializers.CharField(read_only=True)
    team_name = serializers.CharField(read_only=True)
    team_url = serializers.URLField(read_only=True)
    user_display_name = serializers.CharField(read_only=True)
    user_email = serializers.EmailField(read_only=True)
    default_channel_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = TeamsIntegration
        fields = [
            'id',
            'tenant_id',
            'tenant_name',
            'team_id',
            'team_name',
            'team_url',
            'user_display_name',
            'user_email',
            'default_channel_id',
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
        read_only_fields = [
            'id', 'tenant_id', 'tenant_name', 'team_url',
            'user_display_name', 'user_email', 'created_at', 'updated_at'
        ]


class TeamsTeamSerializer(serializers.Serializer):
    """Serializer for Teams team listing"""
    id = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True)


class TeamsChannelSerializer(serializers.Serializer):
    """Serializer for Teams channel listing"""
    id = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    membership_type = serializers.CharField()


class TeamsTestNotificationSerializer(serializers.Serializer):
    """Serializer for test notification request"""
    team_id = serializers.CharField(required=True)
    channel_id = serializers.CharField(required=True)
    
    def validate_team_id(self, value):
        if not value:
            raise serializers.ValidationError("Team ID is required")
        return value
    
    def validate_channel_id(self, value):
        if not value:
            raise serializers.ValidationError("Channel ID is required")
        return value


class TeamsConfigurationUpdateSerializer(serializers.Serializer):
    """Serializer for updating Teams integration configuration"""
    team_id = serializers.CharField(required=False, allow_blank=True)
    team_name = serializers.CharField(required=False, allow_blank=True)
    default_channel_id = serializers.CharField(required=False, allow_blank=True)
    default_channel_name = serializers.CharField(required=False, allow_blank=True)
    notify_new_tickets = serializers.BooleanField(required=False)
    notify_assignments = serializers.BooleanField(required=False)
    notify_status_updates = serializers.BooleanField(required=False)
    notify_sla_breaches = serializers.BooleanField(required=False)
    notify_comments = serializers.BooleanField(required=False)
