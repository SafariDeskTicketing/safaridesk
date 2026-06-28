from rest_framework import serializers

from tenant.models import Department, DepartmentEmails


class DepartmentEmailSerializer(serializers.ModelSerializer):
    department_id = serializers.IntegerField(source='department.id', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = DepartmentEmails
        fields = [
            'id',
            'email',
             'host',
             'port',
             'username',
             'use_tls',
             'use_ssl',
             'imap_host',
             'imap_port',
             'imap_username',
             'imap_use_ssl',
            'is_active',
            'created_at',
            'updated_at',
            'department_id',
            'department_name',
        ]


class DepartmentEmailUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DepartmentEmails
        fields = (
            'email',
            'department',
            'host',
            'port',
            'username',
            'password',
            'use_tls',
            'use_ssl',
            'imap_host',
            'imap_port',
            'imap_username',
            'imap_password',
            'imap_use_ssl',
            'is_active',
        )
        extra_kwargs = {
            'department': {'required': False},
            'password': {'required': False, 'allow_blank': True},
            'imap_password': {'required': False, 'allow_blank': True},
        }


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'slag', 'created_at', 'updated_at', 'support_email']
        read_only_fields = ['id', 'slag', 'created_at', 'updated_at']

    def validate_name(self, value):
        """Validate department name"""
        if not value.strip():
            raise serializers.ValidationError("Department name cannot be empty.")

        # Check for duplicate names (case-insensitive)
        instance = self.instance
        business = self.context['request'].user.business
        queryset = Department.objects.filter(name__iexact=value.strip(), business=business)

        if instance:
            queryset = queryset.exclude(pk=instance.pk)

        if queryset.exists():
            raise serializers.ValidationError("A department with this name already exists.")

        return value.strip()

    def validate_support_email(self, value):
        """Validate support email"""
        if value:
            from django.core.validators import validate_email
            from django.core.exceptions import ValidationError
            try:
                validate_email(value)
            except ValidationError:
                raise serializers.ValidationError("Invalid email address.")
        return value


class DepartmentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views"""

    class Meta:
        model = Department
        fields = ['id', 'name', 'slag', 'created_at', 'support_email', 'status']
