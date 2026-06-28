// Knowledge Base TypeScript Interfaces
// Adapted for the current frontend structure

export interface KBUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  display_name: string;
  avatar?: string;
  role?: 'admin' | 'agent' | 'staff';
}

export interface KBCategory {
  id: number;
  name: string;
  description?: string;
  slug: string;
  parent?: number;
  children?: KBCategory[];
  icon?: string;
  color?: string;
  status: 'A' | 'I'; // Active/Inactive - matching backend
  article_count: number;
  sort_order: number;
  is_public: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  level?: number;
  path?: string;
}

export interface KBArticle {
  id: number;
  public_path?: string;
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  category: KBCategory;
  author: KBUser;
  published_at: string;
  created_at: string;
  updated_at: string;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  comment_count: number;
  reading_time: number;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  is_featured: boolean;
  is_public: boolean;
  is_pinned?: boolean;
  language: string;
  quality_score?: number;
  seo_score?: number;
  engagement_score?: number;
  helpful_percentage?: number;
  is_published?: boolean;
  
  // SEO fields
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  seo_canonical_url?: string;
  
  // Versioning
  version?: number;
  previous_version_data?: Record<string, unknown>;
  translation_source?: number;
  
  // Scheduling
  scheduled_publish_at?: string;
  last_reviewed_at?: string;
  
  // Additional metadata
  metadata?: Record<string, unknown>;
}

export interface KBInteraction {
  id: string;
  article: number;
  article_title?: string;
  user?: KBUser;
  interaction_type: 'comment' | 'rating' | 'helpful' | 'bookmark';
  content?: string;
  rating?: number;
  is_helpful?: boolean;
  is_approved: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface KBAnalytics {
  id: string;
  article?: number;
  article_title?: string;
  category?: number;
  category_name?: string;
  event_type: 'view' | 'search' | 'interaction' | 'download';
  event_data: Record<string, unknown>;
  user?: KBUser;
  user_username?: string;
  session_id?: string;
  ip_address: string;
  user_agent?: string;
  referrer?: string;
  device_type?: string;
  browser?: string;
  country?: string;
  region?: string;
  city?: string;
  timestamp: string;
  duration?: number;
  date: string;
  hour: number;
}

export interface KBSettings {
  id: number;
  key: string;
  category: string;
  value: string;
  value_type: 'string' | 'number' | 'boolean' | 'json';
  default_value?: string;
  label: string;
  description?: string;
  help_text?: string;
  is_public: boolean;
  is_required: boolean;
  is_editable: boolean;
  validation_rules?: Record<string, unknown>;
  sort_order: number;
  parsed_value?: unknown;
  created_at: string;
  updated_at: string;
  status: 'A' | 'I';
}

// API Response Types
export interface KBPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface KBSearchFilters {
  q?: string; // Search query
  search?: string; // Alternative search param
  category?: string;
  difficulty?: string;
  featured?: boolean;
  language?: string;
  status?: string;
  author?: string;
  tags?: string;
  created_after?: string;
  created_before?: string;
  published_after?: string;
  published_before?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

// Create/Update DTOs
export interface CreateKBCategoryDto {
  name: string;
  description?: string;
  parent?: number;
  icon?: string;
  color?: string;
  sort_order?: number;
  is_public?: boolean;
  is_featured?: boolean;
}

export interface UpdateKBCategoryDto extends Partial<CreateKBCategoryDto> {
  id: number;
}

export interface CreateKBArticleDto {
  title: string;
  content: string;
  excerpt?: string;
  category: number;
  status?: 'draft' | 'review' | 'published' | 'archived';
  is_public?: boolean;
  is_featured?: boolean;
  is_pinned?: boolean;
  tags?: string[];
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
  language?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  scheduled_publish_at?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateKBArticleDto extends Partial<CreateKBArticleDto> {
  id?: number;
}

// Analytics Dashboard Types
export interface KBAnalyticsDashboard {
  total_articles: number;
  total_categories: number;
  period_views: number;
  popular_articles: Array<{
    title: string;
    slug: string;
    view_count: number;
    helpful_count: number;
    category: string;
  }>;
  search_count: number;
  period_days: number;
}

export interface KBSearchResult {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  view_count: number;
  helpful_count: number;
  published_at: string;
  reading_time: number;
  difficulty_level: string;
  relevance_score?: number;
}

// Tree structure for categories
export interface KBCategoryTree extends KBCategory {
  children: KBCategoryTree[];
}

// Error types
export interface KBError {
  message: string;
  code?: string;
  field?: string;
}

export interface KBResponse<T = unknown> {
  data?: T;
  error?: KBError;
  success: boolean;
}

// Settings-specific types for frontend forms
export interface KBSettingsData {
  kb_title: string;
  kb_description: string;
  allow_public_access: boolean;
  enable_comments: boolean;
  enable_ratings: boolean;
  enable_search: boolean;
  articles_per_page: number;
  default_article_status: 'draft' | 'published';
  require_approval: boolean;
  seo_enabled: boolean;
  analytics_enabled: boolean;
}

// Public settings interface (subset of KBSettings for public consumption)
export interface KBPublicSettings {
  kb_title?: string;
  kb_description?: string;
  allow_public_access?: boolean;
  enable_comments?: boolean;
  enable_ratings?: boolean;
  enable_search?: boolean;
  articles_per_page?: number;
  seo_enabled?: boolean;
}
