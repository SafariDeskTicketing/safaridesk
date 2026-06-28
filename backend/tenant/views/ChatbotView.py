from __future__ import annotations

from typing import Any, Dict

from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status

from tenant.models.ChatbotModel import ChatConversation, ChatMessage
from tenant.models.TicketModel import Ticket
from tenant.services.audit import actor_name, log_audit_event
from tenant.services.ai.ticket_extractor import TicketExtractor
from tenant.services.tickets.creation import create_ticket_from_payload


class ChatbotCreateTicketView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        business_id = request.data.get('business_id')
        conversation_id = request.data.get('conversation_id')
        overrides: Dict[str, Any] = request.data.get('ticket_data', {}) or {}

        if not business_id or not conversation_id:
            return Response({"error": "business_id and conversation_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        conversation = get_object_or_404(ChatConversation, business_id=business_id, conversation_id=conversation_id)

        # Use last user message to extract fields
        last_user_msg = ChatMessage.objects.filter(conversation=conversation, role='user').order_by('-created_at').first()
        text = last_user_msg.content if last_user_msg else ""

        extractor = TicketExtractor()
        data = extractor.extract(business_id=int(business_id), text=text)
        # Apply overrides from client (e.g., selected category/department)
        data.update({k: v for k, v in overrides.items() if v is not None})

        # Reuse core creation logic (aligned with TicketView.create)
        ticket = create_ticket_from_payload(
            business_id=int(business_id),
            data=data,
            source='chatbot',
        )
        active_ticket = ticket.merged_into if ticket.is_merged and ticket.merged_into else ticket

        # Link ticket to conversation
        conversation.ticket = active_ticket
        conversation.status = 'completed'
        conversation.save(update_fields=['ticket', 'status'])

        return Response({
            'message': 'Duplicate ticket detected and merged automatically' if ticket.is_merged else 'Ticket created from conversation',
            'ticket_id': active_ticket.id,
            'ticket_ref': active_ticket.ticket_id,
            'duplicate_detection': getattr(ticket, "_duplicate_detection", None),
            'conversation_id': conversation.conversation_id,
        }, status=status.HTTP_201_CREATED)


class ChatbotConversationView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, conversation_id: str, *args, **kwargs):
        business_id = request.query_params.get('business_id')
        if not business_id:
            return Response({"error": "business_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        conversation = get_object_or_404(ChatConversation, business_id=business_id, conversation_id=conversation_id)
        messages = ChatMessage.objects.filter(conversation=conversation).order_by('created_at')
        return Response({
            'conversation': {
                'conversation_id': conversation.conversation_id,
                'business_id': conversation.business_id,
                'mode': conversation.mode,
                'status': conversation.status,
                'ticket_id': conversation.ticket_id,
            },
            'messages': [
                {
                    'role': m.role,
                    'content': m.content,
                    'intent': m.intent,
                    'confidence': m.confidence_score,
                    'created_at': m.created_at,
                }
                for m in messages
            ]
        }, status=status.HTTP_200_OK)


class ChatbotConfigView(APIView):
    # Only authenticated admins/staff should change config
    # For MVP, IsAuthenticated is enough, ideally strict to admins
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request, *args, **kwargs):
        # Assumes user.business is available (via middleware or user model)
        business = getattr(request.user, 'business', None)
        if not business:
             # Fallback for testing/dev if business not linked directly
             business_id = request.query_params.get('business_id')
             if not business_id:
                return Response({"error": "Business context required"}, status=status.HTTP_400_BAD_REQUEST)
        else:
             business_id = business.id

        from tenant.models.ChatbotModel import ChatbotConfig
        from tenant.serializers.ChatbotSerializer import ChatbotConfigSerializer

        config, created = ChatbotConfig.objects.get_or_create(business_id=business_id)
        serializer = ChatbotConfigSerializer(config)
        return Response(serializer.data)

    def put(self, request, *args, **kwargs):
        business = getattr(request.user, 'business', None)
        if not business:
             business_id = request.data.get('business_id') or request.query_params.get('business_id')
             if not business_id:
                return Response({"error": "Business context required"}, status=status.HTTP_400_BAD_REQUEST)
        else:
             business_id = business.id

        from tenant.models.ChatbotModel import ChatbotConfig
        from tenant.serializers.ChatbotSerializer import ChatbotConfigSerializer

        config, created = ChatbotConfig.objects.get_or_create(business_id=business_id)
        serializer = ChatbotConfigSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(last_updated_by=request.user)
            log_audit_event(
                request,
                event_type="SETTINGS_UPDATED",
                entity_type="settings",
                entity=config,
                activity=f"{actor_name(request.user)} updated chatbot settings",
                metadata={"area": "chatbot"},
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
