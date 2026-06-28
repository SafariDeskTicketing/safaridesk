from rest_framework import serializers

from tenant.models import Label, TicketCategories, SLA
from tenant.models.DepartmentModel import Department
from tenant.models.TicketModel import Ticket
from users.models.UserModel import Users
from tenant.serializers.EmailMessageRecordSerializer import EmailMessageRecordSerializer
from tenant.serializers.LabelSerializer import LabelSerializer


class TicketCategorySerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    
    class Meta:
        model = TicketCategories
        fields = ['id', 'name', 'description', 'is_active', 'department', 'department_name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'department_name']

    def validate_name(self, value):
        """Validate that name is not empty"""
        if not value.strip():
            raise serializers.ValidationError("Name cannot be empty")
        return value.strip()

    def validate_description(self, value):
        """Validate description"""
        if value and len(value.strip()) < 10:
            raise serializers.ValidationError("Description must be at least 10 characters long")
        return value.strip() if value else value


class TicketCategoryUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketCategories
        fields = ['name', 'description', 'department']
        extra_kwargs = {
            'department': {'required': False, 'allow_null': True},
        }

    def validate_name(self, value):
        """Validate that name is not empty"""
        if not value.strip():
            raise serializers.ValidationError("Name cannot be empty")
        return value.strip()

    def validate_description(self, value):
        """Validate description"""
        if value and len(value.strip()) < 10:
            raise serializers.ValidationError("Description must be at least 10 characters long")
        return value.strip() if value else value


class TicketSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=100)
    creator_name = serializers.CharField(max_length=100)
    creator_phone = serializers.CharField(max_length=100)
    creator_email = serializers.CharField(max_length=100)
    description = serializers.CharField(max_length=255)
    category = serializers.IntegerField()
    department = serializers.IntegerField()
    priority = serializers.CharField(max_length=10)
    is_public = serializers.BooleanField(default=False)
    source = serializers.CharField(max_length=20, required=False, default='web')
    assignee_id = serializers.IntegerField(required=False, allow_null=True)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=200),
        required=False,
        allow_empty=True
    )
    label_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
        default=list,
    )

class TicketAssign(serializers.Serializer):
    ticket_id = serializers.IntegerField()
    agent_id = serializers.IntegerField()

class TicketUpdateStatus(serializers.Serializer):
    status = serializers.CharField(max_length=100)

class TicketAddComment(serializers.Serializer):
    comment = serializers.CharField(max_length=500)
    is_internal = serializers.BooleanField()


class TicketAddWatchers(serializers.Serializer):
    watchers = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False
    )

class TicketAddTags(serializers.Serializer):
    tags = serializers.ListField(
        child=serializers.CharField(max_length=200),
        allow_empty=False
    )

class TicketCategory1Serializer(serializers.ModelSerializer):
    class Meta:
        model = TicketCategories
        fields = ['id', 'name']


class Department1Serializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name']

class TicketMergeInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ['id', 'ticket_id', 'title']

class TicketMergeRequestSerializer(serializers.Serializer):
    source_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
        help_text="Ticket IDs to merge into the target ticket"
    )
    note = serializers.CharField(required=False, allow_blank=True, help_text="Optional merge note")

class UserBasicInfo(serializers.ModelSerializer):
    class Meta:
        model = Users
        fields = ['id', 'first_name', 'last_name', 'email', 'phone_number', 'avatar_url', 'is_active']

class SlaSerializer(serializers.ModelSerializer):
    class Meta:
        model = SLA
        fields = "__all__"



