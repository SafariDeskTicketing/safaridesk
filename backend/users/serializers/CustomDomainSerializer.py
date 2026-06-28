"""
Custom Domain Serializers
"""
from rest_framework import serializers
from users.models import CustomDomains


class CustomDomainSerializer(serializers.ModelSerializer):
    """Serializer for CustomDomains model"""

    business_name = serializers.CharField(source='business.name', read_only=True)
    verification_instructions = serializers.SerializerMethodField()

    class Meta:
        model = CustomDomains
        fields = [
            'id',
            'business',
            'business_name',
            'domain',
            'is_primary',
            'is_verified',
            'verification_method',
            'verification_status',
            'verification_token',
            'verification_record_name',
            'verification_record_value',
            'verification_instructions',
            'last_verification_attempt',
            'verified_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'business',
            'is_verified',
            'verification_status',
            'verification_token',
            'verification_record_name',
            'verification_record_value',
            'last_verification_attempt',
            'verified_at',
            'created_at',
            'updated_at',
        ]

    def get_verification_instructions(self, obj):
        """Generate human-readable verification instructions"""
        if not obj.verification_record_name or not obj.verification_record_value:
            return None

        if obj.verification_method == 'dns_txt':
            return {
                'method': 'DNS TXT Record',
                'steps': [
                    f"Log in to your domain provider's DNS management panel",
                    f"Create a new TXT record with the following details:",
                    f"  - Record Type: TXT",
                    f"  - Name/Host: {obj.verification_record_name}",
                    f"  - Value: {obj.verification_record_value}",
                    f"  - TTL: 3600 (or default)",
                    f"Wait for DNS propagation (usually 5-30 minutes)",
                    f"Click 'Verify Domain' button to complete verification"
                ]
            }
        elif obj.verification_method == 'dns_cname':
            return {
                'method': 'DNS CNAME Record',
                'steps': [
                    f"Log in to your domain provider's DNS management panel",
                    f"Create a new CNAME record with the following details:",
                    f"  - Record Type: CNAME",
                    f"  - Name/Host: {obj.verification_record_name}",
                    f"  - Value/Target: {obj.verification_record_value}",
                    f"  - TTL: 3600 (or default)",
                    f"Wait for DNS propagation (usually 5-30 minutes)",
                    f"Click 'Verify Domain' button to complete verification"
                ]
            }

        return None

    def validate_domain(self, value):
        """Validate domain format and uniqueness"""
        # Remove protocol if present
        domain = value.lower().replace('http://', '').replace('https://', '').strip('/')

        # Remove trailing slash
        domain = domain.split('/')[0]

        # Basic validation
        if not domain or '.' not in domain:
            raise serializers.ValidationError("Please enter a valid domain name (e.g., support.company.com)")

        # Check for localhost or IP addresses
        invalid_patterns = ['localhost', '127.0.0.1', '0.0.0.0']
        if any(pattern in domain for pattern in invalid_patterns):
            raise serializers.ValidationError("Cannot use localhost or IP addresses as custom domain")

        return domain

    def validate(self, data):
        """Ensure business can only have one verified domain"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            business = request.user.business

            # Check if business already has a verified domain
            existing_verified = CustomDomains.objects.filter(
                business=business,
                is_verified=True
            ).exclude(id=self.instance.id if self.instance else None).exists()

            if existing_verified:
                raise serializers.ValidationError(
                    "Your business already has a verified custom domain. "
                    "Please remove the existing domain before adding a new one."
                )

        return data


class DomainVerificationSerializer(serializers.Serializer):
    """Serializer for domain verification action"""
    domain_id = serializers.IntegerField()


class DomainCheckSerializer(serializers.Serializer):
    """Serializer for checking domain DNS propagation"""
    domain = serializers.CharField()
    record_type = serializers.ChoiceField(
        choices=['A', 'CNAME', 'TXT', 'MX'],
        default='A'
    )

