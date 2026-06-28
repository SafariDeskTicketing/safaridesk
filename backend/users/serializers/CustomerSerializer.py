from rest_framework import serializers

from tenant.models import Ticket
from users.models import Customer

class TicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = ['id', 'title', 'description', 'status', 'priority', 'created_at', 'ticket_id']

# Adjust the import path

class CustomerSerializer(serializers.ModelSerializer):
    tickets = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = ['id', 'email', 'allow_login', 'is_active', 'first_name', 'last_name', 'phone_number', 'tickets']

    def get_tickets(self, obj):
        related_tickets = Ticket.objects.filter(creator_email=obj.email)
        return TicketSerializer(related_tickets, many=True).data