class TicketsList(serializers.ModelSerializer):
    category = TicketCategory1Serializer(read_only=True)
    sla = SlaSerializer(read_only=True)
    department = Department1Serializer(read_only=True)
    assigned_to = UserBasicInfo(read_only=True)
    merged_into = TicketMergeInfoSerializer(read_only=True)
    email_messages = EmailMessageRecordSerializer(many=True, read_only=True)
    labels = LabelSerializer(many=True, read_only=True)
    tags = serializers.SerializerMethodField()

    category_id = serializers.PrimaryKeyRelatedField(
        queryset=TicketCategories.objects.all(), source='category', write_only=True
    )
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), source='department', write_only=True
    )

    assigned_to_id = serializers.PrimaryKeyRelatedField(
        queryset=Users.objects.all(), source='assigned_to', write_only=True, required=False, allow_null=True
    )


    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)

    breached = serializers.BooleanField(source='is_sla_breached', read_only=True)
    linked_tasks_count = serializers.SerializerMethodField()
    unread_activity_count = serializers.SerializerMethodField()
    attachments_count = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    creator_is_active = serializers.SerializerMethodField()
    contact = serializers.SerializerMethodField()

    # Explicit declarations for unread status fields
    is_opened = serializers.BooleanField(read_only=True)
    has_new_reply = serializers.BooleanField(read_only=True)
    csat_score = serializers.IntegerField(read_only=True, allow_null=True)

    def get_creator_is_active(self, obj) -> bool:
        if obj.contact_id is not None:
            return getattr(obj.contact, 'is_active', True)
        return True

    def get_contact(self, obj):
        contact = getattr(obj, 'contact', None)
        if not contact:
            return None
        return {
            'id': contact.id,
            'name': contact.name,
            'email': contact.email or '',
            'phone': contact.phone or '',
            'is_active': contact.is_active,
        }

    def get_linked_tasks_count(self, obj):
        """Return the count of tasks linked to this ticket"""
        try:
            from tenant.models import Task
            return Task.objects.filter(
                linked_ticket=obj,
                is_archived=False,
                is_deleted=False
            ).exclude(task_status='draft').count()
        except Exception as e:
            return 0

    def get_unread_activity_count(self, obj):
        """Return the count of unread activities for the current user"""
        try:
            request = self.context.get('request')
            if not request or not request.user:
                return 0
            
            from tenant.models import ActivityReadStatus
            # Get all activity IDs for this ticket
            activity_ids = obj.activities.values_list('id', flat=True)
            # Get read activity IDs for this user
            read_activity_ids = ActivityReadStatus.objects.filter(
                activity_id__in=activity_ids,
                user=request.user
            ).values_list('activity_id', flat=True)
            # Count unread = total activities - read activities
            return len(activity_ids) - len(read_activity_ids)
        except Exception as e:
            return 0

    def get_attachments_count(self, obj):
        """Return number of attachments linked to the ticket"""
        try:
            return obj.attachments.count()
        except Exception:
            return 0

    def get_comments_count(self, obj):
        """Return number of comments on the ticket"""
        try:
            return obj.comments.count()
        except Exception:
            return 0

    def get_tags(self, obj):
        try:
            prefetched_labels = getattr(obj, '_prefetched_objects_cache', {}).get('labels')
            if prefetched_labels is not None:
                return [
                    label.name for label in sorted(
                        prefetched_labels,
                        key=lambda label: ((label.name or '').lower(), -label.id),
                    )
                ]
            return list(obj.labels.order_by('name').values_list('name', flat=True))
        except Exception:
            return []


    class Meta:
        model = Ticket
        fields = [
            'id',
            'title',
            'creator_name',
            'creator_phone',
            'creator_email',
            'contact',
            'ticket_id',
            'description',
            'category',
            'category_id',
            'labels',
            'tags',
            'sla',
            'department',
            'department_id',
            'priority',
            'priority_display',
            'is_public',
            'status',
            'status_display',
            'source',
            'source_display',
            'created_at',
            'due_date',
            'resolved_at',
            'assigned_to',
            'assigned_to_id',
            'breached',
            'is_merged',
            'merged_into',
            'email_messages',
            'linked_tasks_count',
            'unread_activity_count',
            'attachments_count',
            'comments_count',
            'is_opened',
            'has_new_reply',
            'csat_score',
            'creator_is_active',
        ]

