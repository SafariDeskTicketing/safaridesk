from rest_framework import serializers

from tenant.models import CopilotSuggestion


class CopilotInvokeSerializer(serializers.Serializer):
    ticket_id = serializers.IntegerField()
    command = serializers.CharField(required=False, allow_blank=True, max_length=32)
    query = serializers.CharField(required=False, allow_blank=True, default="")
    surface = serializers.ChoiceField(choices=["rail", "activity_stream"], default="rail")
    extra_input = serializers.CharField(required=False, allow_blank=True, default="")


class CopilotConfirmSerializer(serializers.Serializer):
    edited_payload = serializers.JSONField(required=False)


class CopilotSuggestionSerializer(serializers.ModelSerializer):
    ticket_id = serializers.IntegerField(source="ticket.id", allow_null=True, read_only=True)
    approved_at = serializers.DateTimeField(source="confirmed_at", allow_null=True, read_only=True)

    class Meta:
        model = CopilotSuggestion
        fields = [
            "id",
            "ticket_id",
            "command",
            "request_text",
            "suggestion_type",
            "status",
            "surface",
            "payload",
            "metadata",
            "confidence_score",
            "approved_at",
            "rejected_at",
            "created_at",
        ]
