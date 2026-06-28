import React, { useEffect, useRef, useState } from 'react';
import { sanitizeHTML } from '../../../utils/sanitize';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  Share2,
  Edit,
  User,
  Calendar,
  Eye,
  EyeOff,
  MoreHorizontal,
  FolderInput,
  Archive,
  RotateCcw,
  Trash2,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { useKnowledgeStore } from '../../../stores/knowledgeStore';
import { UpdateKBArticleDto } from '../../../types/knowledge';
import SEOMetaTags from '../shared/SEOMetaTags';
import { useAuthStore } from '../../../stores/authStore';
import { canEditArticle } from '../../../utils/kbPermissions';
import { successNotification, errorNotification } from '../../../components/ui/Toast';
import { Modal } from '../../../components/ui/Modal';
import { buildPublicArticleUrl } from '../../../utils/kbArticle';

// Simple date formatter
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

// Article Detail Skeleton
const ArticleDetailSkeleton: React.FC = () => (
  <div className="space-y-5">
    <div className="sd-shimmer h-5 w-1/4" />
    <div className="sd-shimmer h-8 w-3/4" />
    <div className="sd-shimmer h-3.5 w-1/2" />
    <div className="space-y-3">
      <div className="sd-shimmer h-3.5 w-full" />
      <div className="sd-shimmer h-3.5 w-5/6" />
      <div className="sd-shimmer h-3.5 w-3/4" />
    </div>
  </div>
);

const ArticleDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentArticle, isLoading, fetchArticle, updateArticle, deleteArticle, fetchCategories, categories, markArticleHelpful, markArticleNotHelpful } = useKnowledgeStore();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [showMoveCategoryModal, setShowMoveCategoryModal] = useState(false);
  const [moveCategoryId, setMoveCategoryId] = useState('');
  const [isMovingCategory, setIsMovingCategory] = useState(false);
  const [isUpdatingArchiveState, setIsUpdatingArchiveState] = useState(false);
  const [helpfulVote, setHelpfulVote] = useState<'helpful' | 'not_helpful' | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (slug) {
      fetchArticle(slug);
      fetchCategories();
    }
  }, [slug, fetchArticle, fetchCategories]);

  useEffect(() => {
    const onClose = (event: MouseEvent) => {
      const target = event.target as Node;
      if (actionMenuRef.current?.contains(target)) return;
      setIsActionMenuOpen(false);
    };
    if (isActionMenuOpen) {
      window.addEventListener('mousedown', onClose);
    }
    return () => window.removeEventListener('mousedown', onClose);
  }, [isActionMenuOpen]);

  const handleShare = async () => {
    const shareUrl = currentArticle
      ? `${window.location.origin}${buildPublicArticleUrl('/helpcenter/kb', currentArticle)}`
      : `${window.location.origin}/helpcenter/kb/${slug}`;
    if (navigator.share && currentArticle) {
      try {
        await navigator.share({
          title: currentArticle.title,
          text: (currentArticle.content || '').substring(0, 200) + '...',
          url: shareUrl,
        });
      } catch {
        navigator.clipboard.writeText(shareUrl);
        successNotification("Link copied to clipboard");
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      successNotification("Link copied to clipboard");
    }
  };

  const handleTogglePublish = async () => {
    if (!currentArticle || !slug) return;
    
    const currentStatus = (currentArticle.status || '').toLowerCase();
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    setIsUpdatingStatus(true);
    try {
      const payload = {
        title: currentArticle.title,
        content: currentArticle.content,
        excerpt: currentArticle.excerpt || '',
        category: currentArticle.category?.id,
        status: newStatus as UpdateKBArticleDto['status'],
        is_public: currentArticle.is_public ?? true,
        is_featured: currentArticle.is_featured ?? false,
        is_pinned: currentArticle.is_pinned ?? false,
        tags: currentArticle.tags || [],
        difficulty_level: currentArticle.difficulty_level,
        language: currentArticle.language,
        seo_title: currentArticle.seo_title,
        seo_description: currentArticle.seo_description,
        seo_keywords: currentArticle.seo_keywords,
        scheduled_publish_at: currentArticle.scheduled_publish_at,
        metadata: currentArticle.metadata,
      };

      try {
        await updateArticle(slug, payload as UpdateKBArticleDto);
      } catch {
        // Fallback for stricter backends that only accept partial status updates.
        await updateArticle(slug, { status: newStatus });
      }

      successNotification(
        newStatus === 'published' 
          ? 'Article published successfully' 
          : 'Article unpublished successfully'
      );
      await fetchArticle(slug); // Refresh article data
    } catch (error) {
      errorNotification('Failed to update article status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleMoveCategory = async () => {
    if (!currentArticle || !slug) return;
    const targetId = Number(moveCategoryId);
    if (!targetId || targetId === currentArticle.category?.id) {
      errorNotification('Select a different category.');
      return;
    }
    try {
      setIsMovingCategory(true);
      const payload = {
        title: currentArticle.title,
        content: currentArticle.content || '',
        excerpt: currentArticle.excerpt || '',
        category: targetId,
        status: (currentArticle.status || 'draft').toLowerCase() as UpdateKBArticleDto['status'],
        is_public: currentArticle.is_public ?? true,
        is_featured: currentArticle.is_featured ?? false,
        is_pinned: currentArticle.is_pinned ?? false,
        tags: currentArticle.tags || [],
        difficulty_level: currentArticle.difficulty_level,
        language: currentArticle.language,
        seo_title: currentArticle.seo_title,
        seo_description: currentArticle.seo_description,
        seo_keywords: currentArticle.seo_keywords,
        scheduled_publish_at: currentArticle.scheduled_publish_at,
        metadata: currentArticle.metadata,
      };

      try {
        await updateArticle(slug, payload as UpdateKBArticleDto);
      } catch {
        await updateArticle(slug, { category: targetId });
      }
      successNotification('Article moved');
      setShowMoveCategoryModal(false);
      setMoveCategoryId('');
      await fetchArticle(slug);
    } catch {
      errorNotification('Failed to move article');
    } finally {
      setIsMovingCategory(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!currentArticle || !slug) return;
    const status = (currentArticle.status || '').toLowerCase();
    const isArchived = status === 'archived';
    const nextStatus: UpdateKBArticleDto['status'] = isArchived ? 'draft' : 'archived';

    try {
      setIsUpdatingArchiveState(true);
      const payload = {
        title: currentArticle.title,
        content: currentArticle.content || '',
        excerpt: currentArticle.excerpt || '',
        category: currentArticle.category?.id,
        status: nextStatus,
        is_public: currentArticle.is_public ?? true,
        is_featured: currentArticle.is_featured ?? false,
        is_pinned: currentArticle.is_pinned ?? false,
        tags: currentArticle.tags || [],
        difficulty_level: currentArticle.difficulty_level,
        language: currentArticle.language,
        seo_title: currentArticle.seo_title,
        seo_description: currentArticle.seo_description,
        seo_keywords: currentArticle.seo_keywords,
        scheduled_publish_at: currentArticle.scheduled_publish_at,
        metadata: currentArticle.metadata,
      };

      try {
        await updateArticle(slug, payload as UpdateKBArticleDto);
      } catch {
        await updateArticle(slug, { status: nextStatus });
      }

      successNotification(isArchived ? 'Article removed from archive' : 'Article moved to archive');
      setIsActionMenuOpen(false);
      await fetchArticle(slug);
    } catch {
      errorNotification(isArchived ? 'Failed to remove from archive' : 'Failed to archive article');
    } finally {
      setIsUpdatingArchiveState(false);
    }
  };

  const handleDeleteArticle = async () => {
    if (!currentArticle || !slug) return;
    const confirmed = window.confirm('Delete this article?');
    if (!confirmed) return;
    await deleteArticle(slug);
    successNotification('Article deleted');
    navigate('/knowledge');
  };
 
  const handleVote = async (vote: 'helpful' | 'not_helpful') => {
    if (!slug || isVoting || helpfulVote !== null) return;
    setIsVoting(true);
    try {
      if (vote === 'helpful') {
        await markArticleHelpful(slug);
      } else {
        await markArticleNotHelpful(slug);
      }
      setHelpfulVote(vote);
    } catch {
      errorNotification('Failed to record your feedback.');
    } finally {
      setIsVoting(false);
    }
  };

  const canEdit = canEditArticle(user, currentArticle?.author?.id);
  const currentStatus = (currentArticle?.status || '').toLowerCase();

  if (isLoading || !currentArticle) {
    return (
      <div className="mx-auto w-full max-w-5xl py-4">
        <ArticleDetailSkeleton />
      </div>
    );
  }

  return (
    <>
      <SEOMetaTags
        title={`${currentArticle.title} | SafariDesk Knowledge Base`}
        description={currentArticle.excerpt || (currentArticle.content || '').substring(0, 160)}
        keywords={[
          currentArticle.title,
          ...(currentArticle.tags || []),
          currentArticle.category?.name || '',
          'knowledge base',
          'help'
        ].filter(Boolean).join(', ')}
      />

      <div className="mx-auto w-full min-w-0 max-w-5xl py-4">
        {/* Navigation */}
        <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex w-fit items-center gap-2 text-[length:var(--font-body)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          
          {/* Breadcrumb */}
          <nav className="flex min-w-0 items-center gap-2 text-[length:var(--font-meta)] text-[var(--text-secondary)] sm:justify-end">
            <a href="/knowledge" className="shrink-0 hover:text-[var(--text-primary)]">
              Articles
            </a>
            {currentArticle.category && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className="min-w-0 truncate text-[var(--text-primary)] sm:max-w-[220px]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                  {currentArticle.category.name}
                </span>
              </>
            )}
          </nav>
        </div>

        {/* Article Header */}
        <header className="mb-6">
          <div className="mb-4 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex min-w-0 flex-wrap items-start gap-3">
                <h1 className="min-w-0 flex-1 break-words text-[length:var(--font-display-lg)] leading-tight text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-title)' }}>
                  {String(currentArticle.title)}
                </h1>
                {/* Public/Internal Badge */}
                {currentArticle.is_public ? (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2 py-0.5 text-[length:var(--font-meta)] text-[var(--status-success-text)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                    Public
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-[length:var(--font-meta)] text-[var(--status-warning-text)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                    Internal
                  </span>
                )}
              </div>
            </div>
            
            <div ref={actionMenuRef} className="relative flex flex-wrap items-center gap-2 lg:ml-4 lg:justify-end">
              {canEdit && (
                <button
                  onClick={handleTogglePublish}
                  disabled={isUpdatingStatus}
                  className={`flex items-center gap-1.5 rounded-[var(--shell-radius)] px-3 py-1.5 text-[length:var(--font-button)] transition-colors ${
                    currentStatus === 'published'
                      ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] hover:brightness-95'
                      : 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] hover:brightness-95'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  style={{ fontWeight: 'var(--font-weight-label)' }}
                  title={currentStatus === 'published' ? 'Unpublish article' : 'Publish article'}
                >
                  {currentStatus === 'published' ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      {isUpdatingStatus ? 'Unpublishing...' : 'Unpublish'}
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      {isUpdatingStatus ? 'Publishing...' : 'Publish'}
                    </>
                  )}
                </button>
              )}
              
              {!canEdit && (
                <button
                  onClick={handleShare}
                  className="rounded-[var(--shell-radius)] p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
                  title="Share article"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
              {canEdit && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsActionMenuOpen((prev) => !prev);
                    }}
                    className="rounded-[var(--shell-radius)] p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
                    title="More actions"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {isActionMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-10 z-20 w-52 rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] shadow-[var(--shell-shadow-md)]"
                    >
                      <button
                        onClick={() => {
                          setIsActionMenuOpen(false);
                          navigate(`/knowledge/articles/${currentArticle.slug}/edit`);
                        }}
                        className="flex w-full items-center gap-2 rounded-t-[var(--shell-radius)] px-4 py-3 text-left text-[length:var(--font-body)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setIsActionMenuOpen(false);
                          setMoveCategoryId(String(currentArticle.category?.id || ''));
                          setShowMoveCategoryModal(true);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-[length:var(--font-body)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                      >
                        <FolderInput className="w-4 h-4" />
                        Move To
                      </button>
                      <button
                        onClick={handleToggleArchive}
                        disabled={isUpdatingArchiveState}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-[length:var(--font-body)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {currentStatus === 'archived' ? (
                          <RotateCcw className="w-4 h-4" />
                        ) : (
                          <Archive className="w-4 h-4" />
                        )}
                        {currentStatus === 'archived' ? 'Remove from Archive' : 'Move to Archive'}
                      </button>
                      <button
                        onClick={() => {
                          setIsActionMenuOpen(false);
                          handleShare();
                        }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-[length:var(--font-body)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                      >
                        <Share2 className="w-4 h-4" />
                        Share
                      </button>
                      <button
                        onClick={handleDeleteArticle}
                        className="flex w-full items-center gap-2 rounded-b-[var(--shell-radius)] px-4 py-3 text-left text-[length:var(--font-body)] text-[var(--text-primary)] hover:bg-[var(--status-danger-bg)]"
                      >
                        <Trash2 className="w-4 h-4 text-[var(--status-danger-text)]" />
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {currentArticle.excerpt && (
            <p className="mb-4 text-[length:var(--font-page-subtitle)] leading-relaxed text-[var(--text-secondary)]">
              {currentArticle.excerpt}
            </p>
          )}

          {/* Featured Image */}
          {currentArticle.metadata?.featured_image && 
           typeof currentArticle.metadata.featured_image === 'string' && 
           currentArticle.metadata.featured_image.trim() !== '' ? (
            <div className="mb-6">
              <img
                src={currentArticle.metadata.featured_image}
                alt={String(currentArticle.title)}
                className="h-64 w-full rounded-[var(--shell-radius)] object-cover shadow-[var(--shell-shadow-md)] md:h-96"
                onError={(e) => {
                  // Hide image if it fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          ) : null}

          {/* Article Metadata */}
          <div className="flex flex-wrap items-center gap-6 border-b border-[var(--border-color)] pb-5">
            <div className="flex items-center gap-2 text-[length:var(--font-body)] text-[var(--text-secondary)]">
              <User className="w-4 h-4" />
              <span>By {currentArticle.author 
                ? currentArticle.author.display_name || `${currentArticle.author.first_name || ''} ${currentArticle.author.last_name || ''}`.trim() || 'Unknown Author'
                : 'Unknown Author'}</span>
            </div>

            <div className="flex items-center gap-2 text-[length:var(--font-body)] text-[var(--text-secondary)]">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(currentArticle.created_at)}</span>
            </div>

            {/* Status Badge */}
            <span className={`rounded-full border px-2 py-1 text-[length:var(--font-meta)] ${
              currentArticle.status === 'published' 
                ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
                : currentArticle.status === 'review'
                ? 'border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]'
                : currentArticle.status === 'draft'
                ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
                : currentArticle.status === 'archived'
                ? 'border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]'
                : 'border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]'
            }`} style={{ fontWeight: 'var(--font-weight-label)' }}>
              {currentArticle.status === 'review' ? 'Under Review' : currentArticle.status}
            </span>
          </div>
          
        </header>

        {/* Article Content */}
        <main className="prose prose-base max-w-none overflow-x-auto">
          <div
            className="kb-content min-w-0 leading-relaxed text-[var(--text-primary)]"
            style={{
              wordBreak: 'break-word',
              overflowWrap: 'break-word'
            }}
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(currentArticle.content || '') }}
          />
        </main>

        {/* Was this helpful? */}
        <div
          className="mt-10 rounded-[var(--shell-radius)] border px-6 py-6 text-center"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-subtle)' }}
        >
          {helpfulVote === null ? (
            <>
              <p
                className="mb-4 text-[length:var(--font-body)]"
                style={{ color: 'var(--text-primary)', fontWeight: 'var(--font-weight-label)' }}
              >
                Was this article helpful?
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isVoting}
                  onClick={() => handleVote('helpful')}
                  className="inline-flex items-center gap-2 rounded-[var(--shell-radius)] border px-5 py-2.5 text-[length:var(--font-body)] transition-colors disabled:opacity-60"
                  style={{
                    borderColor: 'var(--status-success-border)',
                    backgroundColor: 'var(--status-success-bg)',
                    color: 'var(--status-success-text)',
                  }}
                >
                  <ThumbsUp size={15} />
                  Yes, helpful
                </button>
                <button
                  type="button"
                  disabled={isVoting}
                  onClick={() => handleVote('not_helpful')}
                  className="inline-flex items-center gap-2 rounded-[var(--shell-radius)] border px-5 py-2.5 text-[length:var(--font-body)] transition-colors disabled:opacity-60"
                  style={{
                    borderColor: 'var(--status-danger-border)',
                    backgroundColor: 'var(--status-danger-bg)',
                    color: 'var(--status-danger-text)',
                  }}
                >
                  <ThumbsDown size={15} />
                  Not helpful
                </button>
              </div>
              <p className="mt-3 text-[length:var(--font-meta)]" style={{ color: 'var(--text-secondary)' }}>
                {currentArticle.helpful_count} found this helpful
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              {helpfulVote === 'helpful' ? (
                <ThumbsUp size={24} style={{ color: 'var(--status-success-text)' }} />
              ) : (
                <ThumbsDown size={24} style={{ color: 'var(--status-danger-text)' }} />
              )}
              <p
                className="text-[length:var(--font-body)]"
                style={{ color: 'var(--text-primary)', fontWeight: 'var(--font-weight-label)' }}
              >
                Thank you for your feedback!
              </p>
              <p className="text-[length:var(--font-meta)]" style={{ color: 'var(--text-secondary)' }}>
                Your response helps us improve our knowledge base.
              </p>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showMoveCategoryModal}
        onClose={() => {
          setShowMoveCategoryModal(false);
          setMoveCategoryId('');
        }}
        title="Move Article"
      >
        <div className="space-y-4">
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
            Choose the category you want to move this article to.
          </p>
          <select
            value={moveCategoryId}
            onChange={(event) => setMoveCategoryId(event.target.value)}
            className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)]"
          >
            <option value="">Select category</option>
            {categories
              .filter((category) => category.id !== currentArticle?.category?.id)
              .map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
          </select>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowMoveCategoryModal(false);
                setMoveCategoryId('');
              }}
              className="rounded-[var(--shell-radius)] border border-[var(--border-color)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleMoveCategory}
              disabled={!moveCategoryId || isMovingCategory}
              className="rounded-[var(--shell-radius)] px-3 py-2 text-[length:var(--font-button)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: 'var(--primary, #4F46E5)', color: 'var(--button-primary-text, #fff)' }}
            >
              {isMovingCategory ? 'Moving...' : 'Move'}
            </button>
          </div>
        </div>
      </Modal>

    </>
  );
};

export default ArticleDetail;
