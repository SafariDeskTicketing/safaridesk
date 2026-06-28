import html
import re

from rest_framework import serializers
from tenant.models import Department
from tenant.models import Label
from tenant.models.TaskModel import Task, TaskAttachment, TaskComment, TaskReplayAttachment
from tenant.models.TicketModel import Ticket
from tenant.serializers.DepartmentSerializer import DepartmentListSerializer
from tenant.serializers.LabelSerializer import LabelSerializer
from users.models import Users

TASK_TITLE_MAX_LENGTH = 120

_UNSAFE_RICH_TEXT_BLOCK_PATTERN = re.compile(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>', re.IGNORECASE)
_RICH_TEXT_MEDIA_PATTERN = re.compile(r'<(img|video|audio|iframe|embed|object)\b', re.IGNORECASE)


def _rich_text_without_unsafe_blocks(value):
    return _UNSAFE_RICH_TEXT_BLOCK_PATTERN.sub(' ', value or '')


def _rich_text_plain_text(value):
    value = _rich_text_without_unsafe_blocks(value)
    value = re.sub(r'<[^>]+>', ' ', value)
    value = html.unescape(value).replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', value).strip()


def _rich_text_has_content(value):
    return bool(
        _rich_text_plain_text(value)
        or _RICH_TEXT_MEDIA_PATTERN.search(_rich_text_without_unsafe_blocks(value))
    )


class UserMiniSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    class Meta:
        model = Users
        fields = ['id', 'name', 'email', 'phone_number', 'avatar_url', 'first_name', 'last_name', 'is_active']

    def get_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


class TicketMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ['id', 'title', 'ticket_id', 'status', 'priority']

class TaskListSerializer(serializers.ModelSerializer):
    assigned_to = UserMiniSerializer(read_only=True)
    created_by = UserMiniSerializer(read_only=True)
    linked_ticket = TicketMiniSerializer(read_only=True)
    department = DepartmentListSerializer(read_only=True)
    labels = LabelSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        exclude = ['business', 'updated_by']



class TaskSerializer(serializers.ModelSerializer):
    title = serializers.CharField(required=True)
    description = serializers.CharField(required=False, allow_blank=True)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=True)
    task_status = serializers.ChoiceField(choices=Task.STATUS_CHOICES, required=False)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=Users.objects.all(), required=False, allow_null=True)
    due_date = serializers.DateTimeField(required=False, allow_null=True)
    labels = serializers.PrimaryKeyRelatedField(queryset=Label.objects.all(), many=True, required=False)

    class Meta:
        model = Task
        fields = '__all__'
        read_only_fields = ['created_by', 'business', 'completed_at', 'created_at', 'updated_at']

class TaskCreateSerializer(serializers.Serializer):
    title = serializers.CharField(required=True, max_length=TASK_TITLE_MAX_LENGTH, trim_whitespace=True)
    assigned_to = serializers.IntegerField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True)
    due_date = serializers.DateTimeField(required=True)
    department_id = serializers.IntegerField(required=True)
    priority = serializers.CharField(required=False, allow_blank=True, default='medium')
    ticket_id = serializers.IntegerField(required=False, allow_null=True)
    label_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
        default=list,
    )

    def validate_description(self, value):
        if value and not _rich_text_has_content(value):
            return ''
        return value


class TaskAssignSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=True)


class TaskStatusUpdateSerializer(serializers.Serializer):
    status = serializers.CharField(required=True)

class TaskAttachToTicketSerializer(serializers.Serializer):
    ticket_id = serializers.IntegerField(required=True)




class TaskAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskAttachment
        fields = ['id', 'file_url', 'filename', 'description', 'created_at']

class TaskReplayAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskReplayAttachment
        fields = ['id', 'file_url', 'filename']

class TaskCommentAuthorSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = Users
        fields = ['id', 'name', 'email', 'is_active']

    def get_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()

class TaskCommentSerializer(serializers.ModelSerializer):
    author = TaskCommentAuthorSerializer(read_only=True)
    attachments = TaskReplayAttachmentSerializer(source='attachment', many=True, read_only=True)

    class Meta:
        model = TaskComment
        fields = ['id', 'author', 'content', 'created_at', 'is_internal', 'attachments']


class TaskDetailSerializer(serializers.ModelSerializer):
    is_completed = serializers.BooleanField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    assigned_to = UserMiniSerializer(read_only=True)
    linked_ticket = TicketMiniSerializer(read_only=True)
    attachments = TaskAttachmentSerializer(many=True, read_only=True)
    comments = TaskCommentSerializer(many=True, read_only=True)
    department = DepartmentListSerializer(read_only=True)
    created_by = UserMiniSerializer(read_only=True)
    labels = LabelSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'priority', 'task_status', 'task_trackid',
            'is_completed', 'is_overdue', 'due_date', 'completed_at', 'created_at',
            'assigned_to', 'linked_ticket', 'attachments', 'comments', 'department', 'created_by', 'labels'
        ]

class TaskAddComment(serializers.Serializer):
    comment = serializers.CharField(max_length=500)
    is_internal = serializers.BooleanField()
