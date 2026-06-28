from rest_framework import serializers
from django.contrib.auth.models import Group

from tenant.models.SlaXModel import SLAConfiguration, SLACondition, SLAReminder, SLAEscalations, SLATarget, SLA, BusinessHoursx, Holidays
from users.models import Users


class SLAConfigurationSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='business.name', read_only=True)
    
    class Meta:
        model = SLAConfiguration
        fields = [
            'id', 'business', 'business_name', 'sla_enabled', 'created_at', 'updated_at',
            # Business hours fields
            'monday_enabled', 'monday_start', 'monday_end',
            'tuesday_enabled', 'tuesday_start', 'tuesday_end',
            'wednesday_enabled', 'wednesday_start', 'wednesday_end',
            'thursday_enabled', 'thursday_start', 'thursday_end',
            'friday_enabled', 'friday_start', 'friday_end',
            'saturday_enabled', 'saturday_start', 'saturday_end',
            'sunday_enabled', 'sunday_start', 'sunday_end',
            'pause_outside_hours', 'exclude_holidays'
        ]
        read_only_fields = ['id', 'business', 'business_name', 'created_at', 'updated_at']


class BusinessHoursSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessHoursx
        fields = ['id', 'name', 'day_of_week', 'start_time', 'end_time', 'is_working_day']


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holidays
        fields = ['id', 'name', 'date', 'is_recurring', 'description', 'is_active']
        read_only_fields = ['id']


class SLAConditionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SLACondition
        fields = ['id', 'condition_type', 'operator', 'value', 'is_active']
        extra_kwargs = {
            'condition_type': {'required': False, 'allow_null': True},
            'operator': {'required': False, 'allow_null': True},
            'value': {'required': False, 'allow_null': True},
        }


class SLAReminderSerializer(serializers.ModelSerializer):
    notify_groups = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        many=True,
        required=False
    )
    notify_agents = serializers.PrimaryKeyRelatedField(
        queryset=Users.objects.all(),
        many=True,
        required=False
    )

    class Meta:
        model = SLAReminder
        fields = [
            'id', 'reminder_type', 'time_before', 'time_unit',
            'notify_groups', 'notify_agents', 'is_active'
        ]


class SLAEscalationSerializer(serializers.ModelSerializer):
    escalate_to_groups = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        many=True,
        required=False
    )
    escalate_to_agents = serializers.PrimaryKeyRelatedField(
        queryset=Users.objects.all(),
        many=True,
        required=False
    )

    class Meta:
        model = SLAEscalations
        fields = [
            'id', 'escalation_type', 'level', 'trigger_time', 'trigger_unit',
            'escalate_to_groups', 'escalate_to_agents', 'is_active'
        ]


class SLATargetSerializer(serializers.ModelSerializer):
    reminders = SLAReminderSerializer(many=True, required=False)
    escalations = SLAEscalationSerializer(many=True, required=False)

    class Meta:
        model = SLATarget
        fields = [
            'id', 'priority', 'first_response_time', 'first_response_unit',
            'next_response_time', 'next_response_unit', 'resolution_time',
            'resolution_unit', 'operational_hours', 'reminder_enabled',
            'escalation_enabled', 'reminders', 'escalations'
        ]


