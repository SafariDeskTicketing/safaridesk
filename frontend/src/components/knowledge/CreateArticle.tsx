import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import SafariDeskEditor from '../editor/SafariDeskEditor';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import { successNotification, errorNotification } from '../ui/Toast';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { Card } from '../ui/Card';
import { isRichTextEmpty } from '../../utils/richText';
import { TITLE_MAX_LENGTH, getTitleLengthMessage } from '../../utils/validationLimits';
import { getApiErrorMessage } from '../../utils/apiError';

interface CreateArticleProps {
  onCancel?: () => void;
}

const CreateArticle: React.FC<CreateArticleProps> = ({ onCancel }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { categories, fetchCategories, createArticle, fetchArticle, currentArticle, updateArticle } = useKnowledgeStore();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contentError, setContentError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (!slug) return;
    fetchArticle(slug);
  }, [fetchArticle, slug]);

  useEffect(() => {
    if (!slug || !currentArticle) return;
    setTitle(currentArticle.title || '');
    setContent(currentArticle.content || '');
    setCategoryId(currentArticle.category?.id?.toString() || '');
    setStatus(currentArticle.status === 'published' ? 'published' : 'draft');
  }, [currentArticle, slug]);

  useEffect(() => {
    if (categoryId || categories.length === 0) return;
    const params = new URLSearchParams(location.search);
    const preselect = params.get('category');
    if (preselect) {
      setCategoryId(preselect);
    }
  }, [categoryId, categories.length, location.search]);

  const selectedCategory = categories.find((category) => category.id.toString() === categoryId);
  const categoryOptions = useMemo(
    () => categories.map((category) => ({ value: category.id.toString(), label: category.name })),
    [categories]
  );
  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
  ];

  const handleCreate = async () => {
    setContentError('');

    if (!title.trim()) {
      errorNotification('Please add a title.');
      return;
    }
    if (title.trim().length > TITLE_MAX_LENGTH) {
      const message = getTitleLengthMessage('Article');
      errorNotification(message);
      return;
    }
    if (!categoryId) {
      errorNotification('Please select a category.');
      return;
    }
    if (isRichTextEmpty(content)) {
      const message = 'Article body cannot be empty. Please provide content before publishing.';
      setContentError(message);
      errorNotification(message);
      return;
    }

    try {
      setIsSubmitting(true);
      if (slug) {
        await updateArticle(slug, {
          title: title.trim(),
          content,
          excerpt: currentArticle?.excerpt || '',
          category: Number(categoryId),
          status,
          is_public: currentArticle?.is_public ?? true,
          is_featured: currentArticle?.is_featured ?? false,
          is_pinned: currentArticle?.is_pinned ?? false,
          tags: currentArticle?.tags || [],
          difficulty_level: currentArticle?.difficulty_level,
          language: currentArticle?.language,
          seo_title: currentArticle?.seo_title,
          seo_description: currentArticle?.seo_description,
          seo_keywords: currentArticle?.seo_keywords,
          scheduled_publish_at: currentArticle?.scheduled_publish_at,
          metadata: currentArticle?.metadata,
        });
        successNotification('Article updated.');
      } else {
        await createArticle({
          title: title.trim(),
          content,
          category: Number(categoryId),
          status,
          is_public: true,
        });
        successNotification('Article created.');
      }
      navigate('/knowledge');
    } catch (error) {
      errorNotification(getApiErrorMessage(error, 'Failed to save article.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="sd-content-shell pb-[var(--shell-panel-padding)]">
      <div className="sticky top-0 z-10 mb-6 flex items-center justify-between gap-3 bg-[var(--card-bg)] py-3">
        <div className="flex min-w-0 flex-1 items-center gap-1 text-sm text-[var(--text-secondary)]">
          <span>Knowledge Base</span>
          <span>/</span>
          <span className="max-w-[200px] truncate">{selectedCategory?.name || 'General'}</span>
          <span>/</span>
          <span className="max-w-[240px] truncate font-medium text-[var(--text-primary)]">New Article</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => (onCancel ? onCancel() : navigate('/knowledge'))}
          >
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleCreate}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : (slug ? 'Update' : 'Create')}
          </Button>
        </div>
      </div>

      <Card className="rounded-[20px] p-6">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-xs font-semibold text-[var(--text-primary)]">
              JD
            </div>
            <span>Jobtanui21@gmail.com in</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
            <Select
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions}
              placeholder="Select Category"
            />
            <Select
              value={status}
              onChange={(value) => setStatus(value as 'draft' | 'published')}
              options={statusOptions}
            />
          </div>
        </div>

        <div className="mb-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            className="w-full border-none bg-transparent text-[28px] font-semibold leading-tight text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-0"
          />
          {title.trim().length > TITLE_MAX_LENGTH && (
            <p className="mt-2 text-[14px] text-[var(--status-danger-text)]">
              {title.trim().length}/{TITLE_MAX_LENGTH} characters
            </p>
          )}
        </div>
        <div className="border-t border-[var(--border-color)] pt-4">
          <SafariDeskEditor
            content={content}
            onChange={(nextContent) => {
              setContent(nextContent);
              if (contentError && !isRichTextEmpty(nextContent)) {
                setContentError('');
              }
            }}
            className={contentError ? 'ring-2 ring-[var(--status-danger-text)]' : ''}
          />
          {contentError && (
            <p className="mt-2 text-[14px] text-[var(--status-danger-text)]">{contentError}</p>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CreateArticle;
