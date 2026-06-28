from rest_framework import serializers

from tenant.models import TenantAuditLog


class TenantAuditLogSerializer(serializers.ModelSerializer):
    timestamp = serializers.DateTimeField(read_only=True)
    actor = serializers.SerializerMethodField()
    ip_address = serializers.SerializerMethodField()

    class Meta:
        model = TenantAuditLog
        fields = [
            "id",
            "timestamp",
            "actor",
            "event_type",
            "ip_address",
            "activity",
            "entity_type",
            "entity_id",
            "metadata",
        ]

    def get_actor(self, obj: TenantAuditLog) -> dict:
        return {
            "id": obj.actor_id,
            "name": obj.actor_name or "System",
            "email": obj.actor_email or "",
            "avatar_url": obj.actor_avatar_url or None,
        }

    def get_ip_address(self, obj: TenantAuditLog) -> str:
        return obj.ip_address or ""
