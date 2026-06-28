from rest_framework import serializers


class MailCredentialValidationSerializer(serializers.Serializer):
    imap_host = serializers.CharField(required=False, allow_blank=True)
    imap_port = serializers.IntegerField(required=False, min_value=1, max_value=65535)
    imap_username = serializers.CharField(required=False, allow_blank=True)
    imap_password = serializers.CharField(
        required=False, allow_blank=True, style={"input_type": "password"}
    )
    imap_use_ssl = serializers.BooleanField(required=False, default=True)

    smtp_host = serializers.CharField(required=False, allow_blank=True)
    smtp_port = serializers.IntegerField(required=False, min_value=1, max_value=65535)
    smtp_username = serializers.CharField(required=False, allow_blank=True)
    smtp_password = serializers.CharField(
        required=False, allow_blank=True, style={"input_type": "password"}
    )
    smtp_use_ssl = serializers.BooleanField(required=False, default=True)
    smtp_use_tls = serializers.BooleanField(required=False, default=False)

    timeout = serializers.IntegerField(required=False, default=20, min_value=5, max_value=60)

    def validate(self, attrs):
        has_imap = bool(attrs.get("imap_host"))
        has_smtp = bool(attrs.get("smtp_host"))
        if not (has_imap or has_smtp):
            raise serializers.ValidationError(
                "Provide at least IMAP or SMTP connection details to validate."
            )
        return attrs
