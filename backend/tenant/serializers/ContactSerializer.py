from rest_framework import serializers

from tenant.models import Contact


class ContactSerializer(serializers.ModelSerializer):
    ticket_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Contact
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "notes",
            "tags",
            "is_active",
            "owner",
            "business",
            "ticket_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "owner", "business", "ticket_count", "created_at", "updated_at"]

    def get_ticket_count(self, obj) -> int:
        return obj.ticket_set.count() if hasattr(obj, 'ticket_set') else 0

    def validate(self, attrs):
        name = attrs.get("name") or getattr(self.instance, "name", None)
        email = attrs.get("email") if "email" in attrs else getattr(self.instance, "email", None)
        phone = attrs.get("phone") if "phone" in attrs else getattr(self.instance, "phone", None)

        if not name:
            raise serializers.ValidationError({"name": "Name is required."})

        if not email and not phone:
            raise serializers.ValidationError({"email": "Provide at least email or phone.", "phone": "Provide at least email or phone."})

        request = self.context.get("request")
        business = getattr(request.user, "business", None) if request else None
        if email and business:
            qs = Contact.objects.filter(business=business, email=email, is_deleted=False)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"email": "A contact with this email already exists for this business."})

        # Normalize tags to list
        tags = attrs.get("tags")
        if tags is not None and not isinstance(tags, list):
            raise serializers.ValidationError({"tags": "Tags must be a list."})

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and hasattr(request, "user"):
            validated_data["business"] = request.user.business
            validated_data["owner"] = request.user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Ensure tags are a list when updating
        if "tags" in validated_data and validated_data["tags"] is None:
            validated_data["tags"] = []
        return super().update(instance, validated_data)
