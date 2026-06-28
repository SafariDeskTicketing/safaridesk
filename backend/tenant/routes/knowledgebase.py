# Knowledge Base Routes
from django.urls import path
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from tenant.views.KnowledgeBaseView import (
    KBCategoryViewSet, KBArticleViewSet, KBAnalyticsViewSet, KBSettingsViewSet,
    KBAISuggestionViewSet, KBAskAIView, KBArticleVersionsView, AIUsageView,
)

# CORS OPTIONS handler for KB endpoints
@csrf_exempt
@require_http_methods(["OPTIONS"])
def kb_cors_options(request):
    """Handle CORS preflight requests for KB endpoints"""
    response = HttpResponse()
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    response['Access-Control-Allow-Headers'] = 'Origin, Content-Type, Accept, Authorization, X-Requested-With'
    response['Access-Control-Allow-Credentials'] = 'true'
    return response

urlpatterns = [
    # Category endpoints
    path('categories/', KBCategoryViewSet.as_view({'get': 'list', 'post': 'create'}), name='kb_categories'),
    path('categories/count/', KBCategoryViewSet.as_view({'get': 'count'}), name='kb_categories_count'),
    path('categories/public/', KBCategoryViewSet.as_view({'get': 'public_list'}), name='kb_categories_public'),
    path('categories/tree/', KBCategoryViewSet.as_view({'get': 'tree'}), name='kb_categories_tree'),
    path('categories/<slug:slug>/', KBCategoryViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='kb_category_detail'),
    path('categories/<slug:slug>/articles/', KBCategoryViewSet.as_view({'get': 'articles'}), name='kb_category_articles'),
    
    # Article endpoints
    path('articles/', KBArticleViewSet.as_view({'get': 'list', 'post': 'create'}), name='kb_articles'),
    path('articles/count/', KBArticleViewSet.as_view({'get': 'count'}), name='kb_articles_count'),
    path('articles/search/', KBArticleViewSet.as_view({'get': 'search'}), name='kb_articles_search'),
    path('articles/public-search/', KBArticleViewSet.as_view({'get': 'public_search'}), name='kb_articles_public_search'),
    path('articles/featured/', KBArticleViewSet.as_view({'get': 'featured'}), name='kb_articles_featured'),
    path('articles/popular/', KBArticleViewSet.as_view({'get': 'popular'}), name='kb_articles_popular'),
    path('articles/public/', KBArticleViewSet.as_view({'get': 'public_articles'}), name='kb_articles_public'),
    path('articles/upload_image/', KBArticleViewSet.as_view({'post': 'upload_image'}), name='kb_articles_upload_image'),
    path('articles/<slug:slug>/', KBArticleViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='kb_article_detail'),
    path('articles/<slug:slug>/approve/', KBArticleViewSet.as_view({'post': 'approve'}), name='kb_article_approve'),
    path('articles/<slug:slug>/reject/', KBArticleViewSet.as_view({'post': 'reject'}), name='kb_article_reject'),
    path('articles/<slug:slug>/helpful/', KBArticleViewSet.as_view({'post': 'helpful'}), name='kb_article_helpful'),
    path('articles/<slug:slug>/interact/', KBArticleViewSet.as_view({'post': 'interact'}), name='kb_article_interact'),
    path('articles/<slug:slug>/upload_featured_image/', KBArticleViewSet.as_view({'post': 'upload_featured_image'}), name='kb_article_upload_featured_image'),
    path('articles/<slug:slug>/versions/', KBArticleVersionsView.as_view({'get': 'list'}), name='kb_article_versions'),

    # AI Suggestions endpoints (admin-only review queue for KB Learning)
    path('ai-suggestions/', KBAISuggestionViewSet.as_view({'get': 'list', 'post': 'create'}), name='kb_ai_suggestions'),
    path('ai-suggestions/generate/', KBAISuggestionViewSet.as_view({'post': 'generate'}), name='kb_ai_suggestions_generate'),
    path('ai-suggestions/<int:pk>/', KBAISuggestionViewSet.as_view({'get': 'retrieve', 'delete': 'destroy'}), name='kb_ai_suggestion_detail'),
    path('ai-suggestions/<int:pk>/approve/', KBAISuggestionViewSet.as_view({'post': 'approve'}), name='kb_ai_suggestion_approve'),
    path('ai-suggestions/<int:pk>/reject/', KBAISuggestionViewSet.as_view({'post': 'reject'}), name='kb_ai_suggestion_reject'),

    # Ask AI — grounded RAG over visible KB articles
    path('ask-ai/', KBAskAIView.as_view({'post': 'create'}), name='kb_ask_ai'),
    path('ai-usage/', AIUsageView.as_view({'get': 'list', 'patch': 'partial_update'}), name='kb_ai_usage'),

    # Analytics endpoints
    path('analytics/', KBAnalyticsViewSet.as_view({'get': 'list'}), name='kb_analytics'),
    path('analytics/dashboard/', KBAnalyticsViewSet.as_view({'get': 'dashboard'}), name='kb_analytics_dashboard'),
    path('analytics/activity_feed/', KBAnalyticsViewSet.as_view({'get': 'activity_feed'}), name='kb_analytics_activity_feed'),
    
    # Settings endpoints
    path('settings/', KBSettingsViewSet.as_view({'get': 'list', 'post': 'create'}), name='kb_settings'),
    path('settings/public/', KBSettingsViewSet.as_view({'get': 'public'}), name='kb_settings_public'),
    path('settings/<str:key>/', KBSettingsViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='kb_setting_detail'),
]
