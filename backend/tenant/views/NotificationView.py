from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.filters import OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from tenant.models.Notification import Notification

from tenant.serializers.NotificationSerializer import NotificationSerializer, NotificationUpdateSerializer
from rest_framework.generics import RetrieveUpdateAPIView

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['is_read', 'notification_type']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user

        # IMPORTANT: Only return notifications for the logged-in user
        # Each user should only see their own notifications
        return Notification.objects.filter(user=user).order_by("-created_at")


class MarkNotificationAsReadView(RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationUpdateSerializer
    lookup_field = 'pk'
    
    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return Notification.objects.all()
        else:
            return Notification.objects.filter(user=user)
    
    def get_serializer_class(self):
        if self.request.method == 'GET':
            return NotificationSerializer
        return NotificationUpdateSerializer
    
    def perform_update(self, serializer):
        # Always set is_read to True regardless of what's sent
        serializer.save(is_read=True)


class UnreadNotificationCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"unread": count})


class MarkAllAsReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        marked = Notification.objects.filter(
            user=request.user, is_read=False
        ).update(is_read=True, read_at=timezone.now())
        return Response({"marked_read": marked})
