"""
OPTIMIZED Knowledge Base Models - Maximum Efficiency
This consolidates 60+ models into 6 essential tables with SEO support.
Prevents Django migration bloat and over-normalization issues.
"""

from django.db import models
from django.db.models import F, Q
from django.urls import reverse
from django.utils import timezone
from django.utils.text import slugify
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.conf import settings
import json

from shared.models.BaseModel import BaseEntity


class KBCategory(BaseEntity):
    """
    Consolidated Category Model - Replaces multiple category-related models
    Includes SEO, hierarchy, and metadata in one efficient table
    """
    name = models.CharField(max_length=200, db_index=True)
    slug = models.SlugField(max_length=220, db_index=True)
    description = models.TextField(blank=True)
    
    # Hierarchy - Simple parent-child relationship
    parent = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='children', db_index=True
    )
    
    # SEO Fields (inline, not separate table)
    seo_title = models.CharField(max_length=60, blank=True, help_text="SEO title tag")
    seo_description = models.CharField(max_length=160, blank=True, help_text="Meta description")
    seo_keywords = models.CharField(max_length=200, blank=True, help_text="Meta keywords")
    
    # Display & Behavior
    icon = models.CharField(max_length=100, blank=True)
    color = models.CharField(max_length=7, default="#20b8cd")
    sort_order = models.IntegerField(default=0, db_index=True)
    is_public = models.BooleanField(default=True, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    
    # Consolidated Metadata (replaces multiple tables)
    metadata = models.JSONField(default=dict, blank=True, help_text="Flexible metadata storage")
    
    # Cached values for performance
    article_count = models.PositiveIntegerField(default=0, db_index=True)
    level = models.PositiveIntegerField(default=0, db_index=True)
    path = models.CharField(max_length=500, db_index=True, blank=True)

    class Meta:
        db_table = "kb_categories"
        ordering = ['sort_order', 'name']
        unique_together = [('slug', 'business')]
        indexes = [
            models.Index(fields=['parent', 'sort_order']),
            models.Index(fields=['is_public', 'status']),
            models.Index(fields=['is_featured', 'status']),
            models.Index(fields=['slug', 'business']),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        
        # Auto-generate SEO fields if empty
        if not self.seo_title:
            self.seo_title = self.name[:60]
        if not self.seo_description:
            self.seo_description = (self.description[:160] if self.description else f"Articles about {self.name}")
        
        # Generate hierarchy data
        if self.parent:
            self.level = self.parent.level + 1
            self.path = f"{self.parent.path}/{self.slug}"
        else:
            self.level = 0
            self.path = self.slug
            
        super().save(*args, **kwargs)


class KBArticle(BaseEntity):
    """
    Consolidated Article Model - Replaces 20+ article-related models
    Includes content, SEO, analytics, versioning, and metadata in one table
    """
    title = models.CharField(max_length=500, db_index=True)
    slug = models.SlugField(max_length=520, db_index=True)
    content = models.TextField()
    excerpt = models.TextField(blank=True)
    
    # Relationships
    category = models.ForeignKey(KBCategory, on_delete=models.CASCADE, related_name='articles', db_index=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='kb_articles', db_index=True)
    
    # Status & Visibility
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('review', 'Under Review'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
    is_public = models.BooleanField(default=True, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    is_pinned = models.BooleanField(default=False, db_index=True)
    
    # SEO Fields (inline, not separate table)
    seo_title = models.CharField(max_length=60, blank=True, help_text="SEO title tag")
    seo_description = models.CharField(max_length=160, blank=True, help_text="Meta description")
    seo_keywords = models.CharField(max_length=200, blank=True, help_text="Meta keywords")
    seo_canonical_url = models.URLField(blank=True, help_text="Canonical URL for SEO")
    
    # Content Organization
    tags = models.JSONField(default=list, blank=True, help_text="Article tags as JSON array")
    sort_order = models.IntegerField(default=0, db_index=True)
    
    # Analytics & Engagement (consolidated from multiple tables)
    view_count = models.PositiveIntegerField(default=0, db_index=True)
    like_count = models.PositiveIntegerField(default=0)
    share_count = models.PositiveIntegerField(default=0)
    comment_count = models.PositiveIntegerField(default=0)
    helpful_count = models.PositiveIntegerField(default=0)
    not_helpful_count = models.PositiveIntegerField(default=0)
    
    # Content Metadata
    reading_time = models.PositiveIntegerField(default=0, help_text="Minutes")
    # difficulty_level = models.CharField(max_length=20, choices=[
    #     ('beginner', 'Beginner'),
    #     ('intermediate', 'Intermediate'),
    #     ('advanced', 'Advanced'),
    # ], default='beginner', db_index=True)
    
    # Publishing & Scheduling
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)
    scheduled_publish_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # Versioning (simplified)
    version = models.PositiveIntegerField(default=1)
    previous_version_data = models.JSONField(default=dict, blank=True, help_text="Previous version backup")
    
    # Flexible Metadata (replaces multiple specialized tables)
    metadata = models.JSONField(default=dict, blank=True, help_text="Custom fields, attachments, etc.")
    
    # Multilingual Support (consolidated)
    language = models.CharField(max_length=10, default='en', db_index=True)
    translation_source = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='translations', db_index=True
    )
    
    # Quality Scores (consolidated analytics)
    quality_score = models.FloatField(default=0.0, help_text="Content quality score")
    seo_score = models.FloatField(default=0.0, help_text="SEO optimization score")
    engagement_score = models.FloatField(default=0.0, help_text="User engagement score")

    class Meta:
        db_table = "kb_articles"
        ordering = ['-published_at', '-created_at']
        unique_together = [('slug', 'business')]
        indexes = [
            models.Index(fields=['category', 'status']),
            models.Index(fields=['status', 'is_public']),
            models.Index(fields=['published_at', 'status']),
            models.Index(fields=['is_featured', 'status']),
            models.Index(fields=['view_count']),
            models.Index(fields=['language', 'status']),
            # models.Index(fields=['difficulty_level', 'status']),
            models.Index(fields=['scheduled_publish_at']),
            models.Index(fields=['slug', 'business']),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        previous_category_id = None
        previous_status = None
        if not is_new:
            previous = KBArticle.objects.filter(pk=self.pk).values('category_id', 'status').first()
            if previous:
                previous_category_id = previous['category_id']
                previous_status = previous['status']

        if not self.slug:
            self.slug = slugify(self.title)
        
        # Auto-generate SEO fields if empty
        if not self.seo_title:
            self.seo_title = self.title[:60]
        if not self.seo_description:
            self.seo_description = (self.excerpt[:160] if self.excerpt else f"Learn about {self.title}")
        
        # Set published_at when status changes to published
        if self.status == 'published' and not self.published_at:
            self.published_at = timezone.now()
        
        # Calculate reading time if not set
        if not self.reading_time and self.content:
            word_count = len(self.content.split())
            self.reading_time = max(1, word_count // 200)  # Assume 200 words per minute
        
        super().save(*args, **kwargs)

        # Update category article_count only when publish status or category changes.
        new_published = self.status == 'published'
        old_published = previous_status == 'published'

        if is_new:
            if new_published and self.category_id:
                KBCategory.objects.filter(id=self.category_id).update(
                    article_count=F('article_count') + 1
                )
        else:
            if previous_category_id != self.category_id:
                if old_published and previous_category_id:
                    KBCategory.objects.filter(id=previous_category_id).update(
                        article_count=F('article_count') - 1
                    )
                if new_published and self.category_id:
                    KBCategory.objects.filter(id=self.category_id).update(
                        article_count=F('article_count') + 1
                    )
            elif old_published != new_published and self.category_id:
                KBCategory.objects.filter(id=self.category_id).update(
                    article_count=F('article_count') + (1 if new_published else -1)
                )

    def get_absolute_url(self):
        return reverse('kb:article-detail', kwargs={'slug': self.slug})

    @property
    def is_published(self):
        return self.status == 'published'

    @property
    def helpful_percentage(self):
        total = self.helpful_count + self.not_helpful_count
        return (self.helpful_count / total) * 100 if total > 0 else 0


class KBInteraction(BaseEntity):
    """
    Consolidated Interaction Model - Replaces comments, ratings, feedback, etc.
    Handles all user interactions with articles in one efficient table
    """
    INTERACTION_TYPES = [
        ('comment', 'Comment'),
        ('rating', 'Rating'),
        ('helpful', 'Helpful Vote'),
        ('not_helpful', 'Not Helpful Vote'),
        ('like', 'Like'),
        ('bookmark', 'Bookmark'),
        ('share', 'Share'),
        ('feedback', 'General Feedback'),
    ]
    
    article = models.ForeignKey(KBArticle, on_delete=models.CASCADE, related_name='interactions', db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, db_index=True)
    
    # Interaction details
    interaction_type = models.CharField(max_length=20, choices=INTERACTION_TYPES, db_index=True)
    content = models.TextField(blank=True, help_text="Comment text, feedback, etc.")
    
    # Rating/scoring
    rating = models.PositiveIntegerField(null=True, blank=True, help_text="1-5 stars")
    is_helpful = models.BooleanField(null=True, blank=True, help_text="For helpful votes")
    
    # Moderation
    is_approved = models.BooleanField(default=True, db_index=True)
    is_public = models.BooleanField(default=True, db_index=True)
    
    # Anonymous tracking
    session_id = models.CharField(max_length=100, blank=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional interaction data")

    class Meta:
        db_table = "kb_interactions"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['article', 'interaction_type']),
            models.Index(fields=['user', 'interaction_type']),
            models.Index(fields=['interaction_type', 'is_approved']),
            models.Index(fields=['created_at']),
        ]
        # Prevent duplicate interactions
        unique_together = [
            ('article', 'user', 'interaction_type'),  # One interaction per user per article
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['article', 'session_id', 'interaction_type'],
                condition=Q(user__isnull=True),
                name='kb_interaction_session_unique',
            ),
        ]

    def __str__(self):
        return f"{self.interaction_type} on {self.article.title}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        # Only update article counters when creating new interactions, not on updates
        if is_new:
            # Update article counters by incrementing, not recounting
            if self.interaction_type == 'comment' and self.is_approved:
                self.article.comment_count += 1
                self.article.save(update_fields=['comment_count'])
            elif self.interaction_type == 'like':
                self.article.like_count += 1
                self.article.save(update_fields=['like_count'])
            elif self.interaction_type == 'helpful':
                self.article.helpful_count += 1
                self.article.save(update_fields=['helpful_count'])
            elif self.interaction_type == 'not_helpful':
                self.article.not_helpful_count += 1
                self.article.save(update_fields=['not_helpful_count'])
            elif self.interaction_type == 'share':
                self.article.share_count += 1
                self.article.save(update_fields=['share_count'])


class KBAnalytics(BaseEntity):
    """
    Consolidated Analytics Model - Replaces 15+ analytics-related models
    Tracks all events, metrics, and performance data in one table
    """
    EVENT_TYPES = [
        ('view', 'Article View'),
        ('search', 'Search Query'),
        ('click', 'Link Click'),
        ('download', 'Download'),
        ('print', 'Print'),
        ('copy', 'Copy Text'),
        ('scroll', 'Scroll Depth'),
        ('time', 'Time on Page'),
        ('exit', 'Exit Point'),
        ('conversion', 'Conversion'),
    ]
    
    # Content tracking
    article = models.ForeignKey(KBArticle, on_delete=models.CASCADE, null=True, blank=True, db_index=True)
    category = models.ForeignKey(KBCategory, on_delete=models.CASCADE, null=True, blank=True, db_index=True)
    
    # Event details
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES, db_index=True)
    event_data = models.JSONField(default=dict, blank=True, help_text="Event-specific data")
    
    # User tracking
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, db_index=True)
    session_id = models.CharField(max_length=100, blank=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    # Technical details
    user_agent = models.TextField(blank=True)
    referrer = models.URLField(blank=True)
    device_type = models.CharField(max_length=20, blank=True, db_index=True)
    browser = models.CharField(max_length=50, blank=True)
    
    # Geographic data
    country = models.CharField(max_length=5, blank=True, db_index=True)
    region = models.CharField(max_length=50, blank=True)
    city = models.CharField(max_length=100, blank=True)
    
    # Timing
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    duration = models.PositiveIntegerField(null=True, blank=True, help_text="Duration in seconds")
    
    # Aggregated metrics (for performance)
    date = models.DateField(auto_now_add=True, db_index=True)
    hour = models.PositiveIntegerField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = "kb_analytics"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['article', 'event_type', 'date']),
            models.Index(fields=['category', 'event_type', 'date']),
            models.Index(fields=['event_type', 'timestamp']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['date', 'event_type']),
            models.Index(fields=['device_type', 'date']),
            models.Index(fields=['country', 'date']),
        ]

    def __str__(self):
        return f"{self.event_type} - {self.article or self.category} ({self.timestamp})"

    def save(self, *args, **kwargs):
        # Extract hour from timestamp
        if self.timestamp:
            self.hour = self.timestamp.hour
        
        super().save(*args, **kwargs)
        
        # Note: view_count is now updated directly in the view when creating analytics
        # This prevents duplicate counting on every save


