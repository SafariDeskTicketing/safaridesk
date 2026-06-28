from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from shared.services.notification_preferences import NotificationSettingsService
from tenant.services.audit import actor_name, log_audit_event
from tenant.serializers.NotificationSettingSerializer import (
    OrganizationNotificationSettingSerializer,
    UserNotificationPreferenceSerializer,
)


class UserNotificationPreferenceView(APIView):
    """
    Allow authenticated users to view and update their notification preferences.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        preference = NotificationSettingsService.get_user_preferences(request.user)
        serializer = UserNotificationPreferenceSerializer(preference)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        preference = NotificationSettingsService.get_user_preferences(request.user)
        serializer = UserNotificationPreferenceSerializer(
            preference,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_audit_event(
            request,
            event_type="SETTINGS_UPDATED",
            entity_type="settings",
            entity=request.user,
            activity=f"{actor_name(request.user)} updated notification preferences",
            metadata={"area": "user notifications"},
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class OrganizationNotificationSettingView(APIView):
    """
    Manage organization-level notification policies. Restricted to workspace admins.
    """

    permission_classes = [IsAuthenticated]

    def _ensure_admin(self, user):
        if user.is_superuser or user.is_staff:
            return True

        role = getattr(user, "role", None)
        role_name = (getattr(role, "name", "") or "").lower()
        if role_name in {"admin", "manager", "owner"}:
            return True
        raise PermissionDenied("You do not have permission to manage organization notifications.")

    def _get_settings(self, request):
        business = getattr(request.user, "business", None)
        if not business:
            raise PermissionDenied("You need to belong to a workspace to configure these settings.")
        return NotificationSettingsService.get_business_settings(business)

    def get(self, request):
        settings = self._get_settings(request)
        serializer = OrganizationNotificationSettingSerializer(settings)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        self._ensure_admin(request.user)
        settings = self._get_settings(request)
        serializer = OrganizationNotificationSettingSerializer(
            settings,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_audit_event(
            request,
            event_type="SETTINGS_UPDATED",
            entity_type="settings",
            entity=settings,
            activity=f"{actor_name(request.user)} updated organization notification settings",
            metadata={"area": "organization notifications"},
        )
        return Response(serializer.data, status=status.HTTP_200_OK)
