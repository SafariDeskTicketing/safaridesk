from django.db.models import Q, Count, Avg, Max, Min, Sum, F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.paginator import Paginator
from django.db import transaction, IntegrityError
from django.core.cache import cache
from django.conf import settings
from django.http import JsonResponse, Http404
from django.views.decorators.cache import cache_page
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views.decorators.http import require_http_methods

from django.conf import settings
from RNSafarideskBack.settings import FILE_URL

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.exceptions import ValidationError, NotFound
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.pagination import PageNumberPagination

from tenant.models.KnowledgeBase import (
    KBCategory, KBArticle, KBInteraction, KBAnalytics, KBSettings, KBAISuggestion, get_kb_setting
)
from tenant.serializers.KnowledgeBaseSerializer import (
    KBCategorySerializer, KBCategoryDetailSerializer,
    KBArticleSerializer, KBArticleDetailSerializer, KBArticleCreateUpdateSerializer,
    KBInteractionSerializer, KBAnalyticsSerializer, KBSettingsSerializer,
    KBAISuggestionSerializer,
    ARTICLE_DUPLICATE_SLUG_MESSAGE,
)
from tenant.models.AIUsageModel import AIUsageEvent
from tenant.services.ai.usage import (
    AIUsageLimitExceeded,
    current_period_start,
    get_or_create_policy,
    get_usage_snapshot,
)

import hashlib
import os
import uuid
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from PIL import Image


def get_kb_setting_for_business(business_id, key, default=None):
    """Read a KB setting for public business-scoped endpoints."""
    if not business_id:
        return default
    setting = KBSettings.objects.filter(
        business_id=business_id,
        key=key,
        status='A',
    ).first()
    return setting.get_value() if setting else default


# ---------------------------------------------------------------------------
# Role helpers (used by KBSettingsViewSet and the AI suggestion viewsets).
# Defined at module top so every viewset has access without circular refs.
# ---------------------------------------------------------------------------

ADMIN_ROLE_KEYS = {'admin', 'super_admin', 'superuser', 'owner', 'manager'}


def _role_key(user):
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    if getattr(user, 'is_superuser', False):
        return 'superuser'
    if getattr(user, 'is_staff', False):
        return 'admin'
    role = getattr(user, 'role', None)
    role_name = role if isinstance(role, str) else getattr(role, 'name', None)
    return str(role_name).strip().lower().replace(' ', '_') if role_name else None


def _is_kb_admin(user):
    return _role_key(user) in ADMIN_ROLE_KEYS


def _article_duplicate_slug_response():
    return Response(
        {"message": ARTICLE_DUPLICATE_SLUG_MESSAGE, "errors": {"slug": [ARTICLE_DUPLICATE_SLUG_MESSAGE]}},
        status=status.HTTP_400_BAD_REQUEST,
    )


def _is_article_slug_integrity_error(exc):
    cause = getattr(exc, '__cause__', None)
    diag = getattr(cause, 'diag', None)
    constraint_name = (getattr(diag, 'constraint_name', '') or '').lower()
    if constraint_name:
        return all(part in constraint_name for part in ('kb_articles', 'slug', 'business'))

    message = str(cause or exc).lower()
    return (
        'kb_articles' in message
        and 'slug' in message
        and 'business' in message
        and ('unique' in message or 'duplicate' in message)
    )

# CORS mixin for KB endpoints
class CORSMixin:
    """Mixin to add CORS headers to all responses"""
    
    def dispatch(self, request, *args, **kwargs):
        response = super().dispatch(request, *args, **kwargs)
        
        # Add CORS headers
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Origin, Content-Type, Accept, Authorization, X-Requested-With'
        response['Access-Control-Allow-Credentials'] = 'true'
        
        return response
    
    def options(self, request, *args, **kwargs):
        """Handle CORS preflight requests"""
        response = Response(status=200)
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Origin, Content-Type, Accept, Authorization, X-Requested-With'
        response['Access-Control-Allow-Credentials'] = 'true'
        return response


