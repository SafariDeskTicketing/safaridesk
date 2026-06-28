import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link2, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import SafariDeskEditor, { type SafariDeskEditorHandle } from '../../../components/editor/SafariDeskEditor';
import { useKnowledgeStore } from '../../../stores/knowledgeStore';
import { successNotification, errorNotification } from '../../../components/ui/Toast';
import { useAuthStore } from '../../../stores/authStore';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import { isRichTextEmpty } from '../../../utils/richText';
import { TITLE_MAX_LENGTH, getTitleLengthMessage } from '../../../utils/validationLimits';
import { getApiErrorMessage } from '../../../utils/apiError';

// lowercase-alnum-hyphen only, trim leading/trailing hyphens
const normaliseSlug = (raw: string): string =>
  raw
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

interface EditArticleProps {
  onCancel?: () => void;
}

const EditArticle: React.FC<EditArticleProps> = ({ onCancel }) => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuthStore();
  const { categories, fetchCategories, updateArticle, fetchArticle, currentArticle, isLoadingArticle } = useKnowledgeStore();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [allowVisibilityOverride, setAllowVisibilityOverride] = useState(false);
  const [articleVisibility, setArticleVisibility] = useState<'public' | 'internal'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlug, setCurrentSlug] = useState<string>('');
  const [slugDraft, setSlugDraft] = useState<string>('');
  const [isSlugPanelOpen, setIsSlugPanelOpen] = useState(false);
  const [contentError, setContentError] = useState('');
  const editorRef = React.useRef<SafariDeskEditorHandle>(null);
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    http.get<{ results: Array<{ key: string; value: string }> }>(APIS.KB_SETTINGS)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
        const setting = list.find((item) => item.key === 'allow_article_visibility_override');
        setAllowVisibilityOverride(setting?.value === 'true' || setting?.value === '1' || setting?.value === 'True');
      })
      .catch(() => setAllowVisibilityOverride(false));
  }, []);

  const categoryOptions = useMemo(
    () => categories.map((cat) => ({ value: String(cat.id), label: cat.name })),
    [categories]
  );

  useEffect(() => {
    if (categoryId || categories.length === 0) return;
    const generalCategory = categories.find((cat) => cat.name.trim().toLowerCase() === 'general');
    if (generalCategory) {
      setCategoryId(String(generalCategory.id));
    }
  }, [categories, categoryId]);
  const selectedCategory = categories.find((category) => category.id.toString() === categoryId);
  const articleIsPublic = selectedCategory?.is_public === false
    ? false
    : allowVisibilityOverride
      ? articleVisibility === 'public'
      : true;

  useEffect(() => {
    if (!slug) return;
    fetchArticle(slug);
  }, [fetchArticle, slug]);

  useEffect(() => {
    if (!slug || !currentArticle) return;
    setTitle(currentArticle.title || '');
    setContent(currentArticle.content || '');
    setCategoryId(currentArticle.category?.id?.toString() || '');
    setArticleVisibility(currentArticle.is_public === false ? 'internal' : 'public');
    const resolvedSlug = currentArticle.slug || slug || '';
    setCurrentSlug(resolvedSlug);
    setSlugDraft(resolvedSlug);
    setIsLoading(false);
  }, [currentArticle, slug]);

  useEffect(() => {
    if (selectedCategory?.is_public === false) {
      setArticleVisibility('internal');
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (!slug) {
      setIsLoading(false);
      return;
    }
    if (!isLoadingArticle && !currentArticle) {
      setIsLoading(false);
    }
  }, [slug, isLoadingArticle, currentArticle]);

  const handleDiscard = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/knowledge');
    }
  };

  const handleUpdate = async () => {
    setContentError('');

    if (!title.trim()) {
      errorNotification('Please enter a title');
      return;
    }
    if (title.trim().length > TITLE_MAX_LENGTH) {
      const message = getTitleLengthMessage('Article');
      errorNotification(message);
      return;
    }
    
    if (!categoryId) {
      errorNotification('Please select a category');
      return;
    }

    if (!slug) {
      errorNotification('Article not found');
      return;
    }

    if (isRichTextEmpty(content)) {
      const message = 'Article body cannot be empty. Please provide content before publishing.';
      setContentError(message);
      errorNotification(message);
      return;
    }

    const trimmedSlug = normaliseSlug(slugDraft);
    const slugChanged = !!trimmedSlug && trimmedSlug !== currentSlug;

    setIsSubmitting(true);
    try {
      // include slug in payload only when the admin explicitly edited it —
      // backend may or may not honour it; graceful fallback on strict backends
      const payload: Record<string, unknown> = {
        title: title.trim(),
        content,
        category: parseInt(categoryId),
        is_public: articleIsPublic,
      };
      if (slugChanged) payload.slug = trimmedSlug;

      await updateArticle(slug, payload as Parameters<typeof updateArticle>[1]);
      editorRef.current?.markClean();
      successNotification(
        slugChanged
          ? 'Article updated. URL changed to /' + trimmedSlug
          : 'Article updated successfully'
      );
      navigate('/knowledge');
    } catch (error) {
      errorNotification(getApiErrorMessage(error, 'Failed to update article'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isLoadingArticle) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500 dark:text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b backdrop-blur"
        style={{ padding: '14px var(--shell-panel-padding)', borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="truncate text-[length:var(--font-meta)] text-[var(--text-secondary)]" title={currentArticle?.title}>
            Knowledge Base / {currentArticle?.category?.name || 'General'} /{' '}
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{currentArticle?.title || 'Article'}</span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-sm font-semibold text-white shadow-sm">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="min-w-0 max-w-[220px] truncate text-[length:var(--font-body)] font-medium text-[var(--text-primary)]">
              {user?.email || 'User'}
            </span>
            <span className="flex-shrink-0 text-[length:var(--font-meta)] text-[var(--text-muted)]">in</span>
            <Select
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions}
              placeholder={categories.length === 0 ? 'No categories available' : 'Select category'}
              disabled={categories.length === 0}
              size="sm"
              className="w-[260px] max-w-full"
            />
            {allowVisibilityOverride && selectedCategory?.is_public !== false && (
              <Select
                value={articleVisibility}
                onChange={(value) => setArticleVisibility(value as 'public' | 'internal')}
                options={[
                  { value: 'public', label: 'Public' },
                  { value: 'internal', label: 'Internal' },
                ]}
                size="sm"
                className="w-[150px]"
              />
            )}
            {selectedCategory?.is_public === false && (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                Internal via category
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDiscard}
            disabled={isSubmitting}
            className="rounded-lg"
          >
            Discard
          </Button>
          <Button
            size="sm"
            onClick={handleUpdate}
            loading={isSubmitting}
            className="rounded-lg bg-gradient-to-r from-primary-600 to-primary-600 hover:from-primary-700 hover:to-primary-700 shadow-sm"
          >
            Update
          </Button>
        </div>
      </div>

      {/* Title Input */}
      <div
        style={{
          paddingInline: 'var(--shell-panel-padding)',
          paddingTop: 'calc(var(--shell-page-padding) + 4px)',
          paddingBottom: '8px',
        }}
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          maxLength={TITLE_MAX_LENGTH}
          className="w-full text-[28px] md:text-[30px] leading-tight font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-[var(--text-primary)] placeholder-gray-300 dark:placeholder-gray-600"
        />
        {title.trim().length > 0 && (
          <p
            className="mt-1 text-[length:var(--font-meta)]"
            style={{ color: title.trim().length >= TITLE_MAX_LENGTH ? 'var(--status-danger-text)' : 'var(--text-muted)' }}
          >
            {title.trim().length}/{TITLE_MAX_LENGTH}
          </p>
        )}

        {/* URL / Slug control — slug stays stable when title changes; edit here to rename the URL */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setIsSlugPanelOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[length:var(--font-meta)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <Link2 size={13} />
            <span className="font-mono">/{currentSlug || 'article-url'}</span>
            <span className="opacity-70">· {isSlugPanelOpen ? 'hide' : 'edit URL'}</span>
          </button>

          {isSlugPanelOpen && (
            <div
              className="mt-2 rounded-[var(--shell-radius)] border p-3"
              style={{
                borderColor: 'var(--border-color)',
                backgroundColor: 'var(--surface-subtle)',
              }}
            >
              <label
                className="mb-1 block text-[length:var(--font-meta)] text-[var(--text-secondary)]"
              >
                Article URL slug
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[length:var(--font-meta)] text-[var(--text-muted)] font-mono whitespace-nowrap">
                  /kb/
                </span>
                <input
                  type="text"
                  value={slugDraft}
                  onChange={(e) => setSlugDraft(e.target.value)}
                  onBlur={() => setSlugDraft((value) => normaliseSlug(value))}
                  placeholder="how-to-reset-password"
                  className="flex-1 rounded-[var(--shell-radius)] border bg-[var(--shell-field-bg)] px-2.5 py-1.5 text-[length:var(--font-body)] font-mono text-[var(--text-primary)] outline-none focus:border-[hsl(var(--primary-600-hsl))]"
                  style={{ borderColor: 'var(--border-color)' }}
                />
                {slugDraft !== currentSlug && (
                  <button
                    type="button"
                    onClick={() => setSlugDraft(currentSlug)}
                    className="text-[length:var(--font-meta)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-start gap-1.5 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                {normaliseSlug(slugDraft) !== currentSlug && slugDraft.trim() ? (
                  <>
                    <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--status-warning-text)' }} />
                    <span>
                      Changing the URL breaks any external links pointing to{' '}
                      <span className="font-mono">/kb/{currentSlug}</span>. The old URL won't redirect automatically unless your admin sets up a redirect.
                    </span>
                  </>
                ) : (
                  <span>
                    The URL stays the same when you edit the title. Edit it here only when you need to rename the article's public URL.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div
        className="flex-1 overflow-auto"
        style={{
          paddingInline: 'var(--shell-panel-padding)',
          paddingTop: 'var(--shell-page-padding)',
          paddingBottom: 'var(--shell-panel-padding)',
        }}
      >
        <SafariDeskEditor
          ref={editorRef}
          content={content}
          onChange={(nextContent) => {
            setContent(nextContent);
            if (contentError && !isRichTextEmpty(nextContent)) {
              setContentError('');
            }
          }}
          className={contentError ? 'ring-2 ring-[var(--status-danger-text)]' : ''}
          warnOnNavigation
        />
        {contentError && (
          <p className="mt-2 text-[14px] text-[var(--status-danger-text)]">{contentError}</p>
        )}
      </div>
    </div>
  );
};

export default EditArticle;