class SLASerializer(serializers.ModelSerializer):
    conditions = SLAConditionSerializer(many=True, required=False)
    targets = SLATargetSerializer(many=True, required=False)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = SLA
        fields = [
            'id', 'name', 'description', 'operational_hours',
            'evaluation_method', 'is_active', 'auto_apply', 'created_at', 'updated_at',
            'created_by', 'conditions', 'targets'
        ]
        extra_kwargs = {
            'operational_hours': {'required': False, 'allow_null': True},
            'evaluation_method': {'required': False, 'allow_null': True},
            'description': {'required': False, 'allow_null': True, 'allow_blank': True},
        }

    def validate(self, attrs):
        targets = attrs.get('targets') or []
        priorities = []
        duplicate_priorities = []

        for target in targets:
            priority = target.get('priority')
            if not priority:
                continue
            if priority in priorities and priority not in duplicate_priorities:
                duplicate_priorities.append(priority)
            priorities.append(priority)

        if duplicate_priorities:
            raise serializers.ValidationError({
                'targets': [
                    f"Each SLA policy can only have one target per priority. Duplicate priority values: {', '.join(duplicate_priorities)}"
                ]
            })

        return attrs

    def validate_name(self, value):
        """Validate that the policy name is unique for the business"""
        business_id = self.context['request'].user.business_id
        
        # For update operations, exclude the current instance from the check
        if self.instance:
            # Check if another policy with the same name exists (excluding current one)
            if SLA.objects.filter(business_id=business_id, name__iexact=value).exclude(id=self.instance.id).exists():
                raise serializers.ValidationError("A policy with this name already exists")
        else:
            # For create operations, check if any policy with the same name exists
            if SLA.objects.filter(business_id=business_id, name__iexact=value).exists():
                raise serializers.ValidationError("A policy with this name already exists")
        
        return value

    def create(self, validated_data):
        conditions_data = validated_data.pop('conditions', [])
        targets_data = validated_data.pop('targets', [])

        # Set the created_by user from request
        validated_data['created_by'] = self.context['request'].user
        
        # Set defaults if not provided
        if 'operational_hours' not in validated_data or not validated_data['operational_hours']:
            validated_data['operational_hours'] = 'calendar'
        if 'evaluation_method' not in validated_data or not validated_data['evaluation_method']:
            validated_data['evaluation_method'] = 'ticket_creation'

        # Create SLA instance
        sla = SLA.objects.create(**validated_data)

        # Create conditions (skip if empty or invalid)
        for condition_data in conditions_data:
            if condition_data.get('condition_type') and condition_data.get('value'):
                SLACondition.objects.create(sla=sla, **condition_data)

        # Create targets with reminders and escalations
        for target_data in targets_data:
            reminders_data = target_data.pop('reminders', [])
            escalations_data = target_data.pop('escalations', [])

            target = SLATarget.objects.create(sla=sla, **target_data)

            # Create reminders for this target
            for reminder_data in reminders_data:
                notify_groups = reminder_data.pop('notify_groups', [])
                notify_agents = reminder_data.pop('notify_agents', [])

                reminder = SLAReminder.objects.create(sla_target=target, **reminder_data)
                reminder.notify_groups.set(notify_groups)
                reminder.notify_agents.set(notify_agents)

            # Create escalations for this target
            for escalation_data in escalations_data:
                escalate_to_groups = escalation_data.pop('escalate_to_groups', [])
                escalate_to_agents = escalation_data.pop('escalate_to_agents', [])

                escalation = SLAEscalations.objects.create(sla_target=target, **escalation_data)
                escalation.escalate_to_groups.set(escalate_to_groups)
                escalation.escalate_to_agents.set(escalate_to_agents)

        return sla

    def update(self, instance, validated_data):
        conditions_data = validated_data.pop('conditions', [])
        targets_data = validated_data.pop('targets', [])

        # Update SLA fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update conditions (simple approach: delete and recreate)
        instance.conditions.all().delete()
        for condition_data in conditions_data:
            SLACondition.objects.create(sla=instance, **condition_data)

        # Update targets (simple approach: delete and recreate)
        instance.targets.all().delete()
        for target_data in targets_data:
            reminders_data = target_data.pop('reminders', [])
            escalations_data = target_data.pop('escalations', [])

            target = SLATarget.objects.create(sla=instance, **target_data)

            # Create reminders for this target
            for reminder_data in reminders_data:
                notify_groups = reminder_data.pop('notify_groups', [])
                notify_agents = reminder_data.pop('notify_agents', [])

                reminder = SLAReminder.objects.create(sla_target=target, **reminder_data)
                reminder.notify_groups.set(notify_groups)
                reminder.notify_agents.set(notify_agents)

            # Create escalations for this target
            for escalation_data in escalations_data:
                escalate_to_groups = escalation_data.pop('escalate_to_groups', [])
                escalate_to_agents = escalation_data.pop('escalate_to_agents', [])

                escalation = SLAEscalations.objects.create(sla_target=target, **escalation_data)
                escalation.escalate_to_groups.set(escalate_to_groups)
                escalation.escalate_to_agents.set(escalate_to_agents)

        return instance
