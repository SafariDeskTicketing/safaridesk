from rest_framework import serializers


class CustomerMagicLinkRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    business_id = serializers.IntegerField(required=False, allow_null=True)


class CustomerMagicLinkVerifySerializer(serializers.Serializer):
    token = serializers.CharField()
