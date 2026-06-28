import json
import logging
import os
from datetime import timedelta

from django.contrib.auth.tokens import default_token_generator
from django.db import connection
from django.db.models import Count, Q
from django.http import StreamingHttpResponse
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import Business, Users
from shared.models.AdminAuditLog import AdminAuditLog
from tenant.services.audit import log_audit_event

logger = logging.getLogger(__name__)

TENANT_ADMIN_AUDIT_ACTIONS = {
    'activated_business',
    'suspend_business',
    'edit_business_config',
    'enable_user',
    'disable_user',
    'force_logout',
    'reset_password',
}


def _get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _log_action(admin_user, action_name, target_type, target_id, target_label, detail, request):
    """Fire-and-forget audit log. Never raises."""
    try:
        AdminAuditLog.objects.create(
            admin_user=admin_user,
            action=action_name,
            target_type=target_type,
            target_id=target_id,
            target_label=target_label or '',
            detail=detail or {},
            ip_address=_get_client_ip(request),
        )
    except Exception as exc:
        logger.warning('[SafariAdmin] Failed to write audit log: %s', exc)
    try:
        if action_name not in TENANT_ADMIN_AUDIT_ACTIONS:
            return
        target_entity = None
        target_business = None
        if target_type == 'Business':
            target_entity = Business.objects.filter(id=target_id).first()
            target_business = target_entity
        elif target_type == 'User':
            target_entity = Users.objects.select_related('business').filter(id=target_id).first()
            target_business = getattr(target_entity, 'business', None)
        if target_entity and target_business:
            log_audit_event(
                request,
                event_type=f"SAFARI_ADMIN_{action_name.upper()}",
                entity_type="safari_admin",
                entity=target_entity,
                activity=f"SafariAdmin {action_name.replace('_', ' ')} on {target_type} '{target_label}'",
                metadata=detail or {},
                actor_user=admin_user,
                business=target_business,
            )
    except Exception as exc:
        logger.warning('[SafariAdmin] Failed to write tenant audit log: %s', exc)


# ---------------------------------------------------------------------------
# Permission
# ---------------------------------------------------------------------------

class IsSuperAdmin(IsAuthenticated):
    """Only staff or superuser accounts can access SafariAdmin endpoints."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return bool(request.user.is_staff or request.user.is_superuser)


class IsBusinessOwner(IsAuthenticated):
    """
    Original permission — only the owner of the business the user belongs to.
    Used for business self-service actions (deletion request/cancel).
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        business = getattr(request.user, 'business', None)
        if not business:
            return False
        owner_id = getattr(business, 'owner_id', None)
        return owner_id is not None and owner_id == request.user.id


# ---------------------------------------------------------------------------
# Businesses ViewSet
# ---------------------------------------------------------------------------

# Actions that belong to business owners (self-service deletion management)
_OWNER_ACTIONS = {'request_deletion', 'cancel_deletion'}


