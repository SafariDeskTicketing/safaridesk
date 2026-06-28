from rest_framework import serializers

from tenant.models import Label
from tenant.services.labels import HEX_COLOR_RE, normalize_label_color


class LabelSerializer(serializers.ModelSerializer):
    text_color = serializers.CharField(read_only=True)

    class Meta:
        model = Label
        fields = [
            "id",
            "name",
            "description",
            "color",
            "text_color",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "text_color", "created_at", "updated_at"]

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Name cannot be empty")
        return cleaned

    def validate_description(self, value):
        return (value or "").strip()

    def validate_color(self, value):
        if not HEX_COLOR_RE.match((value or "").strip()):
            raise serializers.ValidationError("Color must be a valid hex code")
        normalized = normalize_label_color(value)
        return normalized


class LabelUpdateSerializer(LabelSerializer):
    class Meta(LabelSerializer.Meta):
        fields = ["name", "description", "color", "is_active"]


class LabelAssignmentSerializer(serializers.Serializer):
    label_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
        default=list,
    )
