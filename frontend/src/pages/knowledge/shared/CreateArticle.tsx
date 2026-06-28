import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

interface CreateArticleProps {
  onCancel?: () => void;
}

const CreateArticle: React.FC<CreateArticleProps> = ({ onCancel }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { categories, fetchCategories, createArticle } = useKnowledgeStore();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [allowVisibilityOverride, setAllowVisibilityOverride] = useState(false);
  const [articleVisibility, setArticleVisibility] = useState<'public' | 'internal'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contentError, setContentError] = useState('');
  const editorRef = React.useRef<SafariDeskEditorHandle>(null);

  React.useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  React.useEffect(() => {
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

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (selectedCategory?.is_public === false) {
      setArticleVisibility('internal');
    }
  }, [selectedCategory]);

  const handleDiscard = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/knowledge');
    }
  };

  const handleCreate = async () => {
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

    if (isRichTextEmpty(content)) {
      const message = 'Article body cannot be empty. Please provide content before publishing.';
      setContentError(message);
      errorNotification(message);
      return;
    }

    setIsSubmitting(true);
    try {
      await createArticle({
        title: title.trim(),
        content,
        category: parseInt(categoryId),
        status: 'draft',
        is_public: articleIsPublic,
      });
      editorRef.current?.markClean();
      successNotification('Article created successfully');
      navigate('/knowledge');
    } catch (error) {
      errorNotification(getApiErrorMessage(error, 'Failed to create article'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b backdrop-blur"
        style={{ padding: '14px var(--shell-panel-padding)', borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="truncate text-[length:var(--font-meta)] text-[var(--text-secondary)]">
            Knowledge Base / {categoryId ? categories.find((c) => c.id.toString() === categoryId)?.name : 'Select category'} / New Article
          </div>
          <div className="flex min-w-0 items-center gap-2 overflow-visible">
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
              <span
                className="rounded-full text-[length:var(--font-meta)] px-2 py-1 font-medium"
                style={{ backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' }}
              >
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
            onClick={handleCreate}
            loading={isSubmitting}
            className="rounded-lg bg-gradient-to-r from-primary-600 to-primary-600 hover:from-primary-700 hover:to-primary-700 shadow-sm"
          >
            Create
          </Button>
        </div>
      </div>

      {/* Content safe area */}
      <div className="flex-1 overflow-auto">
        <div
          style={{
            width: '100%',
            minWidth: 0,
            paddingInline: 0,
            paddingTop: 'calc(var(--shell-page-padding) + 4px)',
            paddingBottom: 'var(--shell-panel-padding)',
          }}
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            maxLength={TITLE_MAX_LENGTH}
            className="w-full text-[28px] md:text-[30px] leading-tight font-semibold bg-transparent border-none outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
          {title.trim().length > 0 && (
            <p
              className="mt-1 text-[length:var(--font-meta)]"
              style={{ color: title.trim().length >= TITLE_MAX_LENGTH ? 'var(--status-danger-text)' : 'var(--text-muted)' }}
            >
              {title.trim().length}/{TITLE_MAX_LENGTH}
            </p>
          )}

          <div style={{ marginTop: 'var(--shell-page-padding)' }}>
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
              <p className="mt-2 text-[length:var(--font-meta)] text-[var(--status-danger-text)]">{contentError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateArticle;
