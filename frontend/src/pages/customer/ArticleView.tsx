import React, { useEffect, useState } from 'react';
import { sanitizeHTML } from '../../utils/sanitize';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Share2,
  User,
  Calendar,
  ThumbsDown,
  ThumbsUp,
  FileText,
  ArrowRight
} from 'lucide-react';
import { useValidateDomain } from '../../hooks/useValidateDomain';
import SEOMetaTags from '../knowledge/shared/SEOMetaTags';
import { CustomerLayout } from './layout/CustomerLayout';
import { KBArticle } from '../../types/knowledge';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { buildPublicArticleUrl } from '../../utils/kbArticle';

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return 'Unknown date';
  }
};

const ArticleDetailSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-6">
    <div className="h-6 bg-gray-200 dark:bg-surface-hover rounded w-1/4"></div>
    <div className="h-10 bg-gray-200 dark:bg-surface-hover rounded w-3/4"></div>
    <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-1/2"></div>
    <div className="space-y-3">
      <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded"></div>
      <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-5/6"></div>
      <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-3/4"></div>
    </div>
  </div>
);

const ArticleView: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [currentArticle, setCurrentArticle] = useState<KBArticle | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<KBArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [ratingsEnabled, setRatingsEnabled] = useState(true);
  const { businessId } = useValidateDomain();

  useEffect(() => {
    const fetchArticle = async () => {
      if (slug && businessId) {
        try {
          const [response, settingsResponse] = await Promise.all([
            http.get(`${APIS.KB_ARTICLE_DETAIL}${slug}/`, {
              params: businessId ? { business_id: businessId } : undefined,
              skipAuth: true,
            } as any),
            http.get(APIS.KB_SETTINGS_PUBLIC, {
              params: { business_id: businessId },
              skipAuth: true,
            } as any).catch(() => ({ data: {} })),
          ]);
          const article: KBArticle = response.data;
          setCurrentArticle(article);
          setRatingsEnabled(settingsResponse.data?.enable_ratings !== false);

          if (article.category?.slug && businessId) {
            http.get(APIS.PUBLIC_KB_ARTICLES, {
              params: { business_id: businessId, category_slug: article.category.slug, page_size: 5 },
              skipAuth: true,
            } as any)
              .then(res => {
                const results: KBArticle[] = Array.isArray(res.data)
                  ? res.data
                  : (Array.isArray(res.data?.results) ? res.data.results : []);
                setRelatedArticles(results.filter(a => a.id !== article.id).slice(0, 4));
              })
              .catch(() => {});
          }
        } catch (error) {
          console.error("Failed to fetch article", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchArticle();
  }, [slug, businessId]);

  useEffect(() => {
    if (!slug) return;
    const savedFeedback = window.localStorage.getItem(`kb-feedback:${slug}`);
    if (savedFeedback === 'helpful' || savedFeedback === 'not_helpful') {
      setFeedback(savedFeedback);
    } else {
      setFeedback(null);
    }
    setFeedbackError(null);
  }, [slug]);

  const handleHelpfulVote = async (isHelpful: boolean) => {
    if (!slug || !businessId || !ratingsEnabled || feedback || isSubmittingFeedback) return;

    setIsSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      const response = await http.post(
        `${APIS.KB_ARTICLE_DETAIL}${slug}/helpful/`,
        { is_helpful: isHelpful },
        {
          params: { business_id: businessId },
          skipAuth: true,
        } as any
      );

      const nextFeedback = isHelpful ? 'helpful' : 'not_helpful';
      setFeedback(nextFeedback);
      window.localStorage.setItem(`kb-feedback:${slug}`, nextFeedback);
      setCurrentArticle((article) => article ? {
        ...article,
        helpful_count: response.data.helpful_count ?? article.helpful_count,
        not_helpful_count: response.data.not_helpful_count ?? article.not_helpful_count,
        helpful_percentage: response.data.helpful_percentage ?? article.helpful_percentage,
      } : article);
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Unable to record your feedback right now.';
      setFeedbackError(message);
      if (message.toLowerCase().includes('already voted')) {
        const nextFeedback = isHelpful ? 'helpful' : 'not_helpful';
        setFeedback(nextFeedback);
        window.localStorage.setItem(`kb-feedback:${slug}`, nextFeedback);
      }
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share && currentArticle) {
      try {
        await navigator.share({
          title: currentArticle.title,
          text: (currentArticle.content || '').substring(0, 200) + '...',
          url: window.location.href,
        });
      } catch {
        navigator.clipboard.writeText(window.location.href);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (isLoading || !currentArticle) {
    return (
      <CustomerLayout fullWidth>
        <div className="mx-auto max-w-4xl">
          <ArticleDetailSkeleton />
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout fullWidth>
      <SEOMetaTags
        title={`${currentArticle.title} | Knowledge Base`}
        description={currentArticle.excerpt || (currentArticle.content || '').substring(0, 160)}
        keywords={[
          currentArticle.title,
          ...(currentArticle.tags || []),
          currentArticle.category?.name || '',
          'knowledge base',
          'help'
        ].filter(Boolean).join(', ')}
      />

      <div className="w-full">
        <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 px-4 pb-5 pt-5 dark:border-subtle sm:px-5 lg:px-6 md:flex-row md:items-center md:justify-between">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary-300 hover:text-primary-700 dark:border-subtle dark:bg-surface-elevated dark:text-[var(--text-primary)]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <nav className="flex min-w-0 items-center gap-2 text-sm text-slate-500 dark:text-[var(--text-muted)]">
            <button type="button" onClick={() => navigate('/helpcenter/kb')} className="hover:text-primary-700 dark:hover:text-primary-300">
              Knowledge Base
            </button>
            {currentArticle.category && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="max-w-[180px] truncate">{currentArticle.category.name}</span>
              </>
            )}
            <ChevronRight className="w-3 h-3" />
            <span className="max-w-[220px] truncate font-medium text-slate-950 dark:text-[var(--text-primary)]">
              {String(currentArticle.title)}
            </span>
          </nav>
        </div>

        <div className="grid gap-8 px-4 pt-1 sm:px-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-6">
          <article className="min-w-0 pl-2 sm:pl-6 lg:pl-8">
            <header className="mb-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-3xl font-semibold leading-tight tracking-normal text-slate-950 dark:text-white md:text-4xl">
                    {String(currentArticle.title)}
                  </h1>
                  {currentArticle.excerpt && (
                    <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 dark:text-[var(--text-muted)]">
                      {currentArticle.excerpt}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleShare}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-primary-300 hover:text-primary-700 dark:border-subtle dark:bg-surface-elevated dark:text-[var(--text-primary)]"
                  title="Share article"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4 border-y border-slate-200 py-4 dark:border-subtle">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-[var(--text-muted)]">
                  <User className="w-4 h-4" />
                  <span>By {currentArticle.author
                    ? currentArticle.author.display_name || `${currentArticle.author.first_name || ''} ${currentArticle.author.last_name || ''}`.trim() || 'Unknown Author'
                    : 'Unknown Author'}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-[var(--text-muted)]">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(currentArticle.created_at)}</span>
                </div>
              </div>
            </header>

            {currentArticle.metadata?.featured_image &&
            typeof currentArticle.metadata.featured_image === 'string' &&
            currentArticle.metadata.featured_image.trim() !== '' ? (
              <div className="mb-8 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-subtle dark:bg-surface-elevated">
                <img
                  src={currentArticle.metadata.featured_image}
                  alt={String(currentArticle.title)}
                  className="h-64 w-full object-cover md:h-96"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            ) : null}

            <main className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-subtle dark:bg-surface-elevated sm:p-8">
              <div
                className="kb-content prose prose-slate max-w-none text-slate-800 dark:prose-invert dark:text-[var(--text-primary)] prose-headings:tracking-normal prose-a:text-primary-700 prose-img:rounded-lg"
                style={{
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word'
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeHTML(currentArticle.content || '') }}
              />
            </main>

            {ratingsEnabled && (
              <section className="mt-8 border-t border-slate-200 pt-6 dark:border-subtle">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-subtle dark:bg-surface-elevated">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-slate-950 dark:text-[var(--text-primary)]">
                        Was this article helpful?
                      </h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-[var(--text-muted)]">
                        {feedback
                          ? 'Thanks for the feedback.'
                          : 'Your feedback helps improve this knowledge base.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleHelpfulVote(true)}
                        disabled={Boolean(feedback) || isSubmittingFeedback}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                          feedback === 'helpful'
                            ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-subtle dark:text-[var(--text-primary)] dark:hover:bg-surface-hover'
                        }`}
                      >
                        <ThumbsUp className="h-4 w-4" />
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHelpfulVote(false)}
                        disabled={Boolean(feedback) || isSubmittingFeedback}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                          feedback === 'not_helpful'
                            ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-subtle dark:text-[var(--text-primary)] dark:hover:bg-surface-hover'
                        }`}
                      >
                        <ThumbsDown className="h-4 w-4" />
                        No
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-[var(--text-muted)]">
                    <span>{currentArticle.helpful_count || 0} helpful</span>
                    <span>{currentArticle.not_helpful_count || 0} not helpful</span>
                    {feedbackError && (
                      <span className="text-red-600 dark:text-red-300">{feedbackError}</span>
                    )}
                  </div>
                </div>
              </section>
            )}
          </article>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {relatedArticles.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-subtle dark:bg-surface-elevated">
                <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-[var(--text-primary)]">Related articles</h2>
                <div className="space-y-1">
                  {relatedArticles.map(article => (
                    <Link
                      key={article.id}
                      to={buildPublicArticleUrl('/helpcenter/kb', article)}
                      className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-surface-hover"
                    >
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 group-hover:text-primary-600 dark:text-[var(--text-muted)]" />
                      <span className="text-[length:var(--font-meta)] font-medium text-slate-700 group-hover:text-primary-700 dark:text-[var(--text-primary)] dark:group-hover:text-primary-300">
                        {article.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-subtle dark:bg-surface-elevated">
              <div className="mb-4 flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary-700 dark:text-primary-300" />
                <h2 className="text-sm font-semibold text-slate-950 dark:text-[var(--text-primary)]">Need more help?</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/helpcenter/new')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-primary-300 hover:text-primary-700 dark:border-subtle dark:text-[var(--text-primary)]"
              >
                Create a ticket
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </aside>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default ArticleView;