class KBSettings(BaseEntity):
    """
    Consolidated Settings Model - Replaces multiple configuration tables
    Stores all KB system settings in one flexible table
    """
    SETTING_TYPES = [
        ('string', 'String'),
        ('integer', 'Integer'),
        ('float', 'Float'),
        ('boolean', 'Boolean'),
        ('json', 'JSON'),
        ('text', 'Text'),
        ('url', 'URL'),
        ('email', 'Email'),
        ('color', 'Color'),
        ('file', 'File Path'),
    ]
    
    # Setting identification
    # NOTE: uniqueness is (key, business) via Meta.unique_together below, NOT
    # globally on `key`. The previous `unique=True` on this field broke
    # multi-tenancy — only one business could own each setting row.
    key = models.CharField(max_length=100, db_index=True)
    category = models.CharField(max_length=50, blank=True, db_index=True, help_text="Setting category")
    
    # Setting value
    value = models.TextField()
    value_type = models.CharField(max_length=20, choices=SETTING_TYPES, default='string')
    default_value = models.TextField(blank=True, help_text="Default value")
    
    # Metadata
    label = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    help_text = models.TextField(blank=True)
    
    # Behavior
    is_public = models.BooleanField(default=False, help_text="Public settings can be accessed by non-admin users")
    is_required = models.BooleanField(default=False)
    is_editable = models.BooleanField(default=True)
    
    # Validation
    validation_rules = models.JSONField(default=dict, blank=True, help_text="Validation rules (min, max, regex, etc.)")
    
    # Organization
    sort_order = models.IntegerField(default=0, db_index=True)

    class Meta:
        db_table = "kb_settings"
        ordering = ['category', 'sort_order', 'key']
        unique_together = [('key', 'business')]
        indexes = [
            models.Index(fields=['category', 'sort_order']),
            models.Index(fields=['is_public']),
            models.Index(fields=['key', 'business']),
        ]

    def __str__(self):
        return f"{self.key} ({self.category})"

    def get_value(self):
        """Get the parsed value based on type"""
        if self.value_type == 'integer':
            return int(self.value) if self.value else 0
        elif self.value_type == 'float':
            return float(self.value) if self.value else 0.0
        elif self.value_type == 'boolean':
            return self.value.lower() in ('true', '1', 'yes', 'on')
        elif self.value_type == 'json':
            try:
                return json.loads(self.value) if self.value else {}
            except json.JSONDecodeError:
                return {}
        return self.value

    def set_value(self, value):
        """Set the value with proper type conversion"""
        if self.value_type == 'json':
            self.value = json.dumps(value)
        else:
            self.value = str(value)


