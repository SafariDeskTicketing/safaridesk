from rest_framework import serializers
from tenant.models.MailIntegrationModel import EmailFilterList, EmailFilterLog


class EmailFilterListSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailFilterList
        fields = ["rules", "updated_at"]
        read_only_fields = ["updated_at"]

    def validate_rules(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("rules must be a list of strings.")
        cleaned = []
        for item in value:
            if not isinstance(item, str):
                raise serializers.ValidationError("Each rule must be a string.")
            line = item.rstrip("\r\n")
            if len(line) > 500:
                raise serializers.ValidationError(f"Rule too long (max 500 chars): {line[:60]}...")
            cleaned.append(line)
        return cleaned


class EmailFilterLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailFilterLog
        fields = ["id", "sender", "subject", "rule_matched", "rule_tier", "blocked_at"]
