from rest_framework import serializers

from tenant.models.TicketModel import Ticket
from users.models import Users


class AgentSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField(max_length=100)
    phone_number = serializers.CharField(max_length=50)
    gender = serializers.CharField(max_length=10, required=False, allow_blank=True)  # Make optional
    departments = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False
    )


class AgentReadSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()  # Override to return list of dicts
    role = serializers.SerializerMethodField()
    created_at = serializers.SerializerMethodField()
    csat_avg = serializers.SerializerMethodField()
    pending_deletion_id = serializers.SerializerMethodField()
    pending_deletion_grace_period_end = serializers.SerializerMethodField()

    class Meta:
        model = Users
        fields = [
            'id',
            'name',
            'email',
            'phone_number',
            'gender',
            'department',
            'avatar_url',
            'role',
            'status',
            'is_active',
            'date_joined',
            'last_login',
            'created_at',
            'csat_avg',
            'pending_deletion_id',
            'pending_deletion_grace_period_end',
        ]

    def get_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"

    def get_department(self, obj):
        return [
            {"id": dept.id, "name": dept.name}
            for dept in obj.department.all()
        ]

    def get_role(self, obj):
        return obj.role.name if obj.role else None

    def get_created_at(self, obj):
        """Get created_at - use date_joined as Users doesn't have created_at from BaseEntity"""
        return obj.date_joined

    def get_csat_avg(self, obj):
        """Compute average CSAT score (0-10) for tickets assigned to this agent."""
        from django.db.models import Avg
        result = Ticket.objects.filter(
            assigned_to=obj,
            csat_score__isnull=False,
        ).aggregate(avg=Avg('csat_score'))
        avg = result.get('avg')
        return round(avg, 1) if avg is not None else None

    def get_pending_deletion_id(self, obj):
        deletion = getattr(obj, 'deletion_request', None)
        if deletion and deletion.status == 'pending':
            return deletion.id
        return None

    def get_pending_deletion_grace_period_end(self, obj):
        deletion = getattr(obj, 'deletion_request', None)
        if deletion and deletion.status == 'pending':
            return deletion.grace_period_end
        return None
