# tenant/serializers.py

from rest_framework import serializers

from tenant.models import Requests


class DomainValidationSerializer(serializers.Serializer):
    url = serializers.CharField()

class TicketSearchSerializer(serializers.Serializer):
    businessId = serializers.IntegerField()

class RequestCreateSerializer(serializers.ModelSerializer):
    businessId = serializers.IntegerField(write_only=True)
    departmentId = serializers.IntegerField(write_only=True)

    class Meta:
        model = Requests
        fields = [
            "title",
            "description",
            "type",
            "creator_name",
            "creator_email",
            "creator_phone",
            "businessId",
            "departmentId",
        ]

class RequestSerializer(serializers.ModelSerializer):

    class Meta:
        model = Requests
        exclude = ['business', 'department']