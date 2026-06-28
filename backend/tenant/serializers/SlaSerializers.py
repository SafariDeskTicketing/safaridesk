from rest_framework import serializers
from tenant.models.SlaModel import (
    SLAConfiguration, SLAPolicy, BusinessHours, Holiday, SLATracker, 
    SLAEscalation, SLAEscalationLog
)


from users.models.UserModel import Users


class SLAConfigurationSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='business.name', read_only=True)
    
    class Meta:
        model = SLAConfiguration
        fields = ['id', 'business', 'business_name', 'sla_enabled', 'created_at', 'updated_at']
        read_only_fields = ['id', 'business', 'business_name', 'created_at', 'updated_at']


class SLAPolicySerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = SLAPolicy
        fields = [
            'id', 'name', 'description', 'priority', 'customer_tier',
            'category', 'category_name', 'first_response_time', 'resolution_time',
            'business_hours_only', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'category_name']

    def validate_first_response_time(self, value):
        if value <= 0:
            raise serializers.ValidationError("First response time must be greater than 0")
        return value

    def validate_resolution_time(self, value):
        if value <= 0:
            raise serializers.ValidationError("Resolution time must be greater than 0")
        return value

    def validate(self, data):
        if data.get('first_response_time') and data.get('resolution_time'):
            if data['first_response_time'] >= data['resolution_time']:
                raise serializers.ValidationError(
                    "First response time must be less than resolution time"
                )
        return data


class BusinessHoursSerializer(serializers.ModelSerializer):
    weekday_display = serializers.CharField(source='get_weekday_display', read_only=True)
    
    class Meta:
        model = BusinessHours
        fields = [
            'id', 'name', 'weekday', 'weekday_display', 'start_time',
            'end_time', 'is_working_day', 'timezone'
        ]
        read_only_fields = ['id', 'weekday_display']

    def validate_weekday(self, value):
        if value < 0 or value > 6:
            raise serializers.ValidationError("Weekday must be between 0 (Sunday) and 6 (Saturday)")
        return value

    def validate(self, data):
        if data.get('start_time') and data.get('end_time'):
            if data['start_time'] >= data['end_time']:
                raise serializers.ValidationError(
                    "Start time must be before end time"
                )
        return data


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ['id', 'name', 'date', 'is_recurring', 'description']
        read_only_fields = ['id']

    def validate_date(self, value):
        from datetime import date
        if value < date.today():
            raise serializers.ValidationError("Holiday date cannot be in the past")
        return value


class SLATrackerSerializer(serializers.ModelSerializer):
    sla_policy = SLAPolicySerializer(read_only=True)
    sla_policy_id = serializers.UUIDField(write_only=True)
    ticket_id = serializers.UUIDField()
    
    class Meta:
        model = SLATracker
        fields = [
            'id', 'ticket_id', 'sla_policy', 'sla_policy_id',
            'first_response_due', 'first_response_completed', 'first_response_status',
            'resolution_due', 'resolution_completed', 'resolution_status',
            'total_paused_time', 'is_paused', 'paused_at', 'pause_reason',
            'effective_first_response_due', 'effective_resolution_due',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'sla_policy', 'total_paused_time', 'is_paused', 'paused_at',
            'effective_first_response_due', 'effective_resolution_due',
            'created_at', 'updated_at'
        ]

    def validate(self, data):
        if data.get('first_response_due') and data.get('resolution_due'):
            if data['first_response_due'] >= data['resolution_due']:
                raise serializers.ValidationError(
                    "First response due time must be before resolution due time"
                )
        return data


class SLATrackerUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating SLA tracker status and completion times"""
    class Meta:
        model = SLATracker
        fields = [
            'first_response_completed', 'resolution_completed',
            'first_response_status', 'resolution_status'
        ]


class SLATrackerPauseSerializer(serializers.Serializer):
    """Serializer for pausing SLA tracker"""
    reason = serializers.CharField(max_length=500, required=True)

    def validate_reason(self, value):
        if not value.strip():
            raise serializers.ValidationError("Pause reason cannot be empty")
        return value


class SLAEscalationSerializer(serializers.ModelSerializer):
    sla_policy_name = serializers.CharField(source='sla_policy.name', read_only=True)
    escalation_users = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Users.objects.all(), required=False
    )
    
    class Meta:
        model = SLAEscalation
        fields = [
            'id', 'sla_policy', 'sla_policy_name', 'escalation_type',
            'trigger_percentage', 'notify_agent', 'notify_supervisor',
            'notify_manager', 'escalation_users', 'escalation_emails',
            'email_subject', 'email_body', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'sla_policy_name', 'created_at']

    def validate_trigger_percentage(self, value):
        if value <= 0 or value > 100:
            raise serializers.ValidationError("Trigger percentage must be between 1 and 100")
        return value

    def validate_escalation_emails(self, value):
        if value:
            emails = [email.strip() for email in value.split(',')]
            for email in emails:
                if email and '@' not in email:
                    raise serializers.ValidationError(f"Invalid email format: {email}")
        return value

    def validate(self, data):
        # Ensure at least one notification method is selected
        if not any([
            data.get('notify_agent'),
            data.get('notify_supervisor'),
            data.get('notify_manager'),
            data.get('escalation_users'),
            data.get('escalation_emails')
        ]):
            raise serializers.ValidationError(
                "At least one notification method must be selected"
            )
        return data


class SLAEscalationLogSerializer(serializers.ModelSerializer):
    """Serializer for SLA escalation logs"""
    ticket_id = serializers.CharField(source='sla_tracker.ticket.id', read_only=True)
    escalation_type = serializers.CharField(source='escalation.escalation_type', read_only=True)
    
    class Meta:
        model = SLAEscalationLog
        fields = [
            'id', 'ticket_id', 'escalation_type', 'escalated_at', 'recipients'
        ]
        read_only_fields = ['id', 'ticket_id', 'escalation_type', 'escalated_at']


class SLADashboardSerializer(serializers.Serializer):
    """Serializer for SLA dashboard statistics"""
    total_trackers = serializers.IntegerField()
    within_sla = serializers.IntegerField()
    breached = serializers.IntegerField()
    at_risk = serializers.IntegerField()
    sla_compliance_percentage = serializers.FloatField()
    recent_escalations = SLAEscalationLogSerializer(many=True)
    
    # Policy-wise statistics
    policy_statistics = serializers.ListField(
        child=serializers.DictField(), required=False
    )
    
    # Time-based statistics
    daily_sla_trends = serializers.ListField(
        child=serializers.DictField(), required=False
    )


class SLAPolicyCreateSerializer(serializers.ModelSerializer):
    """Serializer specifically for creating SLA policies"""
    
    class Meta:
        model = SLAPolicy
        fields = [
            'name', 'description', 'priority', 'customer_tier',
            'first_response_time', 'resolution_time',
            'business_hours_only', 'is_active'
        ]
    
    def validate(self, attrs):
        request = self.context.get('request')
        business = request.user.business if request else None

        # Check for duplicate priority under the same business
        if SLAPolicy.objects.filter(priority=attrs['priority'], business=business).exists():
            raise serializers.ValidationError({
                'priority': f"A policy with '{attrs['priority']}' priority already exists for this business."
            })

        return attrs




class SLATrackerCreateSerializer(serializers.ModelSerializer):
    """Serializer specifically for creating SLA trackers"""
    class Meta:
        model = SLATracker
        fields = [
            'ticket_id', 'sla_policy_id', 'first_response_due',
            'resolution_due', 'first_response_status', 'resolution_status'
        ]

    def create(self, validated_data):
        # Set default statuses if not provided
        validated_data.setdefault('first_response_status', 'within_sla')
        validated_data.setdefault('resolution_status', 'within_sla')
        return super().create(validated_data)