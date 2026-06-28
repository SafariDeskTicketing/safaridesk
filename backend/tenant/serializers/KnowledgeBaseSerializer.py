"""
Optimized Knowledge Base Serializers - Complete API Serialization
Provides efficient serialization for all KB models with proper field handling.
"""

import html
import re

from rest_framework import serializers
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.text import slugify
from tenant.models.KnowledgeBase import (
    KBCategory, KBArticle, KBInteraction, KBAnalytics, KBSettings, KBAISuggestion
)

User = get_user_model()
ARTICLE_TITLE_MAX_LENGTH = 120
ARTICLE_DUPLICATE_SLUG_MESSAGE = (
    'An article with a similar title already exists. Choose a different title or edit the article URL.'
)

_UNSAFE_RICH_TEXT_BLOCK_PATTERN = re.compile(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>', re.IGNORECASE)
_RICH_TEXT_MEDIA_PATTERN = re.compile(r'<(img|video|audio|iframe|embed|object)\b', re.IGNORECASE)


def _rich_text_without_unsafe_blocks(value):
    return _UNSAFE_RICH_TEXT_BLOCK_PATTERN.sub(' ', value or '')


def _rich_text_plain_text(value):
    value = _rich_text_without_unsafe_blocks(value)
    value = re.sub(r'<[^>]+>', ' ', value)
    value = html.unescape(value).replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', value).strip()


def _rich_text_has_content(value):
    return bool(
        _rich_text_plain_text(value)
        or _RICH_TEXT_MEDIA_PATTERN.search(_rich_text_without_unsafe_blocks(value))
    )


def _normalise_article_slug(value, fallback=''):
    return slugify(value or '').strip('-') or fallback


def _serializer_business_id(context, instance=None):
    if instance and getattr(instance, 'business_id', None):
        return instance.business_id
    request = context.get('request') if context else None
    user = getattr(request, 'user', None)
    return getattr(user, 'business_id', None) or getattr(getattr(user, 'business', None), 'id', None)


def _article_slug_queryset(slug, business_id):
    queryset = KBArticle.objects.filter(slug=slug)
    if business_id:
        return queryset.filter(business_id=business_id)
    return queryset.filter(business__isnull=True)


def _unique_article_slug(base_slug, business_id):
    candidate = base_slug
    counter = 2
    while _article_slug_queryset(candidate, business_id).exists():
        suffix = f'-{counter}'
        candidate = f'{base_slug[:520 - len(suffix)]}{suffix}'
        counter += 1
    return candidate


class UserBasicSerializer(serializers.ModelSerializer):
    """Basic user serializer for KB references"""
    display_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'display_name']
        read_only_fields = ['id']
    
    def get_display_name(self, obj):
        """Get the display name for the user"""
        if obj.first_name and obj.last_name:
            return f"{obj.first_name} {obj.last_name}".strip()
        elif obj.first_name:
            return obj.first_name
        elif obj.last_name:
            return obj.last_name
        elif obj.username:
            return obj.username
        return obj.email


class KBCategorySerializer(serializers.ModelSerializer):
    """Serializer for KB Categories with hierarchy support"""
    children = serializers.SerializerMethodField()
    article_count = serializers.ReadOnlyField()
    slug = serializers.SlugField(required=False)  # Auto-generated if not provided
    
    class Meta:
        model = KBCategory
        fields = [
            'id', 'name', 'slug', 'description', 'parent', 'seo_title', 
            'seo_description', 'seo_keywords', 'icon', 'color', 'sort_order',
            'is_public', 'is_featured', 'metadata', 'article_count', 'level',
            'path', 'children', 'created_at', 'updated_at', 'status'
        ]
        read_only_fields = ['id', 'article_count', 'level', 'path', 'created_at', 'updated_at']
    
    def get_children(self, obj):
        """Get child categories"""
        if hasattr(obj, 'children'):
            children = obj.children.filter(status='A').order_by('sort_order', 'name')
            return KBCategorySerializer(children, many=True, context=self.context).data
        return []


class KBCategoryDetailSerializer(KBCategorySerializer):
    """Detailed category serializer with additional information"""
    recent_articles = serializers.SerializerMethodField()
    
    class Meta(KBCategorySerializer.Meta):
        fields = KBCategorySerializer.Meta.fields + ['recent_articles']
    
    def get_recent_articles(self, obj):
        """Get recent published articles in this category"""
        recent = obj.articles.filter(
            status='published', 
            is_public=True
        ).order_by('-published_at')[:5]
        
        return [{
            'id': article.id,
            'title': article.title,
            'slug': article.slug,
            'excerpt': article.excerpt,
            'published_at': article.published_at,
            'view_count': article.view_count,
            'reading_time': article.reading_time,
        } for article in recent]


