import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Search, BookOpen, Folder, FileText, ArrowRight, ArrowLeft,
  ChevronRight, Zap, CreditCard, User, AlertCircle, Settings,
  Shield, Users, MessageCircle, TrendingUp, X,
} from 'lucide-react';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { CustomerLayout } from './layout/CustomerLayout';
import { useValidateDomain } from '../../hooks/useValidateDomain';
import { KBArticle, KBCategory } from '../../types/knowledge';
import { buildPublicArticleUrl } from '../../utils/kbArticle';
import { formatShortDate } from '../../utils/displayHelpers';

const getResponseResults = <T,>(data: T[] | { results?: T[] } | undefined): T[] => {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.results) ? data.results : [];
};

// Auto-assign a Lucide icon based on category name keywords
const ICON_MAP: Array<{ test: RegExp; Icon: React.ElementType }> = [
  { test: /start|begin|setup|onboard|welcome|quickstart/i, Icon: Zap },
  { test: /bill|payment|invoice|subscri|price|plan/i, Icon: CreditCard },
  { test: /account|profile|login|password|sign in|auth/i, Icon: User },
  { test: /troubleshoot|error|issue|problem|bug|fix/i, Icon: AlertCircle },
  { test: /config|setting|admin|general|preference/i, Icon: Settings },
  { test: /security|privac|gdpr|compli/i, Icon: Shield },
  { test: /team|staff|agent|employee|people/i, Icon: Users },
  { test: /ticket|support|request|case|contact/i, Icon: MessageCircle },
];

const getCategoryIcon = (name: string): React.ElementType => {
  for (const { test, Icon } of ICON_MAP) {
    if (test.test(name)) return Icon;
  }
  return BookOpen;
};

// Skeleton components
const CategoryCardSkeleton: React.FC = () => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-subtle dark:bg-surface-elevated">
    <div className="flex items-start gap-4">
      <div className="sd-shimmer h-10 w-10 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="sd-shimmer h-4 w-2/3 rounded" />
        <div className="sd-shimmer h-3 rounded" />
        <div className="sd-shimmer h-3 w-1/3 rounded" />
      </div>
    </div>
  </div>
);

const ArticleRowSkeleton: React.FC = () => (
  <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 dark:border-subtle">
    <div className="sd-shimmer h-9 w-9 shrink-0 rounded-lg" />
    <div className="flex-1 space-y-2 pt-1">
      <div className="sd-shimmer h-4 w-3/4 rounded" />
      <div className="sd-shimmer h-3 w-1/2 rounded" />
    </div>
  </div>
);

const KnowledgeBasePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { businessId } = useValidateDomain();

  // Settings
  const [loading, setLoading] = useState(true);
  const [publicAccessEnabled, setPublicAccessEnabled] = useState(true);
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [kbTitle, setKbTitle] = useState('Knowledge Base');
  const [kbDescription, setKbDescription] = useState('Find answers and solutions to common questions.');
  const [articlesPerPage, setArticlesPerPage] = useState(20);

  // Data
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [popularArticles, setPopularArticles] = useState<KBArticle[]>([]);
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  const isHomeView = selectedCategory === null && searchQuery === '';

  // Initial data fetch: settings + categories + popular articles
  useEffect(() => {
    const fetchData = async () => {
      if (!businessId) return;
      setLoading(true);
      try {
        let pageSize = 20;
        try {
          const settingsRes = await http.get(APIS.KB_SETTINGS_PUBLIC, {
            params: { business_id: businessId },
            skipAuth: true,
          } as any);
          const s = settingsRes.data || {};
          setPublicAccessEnabled(s.allow_public_access !== false);
          setSearchEnabled(s.enable_search !== false);
          pageSize = Number(s.articles_per_page) || 20;
          setArticlesPerPage(pageSize);
          if (s.kb_title) setKbTitle(String(s.kb_title));
          if (s.kb_description) setKbDescription(String(s.kb_description));
        } catch {
          // leave defaults
        }

        const [categoriesRes, popularRes] = await Promise.all([
          http.get(APIS.PUBLIC_KB_CATEGORIES, {
            params: { business_id: businessId },
            skipAuth: true,
          } as any),
          http.get(APIS.KB_ARTICLES_POPULAR, {
            params: { business_id: businessId, page_size: 6 },
            skipAuth: true,
          } as any).catch(() => ({ data: [] })),
        ]);

        setCategories(getResponseResults<KBCategory>(categoriesRes.data));
        setPopularArticles(getResponseResults<KBArticle>(popularRes.data));
      } catch {
        setError('Failed to load knowledge base. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [businessId]);

  // If URL has ?q= on mount, trigger search after initial load completes
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && businessId && !loading) {
      performSearch(q);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, businessId]);

  const performSearch = (query: string) => {
    if (!searchEnabled || !businessId) return;
    setArticlesLoading(true);
    setError(null);
    http.get(APIS.PUBLIC_KB_SEARCH, {
      params: { business_id: businessId, q: query },
      skipAuth: true,
    } as any)
      .then(res => setArticles(getResponseResults<KBArticle>(res.data)))
      .catch(() => setError('Search failed. Please try again.'))
      .finally(() => setArticlesLoading(false));
  };

  const fetchCategoryArticles = (slug: string) => {
    if (!businessId) return;
    setArticlesLoading(true);
    setError(null);
    http.get(APIS.PUBLIC_KB_ARTICLES, {
      params: { business_id: businessId, page_size: articlesPerPage, category_slug: slug },
      skipAuth: true,
    } as any)
      .then(res => setArticles(getResponseResults<KBArticle>(res.data)))
      .catch(() => setError('Failed to load articles.'))
      .finally(() => setArticlesLoading(false));
  };

  const handleCategoryClick = (slug: string) => {
    setSearchQuery('');
    setSelectedCategory(slug);
    setError(null);
    fetchCategoryArticles(slug);
  };

  const handleBackToHome = () => {
    setSelectedCategory(null);
    setSearchQuery('');
    setArticles([]);
    setError(null);
    navigate('/helpcenter/kb', { replace: true });
  };

  // Debounced search — fires when searchQuery changes
  useEffect(() => {
    if (!businessId) return;
    if (searchQuery.length === 0) {
      if (selectedCategory) {
        fetchCategoryArticles(selectedCategory);
      } else {
        setArticles([]);
      }
      return;
    }
    const timer = setTimeout(() => {
      if (searchQuery.length > 2) {
        performSearch(searchQuery);
      }
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, businessId]);

  const selectedCategoryData = selectedCategory
    ? categories.find(c => c.slug === selectedCategory) ?? null
    : null;

  const headingText = searchQuery.length > 2
    ? `Results for "${searchQuery}"`
    : selectedCategoryData?.name ?? 'All articles';

  if (loading) {
    return (
      <CustomerLayout fullWidth>
        <div className="w-full">
          <div className="border-b border-slate-200 px-6 pb-10 pt-8 text-center dark:border-subtle sm:px-8 lg:px-12">
            <div className="sd-shimmer mx-auto mb-4 h-12 w-12 rounded-xl" />
            <div className="sd-shimmer mx-auto mb-3 h-9 w-64 rounded-lg" />
            <div className="sd-shimmer mx-auto mb-7 h-5 w-80 rounded" />
            <div className="sd-shimmer mx-auto h-16 w-full max-w-3xl rounded-full" />
          </div>
          <div className="px-6 py-8 sm:px-8 lg:px-12">
            <div className="sd-shimmer mb-5 h-6 w-44 rounded" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => <CategoryCardSkeleton key={i} />)}
            </div>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout fullWidth>
      <div className="w-full">

        {/* Always-visible header: title + description + search */}
        <section className="border-b border-slate-200 px-6 pb-8 pt-8 text-center dark:border-subtle sm:px-8 lg:px-12">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-[var(--text-primary)] sm:text-4xl">
            {kbTitle}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-600 dark:text-[var(--text-muted)]">
            {kbDescription}
          </p>

          {searchEnabled && (
            <div className="relative mx-auto mt-7 max-w-3xl">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-14 w-full rounded-full border border-slate-200 bg-white pl-14 pr-12 text-base text-slate-900 shadow-md placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/15 dark:border-subtle dark:bg-surface-elevated dark:text-[var(--text-primary)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); navigate('/helpcenter/kb', { replace: true }); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-surface-hover"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </section>

        {!publicAccessEnabled && (
          <div className="mx-6 mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-100 sm:mx-8 lg:mx-12">
            This knowledge base is currently not public.
          </div>
        )}

        {publicAccessEnabled && (
          <>
            {isHomeView ? (
              /* ── HOME VIEW: category grid + popular articles ── */
              <div className="px-6 pb-12 sm:px-8 lg:px-12">

                {/* Category grid */}
                <section className="py-8">
                  <h2 className="mb-5 text-lg font-semibold text-slate-900 dark:text-[var(--text-primary)]">
                    Browse by category
                  </h2>
                  {categories.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {categories.map(cat => {
                        const Icon = getCategoryIcon(cat.name);
                        const iconStyle: React.CSSProperties = cat.color
                          ? { backgroundColor: cat.color + '1a', color: cat.color }
                          : { backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)' };
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleCategoryClick(cat.slug)}
                            className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-primary-300 hover:shadow-md dark:border-subtle dark:bg-surface-elevated dark:hover:bg-surface-hover"
                          >
                            <span
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                              style={iconStyle}
                            >
                              <Icon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-slate-900 transition-colors group-hover:text-primary-700 dark:text-[var(--text-primary)] dark:group-hover:text-primary-300">
                                {cat.name}
                              </span>
                              {cat.description && (
                                <span className="mt-1 block text-[length:var(--font-meta)] text-[var(--text-muted)] line-clamp-2">
                                  {cat.description}
                                </span>
                              )}
                              <span className="mt-2 block text-[length:var(--font-meta)] text-[var(--text-muted)]">
                                {cat.article_count} {cat.article_count === 1 ? 'article' : 'articles'}
                              </span>
                            </span>
                            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-surface-hover">
                        <Folder className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-[var(--text-primary)]">No categories yet</p>
                      <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-muted)]">
                        Categories will appear here once they are created and made public.
                      </p>
                    </div>
                  )}
                </section>

                {/* Popular articles */}
                {popularArticles.length > 0 && (
                  <section className="border-t border-slate-200 pt-8 dark:border-subtle">
                    <div className="mb-5 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary-700 dark:text-primary-300" />
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-[var(--text-primary)]">
                        Popular articles
                      </h2>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-subtle dark:bg-surface-elevated">
                      {popularArticles.map(article => (
                        <Link
                          key={article.id}
                          to={buildPublicArticleUrl('/helpcenter/kb', article)}
                          className="group flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 transition-colors hover:bg-slate-50 dark:border-subtle dark:hover:bg-surface-hover"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-surface-hover dark:text-[var(--text-muted)]">
                            <FileText className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-primary-700 dark:text-[var(--text-primary)] dark:group-hover:text-primary-300">
                              {article.title}
                            </span>
                            {article.category && (
                              <span className="mt-0.5 block text-[length:var(--font-meta)] text-[var(--text-muted)]">
                                {article.category.name}
                              </span>
                            )}
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              /* ── ARTICLES VIEW: category or search results ── */
              <div className="px-6 py-6 pb-12 sm:px-8 lg:px-12">

                {/* Back + breadcrumb */}
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleBackToHome}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary-300 hover:text-primary-700 dark:border-subtle dark:bg-surface-elevated dark:text-[var(--text-primary)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    All categories
                  </button>
                  {selectedCategoryData && (
                    <nav className="flex items-center gap-1.5 text-[length:var(--font-meta)] text-[var(--text-muted)]">
                      <button
                        type="button"
                        onClick={handleBackToHome}
                        className="hover:text-primary-700 dark:hover:text-primary-300"
                      >
                        Knowledge Base
                      </button>
                      <ChevronRight className="h-3 w-3" />
                      <span className="font-medium text-slate-900 dark:text-[var(--text-primary)]">
                        {selectedCategoryData.name}
                      </span>
                    </nav>
                  )}
                </div>

                {/* Section heading */}
                <div className="mb-5">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-[var(--text-primary)]">
                    {headingText}
                  </h2>
                  {selectedCategoryData?.description && (
                    <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-muted)]">
                      {selectedCategoryData.description}
                    </p>
                  )}
                  {!articlesLoading && (
                    <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-muted)]">
                      {articles.length} {articles.length === 1 ? 'article' : 'articles'}
                    </p>
                  )}
                </div>

                {/* Article list */}
                {articlesLoading ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-subtle dark:bg-surface-elevated">
                    {[...Array(5)].map((_, i) => <ArticleRowSkeleton key={i} />)}
                  </div>
                ) : error ? (
                  <div className="rounded-lg border p-4 text-sm"
                    style={{ borderColor: 'var(--status-danger-border)', backgroundColor: 'var(--status-danger-bg)', color: 'var(--status-danger-text)' }}
                  >
                    {error}
                  </div>
                ) : articles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-surface-hover">
                      <FileText className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-[var(--text-primary)]">No articles found</p>
                    <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-muted)]">
                      {searchQuery ? `No results for "${searchQuery}".` : 'No published articles in this category yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-subtle dark:bg-surface-elevated">
                    {articles.map(article => (
                      <Link
                        key={article.id}
                        to={buildPublicArticleUrl('/helpcenter/kb', article)}
                        className="group flex items-start gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 transition-colors hover:bg-slate-50 dark:border-subtle dark:hover:bg-surface-hover"
                      >
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-surface-hover dark:text-[var(--text-muted)]">
                          <FileText className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900 transition-colors group-hover:text-primary-700 dark:text-[var(--text-primary)] dark:group-hover:text-primary-300">
                            {article.title}
                          </span>
                          {article.excerpt && (
                            <span className="mt-1 block text-[length:var(--font-meta)] text-[var(--text-muted)] line-clamp-1">
                              {article.excerpt}
                            </span>
                          )}
                          <span className="mt-1 block text-[length:var(--font-meta)] text-[var(--text-muted)]">
                            {article.reading_time ? `${article.reading_time} min read · ` : ''}
                            Updated {formatShortDate(article.updated_at)}
                          </span>
                        </span>
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </CustomerLayout>
  );
};

export default KnowledgeBasePage;