class AdminBusinessViewSet(viewsets.ViewSet):
    # Default: SafariAdmin superadmin only.
    # request_deletion / cancel_deletion restore the original IsBusinessOwner behaviour.
    permission_classes = [IsSuperAdmin]

    def get_permissions(self):
        if self.action in _OWNER_ACTIONS:
            return [IsBusinessOwner()]
        return [IsSuperAdmin()]

    def list(self, request):
        """GET /admin/businesses/ — all tenants with aggregated stats."""
        from tenant.models import Ticket
        businesses = Business.objects.annotate(
            ticket_count=Count('ticket', distinct=True),
            user_count=Count('user_members', distinct=True),
        ).order_by('-created_at')

        data = [{
            'id': b.id,
            'name': b.name,
            'domain': b.domain,
            'domain_url': b.domain_url,
            'email': b.email,
            'phone': b.phone,
            'website': b.website,
            'timezone': b.timezone,
            'organization_size': b.organization_size,
            'is_active': b.is_active,
            'created_at': b.created_at.isoformat() if b.created_at else None,
            'ticket_count': b.ticket_count,
            'user_count': b.user_count,
            'owner_email': b.owner.email if b.owner else None,
        } for b in businesses]

        return Response(data)

    def retrieve(self, request, pk=None):
        """GET /admin/businesses/{id}/ — detailed tenant info."""
        from tenant.models import Ticket
        try:
            business = Business.objects.get(pk=pk)
        except Business.DoesNotExist:
            return Response({'error': 'Business not found'}, status=404)

        ticket_qs = Ticket.objects.filter(business=business, is_deleted=False)
        user_qs = Users.objects.filter(business=business)

        return Response({
            'id': business.id,
            'name': business.name,
            'domain': business.domain,
            'domain_url': business.domain_url,
            'email': business.email,
            'phone': business.phone,
            'website': business.website,
            'timezone': business.timezone,
            'organization_size': business.organization_size,
            'logo_url': business.logo_url,
            'is_active': business.is_active,
            'created_at': business.created_at.isoformat() if business.created_at else None,
            'owner': {
                'id': business.owner.id if business.owner else None,
                'email': business.owner.email if business.owner else None,
                'name': f"{business.owner.first_name} {business.owner.last_name}".strip() if business.owner else None,
            },
            'ticket_count': ticket_qs.count(),
            'user_count': user_qs.count(),
        })

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        """PATCH /admin/businesses/{id}/status/ — activate or suspend a tenant."""
        try:
            business = Business.objects.get(pk=pk)
        except Business.DoesNotExist:
            return Response({'error': 'Business not found'}, status=404)

        is_active = request.data.get('is_active')
        if is_active is None:
            return Response({'error': 'is_active field required'}, status=400)

        business.is_active = bool(is_active)
        business.save(update_fields=['is_active'])

        action_label = 'activated' if business.is_active else 'suspended'
        logger.info('[SafariAdmin] Business %s (%s) %s by admin %s', business.id, business.name, action_label, request.user.email)
        _log_action(request.user, f'{action_label}_business' if business.is_active else 'suspend_business',
                    'Business', business.id, business.name, {'is_active': business.is_active}, request)

        return Response({'id': business.id, 'is_active': business.is_active, 'message': f'Business {action_label}.'})

    @action(detail=True, methods=['get'], url_path='ticket-health')
    def ticket_health(self, request, pk=None):
        """GET /admin/businesses/{id}/ticket-health/ — ticket status breakdown + SLA + trends."""
        from tenant.models import Ticket
        try:
            business = Business.objects.get(pk=pk)
        except Business.DoesNotExist:
            return Response({'error': 'Business not found'}, status=404)

        qs = Ticket.objects.filter(business=business, is_deleted=False)
        seven_days_ago = timezone.now() - timedelta(days=7)

        # SLA breaches: tickets past their due_date and not resolved/closed
        sla_breached = qs.filter(
            due_date__lt=timezone.now(),
            status__in=['open', 'in_progress', 'pending', 'on_hold'],
        ).count()

        # Avg first response time (hours) for tickets that have a response
        from django.db.models import Avg, ExpressionWrapper, F, DurationField
        avg_response = qs.filter(
            first_response_at__isnull=False,
            created_at__isnull=False,
        ).annotate(
            response_duration=ExpressionWrapper(
                F('first_response_at') - F('created_at'),
                output_field=DurationField(),
            )
        ).aggregate(avg=Avg('response_duration'))

        avg_response_hours = None
        if avg_response['avg']:
            avg_response_hours = round(avg_response['avg'].total_seconds() / 3600, 1)

        return Response({
            'open': qs.filter(status='open').count(),
            'in_progress': qs.filter(status='in_progress').count(),
            'pending': qs.filter(status='pending').count(),
            'on_hold': qs.filter(status='on_hold').count(),
            'resolved': qs.filter(status='resolved').count(),
            'closed': qs.filter(status='closed').count(),
            'sla_breached': sla_breached,
            'avg_first_response_hours': avg_response_hours,
            'created_last_7d': qs.filter(created_at__gte=seven_days_ago).count(),
            'resolved_last_7d': qs.filter(resolved_at__gte=seven_days_ago).count(),
        })

    @action(detail=False, methods=['get'], url_path='email-stats')
    def email_stats(self, request):
        """GET /admin/businesses/email-stats/ — all MailIntegration statuses across tenants."""
        from tenant.models.MailIntegrationModel import MailIntegration, MailFetchLog
        seven_days_ago = timezone.now() - timedelta(days=7)

        integrations = MailIntegration.objects.select_related('business').order_by('business__name')

        data = []
        for i in integrations:
            fetch_cycles_7d = MailFetchLog.objects.filter(
                integration=i,
                checked_at__gte=seven_days_ago,
                result='success',
            ).count()

            data.append({
                'id': i.id,
                'email_address': i.email_address,
                'display_name': i.display_name,
                'provider': i.provider,
                'connection_status': i.connection_status,
                'last_success_at': i.last_success_at.isoformat() if i.last_success_at else None,
                'last_error_at': i.last_error_at.isoformat() if i.last_error_at else None,
                'last_error_message': i.last_error_message,
                'business_name': i.business.name if i.business else None,
                'business_id': i.business.id if i.business else None,
                'fetch_cycles_7d': fetch_cycles_7d,
                'is_active': i.is_active,
            })

        return Response(data)

    @action(detail=True, methods=['get', 'patch'], url_path='config')
    def business_config(self, request, pk=None):
        """GET/PATCH /admin/businesses/{id}/config/ — editable business config."""
        try:
            business = Business.objects.get(pk=pk)
        except Business.DoesNotExist:
            return Response({'error': 'Business not found'}, status=404)

        if request.method == 'GET':
            return Response({
                'id': business.id,
                'name': business.name,
                'timezone': business.timezone or '',
                'email': business.email or '',
                'phone': business.phone or '',
                'website': business.website or '',
                'domain_url': business.domain_url or '',
                'support_url': getattr(business, 'support_url', '') or '',
                'organization_size': business.organization_size or '',
            })

        # PATCH
        EDITABLE = ['timezone', 'email', 'phone', 'website', 'domain_url', 'support_url', 'organization_size']
        changed = {}
        for field in EDITABLE:
            if field in request.data:
                setattr(business, field, request.data[field])
                changed[field] = request.data[field]

        if not changed:
            return Response({'message': 'No changes provided.'})

        business.save(update_fields=list(changed.keys()))
        _log_action(request.user, 'edit_business_config', 'Business', business.id, business.name,
                    {'changed_fields': list(changed.keys())}, request)
        logger.info('[SafariAdmin] Business %s config updated by %s: %s', business.id, request.user.email, list(changed.keys()))
        return Response({'id': business.id, 'message': 'Config updated.', **changed})

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """GET /admin/businesses/summary/ — platform-wide stats."""
        from tenant.models import Ticket
        return Response({
            'total_businesses': Business.objects.count(),
            'active_businesses': Business.objects.filter(is_active=True).count(),
            'total_tickets': Ticket.objects.filter(is_deleted=False).count(),
            'total_users': Users.objects.filter(category='BUSINESS').count(),
        })

    @action(detail=False, methods=['get'])
    def deletions(self, request):
        """GET /admin/businesses/deletions/ — business deletion requests."""
        from users.models.BusinessDeletionModel import BusinessDeletionRequest
        items = BusinessDeletionRequest.objects.select_related('requested_by', 'cancelled_by')
        data = [{
            'id': d.id,
            'business_name': d.business_name,
            'business_domain': d.business_domain,
            'status': d.status,
            'reason': d.reason,
            'grace_period_end': d.grace_period_end,
            'requested_by': getattr(d.requested_by, 'email', None),
            'cancelled_by': getattr(d.cancelled_by, 'email', None),
            'created_at': d.created_at,
            'purged_at': d.purged_at,
            'cancelled_at': d.cancelled_at,
        } for d in items]
        return Response(data)

    @action(detail=True, methods=['post'], url_path='request_deletion')
    def request_deletion(self, request, pk=None):
        """POST /admin/businesses/{id}/request_deletion/ — request 30-day deletion."""
        from users.models.BusinessDeletionModel import BusinessDeletionRequest
        try:
            business = Business.objects.get(pk=pk)
        except Business.DoesNotExist:
            return Response({'message': 'Business not found'}, status=status.HTTP_404_NOT_FOUND)

        if hasattr(business, 'deletion_request') and business.deletion_request.status == BusinessDeletionRequest.STATUS_PENDING:
            return Response({'message': 'A pending deletion request already exists for this business'}, status=400)

        reason = request.data.get('reason', '').strip()
        deletion = BusinessDeletionRequest.create_for_business(business=business, requested_by=request.user, reason=reason)
        business.is_active = False
        business.save(update_fields=['is_active'])

        logger.info('[BusinessDeletion] Requested for business_id=%s by admin_id=%s', business.id, request.user.id)

        return Response({
            'message': f'Deletion request created. Will be permanently deleted on {deletion.grace_period_end.strftime("%B %d, %Y")}.',
            'deletion_id': deletion.id,
            'grace_period_end': deletion.grace_period_end,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='cancel_deletion')
    def cancel_deletion(self, request, pk=None):
        """POST /admin/businesses/{id}/cancel_deletion/ — cancel a pending deletion."""
        from users.models.BusinessDeletionModel import BusinessDeletionRequest
        try:
            deletion = BusinessDeletionRequest.objects.get(business_id=pk, status=BusinessDeletionRequest.STATUS_PENDING)
        except BusinessDeletionRequest.DoesNotExist:
            return Response({'message': 'Pending deletion request not found'}, status=404)

        deletion.status = BusinessDeletionRequest.STATUS_CANCELLED
        deletion.cancelled_at = timezone.now()
        deletion.cancelled_by = request.user
        deletion.save(update_fields=['status', 'cancelled_at', 'cancelled_by'])

        if deletion.business:
            deletion.business.is_active = True
            deletion.business.save(update_fields=['is_active'])

        return Response({'message': 'Deletion cancelled. Business reactivated.'})


# ---------------------------------------------------------------------------
# Users ViewSet
# ---------------------------------------------------------------------------

    @action(detail=True, methods=['get'], url_path='mail-log')
    def mail_log(self, request, pk=None):
        """GET /admin/businesses/{id}/mail-log/?days=7&mailbox=<integration_id>"""
        from tenant.models.MailIntegrationModel import MailFetchLog, MailIntegration
        days = min(int(request.query_params.get('days', 3)), 30)
        since = timezone.now() - timedelta(days=days)

        integrations = MailIntegration.objects.filter(business_id=pk)
        mailbox_filter = request.query_params.get('mailbox')
        if mailbox_filter:
            integrations = integrations.filter(id=mailbox_filter)

        logs = (
            MailFetchLog.objects
            .filter(integration__in=integrations, checked_at__gte=since)
            .select_related('integration')
            .order_by('-checked_at')[:200]
        )

        return Response([{
            'id': l.id,
            'mailbox': l.integration.email_address if l.integration else None,
            'integration_id': l.integration_id,
            'checked_at': l.checked_at.isoformat(),
            'result': l.result,
            'duration_ms': l.duration_ms,
            'message_count': l.message_count,
            'new_ticket_count': l.new_ticket_count,
            'new_reply_count': l.new_reply_count,
            'error_message': l.error_message or None,
        } for l in logs])

    @action(detail=True, methods=['get'], url_path='ticket-activity')
    def ticket_activity(self, request, pk=None):
        """GET /admin/businesses/{id}/ticket-activity/?days=3&ticket=<ticket_pk>"""
        from tenant.models.TicketModel import TicketActivity
        days = min(int(request.query_params.get('days', 3)), 30)
        since = timezone.now() - timedelta(days=days)

        qs = (
            TicketActivity.objects
            .filter(ticket__business_id=pk, timestamp__gte=since)
            .select_related('ticket', 'user')
            .order_by('-timestamp')
        )

        ticket_filter = request.query_params.get('ticket')
        if ticket_filter:
            qs = qs.filter(ticket_id=ticket_filter)

        qs = qs[:300]

        return Response([{
            'id': a.id,
            'ticket_pk': a.ticket_id,
            'ticket_ref': a.ticket.ticket_id if a.ticket else None,
            'ticket_subject': a.ticket.title if a.ticket else None,
            'activity_type': a.activity_type,
            'description': a.description,
            'old_value': a.old_value,
            'new_value': a.new_value,
            'actor': f"{a.user.first_name} {a.user.last_name}".strip() if a.user else 'System',
            'timestamp': a.timestamp.isoformat(),
        } for a in qs])


class AdminUserViewSet(viewsets.ViewSet):
    permission_classes = [IsSuperAdmin]

    def list(self, request):
        """GET /admin/users/?search=<email> — cross-tenant user search."""
        query = request.query_params.get('search', '').strip()
        business_id = request.query_params.get('business')

        qs = Users.objects.filter(category='BUSINESS').select_related('business', 'role')

        if query:
            qs = qs.filter(
                Q(email__icontains=query) |
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query)
            )

        qs = qs.order_by('business__name', 'email')[:100]

        data = [{
            'id': u.id,
            'email': u.email,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'role': u.role.name if u.role else None,
            'status': u.status,
            'is_active': u.is_active,
            'business': u.business_id,
            'business_name': u.business.name if u.business else None,
            'created_at': u.date_joined.isoformat() if u.date_joined else None,
            'last_login': u.last_login.isoformat() if u.last_login else None,
        } for u in qs]

        return Response(data)

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        """PATCH /admin/users/{id}/status/ — enable or disable a user account."""
        try:
            user = Users.objects.get(pk=pk)
        except Users.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        new_status = request.data.get('status')
        if new_status not in ('A', 'I'):
            return Response({'error': 'status must be "A" (active) or "I" (inactive)'}, status=400)

        user.status = new_status
        user.is_active = (new_status == 'A')
        user.save(update_fields=['status', 'is_active'])

        action_name = 'enable_user' if new_status == 'A' else 'disable_user'
        logger.info('[SafariAdmin] User %s status set to %s by admin %s', user.email, new_status, request.user.email)
        _log_action(request.user, action_name, 'User', user.id, user.email, {'status': new_status}, request)

        return Response({'id': user.id, 'email': user.email, 'status': user.status, 'is_active': user.is_active})

    @action(detail=True, methods=['post'], url_path='force-logout')
    def force_logout(self, request, pk=None):
        """POST /admin/users/{id}/force-logout/ — blacklist all outstanding JWT refresh tokens."""
        try:
            user = Users.objects.get(pk=pk)
        except Users.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        blacklisted = 0
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
            outstanding = OutstandingToken.objects.filter(user=user)
            for token in outstanding:
                BlacklistedToken.objects.get_or_create(token=token)
                blacklisted += 1
        except Exception as e:
            logger.warning('[SafariAdmin] force-logout: token blacklist error for user %s: %s', user.email, e)

        logger.info('[SafariAdmin] Force-logged out user %s (%s tokens) by admin %s', user.email, blacklisted, request.user.email)
        _log_action(request.user, 'force_logout', 'User', user.id, user.email, {'tokens_blacklisted': blacklisted}, request)

        return Response({'message': f'User sessions invalidated ({blacklisted} tokens blacklisted).', 'tokens_blacklisted': blacklisted})

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        """POST /admin/users/{id}/reset-password/ — send a password reset email."""
        from RNSafarideskBack.settings import DOMAIN_NAME
        from util.Mailer import Mailer

        try:
            user = Users.objects.get(pk=pk)
        except Users.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        if not user.business or not user.business.domain:
            return Response({'error': 'User has no associated business domain for reset URL.'}, status=400)

        # Rotate last_login to invalidate any prior reset tokens
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        reset_url = f"https://{user.business.domain}.{DOMAIN_NAME}/new-password?token={token}&uid={uid}"

        try:
            Mailer().send_password_reset_link(reset_url, user.email)
        except Exception as e:
            logger.error('[SafariAdmin] reset-password: email error for user %s: %s', user.email, e)
            return Response({'error': 'Failed to send reset email.'}, status=500)

        logger.info('[SafariAdmin] Password reset triggered for user %s by admin %s', user.email, request.user.email)
        _log_action(request.user, 'reset_password', 'User', user.id, user.email, {}, request)

        return Response({'message': f'Password reset email sent to {user.email}.'})


