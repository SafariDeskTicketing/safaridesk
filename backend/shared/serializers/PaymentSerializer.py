from rest_framework import serializers
from shared.models.Payment import Payment


class PaymentSerializer(serializers.ModelSerializer):
    """
    Serializer for Payment model
    """
    amount_in_dollars = serializers.FloatField(read_only=True)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)
    business_name = serializers.CharField(source='business.name', read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id',
            'session_id',
            'payment_intent_id',
            'payment_status',
            'amount_total',
            'amount_in_dollars',
            'currency',
            'customer_email',
            'metadata',
            'stripe_response',
            'return_url_hit_at',
            'created_at',
            'updated_at',
            'created_by',
            'created_by_email',
            'business',
            'business_name',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'created_by',
            'business',
        ]


class PaymentListSerializer(serializers.ModelSerializer):
    """
    Simplified serializer for payment list view
    """
    amount_in_dollars = serializers.FloatField(read_only=True)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True)
    business_name = serializers.CharField(source='business.name', read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id',
            'session_id',
            'payment_status',
            'amount_total',
            'amount_in_dollars',
            'currency',
            'customer_email',
            'metadata',
            'created_at',
            'created_by_email',
            'business_name',
        ]
        read_only_fields = fields