class StandardResultsSetPagination(PageNumberPagination):
    """Standard pagination for KB views"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class KBCategoryViewSet(CORSMixin, viewsets.ModelViewSet):
    """
    Complete Category Management ViewSet
    Handles categories with hierarchy, SEO, and analytics
    """
    serializer_class = KBCategorySerializer
    lookup_field = 'slug'
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
        """Dynamic queryset with explicit business scoping."""
        business_id = self.request.query_params.get('business_id')
        domain_business = getattr(self.request, 'custom_domain_business', None)
        user_business = getattr(self.request.user, 'business', None) if self.request.user.is_authenticated else None

        if self.request.user.is_authenticated:
            if not user_business:
                return KBCategory.objects.none()
            # Prevent authenticated users from pivoting into another tenant via query params.
            if business_id and str(user_business.id) != str(business_id):
                return KBCategory.objects.none()
            return KBCategory.objects.filter(
                business=user_business,
                status='A',
            ).order_by('sort_order', 'name')

        scoped_business_id = str(business_id) if business_id else str(domain_business.id) if domain_business else None
        if not scoped_business_id:
            return KBCategory.objects.none()

        if not get_kb_setting_for_business(scoped_business_id, 'allow_public_access', True):
            return KBCategory.objects.none()

        return (
            KBCategory.objects.filter(
                business_id=scoped_business_id,
                status='A',
                is_public=True,
            )
            .exclude(name__iexact='internal')
            .order_by('sort_order', 'name')
        )
    
    def get_serializer_class(self):
        """Dynamic serializer selection based on action"""
        if self.action == 'retrieve':
            return KBCategoryDetailSerializer
        return KBCategorySerializer
    
    def get_permissions(self):
        """Dynamic permissions based on action"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [AllowAny]
        return [permission() for permission in permission_classes]

    @action(detail=True, methods=['get'])
    def articles(self, request, slug=None):
        """Get all published articles in a category"""
        category = self.get_object()
        articles = KBArticle.objects.for_business().filter(
            category=category,
            status='published',
            is_public=True
        ).order_by('-published_at')

        # Apply search filter
        search = request.GET.get('search', '')
        if search:
            articles = articles.filter(
                Q(title__icontains=search) | 
                Q(content__icontains=search) |
                Q(excerpt__icontains=search)
            )
        
        # Apply difficulty filter
        # difficulty = request.GET.get('difficulty', '')
        # if difficulty:
        #     articles = articles.filter(difficulty_level=difficulty)
        
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(articles, request)
        
        # Simple serialization for now
        articles_data = []
        for article in page:
            articles_data.append({
                'id': article.id,
                'title': article.title,
                'slug': article.slug,
                'excerpt': article.excerpt,
                'view_count': article.view_count,
                'helpful_count': article.helpful_count,
                'published_at': article.published_at,
                'reading_time': article.reading_time,
                # 'difficulty_level': article.difficulty_level, # Commented out as requested
            })
        
        return paginator.get_paginated_response(articles_data)
    
    @action(detail=False, methods=['get'])
    def tree(self, request):
        """Get hierarchical category tree with article counts"""
        def build_tree(categories):
            tree = []
            for category in categories:
                children = KBCategory.objects.filter(
                    business_id=category.business_id,
                    parent=category,
                    status='A',
                ).order_by('sort_order', 'name')
                tree.append({
                    'id': category.id,
                    'name': category.name,
                    'slug': category.slug,
                    'description': category.description,
                    'icon': category.icon,
                    'color': category.color,
                    'article_count': category.article_count,
                    'children': build_tree(children) if children.exists() else []
                })
            return tree
        
        root_categories = KBCategory.objects.for_business().filter(
            parent=None, 
            status='A'
        ).order_by('sort_order', 'name')
        
        return Response(build_tree(root_categories))

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def public_list(self, request):
        """
        Provides a list of all public KB categories for a specific business,
        including the count of published articles in each. Not paginated.
        """
        business_id = request.query_params.get('business_id')
        if not business_id:
            return Response({'error': 'Business ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        if not get_kb_setting_for_business(business_id, 'allow_public_access', True):
            return Response([])

        categories = KBCategory.objects.filter(
            business_id=business_id,
            status='A',
            is_public=True,
        ).exclude(
            name__iexact='internal'
        ).annotate(
            published_article_count=Count(
                'articles',
                filter=Q(articles__status='published', articles__is_public=True)
            )
        ).order_by('sort_order', 'name')

        data = [{
            'id': category.id,
            'name': category.name,
            'slug': category.slug,
            'description': category.description,
            'icon': category.icon,
            'color': category.color,
            'article_count': category.published_article_count
        } for category in categories]

        return Response(data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def count(self, request):
        """Get count of categories for the current business"""
        queryset = self.get_queryset()
        count = queryset.count()
        return Response({'count': count}, status=status.HTTP_200_OK)


class KBArticleViewSet(CORSMixin, viewsets.ModelViewSet):
    """
    Complete Article Management ViewSet
    Handles articles with SEO, analytics, versioning, and interactions
    """
    serializer_class = KBArticleSerializer
    lookup_field = 'slug'
    pagination_class = StandardResultsSetPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['title', 'content', 'excerpt', 'tags']
    ordering_fields = ['created_at', 'published_at', 'view_count', 'helpful_count']
    ordering = ['-published_at', '-created_at']

    def _get_role_key(self, user):
        if getattr(user, 'is_superuser', False):
            return 'superuser'
        if getattr(user, 'is_staff', False):
            return 'admin'
        role = getattr(user, 'role', None)
        role_name = role if isinstance(role, str) else getattr(role, 'name', None)
        return str(role_name).strip().lower().replace(' ', '_') if role_name else None

    def _resolve_queryset_business(self):
        """
        Resolve tenant scope for article reads.

        Rules:
        - Authenticated users are always scoped to their own business.
        - Anonymous/public requests must provide business_id or come via custom domain.
        - If an authenticated user passes a different business_id, return no rows.
        """
        request = self.request
        explicit_business_id = request.query_params.get('business_id')
        domain_business = getattr(request, 'custom_domain_business', None)

        if request.user.is_authenticated:
            user_business = getattr(request.user, 'business', None)
            if not user_business:
                return None
            if explicit_business_id and str(user_business.id) != str(explicit_business_id):
                return None
            return user_business

        if explicit_business_id:
            return explicit_business_id
        if domain_business:
            return domain_business
        return None
    
    def get_queryset(self):
        """Filter articles based on user permissions and status"""
        business_scope = self._resolve_queryset_business()
        if business_scope is None:
            return KBArticle.objects.none()

        if isinstance(business_scope, str):
            queryset = KBArticle.objects.filter(business_id=business_scope)
        else:
            queryset = KBArticle.objects.filter(business=business_scope)
        
        # Apply status filter from query params
        status_filter = self.request.GET.get('status', '')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by status for non-authenticated users
        if not self.request.user.is_authenticated:
            business_id = business_scope if isinstance(business_scope, str) else str(business_scope.id)
            if not get_kb_setting_for_business(business_id, 'allow_public_access', True):
                return KBArticle.objects.none()
            queryset = queryset.filter(
                status='published',
                is_public=True,
                category__is_public=True,
                category__status='A',
            )
        elif not self.request.user.is_staff and not status_filter:
            # Regular users can see published articles + their own drafts
            queryset = queryset.filter(
                Q(status='published', is_public=True) |
                Q(author=self.request.user)
            )
        
        # Apply other filters
        category_slug = self.request.GET.get('category', '') or self.request.GET.get('category_slug', '')
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)
        
        # difficulty = self.request.GET.get('difficulty', '')
        # if difficulty:
        #     queryset = queryset.filter(difficulty_level=difficulty)
        
        is_featured = self.request.GET.get('featured', '')
        if is_featured == 'true':
            queryset = queryset.filter(is_featured=True)
        
        language = self.request.GET.get('language', '')
        if language:
            queryset = queryset.filter(language=language)
        
        return queryset
    
    def get_serializer_class(self):
        """Dynamic serializer selection based on action"""
        if self.action == 'retrieve':
            return KBArticleDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return KBArticleCreateUpdateSerializer
        return KBArticleSerializer

    def get_object(self):
        """Support public article paths like 123-reset-password while keeping slug lookups."""
        queryset = self.filter_queryset(self.get_queryset())
        lookup_value = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)

        if lookup_value:
            normalized = str(lookup_value).strip().lower()
            obj = None
            if normalized.startswith('article') and normalized[7:].isdigit():
                obj = queryset.filter(pk=int(normalized[7:])).first()
            else:
                id_part = normalized.split('-', 1)[0]
                if id_part.isdigit():
                    obj = queryset.filter(pk=int(id_part)).first()

            if obj is None:
                obj = get_object_or_404(queryset, **{self.lookup_field: lookup_value})
        else:
            obj = get_object_or_404(queryset)

        self.check_object_permissions(self.request, obj)
        return obj
    
    def get_permissions(self):
        """Dynamic permissions based on action"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [AllowAny]
        return [permission() for permission in permission_classes]

    def _apply_visibility_rules(self, validated_data, instance=None):
        allow_override = get_kb_setting('allow_article_visibility_override', False)
        category = validated_data.get('category') or getattr(instance, 'category', None)

        if category and not category.is_public:
            validated_data['is_public'] = False
        elif not allow_override:
            validated_data['is_public'] = True
    
    def create(self, request, *args, **kwargs):
        """Create a new article with approval workflow"""
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            self.perform_create(serializer)
        except IntegrityError as exc:
            if _is_article_slug_integrity_error(exc):
                return _article_duplicate_slug_response()
            raise
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        """Save article with approval workflow logic"""
        # Check if approval is required from settings
        require_approval = get_kb_setting('require_approval', True)
        default_status = get_kb_setting('default_article_status', 'draft')
        
        # Get the requested status from the serializer
        requested_status = serializer.validated_data.get('status') or default_status
        serializer.validated_data['status'] = requested_status
        self._apply_visibility_rules(serializer.validated_data)
        
        # Apply approval workflow logic
        if require_approval and requested_status == 'published':
            # If approval is required and user wants to publish
            # Only admins (role='admin' or 'super_admin') can publish directly
            role_key = self._get_role_key(self.request.user)
            if role_key not in ['admin', 'super_admin', 'superuser']:
                # Agents and other users need approval - set to draft
                serializer.validated_data['status'] = 'draft'
                # Add a flag to indicate this needs approval
                if 'metadata' not in serializer.validated_data:
                    serializer.validated_data['metadata'] = {}
                serializer.validated_data['metadata']['pending_approval'] = True
                serializer.validated_data['metadata']['requested_status'] = 'published'
        
        # Set the author to the current user
        serializer.save(author=self.request.user)

    def update(self, request, *args, **kwargs):
        """Update article with approval workflow"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            self.perform_update(serializer)
        except IntegrityError as exc:
            if _is_article_slug_integrity_error(exc):
                return _article_duplicate_slug_response()
            raise
        return Response(serializer.data)

    def perform_update(self, serializer):
        """Save article updates with approval workflow logic"""
        # Check if approval is required from settings
        require_approval = get_kb_setting('require_approval', True)
        self._apply_visibility_rules(serializer.validated_data, serializer.instance)
        
        # Get the requested status from the serializer
        requested_status = serializer.validated_data.get('status', None)
        current_status = serializer.instance.status
        
        # Apply approval workflow logic only if status is changing to published
        if require_approval and requested_status == 'published' and current_status != 'published':
            # Only admins (role='admin' or 'super_admin') can publish directly
            role_key = self._get_role_key(self.request.user)
            if role_key not in ['admin', 'super_admin', 'superuser']:
                # Agents and other users need approval - set to draft
                serializer.validated_data['status'] = 'draft'
                # Add a flag to indicate this needs approval
                if 'metadata' not in serializer.validated_data:
                    serializer.validated_data['metadata'] = serializer.instance.metadata or {}
                serializer.validated_data['metadata']['pending_approval'] = True
                serializer.validated_data['metadata']['requested_status'] = 'published'
        
        # Save the updated article
        serializer.save()

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def count(self, request):
        """Get count of articles for the current business"""
        queryset = self.get_queryset()
        count = queryset.count()
        return Response({'count': count}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def approve(self, request, slug=None):
        """Approve an article for publication (admin only)"""
        role_key = self._get_role_key(request.user)
        if role_key not in ['admin', 'super_admin', 'superuser']:
            return Response(
                {'error': 'Permission denied. Only admins can approve articles.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        article = self.get_object()
        
        # Update article status to published
        article.status = 'published'
        article.published_at = timezone.now()
        
        # Update metadata to remove pending approval
        if article.metadata:
            article.metadata.pop('pending_approval', None)
            article.metadata.pop('requested_status', None)
            article.metadata['approved_by'] = request.user.id
            article.metadata['approved_at'] = timezone.now().isoformat()
        else:
            article.metadata = {
                'approved_by': request.user.id,
                'approved_at': timezone.now().isoformat()
            }
        
        article.save()
        
        # TODO: Send notification to article author about approval
        
        return Response({
            'message': 'Article approved successfully',
            'status': 'published'
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def reject(self, request, slug=None):
        """Reject an article submission (admin only)"""
        role_key = self._get_role_key(request.user)
        if role_key not in ['admin', 'super_admin', 'superuser']:
            return Response(
                {'error': 'Permission denied. Only admins can reject articles.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        article = self.get_object()
        reason = request.data.get('reason', 'No reason provided')
        
        # Update metadata to record rejection
        if article.metadata:
            article.metadata.pop('pending_approval', None)
            article.metadata.pop('requested_status', None)
            article.metadata['rejected_by'] = request.user.id
            article.metadata['rejected_at'] = timezone.now().isoformat()
            article.metadata['rejection_reason'] = reason
        else:
            article.metadata = {
                'rejected_by': request.user.id,
                'rejected_at': timezone.now().isoformat(),
                'rejection_reason': reason
            }
        
        # Keep article as draft
        article.status = 'draft'
        article.save()
        
        # TODO: Send notification to article author about rejection
        
        return Response({
            'message': 'Article rejected successfully',
            'status': 'draft',
            'reason': reason
        })
        
    def retrieve(self, request, *args, **kwargs):
        """Get article and track view"""
        instance = self.get_object()

        is_public_article = (
            instance.status == 'published' and
            instance.is_public and
            instance.category and
            instance.category.is_public and
            instance.category.status == 'A'
        )
        # Internal staff/admin article reads should not inflate public KB analytics.
        analytics_enabled = get_kb_setting_for_business(instance.business_id, 'analytics_enabled', True)
        should_track_view = is_public_article and analytics_enabled and not request.user.is_authenticated

        if should_track_view:
            session_key = request.session.session_key or ''
            ip_address = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '')
            user_agent = request.META.get('HTTP_USER_AGENT', '')
            referrer = request.META.get('HTTP_REFERER', '')

            if session_key:
                viewer_key = f'session:{session_key}'
            else:
                fingerprint = hashlib.sha256(f'{ip_address}|{user_agent}'.encode('utf-8')).hexdigest()[:24]
                viewer_key = f'anon:{fingerprint}'

            cache_key = f'kb_view:{instance.business_id}:{instance.id}:{viewer_key}'
            # Atomic add prevents duplicate increments when React StrictMode or
            # fast repeated requests hit the article endpoint at the same time.
            should_count = cache.add(cache_key, True, 30 * 60)

            if should_count:
                KBArticle.objects.filter(pk=instance.pk).update(view_count=F('view_count') + 1)
                instance.refresh_from_db(fields=['view_count'])

                KBAnalytics.objects.create(
                    article=instance,
                    category=instance.category,
                    business_id=instance.business_id,
                    event_type='view',
                    user=None,
                    session_id=session_key or viewer_key,
                    ip_address=ip_address or None,
                    user_agent=user_agent,
                    referrer=referrer,
                )
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def helpful(self, request, slug=None):
        """Mark article as helpful or not helpful"""
        article = self.get_object()
        if not get_kb_setting_for_business(article.business_id, 'enable_ratings', True):
            return Response(
                {'error': 'Article ratings are disabled'},
                status=status.HTTP_400_BAD_REQUEST
            )

        is_helpful = request.data.get('is_helpful', True)
        
        # Ensure session exists for anonymous users
        if not request.session.session_key:
            request.session.create()
        
        # Check if user already voted
        session_key = request.session.session_key or 'anonymous'
        ip_address = request.META.get('REMOTE_ADDR', '')
        
        existing_vote = None
        if request.user.is_authenticated:
            # For authenticated users, check by user and interaction type
            existing_vote = KBInteraction.objects.filter(
                article=article,
                user=request.user,
                interaction_type__in=['helpful', 'not_helpful']
            ).first()
        else:
            # For anonymous users, check by session and IP 
            existing_vote = KBInteraction.objects.filter(
                article=article,
                user__isnull=True,
                session_id=session_key,
                interaction_type__in=['helpful', 'not_helpful']
            ).first()
        
        if existing_vote:
            return Response(
                {'error': 'You have already voted on this article'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create vote interaction
        interaction_type = 'helpful' if is_helpful else 'not_helpful'
        
        try:
            # Try to create the interaction
            # The save() method will automatically increment the counter
            interaction = KBInteraction.objects.create(
                article=article,
                business_id=article.business_id,
                user=request.user if request.user.is_authenticated else None,
                interaction_type=interaction_type,
                is_helpful=is_helpful,
                session_id=session_key,
                ip_address=ip_address,
                metadata={'user_agent': request.META.get('HTTP_USER_AGENT', '')}
            )
            
            # Refresh article to get updated counts
            article.refresh_from_db()
            
            return Response({
                'message': 'Vote recorded successfully',
                'helpful_count': article.helpful_count,
                'not_helpful_count': article.not_helpful_count,
                'helpful_percentage': article.helpful_percentage
            })
            
        except Exception as e:
            # If creation fails (likely due to unique constraint), return error
            return Response(
                {'error': 'Unable to record vote. You may have already voted.'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, slug=None):
        """Get or create comments for an article"""
        article = self.get_object()
        
        if request.method == 'GET':
            comments = KBInteraction.objects.for_business().filter(
                article=article,
                interaction_type='comment',
                is_approved=True,
                is_public=True
            ).order_by('-created_at')
            
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(comments, request)
            serializer = KBInteractionSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        
        elif request.method == 'POST':
            if not get_kb_setting_for_business(article.business_id, 'enable_comments', True):
                return Response(
                    {'error': 'Comments are disabled'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            content = request.data.get('content', '').strip()
            if not content:
                return Response(
                    {'error': 'Comment content is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create comment
            # The save() method will automatically increment the counter
            comment = KBInteraction.objects.create(
                article=article,
                business_id=article.business_id,
                user=request.user if request.user.is_authenticated else None,
                interaction_type='comment',
                content=content,
                is_approved=True,  # Auto-approve for now
                session_id=request.session.session_key,
                ip_address=request.META.get('REMOTE_ADDR'),
                metadata={'user_agent': request.META.get('HTTP_USER_AGENT', '')}
            )
            
            serializer = KBInteractionSerializer(comment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def public_articles(self, request):
        """
        Provides a list of public, published knowledge base articles.
        This endpoint is designed for unauthenticated access from customer portals.
        """
        business_id = self.request.query_params.get('business_id')
        if not business_id:
            return Response({'results': [], 'count': 0})

        if not get_kb_setting_for_business(business_id, 'allow_public_access', True):
            return Response({'results': [], 'count': 0, 'public_access': False})

        queryset = KBArticle.objects.filter(
            business_id=business_id,
            status='published',
            is_public=True,
            category__is_public=True,
            category__status='A',
        )
        
        # Add category filtering by slug
        category_slug = self.request.query_params.get('category_slug', '') or self.request.query_params.get('category', '')
        if category_slug:
            try:
                # Ensure the category belongs to the same business to prevent data leakage
                category = KBCategory.objects.get(business_id=business_id, slug=category_slug)
                queryset = queryset.filter(category=category)
            except KBCategory.DoesNotExist:
                # If an invalid category slug is passed, return no articles
                queryset = queryset.none()

        queryset = queryset.order_by('-published_at')
        
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        
        serializer = self.get_serializer(page, many=True)
        
        return paginator.get_paginated_response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def public_search(self, request):
        """
        Provides a public search endpoint for knowledge base articles,
        scoped to a specific business.
        """
        business_id = self.request.query_params.get('business_id')
        query = self.request.query_params.get('q', '')

        if not business_id:
            return Response({'error': 'Business ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        if not get_kb_setting_for_business(business_id, 'allow_public_access', True):
            return Response({'results': [], 'count': 0, 'public_access': False})

        if not get_kb_setting_for_business(business_id, 'enable_search', True):
            return Response({'results': [], 'count': 0, 'search_enabled': False})
        
        if not query:
            return Response({'results': [], 'count': 0})

        queryset = KBArticle.objects.filter(
            Q(title__icontains=query) |
            Q(content__icontains=query) |
            Q(excerpt__icontains=query),
            business_id=business_id,
            status='published',
            is_public=True,
            category__is_public=True,
            category__status='A',
        ).order_by('-published_at')

        category_slug = self.request.query_params.get('category_slug', '') or self.request.query_params.get('category', '')
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = self.get_serializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
        

    @action(detail=False, methods=['get'])
    def search(self, request):
        """Advanced search with filters and analytics"""
        query = request.GET.get('q', '')
        if not query:
            return Response({'results': [], 'count': 0})
        
        # Build search query
        articles = self.get_queryset().filter(
            Q(title__icontains=query) |
            Q(content__icontains=query) |
            Q(excerpt__icontains=query) |
            Q(tags__icontains=query) |
            Q(metadata__icontains=query)  # Search in metadata as well
        )
        
        # Track search
        scope = self._resolve_queryset_business()
        if isinstance(scope, str):
            scoped_business_id = int(scope) if scope.isdigit() else None
        else:
            scoped_business_id = getattr(scope, 'id', None) if scope is not None else None
        if request.user.is_authenticated:
            scoped_business_id = getattr(request.user, 'business_id', scoped_business_id)

        KBAnalytics.objects.create(
            business_id=scoped_business_id,
            event_type='search',
            user=request.user if request.user.is_authenticated else None,
            ip_address=request.META.get('REMOTE_ADDR', ''),
            event_data={
                'query': query,
                'results_count': articles.count(),
                'timestamp': timezone.now().isoformat(),
            }
        )
        
        # Paginate results
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(articles, request)
        
        # Simple serialization
        results = []
        for article in page:
            results.append({
                'id': article.id,
                'title': article.title,
                'slug': article.slug,
                'excerpt': article.excerpt,
                'category': article.category.name,
                'view_count': article.view_count,
                'helpful_count': article.helpful_count,
                'published_at': article.published_at,
                'reading_time': article.reading_time,
                # 'difficulty_level': article.difficulty_level, # Commented out as requested
            })
        
        return paginator.get_paginated_response(results)
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured articles"""
        articles = self.get_queryset().filter(
            is_featured=True,
            status='published',
            is_public=True
        ).order_by('-published_at')[:10]
        
        results = []
        for article in articles:
            results.append({
                'id': article.id,
                'title': article.title,
                'slug': article.slug,
                'excerpt': article.excerpt,
                'category': article.category.name,
                'view_count': article.view_count,
                'helpful_count': article.helpful_count,
                'published_at': article.published_at,
                'reading_time': article.reading_time,
            })
        
        return Response(results)
    
    @action(detail=False, methods=['get'])
    def popular(self, request):
        """Get popular articles based on view count"""
        articles = self.get_queryset().filter(
            status='published',
            is_public=True
        ).order_by('-view_count')[:10]
        
        results = []
        for article in articles:
            results.append({
                'id': article.id,
                'title': article.title,
                'slug': article.slug,
                'excerpt': article.excerpt,
                'category': article.category.name,
                'view_count': article.view_count,
                'helpful_count': article.helpful_count,
                'published_at': article.published_at,
                'reading_time': article.reading_time,
            })
        
        return Response(results)
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def upload_image(self, request):
        """Upload an image for articles"""
        if 'image' not in request.FILES:
            return Response({'error': 'No image file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        image_file = request.FILES['image']
        
        # Validate file type by both extension and MIME type
        allowed_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
        allowed_mime_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        
        file_extension = os.path.splitext(image_file.name)[1].lower()
        content_type = image_file.content_type
        
        # Check extension
        if file_extension not in allowed_extensions:
            return Response({
                'error': f'Invalid file extension: {file_extension}. Allowed types: JPG, JPEG, PNG, GIF, WEBP'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check MIME type
        if content_type not in allowed_mime_types:
            return Response({
                'error': f'Invalid file type: {content_type}. Allowed types: {", ".join(allowed_mime_types)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file size (max 5MB)
        if image_file.size > 5 * 1024 * 1024:
            return Response({
                'error': 'File too large. Maximum size is 5MB'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Generate unique filename
            unique_filename = f"{uuid.uuid4()}{file_extension}"

            # Save under MEDIA_ROOT/files/ — matches the pattern used by SettingView (logo/favicon)
            # so that Django's /uploads/files/<filename> route resolves correctly.
            upload_dir = os.path.join(settings.MEDIA_ROOT, 'files')
            os.makedirs(upload_dir, exist_ok=True)

            # Save the file
            file_path = os.path.join(upload_dir, unique_filename)
            with open(file_path, 'wb+') as destination:
                for chunk in image_file.chunks():
                    destination.write(chunk)

            # FILE_URL is normally http://host/uploads/files. If it is unset, build
            # the same public files URL from FILE_BASE_URL instead of returning /uuid.png.
            file_base_url = (FILE_URL or '').rstrip('/')
            if not file_base_url:
                origin = (getattr(settings, 'FILE_BASE_URL', '') or '').rstrip('/')
                file_base_url = f"{origin}/uploads/files" if origin else '/uploads/files'
            file_url = f"{file_base_url}/{unique_filename}"

            return Response({
                'url': file_url,
                'name': image_file.name,
                'path': unique_filename
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({
                'error': f'Upload failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def upload_featured_image(self, request, slug=None):
        """Upload a featured image for an article"""
        article = self.get_object()
        
        if 'image' not in request.FILES:
            return Response({'error': 'No image file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        image_file = request.FILES['image']
        
        # Validate and upload using the same logic as general image upload
        upload_response = self.upload_image(request)
        
        if upload_response.status_code == 201:
            # Update article metadata with featured image
            if not article.metadata:
                article.metadata = {}
            
            article.metadata['featured_image'] = upload_response.data['url']
            article.save()
            
            return Response({
                'message': 'Featured image uploaded successfully',
                'url': upload_response.data['url'],
                'article': article.slug
            }, status=status.HTTP_200_OK)
        
        return upload_response


class KBAnalyticsViewSet(CORSMixin, viewsets.ReadOnlyModelViewSet):
    """
    Analytics ViewSet for Knowledge Base metrics
    Provides insights and performance data
    """
    serializer_class = KBAnalyticsSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Dynamic queryset with business filtering"""
        return KBAnalytics.objects.for_business()
    
    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Get dashboard analytics"""
        # Date range
        days = int(request.GET.get('days', 7))
        start_date = timezone.now() - timezone.timedelta(days=days)
        
        # Basic metrics
        total_articles = KBArticle.objects.for_business().filter(status='published').count()
        total_categories = KBCategory.objects.for_business().filter(status='A').count()
        
        # Views in period
        period_views = KBAnalytics.objects.for_business().filter(
            event_type='view',
            timestamp__gte=start_date
        ).count()
        
        # Popular articles
        popular_articles = KBArticle.objects.for_business().filter(
            status='published'
        ).order_by('-view_count')[:5]
        
        # Search queries
        search_queries = KBAnalytics.objects.for_business().filter(
            event_type='search',
            timestamp__gte=start_date
        ).values_list('event_data', flat=True)
        
        popular_articles_data = []
        for article in popular_articles:
            popular_articles_data.append({
                'title': article.title,
                'slug': article.slug,
                'view_count': article.view_count,
                'helpful_count': article.helpful_count,
                'category': article.category.name,
            })
        
        return Response({
            'total_articles': total_articles,
            'total_categories': total_categories,
            'period_views': period_views,
            'popular_articles': popular_articles_data,
            'search_count': len(search_queries),
            'period_days': days,
        })

    @action(detail=False, methods=['get'])
    def activity_feed(self, request):
        """Get recent knowledge base activity for dashboard"""
        limit = int(request.GET.get('limit', 10))
        
        activities = []
        
        # Get recent article publications (approved articles)
        recent_published = KBArticle.objects.for_business().filter(
            status='published',
            published_at__isnull=False,
            metadata__icontains='approved_by'
        ).order_by('-published_at')[:limit//2]
        
        for article in recent_published:
            activities.append({
                'id': f'approve-{article.id}',
                'type': 'approved',
                'article': {
                    'title': article.title,
                    'slug': article.slug,
                    'author': article.author.get_full_name() if article.author else 'Unknown'
                },
                'user': f'Admin User',  # Could get from metadata['approved_by'] if needed
                'timestamp': article.published_at.isoformat() if article.published_at else article.updated_at.isoformat(),
            })
        
        # Get recent article submissions (draft articles with pending_approval)
        recent_submissions = KBArticle.objects.for_business().filter(
            status='draft',
            metadata__icontains='pending_approval'
        ).order_by('-updated_at')[:limit//2]
        
        for article in recent_submissions:
            activities.append({
                'id': f'submit-{article.id}',
                'type': 'submitted',
                'article': {
                    'title': article.title,
                    'slug': article.slug,
                    'author': article.author.get_full_name() if article.author else 'Unknown'
                },
                'user': article.author.get_full_name() if article.author else 'Unknown',
                'timestamp': article.updated_at.isoformat(),
            })
        
        # Get recent rejections
        recent_rejections = KBArticle.objects.for_business().filter(
            status='draft',
            metadata__icontains='rejected_by'
        ).order_by('-updated_at')[:limit//4]
        
        for article in recent_rejections:
            rejection_reason = ''
            if article.metadata and 'rejection_reason' in article.metadata:
                rejection_reason = article.metadata['rejection_reason']
            
            activities.append({
                'id': f'reject-{article.id}',
                'type': 'rejected',
                'article': {
                    'title': article.title,
                    'slug': article.slug,
                    'author': article.author.get_full_name() if article.author else 'Unknown'
                },
                'user': 'Admin User',  # Could get from metadata['rejected_by'] if needed
                'timestamp': article.updated_at.isoformat(),
                'metadata': {
                    'rejection_reason': rejection_reason
                } if rejection_reason else {}
            })
        
        # Sort all activities by timestamp (most recent first)
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # Return only the requested limit
        return Response(activities[:limit])
        

class KBSettingsViewSet(CORSMixin, viewsets.ModelViewSet):
    """
    Settings ViewSet for Knowledge Base configuration
    """
    serializer_class = KBSettingsSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'key'
    # Settings are a small config set; return full list so UI save verification
    # can compare all keys without paging gaps.
    pagination_class = None

    def _resolve_business(self, request):
        """
        Resolve workspace context for settings reads/writes.

        Prefer custom-domain business when available; otherwise fall back to the
        authenticated user's business relation.
        """
        return getattr(request, 'custom_domain_business', None) or getattr(request.user, 'business', None)

    def _get_business_or_error(self, request):
        business = self._resolve_business(request)
        if business is None:
            return None, Response(
                {'error': 'No workspace context found for this user/session.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return business, None

    def _ensure_admin_write_access(self, request):
        if _is_kb_admin(request.user):
            return None
        return Response(
            {'error': 'Permission denied. Only admins can modify settings.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    def get_queryset(self):
        """Dynamic queryset with business filtering"""
        business = self._resolve_business(self.request)
        if business is None:
            return KBSettings.objects.none()
        return KBSettings.objects.filter(business=business)
    
    def get_permissions(self):
        """Dynamic permissions based on action"""
        if self.action == 'public':
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def create(self, request, *args, **kwargs):
        """
        Upsert a setting for the current business.

        The frontend settings page posts every key on Save — we treat POST as
        an upsert by (business, key) so callers don't need to know whether
        the row already exists. Global uniqueness on `key` was removed in
        migration 0056; we now use the composite (key, business) unique.
        """
        permission_error = self._ensure_admin_write_access(request)
        if permission_error:
            return permission_error

        business, business_error = self._get_business_or_error(request)
        if business_error:
            return business_error

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        data['business'] = business

        key = data.get('key')
        business = data.get('business')
        existing = KBSettings.objects.filter(key=key, business=business).first() if key else None

        if existing is not None:
            # Only update fields the caller actually sent, so we don't clobber
            # stored metadata (like `label`) when the frontend only re-sends value.
            for field in [
                'value', 'value_type', 'category', 'default_value',
                'label', 'description', 'help_text',
                'is_public', 'is_required', 'is_editable',
                'validation_rules', 'sort_order',
            ]:
                if field in serializer.validated_data:
                    setattr(existing, field, serializer.validated_data[field])
            existing.save()
            return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)

        setting = serializer.save(business=business)
        return Response(self.get_serializer(setting).data, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        """Update an existing setting by key"""
        permission_error = self._ensure_admin_write_access(request)
        if permission_error:
            return permission_error

        business, business_error = self._get_business_or_error(request)
        if business_error:
            return business_error
            
        key = kwargs.get('key')
        
        try:
            setting = KBSettings.objects.get(key=key, business=business)
        except KBSettings.DoesNotExist:
            return Response({'error': f'Setting with key "{key}" not found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        
        value = request.data.get('value')
        if value is not None:
            setting.value = str(value) if not isinstance(value, str) else value

        for field in [
            'value_type',
            'category',
            'label',
            'description',
            'help_text',
            'is_public',
            'is_required',
            'is_editable',
            'validation_rules',
            'sort_order',
        ]:
            if field in request.data:
                setattr(setting, field, request.data[field])

        setting.save()
            
        serializer = self.get_serializer(setting)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        """PATCH should follow the same auth + tenant scope rules as PUT."""
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Delete an existing setting by key"""
        permission_error = self._ensure_admin_write_access(request)
        if permission_error:
            return permission_error

        business, business_error = self._get_business_or_error(request)
        if business_error:
            return business_error

        key = kwargs.get('key')
        deleted, _ = KBSettings.objects.filter(key=key, business=business).delete()
        if deleted == 0:
            return Response(
                {'error': f'Setting with key "{key}" not found'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    def retrieve(self, request, *args, **kwargs):
        """Get a specific setting by key"""
        key = kwargs.get('key')
        business, business_error = self._get_business_or_error(request)
        if business_error:
            return business_error
        
        try:
            setting = KBSettings.objects.get(key=key, business=business)
        except KBSettings.DoesNotExist:
            return Response({'error': f'Setting with key "{key}" not found'}, 
                          status=status.HTTP_404_NOT_FOUND)
        
        serializer = self.get_serializer(setting)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def public(self, request):
        """Get public settings that can be accessed by all users"""
        business_id = request.query_params.get('business_id')
        business = getattr(request, 'custom_domain_business', None)

        if business_id:
            public_settings = KBSettings.objects.filter(
                business_id=business_id,
                is_public=True,
                status='A',
            )
        elif business:
            public_settings = KBSettings.objects.filter(
                business=business,
                is_public=True,
                status='A',
            )
        elif request.user.is_authenticated:
            user_business = getattr(request.user, 'business', None)
            if user_business is None:
                public_settings = KBSettings.objects.none()
            else:
                public_settings = KBSettings.objects.filter(
                    business=user_business,
                    is_public=True,
                    status='A',
                )
        else:
            public_settings = KBSettings.objects.none()
        
        settings_data = {}
        for setting in public_settings:
            settings_data[setting.key] = setting.get_value()

        return Response(settings_data)


# ---------------------------------------------------------------------------
# KB AI Suggestions
# ---------------------------------------------------------------------------
# Role helpers (ADMIN_ROLE_KEYS / _role_key / _is_kb_admin) are defined near
# the top of this module so every viewset can share them.


class KBAISuggestionViewSet(CORSMixin, viewsets.ModelViewSet):
    """
    Admin-only endpoint for browsing and acting on AI-generated KB suggestions.

    Read endpoints degrade gracefully when the learning feature is off — they
    just return an empty list rather than 403, so the frontend tab can hide
    itself cleanly.
    """
    serializer_class = KBAISuggestionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = KBAISuggestion.objects.for_business().filter(status='A')
        kind = self.request.query_params.get('kind')
        if kind in {'new_article', 'update_article'}:
            qs = qs.filter(kind=kind)
        review_status = self.request.query_params.get('review_status')
        if review_status in {'pending', 'approved', 'rejected', 'superseded'}:
            qs = qs.filter(review_status=review_status)
        return qs.select_related('target_article', 'suggested_category', 'reviewed_by').order_by('-created_at')

    def list(self, request, *args, **kwargs):
        if not _is_kb_admin(request.user):
            # Don't 403; returning an empty list lets the UI render the tab
            # without leaking admin-only data and keeps the frontend gate simple.
            return Response({'results': [], 'count': 0, 'next': None, 'previous': None})
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        # Creations only happen from the learning service / generate action —
        # block direct POSTs.
        return Response(
            {'error': 'Direct creation is not permitted. Use the generate action.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Approve a suggestion:
          - kind=new_article     -> create KBArticle (status='draft' by default,
                                     or 'published' if ai_auto_publish is on)
          - kind=update_article  -> bump target article's version and merge the
                                     proposed fields, snapshotting the old
                                     content in previous_version_data first
        """
        if not _is_kb_admin(request.user):
            return Response({'error': 'Admins only.'}, status=status.HTTP_403_FORBIDDEN)

        suggestion = get_object_or_404(
            KBAISuggestion.objects.for_business(), pk=pk, status='A'
        )

        if suggestion.review_status != 'pending':
            return Response(
                {'error': f'Suggestion is already {suggestion.review_status}.'},
                status=status.HTTP_409_CONFLICT if hasattr(status, 'HTTP_409_CONFLICT') else 409,
            )

        business = request.user.business
        default_status = 'draft'
        publish_on_approval = bool(
            get_kb_setting_for_business(business.id if business else None, 'ai_auto_publish_on_approval', False)
        )

        with transaction.atomic():
            if suggestion.kind == 'new_article':
                article = KBArticle.objects.create(
                    business=business,
                    author=request.user,
                    category=suggestion.suggested_category,
                    title=suggestion.proposed_title or '(Untitled)',
                    slug=suggestion.proposed_slug or '',
                    content=suggestion.proposed_content or '',
                    excerpt=suggestion.proposed_excerpt or '',
                    tags=suggestion.proposed_tags or [],
                    status='published' if publish_on_approval else default_status,
                    metadata={
                        'ai_origin': True,
                        'ai_suggestion_id': suggestion.pk,
                        'approved_by': request.user.id,
                        'approved_at': timezone.now().isoformat(),
                    },
                )
                result = {'article_id': article.id, 'slug': article.slug}
            else:
                article = suggestion.target_article
                if article is None:
                    return Response(
                        {'error': 'Update suggestion has no target article.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                # Snapshot previous content so the old version is recoverable.
                article.previous_version_data = {
                    'version': article.version,
                    'title': article.title,
                    'slug': article.slug,
                    'content': article.content,
                    'excerpt': article.excerpt,
                    'tags': article.tags or [],
                    'snapshotted_at': timezone.now().isoformat(),
                    'replaced_by_suggestion': suggestion.pk,
                }
                # Apply proposed fields. We keep the existing slug by default —
                # admins can rename via the editor if they want to.
                if suggestion.proposed_title:
                    article.title = suggestion.proposed_title
                if suggestion.proposed_content:
                    article.content = suggestion.proposed_content
                if suggestion.proposed_excerpt:
                    article.excerpt = suggestion.proposed_excerpt
                if suggestion.proposed_tags:
                    article.tags = suggestion.proposed_tags
                article.version = (article.version or 1) + 1
                if publish_on_approval and article.status != 'published':
                    article.status = 'published'
                article.save()
                result = {'article_id': article.id, 'slug': article.slug, 'version': article.version}

            suggestion.mark_approved(request.user)

            # Supersede any other pending suggestions for the same target article.
            if suggestion.kind == 'update_article' and suggestion.target_article_id:
                KBAISuggestion.objects.filter(
                    business=business,
                    target_article_id=suggestion.target_article_id,
                    review_status='pending',
                ).exclude(pk=suggestion.pk).update(review_status='superseded')

        return Response({'message': 'Suggestion approved.', **result})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if not _is_kb_admin(request.user):
            return Response({'error': 'Admins only.'}, status=status.HTTP_403_FORBIDDEN)

        suggestion = get_object_or_404(
            KBAISuggestion.objects.for_business(), pk=pk, status='A'
        )
        if suggestion.review_status != 'pending':
            return Response(
                {'error': f'Suggestion is already {suggestion.review_status}.'},
                status=400,
            )
        reason = (request.data.get('reason') or '').strip()
        suggestion.mark_rejected(request.user, reason)
        return Response({'message': 'Suggestion rejected.', 'reason': reason})

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Kick off a learning pass. Gated on the enable_ai_learning setting."""
        if not _is_kb_admin(request.user):
            return Response({'error': 'Admins only.'}, status=status.HTTP_403_FORBIDDEN)

        business = request.user.business
        if not business:
            return Response({'error': 'No business context.'}, status=400)

        if not get_kb_setting_for_business(business.id, 'enable_ai_learning', False):
            return Response(
                {'error': 'AI learning is disabled for this workspace. Enable it under KB Settings → AI & Learning.'},
                status=400,
            )

        # Lazy import to avoid loading LLM deps on module import.
        from tenant.services.ai.kb_learning import KBLearningService

        service = KBLearningService()
        try:
            summary = service.run(business=business, triggered_by=request.user)
        except AIUsageLimitExceeded as exc:
            return Response(
                {
                    'error': 'AI monthly token cap reached.',
                    'detail': str(exc),
                    'used_tokens': exc.used_tokens,
                    'cap_tokens': exc.cap_tokens,
                    'requested_tokens': exc.requested_tokens,
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger_name = getattr(__import__('logging').getLogger(__name__), 'error', None)
            if logger_name:
                logger_name(f'KB learning generate failed: {exc}')
            return Response({'error': 'Learning run failed.', 'detail': str(exc)}, status=500)
        return Response(summary)


# ---------------------------------------------------------------------------
# KB Ask AI — grounded RAG over the user's visible articles
# ---------------------------------------------------------------------------

class KBAskAIView(CORSMixin, viewsets.ViewSet):
    """
    POST /kb/ask-ai/
    Body: { "query": "...", "article_slug": "optional-slug" }

    Returns: { "answer": "...", "references": [{"title","slug","excerpt"}] }
    """
    permission_classes = [IsAuthenticated]

    def create(self, request):
        query = (request.data.get('query') or '').strip()
        if not query:
            return Response({'error': 'query is required.'}, status=400)

        business = request.user.business
        if not business:
            return Response({'error': 'No business context.'}, status=400)

        # Ask AI is an internal tool for signed-in agents/admins and has no
        # per-workspace on/off switch — the customer-facing chatbot is a
        # separate surface with its own configuration.

        article_slug = (request.data.get('article_slug') or '').strip() or None

        # Import lazily so the route still loads if google-genai isn't installed
        # in some environments (admin panels, test setups without the key).
        from tenant.services.ai.kb_ask import KBAskAIService

        service = KBAskAIService()
        try:
            payload = service.answer(
                business_id=business.id,
                user=request.user,
                query=query,
                article_slug=article_slug,
            )
        except AIUsageLimitExceeded as exc:
            return Response(
                {
                    'error': 'AI monthly token cap reached.',
                    'detail': str(exc),
                    'used_tokens': exc.used_tokens,
                    'cap_tokens': exc.cap_tokens,
                    'requested_tokens': exc.requested_tokens,
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        except Exception as exc:  # pragma: no cover - defensive
            return Response({'error': 'Ask AI failed.', 'detail': str(exc)}, status=500)
        return Response(payload)


# ---------------------------------------------------------------------------
# AI usage accounting — current-month cap, cost, and overage status
# ---------------------------------------------------------------------------

class AIUsageView(CORSMixin, viewsets.ViewSet):
    """Admin endpoint for current business AI usage and monthly cap policy."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        if not _is_kb_admin(request.user):
            return Response({'error': 'Admins only.'}, status=status.HTTP_403_FORBIDDEN)

        business = getattr(request.user, 'business', None)
        if not business:
            return Response({'error': 'No business context.'}, status=400)

        period_start = current_period_start()
        policy = get_or_create_policy(business)
        snapshot = get_usage_snapshot(business, period_start=period_start)
        totals = AIUsageEvent.objects.filter(
            business=business,
            period_start=period_start,
        ).aggregate(
            estimated_cost_usd=Sum('estimated_cost_usd'),
            billable_overage_tokens=Sum('billable_overage_tokens'),
            billable_overage_amount_usd=Sum('billable_overage_amount_usd'),
        )
        by_feature = (
            AIUsageEvent.objects.filter(business=business, period_start=period_start)
            .values('feature')
            .annotate(
                total_tokens=Sum('total_tokens'),
                input_tokens=Sum('input_tokens'),
                output_tokens=Sum('output_tokens'),
                estimated_cost_usd=Sum('estimated_cost_usd'),
            )
            .order_by('feature')
        )

        return Response({
            'period_start': period_start.isoformat(),
            'policy': {
                'monthly_token_cap': policy.monthly_token_cap,
                'hard_cap_enabled': policy.hard_cap_enabled,
                'overage_enabled': policy.overage_enabled,
                'overage_price_per_1k_tokens_usd': str(policy.overage_price_per_1k_tokens_usd),
                'currency': policy.currency,
            },
            'usage': {
                'used_tokens': snapshot.used_tokens,
                'remaining_tokens': snapshot.remaining_tokens,
                'cap_tokens': snapshot.cap_tokens,
                'estimated_cost_usd': str(totals.get('estimated_cost_usd') or '0.000000'),
                'billable_overage_tokens': totals.get('billable_overage_tokens') or 0,
                'billable_overage_amount_usd': str(totals.get('billable_overage_amount_usd') or '0.000000'),
                'by_feature': list(by_feature),
            },
        })

    def partial_update(self, request):
        if not _is_kb_admin(request.user):
            return Response({'error': 'Admins only.'}, status=status.HTTP_403_FORBIDDEN)

        business = getattr(request.user, 'business', None)
        if not business:
            return Response({'error': 'No business context.'}, status=400)

        policy = get_or_create_policy(business)
        allowed_fields = {
            'monthly_token_cap',
            'hard_cap_enabled',
            'overage_enabled',
            'overage_price_per_1k_tokens_usd',
        }
        for field in allowed_fields:
            if field in request.data:
                setattr(policy, field, request.data[field])
        policy.save()
        return self.list(request)


# ---------------------------------------------------------------------------
# KB article versions — reads the snapshot stored in previous_version_data
# ---------------------------------------------------------------------------

class KBArticleVersionsView(CORSMixin, viewsets.ViewSet):
    """GET /kb/articles/<slug>/versions/"""
    permission_classes = [IsAuthenticated]

    def list(self, request, slug=None):
        article = get_object_or_404(
            KBArticle.objects.for_business().filter(status='A'),
            slug=slug,
        )
        versions = [{
            'version': article.version,
            'title': article.title,
            'slug': article.slug,
            'excerpt': article.excerpt,
            'content': article.content,
            'is_current': True,
            'updated_at': article.updated_at,
        }]
        prev = article.previous_version_data or {}
        if prev:
            versions.append({
                'version': prev.get('version'),
                'title': prev.get('title'),
                'slug': prev.get('slug'),
                'excerpt': prev.get('excerpt', ''),
                'content': prev.get('content', ''),
                'is_current': False,
                'updated_at': prev.get('snapshotted_at'),
            })
        return Response({'results': versions, 'count': len(versions)})
