from rest_framework import serializers
from tenant.models.Notification import Notification


class NotificationSerializer(serializers.ModelSerializer):
    task = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ['id', 'message', 'is_read', 'created_at', 'notification_type', 'metadata', 'ticket', 'task']

    def get_task(self, obj):
        return None

    # Optional: customize ticket field if needed
    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep['task'] = None

        if 'task_id' in (instance.metadata or {}) and instance.notification_type in ['task_assigned', 'task_comment', 'task_mention', 'task_status_changed']:
            try:
                from tenant.models.TaskModel import Task

                task = Task.objects.select_related('linked_ticket').get(id=instance.metadata['task_id'])
                rep['task'] = {
                    'id': task.id,
                    'task_trackid': task.task_trackid,
                    'title': task.title,
                    'task_status': task.task_status,
                    'priority': task.priority,
                }
                rep['ticket'] = {
                    'id': task.linked_ticket.id,
                    'ticket_id': task.linked_ticket.ticket_id,
                    'title': task.linked_ticket.title,
                    'status': task.linked_ticket.status,
                    'priority': task.linked_ticket.priority,
                } if task.linked_ticket else None
                return rep
            except Exception:
                rep['task'] = None
                rep['ticket'] = None
                return rep

        ticket = instance.ticket
        if ticket:
            rep['ticket'] = {
                'id': ticket.id,
                'ticket_id': ticket.ticket_id,
                'title': ticket.title,
                'status': ticket.status,
                'priority': ticket.priority,
            }
        else:
            rep['ticket'] = None
        return rep

class NotificationUpdateSerializer(serializers.ModelSerializer):
    is_read = serializers.BooleanField(default=True, required=False)
    class Meta:
        model = Notification
        fields = ["is_read"]
        
    def validate(self, attrs):
        user = self.context['request'].user
        
        # Allow if user is admin or owns the notification
        if not (user.is_staff or user.is_superuser or self.instance.user == user):
            raise serializers.ValidationError("You can only update your own notifications or must be an admin.")
        
        return attrs
    def update(self, instance, validated_data):
        instance.is_read = True
        instance.save()
        return instance