# ---------------------------------------------------------------------------
# System Health View
# ---------------------------------------------------------------------------

class AdminSystemHealthView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        """GET /admin/system/health/ — check DB, Redis, Celery, Channels."""
        result = {}

        # PostgreSQL
        try:
            connection.ensure_connection()
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
            result['database'] = 'ok'
        except Exception as e:
            logger.error('[SafariAdmin] DB health check failed: %s', e)
            result['database'] = 'error'

        # Redis
        try:
            from django.core.cache import cache
            cache.set('_sa_health', '1', 5)
            assert cache.get('_sa_health') == '1'
            result['redis'] = 'ok'
        except Exception as e:
            logger.error('[SafariAdmin] Redis health check failed: %s', e)
            result['redis'] = 'error'

        # Celery workers
        try:
            from celery import current_app
            inspector = current_app.control.inspect(timeout=2.0)
            active = inspector.active()
            if active:
                result['celery'] = 'ok'
                result['celery_workers'] = len(active)
            else:
                result['celery'] = 'error'
                result['celery_workers'] = 0
        except Exception as e:
            logger.warning('[SafariAdmin] Celery health check failed: %s', e)
            result['celery'] = 'error'
            result['celery_workers'] = 0

        # Celery queue depth (default queue)
        try:
            from celery import current_app
            with current_app.connection_for_read() as conn:
                queue = conn.SimpleQueue('celery')
                result['queue_depth'] = queue.qsize()
                queue.close()
        except Exception:
            result['queue_depth'] = None

        # Django Channels (Redis channel layer)
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.send)('_health_check', {'type': 'ping'})
            result['channels'] = 'ok'
        except Exception as e:
            logger.warning('[SafariAdmin] Channels health check failed: %s', e)
            result['channels'] = 'error'

        return Response(result)


