from rest_framework import serializers

from tenant.models.Notification import (
    OrganizationNotificationSetting,
    UserNotificationPreference,
)
from shared.services.notification_preferences import NotificationSettingsService


class UserNotificationPreferenceSerializer(serializers.ModelSerializer):
    """
    Serializes per-user notification preferences along with the resolved matrix
    that merges business defaults with user overrides.
    """

    resolved_matrix = serializers.SerializerMethodField()
    business_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = UserNotificationPreference
        fields = (
            "id",
            "business_id",
            "delivery_channels",
            "notification_matrix",
            "quiet_hours",
            "mute_until",
            "browser_push_enabled",
            "email_digest_enabled",
            "digest_frequency",
            "updated_at",
            "resolved_matrix",
        )
        read_only_fields = ("id", "updated_at", "resolved_matrix")

    def get_resolved_matrix(self, obj):
        business = obj.business or (obj.user.business if obj.user else None)
        business_settings = NotificationSettingsService.get_business_settings(business)
        return NotificationSettingsService.build_effective_matrix(obj, business_settings)


class OrganizationNotificationSettingSerializer(serializers.ModelSerializer):
    business_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = OrganizationNotificationSetting
        fields = (
            "id",
            "business_id",
            "delivery_channels",
            "notification_matrix",
            "digest_enabled",
            "digest_frequency",
            "escalation_policy",
            "webhook_url",
            "updated_at",
        )
        read_only_fields = ("id", "updated_at", "business_id")
