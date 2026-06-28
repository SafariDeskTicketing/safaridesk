from rest_framework import serializers
from django.contrib.auth.models import Group

from users.serializers.PermissionSerializer import PermissionSerializer


class GroupsSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)

    class Meta:
        model = Group
        fields = ['id', 'name', 'permissions']