# ---------------------------------------------------------------------------
# Failed Logins View
# ---------------------------------------------------------------------------

class AdminFailedLoginsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        """GET /admin/auth/failed-logins/?hours=24&business=<id>"""
        from users.models.FailedLoginModel import FailedLoginAttempt

        try:
            hours = int(request.query_params.get('hours', 24))
            hours = max(1, min(hours, 720))  # clamp 1h–30d
        except (ValueError, TypeError):
            hours = 24

        since = timezone.now() - timedelta(hours=hours)
        qs = FailedLoginAttempt.objects.filter(attempted_at__gte=since).select_related('business')

        business_id = request.query_params.get('business')
        if business_id:
            qs = qs.filter(business_id=business_id)

        data = [{
            'id': a.id,
            'email': a.email,
            'ip_address': a.ip_address,
            'business_name': a.business.name if a.business else None,
            'business_id': a.business_id,
            'reason': a.reason,
            'attempted_at': a.attempted_at.isoformat(),
        } for a in qs]

        return Response(data)


# ---------------------------------------------------------------------------
# Email Filter ViewSet
# ---------------------------------------------------------------------------

class AdminEmailFilterViewSet(viewsets.ViewSet):
    permission_classes = [IsSuperAdmin]

    def list(self, request):
        """GET /admin/email-filters/ — all businesses with their filter rule lists."""
        from tenant.models.MailIntegrationModel import EmailFilterList
        items = EmailFilterList.objects.select_related('business').order_by('business__name')
        return Response([{
            'id': f.id,
            'business_id': f.business_id,
            'business_name': f.business.name if f.business else '—',
            'rules': f.rules,
            'rule_count': len([r for r in f.rules if r and not str(r).startswith('#')]),
            'updated_at': f.updated_at.isoformat(),
        } for f in items])

    @action(detail=True, methods=['put'], url_path='rules')
    def update_rules(self, request, pk=None):
        """PUT /admin/email-filters/{id}/rules/ — replace rules for a filter list."""
        from tenant.models.MailIntegrationModel import EmailFilterList
        try:
            filter_list = EmailFilterList.objects.select_related('business').get(pk=pk)
        except EmailFilterList.DoesNotExist:
            return Response({'error': 'Filter list not found'}, status=404)

        rules = request.data.get('rules')
        if not isinstance(rules, list):
            return Response({'error': 'rules must be a list of strings'}, status=400)
        for r in rules:
            if not isinstance(r, str):
                return Response({'error': 'Each rule must be a string'}, status=400)
            if len(r) > 500:
                return Response({'error': 'Rule too long (max 500 chars)'}, status=400)

        old_count = len(filter_list.rules)
        filter_list.rules = rules
        filter_list.save(update_fields=['rules', 'updated_at'])

        biz_name = filter_list.business.name if filter_list.business else ''
        _log_action(request.user, 'update_email_filters', 'EmailFilter',
                    filter_list.business_id, biz_name,
                    {'old_count': old_count, 'new_count': len(rules)}, request)
        logger.info('[SafariAdmin] Email filters updated for business %s by %s', filter_list.business_id, request.user.email)

        return Response({
            'id': filter_list.id,
            'business_id': filter_list.business_id,
            'rules': filter_list.rules,
            'rule_count': len([r for r in rules if r and not r.startswith('#')]),
        })


