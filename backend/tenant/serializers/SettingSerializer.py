from rest_framework import serializers
from tenant.models.SettingModel import CsatConfiguration, EmailTemplate, EmailTemplateCategory, EmailConfig


class EmailConfigSerializer(serializers.ModelSerializer):
    default_template = serializers.PrimaryKeyRelatedField(queryset=EmailTemplateCategory.objects.all())

    class Meta:
        model = EmailConfig
        fields = ('default_template', 'email_fetching')


class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = ('id', 'name', 'description', 'subject', 'body', 'is_active', 'type')


class EmailTemplateCategorySerializer(serializers.ModelSerializer):
    templates = EmailTemplateSerializer(many=True, read_only=True)

    class Meta:
        model = EmailTemplateCategory
        fields = ('id', 'name', 'templates')


class SMTPSettingsSerializer(serializers.Serializer):
    host = serializers.CharField(max_length=255)
    port = serializers.IntegerField()
    username = serializers.CharField(max_length=255)
    password = serializers.CharField(max_length=255)
    use_tls = serializers.BooleanField(default=True)
    use_ssl = serializers.BooleanField(default=False)
    default_from_email = serializers.EmailField()
    sender_name = serializers.CharField(max_length=255, allow_blank=True, required=False)
    reply_to_email = serializers.EmailField(allow_blank=True, required=False)


class SMTPTestSerializer(serializers.Serializer):
    email = serializers.CharField(max_length=255)


class EmailSettingsSerializer(serializers.ModelSerializer):
    """Serializer for email signature and format settings."""
    
    class Meta:
        from tenant.models.SettingModel import EmailSettings
        model = EmailSettings
        fields = (
            'id',
            'signature_greeting',
            'signature_name',
            'include_ticket_link',
            'use_plain_text',
        )
        read_only_fields = ('id',)

    def validate_signature_greeting(self, value):
        """Ensure greeting ends with comma or punctuation."""
        if value and not value.rstrip().endswith((',', '.', '!', ':')):
            value = value.rstrip() + ','
        return value


class CsatConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for internal CSAT settings."""

    class Meta:
        model = CsatConfiguration
        fields = (
            'id',
            'enabled',
            'star_label',
            'emotion_label',
            'comment_label',
            'star_required',
            'emotion_required',
            'comment_required',
            'survey_title',
            'intro_text',
            'thank_you_title',
            'thank_you_message',
            'link_expiry_hours',
        )
        read_only_fields = ('id',)


class CsatSurveySubmissionSerializer(serializers.Serializer):
    star_rating = serializers.IntegerField(required=False, min_value=0, max_value=5)
    emotion = serializers.ChoiceField(choices=['happy', 'sad'], required=False)
    comment = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)
