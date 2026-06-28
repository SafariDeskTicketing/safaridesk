from rest_framework import serializers

class DataValidateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    phone_number = serializers.CharField(max_length=15)
    id_no = serializers.IntegerField()
    business_name = serializers.CharField(max_length=100)
    business_email = serializers.EmailField()
    domain = serializers.CharField(max_length=100)