# ---------------------------------------------------------------------------
# Email Filter Log View
# ---------------------------------------------------------------------------

class AdminEmailFilterLogView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        """GET /admin/email-filter-log/?business=<id>&days=7"""
        from tenant.models.MailIntegrationModel import EmailFilterLog
        try:
            days = int(request.query_params.get('days', 7))
            days = max(1, min(days, 90))
        except (ValueError, TypeError):
            days = 7

        since = timezone.now() - timedelta(days=days)
        qs = EmailFilterLog.objects.filter(
            blocked_at__gte=since
        ).select_related('business').order_by('-blocked_at')

        business_id = request.query_params.get('business')
        if business_id:
            qs = qs.filter(business_id=business_id)

        return Response([{
            'id': l.id,
            'business_id': l.business_id,
            'business_name': l.business.name if l.business else '—',
            'sender': l.sender,
            'subject': l.subject,
            'rule_matched': l.rule_matched,
            'rule_tier': l.rule_tier,
            'blocked_at': l.blocked_at.isoformat(),
        } for l in qs[:500]])


# ---------------------------------------------------------------------------
# Payments ViewSet
# ---------------------------------------------------------------------------

class AdminPaymentViewSet(viewsets.ViewSet):
    permission_classes = [IsSuperAdmin]

    def list(self, request):
        """GET /admin/payments/?status=paid — all payments across tenants."""
        from shared.models.Payment import Payment
        qs = Payment.objects.select_related('business', 'created_by').order_by('-created_at')
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(payment_status=status_filter)

        return Response([{
            'id': p.id,
            'session_id': p.session_id,
            'payment_intent_id': p.payment_intent_id,
            'payment_status': p.payment_status,
            'amount_total': p.amount_total,
            'amount_in_dollars': p.amount_in_dollars,
            'currency': p.currency,
            'customer_email': p.customer_email,
            'business_id': p.business_id,
            'business_name': p.business.name if p.business else None,
            'metadata': p.metadata,
            'created_at': p.created_at.isoformat() if p.created_at else None,
        } for p in qs[:200]])

    def retrieve(self, request, pk=None):
        """GET /admin/payments/{id}/ — single payment detail."""
        from shared.models.Payment import Payment
        try:
            p = Payment.objects.select_related('business', 'created_by').get(pk=pk)
        except Payment.DoesNotExist:
            return Response({'error': 'Payment not found'}, status=404)

        return Response({
            'id': p.id,
            'session_id': p.session_id,
            'payment_intent_id': p.payment_intent_id,
            'payment_status': p.payment_status,
            'amount_total': p.amount_total,
            'amount_in_dollars': p.amount_in_dollars,
            'currency': p.currency,
            'customer_email': p.customer_email,
            'business_id': p.business_id,
            'business_name': p.business.name if p.business else None,
            'metadata': p.metadata,
            'stripe_response': p.stripe_response,
            'return_url_hit_at': p.return_url_hit_at.isoformat() if p.return_url_hit_at else None,
            'created_at': p.created_at.isoformat() if p.created_at else None,
            'updated_at': p.updated_at.isoformat() if p.updated_at else None,
        })