# Utility function to get settings
def get_kb_setting(key, default=None, business=None, user=None):
    """Get a KB setting value"""
    try:
        if business is None:
            from django_currentuser.middleware import get_current_user
            user = user or get_current_user()
            if user and getattr(user, 'is_authenticated', False) and getattr(user, 'business', None):
                business = user.business

        if not business:
            return default

        setting = KBSettings.objects.filter(key=key, business=business).first()
        return setting.get_value() if setting else default
    except KBSettings.DoesNotExist:
        return default


class KBAISuggestion(BaseEntity):
    """
    AI-generated suggestions for the knowledge base.

    Two kinds:
      - 'new_article'    — propose a brand-new article (target_article is null)
      - 'update_article' — propose updates to an existing article

    Lifecycle:
      pending -> approved | rejected | superseded

    On approval:
      - new_article    -> create KBArticle with proposed_* fields, status=draft
                          (or 'published' if settings allow auto-publish)
      - update_article -> bump target article's version, preserve previous
                          content in `previous_version_data`, apply proposed_*
                          fields. Previous live version stays served until
                          the new one is published.
    """

    KIND_CHOICES = [
        ('new_article', 'New article'),
        ('update_article', 'Update existing article'),
    ]

    REVIEW_STATUS_CHOICES = [
        ('pending', 'Pending review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('superseded', 'Superseded'),
    ]

    SOURCE_KIND_CHOICES = [
        ('ticket', 'Ticket'),
        ('task', 'Task'),
        ('mixed', 'Mixed'),
    ]

    kind = models.CharField(max_length=24, choices=KIND_CHOICES, default='new_article', db_index=True)
    review_status = models.CharField(
        max_length=16, choices=REVIEW_STATUS_CHOICES, default='pending', db_index=True
    )
    source_kind = models.CharField(
        max_length=16, choices=SOURCE_KIND_CHOICES, default='ticket', db_index=True
    )

    # Optional target: only set for 'update_article' suggestions
    target_article = models.ForeignKey(
        KBArticle, on_delete=models.CASCADE, null=True, blank=True,
        related_name='ai_suggestions', db_index=True,
    )
    suggested_category = models.ForeignKey(
        KBCategory, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='ai_suggestions',
    )

    # Proposed content (what the AI produced). Stored verbatim until approved.
    proposed_title = models.CharField(max_length=500, blank=True)
    proposed_slug = models.SlugField(max_length=520, blank=True)
    proposed_content = models.TextField(blank=True)
    proposed_excerpt = models.TextField(blank=True)
    proposed_tags = models.JSONField(default=list, blank=True)

    # Versioning indicator — "Proposes v{proposed_version}, live is v{current_version}"
    # current_version is null for new_article suggestions.
    current_version = models.PositiveIntegerField(null=True, blank=True)
    proposed_version = models.PositiveIntegerField(default=1)

    # Model confidence (0..1). Null when unknown.
    confidence = models.FloatField(null=True, blank=True, db_index=True)

    # What ticket/task the proposal was learned from. We keep lightweight
    # denormalised refs so we don't tightly couple to those apps' lifecycles.
    source_count = models.PositiveIntegerField(default=0)
    source_refs = models.JSONField(
        default=list, blank=True,
        help_text="List of {kind, id, title} dicts pointing at source tickets/tasks.",
    )

    # Review workflow
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_kb_suggestions',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_reason = models.TextField(blank=True, help_text="Why it was rejected / notes")

    # LLM bookkeeping
    model_name = models.CharField(max_length=80, blank=True)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    prompt_version = models.CharField(max_length=24, blank=True)

    # Flexible bag for anything else (e.g. source excerpts, intermediate signals)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "kb_ai_suggestions"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['review_status', 'kind']),
            models.Index(fields=['target_article', 'review_status']),
            models.Index(fields=['confidence']),
        ]

    def __str__(self):
        label = self.proposed_title or (self.target_article.title if self.target_article else 'untitled')
        return f"[{self.kind}:{self.review_status}] {label}"

    def mark_approved(self, by_user):
        self.review_status = 'approved'
        self.reviewed_by = by_user
        self.reviewed_at = timezone.now()
        self.save(update_fields=['review_status', 'reviewed_by', 'reviewed_at', 'date_updated'])

    def mark_rejected(self, by_user, reason=''):
        self.review_status = 'rejected'
        self.reviewed_by = by_user
        self.reviewed_at = timezone.now()
        self.review_reason = reason or ''
        self.save(update_fields=[
            'review_status', 'reviewed_by', 'reviewed_at', 'review_reason', 'date_updated'
        ])


# Export all models
__all__ = [
    'KBCategory',
    'KBArticle',
    'KBInteraction',
    'KBAnalytics',
    'KBSettings',
    'KBAISuggestion',
    'get_kb_setting',
]

