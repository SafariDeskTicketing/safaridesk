from rest_framework import serializers


class UserDTOSerializer(serializers.Serializer):
    f_name = serializers.CharField(max_length=255)
    l_name = serializers.CharField(max_length=255)
    email = serializers.CharField(max_length=255)
    id_no = serializers.CharField(max_length=255)
    occupation = serializers.CharField(max_length=255)
    phone_number = serializers.CharField(max_length=255)
    role = serializers.IntegerField()


class UserUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=255)
    last_name = serializers.CharField(max_length=255)
    email = serializers.CharField(max_length=255)
    phone_number = serializers.CharField(max_length=255)


class UserPassChangeSerializer(serializers.Serializer):
    oldPass = serializers.CharField(max_length=255)
    newPass = serializers.CharField(max_length=255)