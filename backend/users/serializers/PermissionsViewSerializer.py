from django.contrib.auth.models import Group, Permission
from rest_framework import serializers


class PermissionsViewSerializer(serializers.Serializer):
    group = serializers.CharField(max_length=150)
    permissions = serializers.ListField(child=serializers.IntegerField())

    def create(self, validated_data):
        group = validated_data.get('group')
        permission_ids = validated_data.get('permissions')
        group, _ = Group.objects.get_or_create(name=group)
        if permission_ids:
            permissions = Permission.objects.filter(id__in=permission_ids)
            group.permissions.set(permissions)
        return group
