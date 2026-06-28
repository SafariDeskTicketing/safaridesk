from rest_framework import serializers

class BusinessRegistrationSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    organization_size = serializers.CharField(max_length=200)
    email = serializers.EmailField()
    business_name = serializers.CharField(max_length=100)
    domain = serializers.CharField(max_length=100)
    website = serializers.URLField(allow_null=True)