# ---------------------------------------------------------------------------
# Suspicious Activity View
# ---------------------------------------------------------------------------

class AdminSuspiciousActivityView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        """GET /admin/suspicious-activity/?hours=24"""
        from users.models.SuspiciousActivity import SuspiciousActivity
        try:
            hours = int(request.query_params.get('hours', 24))
            hours = max(1, min(hours, 720))
        except (ValueError, TypeError):
            hours = 24

        since = timezone.now() - timedelta(hours=hours)
        qs = SuspiciousActivity.objects.filter(
            timestamp__gte=since
        ).select_related('user', 'activity_type').order_by('-timestamp')[:500]

        return Response([{
            'id': a.id,
            'user_email': a.user.email if a.user else None,
            'activity_type': a.activity_type.type_name if a.activity_type else '—',
            'description': a.description,
            'ip_address': a.ip_address,
            'timestamp': a.timestamp.isoformat(),
        } for a in qs])


# ---------------------------------------------------------------------------
# Audit Log View
# ---------------------------------------------------------------------------

class AdminAuditLogView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        """GET /admin/audit-log/?action=&admin=&days=30"""
        try:
            days = int(request.query_params.get('days', 30))
            days = max(1, min(days, 365))
        except (ValueError, TypeError):
            days = 30

        since = timezone.now() - timedelta(days=days)
        qs = AdminAuditLog.objects.filter(
            performed_at__gte=since
        ).select_related('admin_user').order_by('-performed_at')

        action_filter = request.query_params.get('action')
        if action_filter:
            qs = qs.filter(action=action_filter)

        admin_filter = request.query_params.get('admin')
        if admin_filter:
            qs = qs.filter(admin_user__email__icontains=admin_filter)

        return Response([{
            'id': a.id,
            'admin_email': a.admin_user.email if a.admin_user else '—',
            'action': a.action,
            'target_type': a.target_type,
            'target_id': a.target_id,
            'target_label': a.target_label,
            'detail': a.detail,
            'ip_address': a.ip_address,
            'performed_at': a.performed_at.isoformat(),
        } for a in qs[:500]])