class KBArticleSerializer(serializers.ModelSerializer):
    """Serializer for KB Articles - List view"""
    category = KBCategorySerializer(read_only=True)
    category_id = serializers.IntegerField(write_only=True)
    author = UserBasicSerializer(read_only=True)
    public_path = serializers.SerializerMethodField()
    helpful_percentage = serializers.ReadOnlyField()
    is_published = serializers.ReadOnlyField()
    
    class Meta:
        model = KBArticle
        fields = [
            'id', 'public_path', 'title', 'slug', 'excerpt', 'status', 'category', 'category_id',
            'author', 'published_at', 'created_at', 'updated_at', 'view_count',
            'helpful_count', 'not_helpful_count', 'comment_count', 'reading_time',
            # 'difficulty_level', # Commented out as requested
            'tags', 'is_featured', 'is_public', 'is_pinned',
            'helpful_percentage', 'is_published', 'language', 'quality_score',
            'seo_score', 'engagement_score', 'metadata'
        ]
        read_only_fields = [
            'id', 'public_path', 'author', 'view_count', 'helpful_count', 'not_helpful_count',
            'comment_count', 'created_at', 'updated_at', 'helpful_percentage',
            'is_published', 'quality_score', 'seo_score', 'engagement_score'
        ]

    def get_public_path(self, obj):
        return f'{obj.id}-{obj.slug}'


class KBArticleDetailSerializer(KBArticleSerializer):
    """Detailed article serializer with full content"""
    interactions = serializers.SerializerMethodField()
    related_articles = serializers.SerializerMethodField()
    
    class Meta(KBArticleSerializer.Meta):
        fields = KBArticleSerializer.Meta.fields + [
            'content', 'seo_title', 'seo_description', 'seo_keywords',
            'seo_canonical_url', 'metadata', 'version', 'previous_version_data',
            'translation_source', 'scheduled_publish_at', 'last_reviewed_at',
            'interactions', 'related_articles'
        ]
    
    def get_interactions(self, obj):
        """Get recent interactions for this article"""
        recent_interactions = obj.interactions.filter(
            is_approved=True,
            is_public=True
        ).order_by('-created_at')[:10]
        
        return [{
            'id': interaction.id,
            'type': interaction.interaction_type,
            'content': interaction.content,
            'user': interaction.user.username if interaction.user else 'Anonymous',
            'created_at': interaction.created_at,
            'rating': interaction.rating,
        } for interaction in recent_interactions]
    
    def get_related_articles(self, obj):
        """Get related articles based on category and tags"""
        related = KBArticle.objects.filter(
            status='published',
            is_public=True,
            category=obj.category
        ).exclude(id=obj.id).order_by('-view_count')[:5]
        
        return [{
            'id': article.id,
            'public_path': f'{article.id}-{article.slug}',
            'title': article.title,
            'slug': article.slug,
            'excerpt': article.excerpt,
            'view_count': article.view_count,
            'reading_time': article.reading_time,
        } for article in related]


class KBArticleCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating articles"""
    slug = serializers.SlugField(required=False, allow_blank=True)
    
    class Meta:
        model = KBArticle
        fields = [
            'title', 'slug', 'content', 'excerpt', 'category', 'status', 'is_public',
            'is_featured', 'is_pinned', 'seo_title', 'seo_description',
            'seo_keywords', 'seo_canonical_url', 'tags', 
            # 'difficulty_level', # Commented out as requested
            'language', 'metadata', 'scheduled_publish_at'
        ]

    def validate_title(self, value):
        if len((value or '').strip()) > ARTICLE_TITLE_MAX_LENGTH:
            raise serializers.ValidationError(
                f'Article title is too long. Maximum {ARTICLE_TITLE_MAX_LENGTH} characters allowed.'
            )
        return value.strip()

    def validate_content(self, value):
        if not _rich_text_has_content(value):
            raise serializers.ValidationError('Article body cannot be empty. Please provide content before publishing.')
        return value

    def validate(self, attrs):
        business_id = _serializer_business_id(self.context, self.instance)

        if 'slug' in attrs:
            normalised_slug = _normalise_article_slug(attrs.get('slug'))
            if normalised_slug:
                conflicts = _article_slug_queryset(normalised_slug, business_id)
                if self.instance:
                    conflicts = conflicts.exclude(pk=self.instance.pk)
                if conflicts.exists():
                    raise serializers.ValidationError({'slug': ARTICLE_DUPLICATE_SLUG_MESSAGE})
                attrs['slug'] = normalised_slug
            else:
                attrs.pop('slug', None)

        if self.instance is None and not attrs.get('slug'):
            attrs['slug'] = _unique_article_slug(
                _normalise_article_slug(attrs.get('title'), fallback='article'),
                business_id,
            )

        return attrs
    
    def create(self, validated_data):
        """Create article with current user as author"""
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)


class KBInteractionSerializer(serializers.ModelSerializer):
    """Serializer for KB Interactions"""
    user = UserBasicSerializer(read_only=True)
    article_title = serializers.CharField(source='article.title', read_only=True)
    
    class Meta:
        model = KBInteraction
        fields = [
            'id', 'article', 'article_title', 'user', 'interaction_type',
            'content', 'rating', 'is_helpful', 'is_approved', 'is_public',
            'created_at', 'updated_at', 'metadata'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
    
    def create(self, validated_data):
        """Create interaction with current user"""
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            validated_data['user'] = request.user
        return super().create(validated_data)


class KBAnalyticsSerializer(serializers.ModelSerializer):
    """Serializer for KB Analytics"""
    article_title = serializers.CharField(source='article.title', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = KBAnalytics
        fields = [
            'id', 'article', 'article_title', 'category', 'category_name',
            'event_type', 'event_data', 'user', 'user_username', 'session_id',
            'ip_address', 'user_agent', 'referrer', 'device_type', 'browser',
            'country', 'region', 'city', 'timestamp', 'duration', 'date', 'hour'
        ]
        read_only_fields = [
            'id', 'timestamp', 'date', 'hour', 'article_title', 
            'category_name', 'user_username'
        ]


class KBSettingsSerializer(serializers.ModelSerializer):
    """Serializer for KB Settings"""
    parsed_value = serializers.SerializerMethodField()
    
    class Meta:
        model = KBSettings
        fields = [
            'id', 'key', 'category', 'value', 'value_type', 'default_value',
            'label', 'description', 'help_text', 'is_public', 'is_required',
            'is_editable', 'validation_rules', 'sort_order', 'parsed_value',
            'created_at', 'updated_at', 'status'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'parsed_value']
    
    def get_parsed_value(self, obj):
        """Get the parsed value based on type"""
        return obj.get_value()


class KBSearchResultSerializer(serializers.Serializer):
    """Serializer for search results"""
    id = serializers.IntegerField()
    title = serializers.CharField()
    slug = serializers.CharField()
    excerpt = serializers.CharField()
    category = serializers.CharField()
    view_count = serializers.IntegerField()
    helpful_count = serializers.IntegerField()
    published_at = serializers.DateTimeField()
    reading_time = serializers.IntegerField()
    # difficulty_level = serializers.CharField() # Commented out as requested
    relevance_score = serializers.FloatField(required=False)


class KBStatsSerializer(serializers.Serializer):
    """Serializer for KB statistics"""
    total_articles = serializers.IntegerField()
    total_categories = serializers.IntegerField()
    total_views = serializers.IntegerField()
    total_interactions = serializers.IntegerField()
    popular_articles = KBArticleSerializer(many=True)
    recent_searches = serializers.ListField(child=serializers.CharField())
    top_categories = KBCategorySerializer(many=True)


class KBAISuggestionSerializer(serializers.ModelSerializer):
    """
    Serializer for AI-generated KB suggestions.

    Exposes the versioning indicator ("Proposes v{proposed_version} · live is v{current_version}")
    and keeps the source references denormalised so the UI can render them without
    an extra fetch per source ticket/task.
    """
    target_article_title = serializers.CharField(source='target_article.title', read_only=True)
    target_article_slug = serializers.CharField(source='target_article.slug', read_only=True)
    suggested_category_name = serializers.CharField(source='suggested_category.name', read_only=True)
    reviewed_by = UserBasicSerializer(read_only=True)
    version_indicator = serializers.SerializerMethodField()

    class Meta:
        model = KBAISuggestion
        fields = [
            'id', 'kind', 'review_status', 'source_kind',
            'target_article', 'target_article_title', 'target_article_slug',
            'suggested_category', 'suggested_category_name',
            'proposed_title', 'proposed_slug', 'proposed_content',
            'proposed_excerpt', 'proposed_tags',
            'current_version', 'proposed_version', 'version_indicator',
            'confidence', 'source_count', 'source_refs',
            'reviewed_by', 'reviewed_at', 'review_reason',
            'model_name', 'input_tokens', 'output_tokens', 'prompt_version',
            'metadata', 'created_at', 'updated_at', 'status',
        ]
        read_only_fields = [
            'id', 'reviewed_by', 'reviewed_at', 'review_status',
            'input_tokens', 'output_tokens', 'model_name', 'prompt_version',
            'created_at', 'updated_at', 'version_indicator',
        ]

    def get_version_indicator(self, obj):
        if obj.kind == 'update_article':
            current = obj.current_version or (obj.target_article.version if obj.target_article else None)
            return {
                'current_version': current,
                'proposed_version': obj.proposed_version,
                'label': f"Proposes v{obj.proposed_version}"
                         + (f" · live is v{current}" if current else ""),
            }
        return {
            'current_version': None,
            'proposed_version': obj.proposed_version,
            'label': 'New article',
        }


# Export all serializers
__all__ = [
    'UserBasicSerializer',
    'KBCategorySerializer',
    'KBCategoryDetailSerializer',
    'KBArticleSerializer',
    'KBArticleDetailSerializer',
    'KBArticleCreateUpdateSerializer',
    'KBInteractionSerializer',
    'KBAnalyticsSerializer',
    'KBSettingsSerializer',
    'KBSearchResultSerializer',
    'KBStatsSerializer',
    'KBAISuggestionSerializer',
]
