import React, { useState, useEffect } from 'react';
import { 
  Search, 
  BookOpen, 
  TrendingUp, 
  Star, 
  Clock,
  ChevronRight,
  Heart,
  Bookmark,
  Eye,
  User
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useKnowledgeStore } from '../../../stores/knowledgeStore';
import { KBCategory } from '../../../types/knowledge';
import SEOMetaTags from '../shared/SEOMetaTags';
import { LoginPrompt } from '../../../components/knowledge/LoginPrompt';
import { useAuthStore } from '../../../stores/authStore';
import MasonryGrid from '../../../components/knowledge/MasonryGrid';
import ArticleCard from '../../../components/knowledge/ArticleCard';
import CategoryIcon from '../../../components/knowledge/CategoryIcon';
import AdvancedSearch, { SearchFilters } from '../../../components/knowledge/AdvancedSearch';

const PublicKBInterface: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const { isAuthenticated } = useAuthStore();
  const { articles, categories, isLoading, fetchArticles, fetchCategories } = useKnowledgeStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [viewMode, setViewMode] = useState<'featured' | 'popular' | 'recent' | 'search'>('featured');
  const [likedArticles, setLikedArticles] = useState<Set<string>>(new Set());
  const [bookmarkedArticles, setBookmarkedArticles] = useState<Set<string>>(new Set());
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginPromptAction, setLoginPromptAction] = useState('');
  const [useAdvancedSearch, setUseAdvancedSearch] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    category: '',
    tags: [],
    sortBy: 'relevance',
    sortOrder: 'desc',
    dateRange: {},
    minRating: undefined,
    author: ''
  });

  useEffect(() => {
    // Always fetch categories and published articles on component mount
    fetchCategories();
    fetchArticles({ status: 'published' });
  }, [fetchCategories, fetchArticles]);

  // Handle category filtering from URL
  useEffect(() => {
    if (slug && categories.length > 0) {
      const category = categories.find(cat => cat.slug === slug);
      if (category) {
        setSelectedCategory(category.slug);
        fetchArticles({ 
          status: 'published',
          category: category.slug
        });
        setViewMode('search');
      }
    }
  }, [slug, categories, fetchArticles]);

  const handleSearch = () => {
    if (searchQuery.trim() || selectedCategory) {
      fetchArticles({ 
        status: 'published',
        q: searchQuery.trim() || undefined,
        category: selectedCategory || undefined
      });
      setViewMode('search');
    } else {
      // Reset to show all published articles
      fetchArticles({ status: 'published' });
      setViewMode('featured');
    }
  };

  const handleCategoryChange = (categorySlug: string) => {
    setSelectedCategory(categorySlug);
    fetchArticles({ 
      status: 'published',
      category: categorySlug || undefined,
      q: searchQuery.trim() || undefined
    });
    setViewMode('search');
  };

  const handleLike = (articleId: string) => {
    if (!isAuthenticated) {
      setLoginPromptAction('like this article');
      setShowLoginPrompt(true);
      return;
    }
    
    setLikedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      return newSet;
    });
  };

  const handleBookmark = (articleId: string) => {
    if (!isAuthenticated) {
      setLoginPromptAction('save this article');
      setShowLoginPrompt(true);
      return;
    }
    
    setBookmarkedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      return newSet;
    });
  };

  const getFilteredArticles = () => {
    const publishedArticles = articles.filter(article => article.status === 'published');
    
    switch (viewMode) {
      case 'featured':
        return publishedArticles.filter(article => article.is_featured).slice(0, 6);
      case 'popular':
        return publishedArticles.sort((a, b) => b.view_count - a.view_count).slice(0, 12);
      case 'recent':
        return publishedArticles.sort((a, b) => 
          new Date(b.published_at || b.created_at).getTime() - 
          new Date(a.published_at || a.created_at).getTime()
        ).slice(0, 12);
      case 'search':
        return publishedArticles;
      default:
        return publishedArticles.slice(0, 6);
    }
  };

  // Filter categories to only show public ones (hide internal folders)
  const getPublicCategories = () => {
    return categories.filter(category => category.is_public !== false);
  };

  const handleAdvancedSearch = () => {
    const params: Record<string, unknown> = { 
      status: 'published'
    };
    
    if (searchFilters.query.trim()) {
      params.q = searchFilters.query.trim();
    }
    
    if (searchFilters.category) {
      params.category = searchFilters.category;
    }
    
    if (searchFilters.author) {
      params.author = searchFilters.author;
    }
    
    // Apply sorting
    if (searchFilters.sortBy !== 'relevance') {
      params.sortBy = searchFilters.sortBy;
      params.sortOrder = searchFilters.sortOrder;
    }
    
    fetchArticles(params);
    setViewMode('search');
  };

  const toggleAdvancedSearch = () => {
    setUseAdvancedSearch(!useAdvancedSearch);
  };

  const CategoryCard: React.FC<{ category: KBCategory }> = ({ category }) => {
    return (
      <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle p-6 hover:shadow-lg transition-all duration-200 group">
        <div className="flex items-center gap-3 mb-3">
          <div 
            className="p-3 rounded-lg flex items-center justify-center"
            style={{ 
              backgroundColor: `${category.color}20`, 
              color: category.color 
            }}
          >
            <CategoryIcon name={category.icon || 'folder'} className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              {category.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-[var(--text-primary)]">
              {category.article_count} articles
            </p>
          </div>
        </div>
        {category.description && (
          <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4 line-clamp-2">
            {category.description}
          </p>
        )}
        <Link to={`/knowledge-base/categories/${category.slug}`}>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full group-hover:border-primary-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
          >
            Explore Category
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <>
      <SEOMetaTags
        title={slug ? `${categories.find(cat => cat.slug === slug)?.name || 'Category'} - SafariDesk Knowledge Base` : "SafariDesk Knowledge Base - Documentation & Support"}
        description="Find answers, learn new things, and get the help you need with SafariDesk's comprehensive knowledge base and documentation."
        keywords={['knowledge base', 'documentation', 'help', 'support', 'safaridesk', 'guides', 'tutorials']}
        type="website"
      />
      <div className="min-h-screen bg-gray-50 dark:bg-surface">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Knowledge Base
              </h1>
              <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
                Find answers, learn new things, and get the help you need
              </p>
              
              {/* Search Section */}
              <div className="max-w-4xl mx-auto">
                {useAdvancedSearch ? (
                  <AdvancedSearch
                    categories={getPublicCategories()}
                    filters={searchFilters}
                    onFiltersChange={setSearchFilters}
                    onSearch={handleAdvancedSearch}
                    isLoading={isLoading}
                  />
                ) : (
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <Input
                        type="text"
                        placeholder="Search for articles, guides, or topics..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        icon={Search}
                        iconPosition="left"
                        className="h-12 text-lg"
                      />
                    </div>
                    <select
                      value={selectedCategory}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="px-4 h-12 border border-gray-300 dark:border-subtle rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">All Categories</option>
                      {getPublicCategories().map(category => (
                        <option key={category.slug} value={category.slug}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <Button onClick={handleSearch} size="lg" variant="secondary">
                      Search
                    </Button>
                  </div>
                )}
                
                {/* Toggle Advanced Search */}
                <div className="mt-4 text-center">
                  <Button
                    variant="ghost"
                    onClick={toggleAdvancedSearch}
                    className="text-primary-100 hover:text-white text-sm"
                  >
                    {useAdvancedSearch ? 'Simple Search' : 'Advanced Search'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Featured Articles Hero Section */}
          {viewMode === 'featured' && getFilteredArticles().length > 0 && (
            <div className="mb-16">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-[var(--text-primary)] mb-8 text-center">
                Featured Articles
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {getFilteredArticles().slice(0, 2).map((article) => {
                  const featuredImage = article.metadata?.featured_image;
                  const hasValidImage = featuredImage && typeof featuredImage === 'string';
                  
                  return (
                    <div 
                      key={article.slug}
                      className="bg-white dark:bg-surface-elevated rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 group"
                    >
                      {hasValidImage ? (
                        <div className="relative h-64 lg:h-80 overflow-hidden">
                          <img
                            src={featuredImage as string}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                          <div className="absolute top-4 left-4">
                            <span className="bg-primary-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                              <Star className="h-3 w-3 fill-current" />
                              Featured
                            </span>
                          </div>
                          <div className="absolute bottom-4 left-4 right-4">
                            <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
                              <span className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded-md">
                                {article.category?.name || 'Uncategorized'}
                              </span>
                              <span>•</span>
                              <span>{article.reading_time} min read</span>
                            </div>
                            <h3 className="text-xl lg:text-2xl font-bold text-white mb-2 line-clamp-2">
                              <Link 
                                to={`/knowledge-base/articles/${article.slug}`}
                                className="hover:text-primary-200 transition-colors"
                              >
                                {article.title}
                              </Link>
                            </h3>
                          </div>
                        </div>
                      ) : null}
                      
                      <div className="p-6">
                        {article.excerpt && (
                          <p className="text-gray-600 dark:text-[var(--text-primary)] mb-4 line-clamp-3">
                            {article.excerpt}
                          </p>
                        )}
                        
                        {article.tags && article.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {article.tags.slice(0, 3).map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-[var(--text-primary)]">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {article.view_count || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(article.published_at || article.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {article.author && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {article.author.display_name || `${article.author.first_name || ''} ${article.author.last_name || ''}`.trim() || 'Unknown Author'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* More Featured Articles */}
              {getFilteredArticles().length > 2 && (
                <div className="mt-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {getFilteredArticles().slice(2).map((article) => (
                      <ArticleCard key={article.slug} article={article} baseUrl="/knowledge-base/articles" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Links */}
          {viewMode !== 'featured' && (
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
                  {viewMode === 'popular' ? 'Popular Articles' : 
                   viewMode === 'recent' ? 'Recent Articles' : 'Search Results'}
                </h2>
                <div className="flex items-center gap-2">
                  {[
                    { key: 'featured', label: 'Featured', icon: Star },
                    { key: 'popular', label: 'Popular', icon: TrendingUp },
                    { key: 'recent', label: 'Recent', icon: Clock },
                  ].map(({ key, label, icon: Icon }) => (
                    <Button
                      key={key}
                      variant={viewMode === key ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode(key as 'featured' | 'popular' | 'recent')}
                      className="flex items-center gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="w-full">
                {getFilteredArticles().length > 0 ? (
                  <MasonryGrid 
                    articles={getFilteredArticles()} 
                    baseUrl="/knowledge-base/articles"
                  />
                ) : (
                  <div className="text-center py-12">
                    <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-2">
                      No articles found
                    </h3>
                    <p className="text-gray-600 dark:text-[var(--text-primary)]">
                      {viewMode === 'search' 
                        ? 'Try adjusting your search terms or category filter.' 
                        : 'Check back later for new content.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Categories */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)] mb-6">
              Browse by Category
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {getPublicCategories().length > 0 ? (
                getPublicCategories().slice(0, 8).map(category => (
                  <CategoryCard key={category.slug} category={category} />
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-2">
                    No categories available
                  </h3>
                  <p className="text-gray-600 dark:text-[var(--text-primary)]">
                    Categories will appear here as content is added.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Popular Articles */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)] mb-6">
              Most Popular Articles
            </h2>
            <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle">
              {articles
                .filter(article => article.status === 'published')
                .sort((a, b) => b.view_count - a.view_count)
                .slice(0, 5)
                .map((article, index) => (
                  <div 
                    key={article.slug}
                    className={`p-6 flex items-center gap-4 ${
                      index < 4 ? 'border-b border-gray-200 dark:border-subtle' : ''
                    }`}
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-1">
                        <Link 
                          to={`/knowledge-base/articles/${article.slug}`}
                          className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        >
                          {article.title}
                        </Link>
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-[var(--text-primary)]">
                        {article.category?.name || 'Uncategorized'} • {article.view_count} views
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLike(article.slug)}
                        className={`${likedArticles.has(article.slug) ? 'text-red-600' : 'text-gray-500'}`}
                      >
                        <Heart className={`h-4 w-4 ${likedArticles.has(article.slug) ? 'fill-red-600' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBookmark(article.slug)}
                        className={`${bookmarkedArticles.has(article.slug) ? 'text-primary-600' : 'text-gray-500'}`}
                      >
                        <Bookmark className={`h-4 w-4 ${bookmarkedArticles.has(article.slug) ? 'fill-primary-600' : ''}`} />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
        
        {/* Login Prompt Modal */}
        {showLoginPrompt && (
          <LoginPrompt 
            action={loginPromptAction}
            onClose={() => setShowLoginPrompt(false)}
          />
        )}
      </div>
    </>
  );
};

export default PublicKBInterface;