# ---------------------------------------------------------------------------
# Live Log Tail View (SSE)
# ---------------------------------------------------------------------------

class AdminLogTailView(APIView):
    permission_classes = [IsSuperAdmin]

    SERVICE_CONTAINERS = {
        'web': os.environ.get('LOG_CONTAINER_WEB', 'safaridesk_api'),
        'celery': os.environ.get('LOG_CONTAINER_CELERY', 'safaridesk_celery'),
        'celery-beat': os.environ.get('LOG_CONTAINER_CELERY_BEAT', 'safaridesk_celery_beat'),
        'channels': os.environ.get('LOG_CONTAINER_CHANNELS', 'safaridesk_channels'),
    }

    def get(self, request):
        """GET /admin/logs/tail/?service=web&lines=100"""
        service = request.query_params.get('service', 'web')
        try:
            lines = max(10, min(500, int(request.query_params.get('lines', '100'))))
        except (ValueError, TypeError):
            lines = 100

        container = self.SERVICE_CONTAINERS.get(service)
        if not container:
            return Response({'error': 'Unknown service'}, status=400)

        def event_stream():
            try:
                import docker as docker_sdk
                client = docker_sdk.from_env()
                try:
                    ctr = client.containers.get(container)
                except docker_sdk.errors.NotFound:
                    yield f"data: {json.dumps({'error': f'Container {container!r} not found', 'service': service})}\n\n"
                    return
                for raw_line in ctr.logs(stream=True, follow=True, tail=lines, timestamps=True):
                    line = raw_line.decode('utf-8', errors='replace').rstrip('\n\r')
                    yield f"data: {json.dumps({'line': line, 'service': service})}\n\n"
            except ImportError:
                yield f"data: {json.dumps({'error': 'docker Python package not installed (pip install docker)', 'service': service})}\n\n"
            except Exception as exc:
                # Common cause: Docker socket not mounted — guide the operator
                msg = str(exc)
                if 'socket' in msg.lower() or 'connection' in msg.lower() or 'permission' in msg.lower():
                    msg = 'Cannot reach Docker socket. Mount /var/run/docker.sock into the API container.'
                yield f"data: {json.dumps({'error': msg, 'service': service})}\n\n"

        response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response


