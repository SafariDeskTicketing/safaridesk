import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from tenant.serializers.CopilotSerializer import (
    CopilotConfirmSerializer,
    CopilotInvokeSerializer,
    CopilotSuggestionSerializer,
)
from tenant.services.copilot import CopilotService


logger = logging.getLogger(__name__)


class CopilotInvokeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = CopilotInvokeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        service = CopilotService()
        try:
            suggestion = service.invoke(
                user=request.user,
                ticket_id=serializer.validated_data["ticket_id"],
                command=serializer.validated_data.get("command"),
                query=serializer.validated_data.get("query", ""),
                surface=serializer.validated_data.get("surface", "rail"),
                extra_input=serializer.validated_data.get("extra_input", ""),
            )
        except ValueError as exc:
            return Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"suggestion": CopilotSuggestionSerializer(suggestion).data}, status=status.HTTP_200_OK)


class CopilotConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, suggestion_id: int, *args, **kwargs):
        serializer = CopilotConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        service = CopilotService()
        try:
            suggestion = service.confirm(
                user=request.user,
                suggestion_id=suggestion_id,
                edited_payload=serializer.validated_data.get("edited_payload"),
            )
        except ValueError as exc:
            return Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"suggestion": CopilotSuggestionSerializer(suggestion).data}, status=status.HTTP_200_OK)


class CopilotRejectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, suggestion_id: int, *args, **kwargs):
        service = CopilotService()
        suggestion = service.reject(user=request.user, suggestion_id=suggestion_id)
        return Response({"suggestion": CopilotSuggestionSerializer(suggestion).data}, status=status.HTTP_200_OK)
