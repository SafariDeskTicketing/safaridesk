from rest_framework import serializers
from tenant.models.ChatbotModel import ChatbotConfig

class ChatbotConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatbotConfig
        fields = [
            'id', 
            'is_enabled', 
            'greeting_message', 
            'tone', 
            'instructions',
            'agent_signature',
            'kb_search_enabled', 
            'auto_categorize', 
            'auto_assign_priority', 
            'auto_route_department',
            'max_response_chars',
            'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']