# ---------------------------------------------------------------------------
# Integrations Health View
# ---------------------------------------------------------------------------

class AdminIntegrationsView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        """GET /admin/system/integrations/"""
        from shared.models.SlackIntegration import SlackIntegration
        from shared.models.TeamsIntegration import TeamsIntegration
        from shared.models.TwilioSMSMessage import TwilioSMSMessage
        from shared.models.TwilioWhatsAppMessage import TwilioWhatsAppMessage

        businesses = Business.objects.filter(is_active=True).order_by('name')

        slack_bids = set(SlackIntegration.objects.filter(is_active=True).values_list('business_id', flat=True))
        teams_bids = set(TeamsIntegration.objects.filter(is_active=True).values_list('business_id', flat=True))
        twilio_bids = set(TwilioSMSMessage.objects.values_list('business_id', flat=True).distinct())
        whatsapp_bids = set(TwilioWhatsAppMessage.objects.values_list('business_id', flat=True).distinct())

        return Response([{
            'business_id': b.id,
            'business_name': b.name,
            'slack': b.id in slack_bids,
            'teams': b.id in teams_bids,
            'twilio_sms': b.id in twilio_bids,
            'whatsapp': b.id in whatsapp_bids,
        } for b in businesses])


# ---------------------------------------------------------------------------
# Queue Stats View
# ---------------------------------------------------------------------------

class AdminQueueView(APIView):
    permission_classes = [IsSuperAdmin]

    QUEUE_NAMES = ['celery', 'default', 'mail_sync', 'email_processing']

    def get(self, request):
        """GET /admin/system/queue/"""
        try:
            import redis as redis_lib
            from django.conf import settings

            broker_url = getattr(settings, 'CELERY_BROKER_URL', 'redis://localhost:6379/0')
            r = redis_lib.from_url(broker_url, decode_responses=True, socket_connect_timeout=2)

            queues = []
            for name in self.QUEUE_NAMES:
                try:
                    depth = r.llen(name)
                    queues.append({'name': name, 'depth': depth})
                except Exception:
                    queues.append({'name': name, 'depth': 0})

            failed_tasks = []
            try:
                keys = r.keys('celery-task-meta-*')
                for key in keys[:100]:
                    try:
                        raw = r.get(key)
                        if raw:
                            task_data = json.loads(raw)
                            if task_data.get('status') == 'FAILURE':
                                failed_tasks.append({
                                    'task_id': task_data.get('task_id', key),
                                    'name': task_data.get('name', 'unknown'),
                                    'error': str(task_data.get('result', ''))[:200],
                                    'date_done': task_data.get('date_done', ''),
                                })
                    except Exception:
                        pass
            except Exception:
                pass

            return Response({
                'queues': queues,
                'failed_tasks': failed_tasks[:20],
                'total_failed': len(failed_tasks),
            })
        except Exception as exc:
            return Response({
                'queues': [],
                'failed_tasks': [],
                'total_failed': 0,
                'error': str(exc),
            })
