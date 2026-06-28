from __future__ import annotations

from typing import Dict, Optional

from rest_framework import serializers

from tenant.models import Department, MailIntegration
from util.mail import validate_mail_credentials


class MailIntegrationSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    default_assignee_name = serializers.SerializerMethodField()

    def get_default_assignee_name(self, obj):
        if obj.default_assignee:
            full_name = obj.default_assignee.get_full_name().strip()
            return full_name or obj.default_assignee.email
        return None

    class Meta:
        model = MailIntegration
        fields = [
            "id",
            "email_address",
            "display_name",
            "provider",
            "direction",
            "department",
            "department_name",
            "default_assignee",
            "default_assignee_name",
            "imap_host",
            "imap_port",
            "imap_use_ssl",
            "smtp_host",
            "smtp_port",
            "smtp_use_ssl",
            "smtp_use_tls",
            "connection_status",
            "connection_status_detail",
            "forwarding_address",
            "forwarding_status",
            "is_active",
            "last_success_at",
            "last_error_at",
            "last_error_message",
            "provider_metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "connection_status",
            "connection_status_detail",
            "forwarding_status",
            "last_success_at",
            "last_error_at",
            "last_error_message",
            "provider_metadata",
            "created_at",
            "updated_at",
        ]


class MailIntegrationWriteSerializer(serializers.ModelSerializer):
    imap_username = serializers.CharField(write_only=True, allow_blank=True, required=False)
    imap_password = serializers.CharField(write_only=True, allow_blank=True, required=False, style={"input_type": "password"})
    smtp_username = serializers.CharField(write_only=True, allow_blank=True, required=False)
    smtp_password = serializers.CharField(write_only=True, allow_blank=True, required=False, style={"input_type": "password"})
    oauth_access_token = serializers.CharField(write_only=True, allow_blank=True, required=False)
    oauth_refresh_token = serializers.CharField(write_only=True, allow_blank=True, required=False)

    class Meta:
        model = MailIntegration
        fields = [
            "id",
            "email_address",
            "display_name",
            "provider",
            "direction",
            "department",
            "connection_status",
            "connection_status_detail",
            "forwarding_address",
            "forwarding_status",
            "is_active",
            "imap_host",
            "imap_port",
            "imap_use_ssl",
            "imap_username",
            "imap_password",
            "smtp_host",
            "smtp_port",
            "smtp_use_ssl",
            "smtp_use_tls",
            "smtp_username",
            "smtp_password",
            "oauth_access_token",
            "oauth_refresh_token",
            "oauth_expires_at",
            "provider_metadata",
        ]
        read_only_fields = ["connection_status", "connection_status_detail", "forwarding_status", "provider_metadata"]
        extra_kwargs = {
            "email_address": {"required": False, "allow_blank": True},
        }

    secret_field_map = {
        "imap_username": "imap_username_encrypted",
        "imap_password": "imap_password_encrypted",
        "smtp_username": "smtp_username_encrypted",
        "smtp_password": "smtp_password_encrypted",
        "oauth_access_token": "oauth_access_token_encrypted",
        "oauth_refresh_token": "oauth_refresh_token_encrypted",
    }

    def _pop_secret_values(self, validated_data: Dict) -> Dict[str, Optional[str]]:
        secrets: Dict[str, Optional[str]] = {}
        for plain_field in list(self.secret_field_map.keys()):
            if plain_field in validated_data:
                secrets[plain_field] = validated_data.pop(plain_field)
        return secrets

    def _persist_secrets(self, instance: MailIntegration, secrets: Dict[str, Optional[str]]):
        update_fields = []
        for plain_field, value in secrets.items():
            instance.set_secret(plain_field, value)
            update_fields.append(self.secret_field_map[plain_field])
        if update_fields:
            instance.save(update_fields=update_fields)

    def validate_department(self, department: Optional[Department]):
        request = self.context.get("request")
        if department and request and department.business != request.user.business:
            raise serializers.ValidationError("Department must belong to your business.")
        return department

    def _validate_custom_configuration(self, data: Dict):
        provider = data.get("provider")
        if provider != MailIntegration.Provider.CUSTOM:
            return

        direction = data.get("direction") or MailIntegration.Direction.BOTH
        needs_incoming = direction in {MailIntegration.Direction.INCOMING, MailIntegration.Direction.BOTH}
        needs_outgoing = direction in {MailIntegration.Direction.OUTGOING, MailIntegration.Direction.BOTH}

        required = []
        if needs_incoming:
            required.extend(["imap_host", "imap_port", "imap_username", "imap_password"])
        if needs_outgoing:
            required.extend(["smtp_host", "smtp_port", "smtp_username", "smtp_password"])

        missing = [field for field in required if not data.get(field)]
        if missing:
            raise serializers.ValidationError(
                {"credentials": f"Custom mailbox setup is missing: {', '.join(missing)}."}
            )

        payload = {}
        if needs_incoming:
            payload.update(
                {
                    "imap_host": data.get("imap_host"),
                    "imap_port": data.get("imap_port"),
                    "imap_username": data.get("imap_username"),
                    "imap_password": data.get("imap_password"),
                    "imap_use_ssl": data.get("imap_use_ssl", True),
                }
            )
        if needs_outgoing:
            payload.update(
                {
                    "smtp_host": data.get("smtp_host"),
                    "smtp_port": data.get("smtp_port"),
                    "smtp_username": data.get("smtp_username"),
                    "smtp_password": data.get("smtp_password"),
                    "smtp_use_ssl": data.get("smtp_use_ssl", True),
                    "smtp_use_tls": data.get("smtp_use_tls", False),
                }
            )

        result = validate_mail_credentials(payload)
        failed = []
        if needs_incoming and result.get("imap", {}).get("status") != "success":
            failed.append(f"IMAP: {result.get('imap', {}).get('message', 'connection failed')}")
        if needs_outgoing and result.get("smtp", {}).get("status") != "success":
            failed.append(f"SMTP: {result.get('smtp', {}).get('message', 'connection failed')}")
        if failed:
            raise serializers.ValidationError({"credentials": " ".join(failed)})

    def create(self, validated_data):
        self._validate_custom_configuration(validated_data)
        provider = validated_data.get("provider")
        if provider == MailIntegration.Provider.CUSTOM:
            validated_data["connection_status"] = MailIntegration.ConnectionStatus.CONNECTED
            validated_data["connection_status_detail"] = ""
            validated_data["is_active"] = True
        else:
            validated_data["connection_status"] = MailIntegration.ConnectionStatus.CONNECTING
            validated_data["connection_status_detail"] = ""
            validated_data["is_active"] = False

        secrets = self._pop_secret_values(validated_data)
        instance = super().create(validated_data)
        self._persist_secrets(instance, secrets)
        return instance

    def update(self, instance, validated_data):
        secrets = self._pop_secret_values(validated_data)
        if instance.provider == MailIntegration.Provider.CUSTOM:
            merged_data = {
                "provider": instance.provider,
                "direction": validated_data.get("direction", instance.direction),
                "imap_host": validated_data.get("imap_host", instance.imap_host),
                "imap_port": validated_data.get("imap_port", instance.imap_port),
                "imap_use_ssl": validated_data.get("imap_use_ssl", instance.imap_use_ssl),
                "imap_username": secrets.get("imap_username") or instance.get_secret("imap_username"),
                "imap_password": secrets.get("imap_password") or instance.get_secret("imap_password"),
                "smtp_host": validated_data.get("smtp_host", instance.smtp_host),
                "smtp_port": validated_data.get("smtp_port", instance.smtp_port),
                "smtp_use_ssl": validated_data.get("smtp_use_ssl", instance.smtp_use_ssl),
                "smtp_use_tls": validated_data.get("smtp_use_tls", instance.smtp_use_tls),
                "smtp_username": secrets.get("smtp_username") or instance.get_secret("smtp_username"),
                "smtp_password": secrets.get("smtp_password") or instance.get_secret("smtp_password"),
            }
            self._validate_custom_configuration(merged_data)
            validated_data["connection_status"] = MailIntegration.ConnectionStatus.CONNECTED
            validated_data["connection_status_detail"] = ""
            validated_data["is_active"] = True

        instance = super().update(instance, validated_data)
        self._persist_secrets(instance, secrets)
        return instance


class MailIntegrationRoutingSerializer(serializers.ModelSerializer):
    class Meta:
        model = MailIntegration
        fields = ["display_name", "department", "direction", "default_assignee"]

    def validate_department(self, department: Optional[Department]):
        request = self.context.get("request")
        if department and request and department.business != request.user.business:
            raise serializers.ValidationError("Department must belong to your business.")
        return department

    def validate_default_assignee(self, user):
        request = self.context.get("request")
        if user and request and user.business != request.user.business:
            raise serializers.ValidationError("Assignee must belong to your business.")
        return user
