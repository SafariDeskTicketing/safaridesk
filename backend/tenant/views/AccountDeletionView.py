import logging
from datetime import timedelta

from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from shared.services.auth_revocation import invalidate_user_sessions
from tenant.services.audit import actor_name, log_audit_event
from users.models import Users
from users.models.DeletionModel import AccountDeletionRequest, GRACE_PERIOD_DAYS

logger = logging.getLogger(__name__)


class AccountDeletionView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _require_admin(self, request):
        role_name = getattr(request.user.role, 'name', '').lower()
        if role_name not in ('admin', 'superadmin') and not request.user.is_superuser:
            return Response(
                {'message': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def request_deletion(self, request, id):
        guard = self._require_admin(request)
        if guard:
            return guard

        try:
            user = Users.objects.get(id=id, business=request.user.business)
        except Users.DoesNotExist:
            return Response({'message': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        if user.id == request.user.id:
            return Response(
                {'message': 'You cannot request deletion of your own account'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_deletion = getattr(user, 'deletion_request', None)
        if existing_deletion and existing_deletion.status == AccountDeletionRequest.STATUS_PENDING:
            return Response(
                {'message': 'A pending deletion request already exists for this user'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get('reason', '').strip()
        if existing_deletion:
            deletion = existing_deletion
            deletion.user = user
            deletion.user_email = user.email
            deletion.user_name = user.get_full_name() or user.email
            deletion.business = getattr(user, 'business', None)
            deletion.requested_by = request.user
            deletion.reason = reason
            deletion.status = AccountDeletionRequest.STATUS_PENDING
            deletion.grace_period_end = timezone.now() + timedelta(days=GRACE_PERIOD_DAYS)
            deletion.cancelled_at = None
            deletion.cancelled_by = None
            deletion.purged_at = None
            deletion.save(update_fields=[
                'user',
                'user_email',
                'user_name',
                'business',
                'requested_by',
                'reason',
                'status',
                'grace_period_end',
                'cancelled_at',
                'cancelled_by',
                'purged_at',
            ])
        else:
            deletion = AccountDeletionRequest.create_for_user(
                user=user,
                requested_by=request.user,
                reason=reason,
            )

        # Soft-delete the account immediately. Keep the user row so ticket/task
        # assignment history remains attributable for SLA and reporting.
        user.is_active = False
        user.status = 'D'
        user.auth_revoked_at = timezone.now()
        user.auth_session_version += 1
        user.save(update_fields=['is_active', 'status', 'auth_revoked_at', 'auth_session_version'])
        invalidate_user_sessions(user, reason='account_deleted')

        logger.info(
            "[AccountDeletion] Requested for user_id=%s by admin_id=%s grace_period_end=%s",
            user.id, request.user.id, deletion.grace_period_end,
        )
        log_audit_event(
            request,
            event_type="USER_DELETED",
            entity_type="user",
            entity=user,
            activity=f"{actor_name(request.user)} deleted User '{user.get_full_name() or user.email}'",
            metadata={
                "email": user.email,
                "deletion_id": deletion.id,
                "reason": reason,
                "grace_period_end": deletion.grace_period_end.isoformat(),
            },
        )

        return Response({
            'message': (
                'Agent deleted. The account has been deactivated, removed from active lists, '
                'and historical assignments remain intact.'
            ),
            'deletion_id': deletion.id,
            'grace_period_end': deletion.grace_period_end,
        }, status=status.HTTP_201_CREATED)

    def cancel_deletion(self, request, id):
        guard = self._require_admin(request)
        if guard:
            return guard

        try:
            deletion = AccountDeletionRequest.objects.get(
                id=id,
                business=request.user.business,
                status=AccountDeletionRequest.STATUS_PENDING,
            )
        except AccountDeletionRequest.DoesNotExist:
            return Response(
                {'message': 'Pending deletion request not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        deletion.status = AccountDeletionRequest.STATUS_CANCELLED
        deletion.cancelled_at = timezone.now()
        deletion.cancelled_by = request.user
        deletion.save(update_fields=['status', 'cancelled_at', 'cancelled_by'])

        if deletion.user:
            deletion.user.is_active = True
            deletion.user.status = 'A'
            deletion.user.save(update_fields=['is_active', 'status'])

        logger.info(
            "[AccountDeletion] Cancelled deletion_id=%s by admin_id=%s",
            deletion.id, request.user.id,
        )
        if deletion.user:
            log_audit_event(
                request,
                event_type="USER_REACTIVATED",
                entity_type="user",
                entity=deletion.user,
                activity=f"{actor_name(request.user)} cancelled deletion for User '{deletion.user.get_full_name() or deletion.user.email}'",
                metadata={"deletion_id": deletion.id},
            )

        return Response({'message': 'Deletion request cancelled. Account has been reactivated.'})

    def list_deletions(self, request):
        guard = self._require_admin(request)
        if guard:
            return guard

        deletions = AccountDeletionRequest.objects.filter(
            business=request.user.business,
        ).select_related('requested_by', 'cancelled_by')

        data = [
            {
                'id': d.id,
                'user_email': d.user_email,
                'user_name': d.user_name,
                'status': d.status,
                'reason': d.reason,
                'grace_period_end': d.grace_period_end,
                'requested_by': getattr(d.requested_by, 'email', None),
                'cancelled_by': getattr(d.cancelled_by, 'email', None),
                'created_at': d.created_at,
                'purged_at': d.purged_at,
                'cancelled_at': d.cancelled_at,
            }
            for d in deletions
        ]
        return Response(data)
