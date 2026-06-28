import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, FileText, MoreVertical, Share2, Pencil, Trash2,
  Search, RefreshCcw, ChevronDown, Folder,
} from 'lucide-react';
import { useKnowledgeStore } from '../../../stores/knowledgeStore';
import { KBArticle } from '../../../types/knowledge';
import { Modal } from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { successNotification, errorNotification } from '../../../components/ui/Toast';

type StatusTab = 'all' | 'published' | 'draft' | 'review' | 'archived';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Draft' },
  { key: 'review', label: 'Review' },
  { key: 'archived', label: 'Archived' },
];

const statusBadgeStyle = (status?: string): React.CSSProperties => {
  const s = (status || 'draft').toLowerCase();
  if (s === 'published') return { backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' };
  if (s === 'review') return { backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)' };
  if (s === 'archived') return { backgroundColor: 'var(--status-neutral-bg)', color: 'var(--status-neutral-text)' };
  return { backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning-text)' };
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  return date.toLocaleDateString();
};

const ArticleList: React.FC = () => {
  const navigate = useNavigate();
  const {
    articles, categories, isLoading,
    fetchArticles, fetchCategories,
    updateArticle, deleteArticle,
  } = useKnowledgeStore();

  // Filters
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<Exclude<StatusTab, 'all'>>('draft');
  const [bulkTargetCategoryId, setBulkTargetCategoryId] = useState('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isBulkMoving, setIsBulkMoving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Row menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchArticles();
    fetchCategories();
  }, [fetchArticles, fetchCategories]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-article-menu]') && !t.closest('[data-article-menu-btn]')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Counts per tab for badges
  const tabCounts = useMemo(() => {
    const counts: Record<StatusTab, number> = { all: 0, published: 0, draft: 0, review: 0, archived: 0 };
    articles.forEach((a) => {
      counts.all++;
      const s = (a.status || 'draft').toLowerCase() as Exclude<StatusTab, 'all'>;
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const q = search.toLowerCase().trim();
    return articles
      .filter((a) => {
        if (activeTab !== 'all' && (a.status || 'draft').toLowerCase() !== activeTab) return false;
        if (categoryFilter !== 'all' && String(a.category?.id) !== categoryFilter) return false;
        if (q) {
          const haystack = [a.title, a.excerpt, a.category?.name, a.author?.display_name, ...(a.tags || [])].join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const at = new Date(a.updated_at || a.created_at).getTime();
        const bt = new Date(b.updated_at || b.created_at).getTime();
        return sortDir === 'desc' ? bt - at : at - bt;
      });
  }, [articles, activeTab, categoryFilter, search, sortDir]);

  const allSelected = filteredArticles.length > 0 && filteredArticles.every((a) => selectedIds.has(a.id));

  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.indeterminate = selectedIds.size > 0 && !allSelected;
  }, [selectedIds.size, allSelected]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) filteredArticles.forEach((a) => next.delete(a.id));
      else filteredArticles.forEach((a) => next.add(a.id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkTargetCategoryId('');
  };

  const buildPayload = (article: KBArticle, overrides: Partial<KBArticle> = {}) => {
    const m = { ...article, ...overrides };
    return {
      title: m.title,
      content: m.content || '',
      excerpt: m.excerpt || '',
      category: m.category?.id,
      status: (m.status || 'draft').toLowerCase(),
      is_public: m.is_public ?? true,
      is_featured: m.is_featured ?? false,
      is_pinned: m.is_pinned ?? false,
      tags: m.tags || [],
      language: m.language,
      seo_title: m.seo_title,
      seo_description: m.seo_description,
      seo_keywords: m.seo_keywords,
    };
  };

  const handleBulkStatusUpdate = async () => {
    if (!selectedIds.size) return;
    try {
      setIsBulkUpdating(true);
      const targets = articles.filter((a) => selectedIds.has(a.id));
      await Promise.all(targets.map((a) => updateArticle(a.slug, buildPayload(a, { status: bulkStatus }) as any)));
      successNotification('Articles updated.');
      clearSelection();
      fetchArticles();
    } catch { errorNotification('Failed to update articles.'); }
    finally { setIsBulkUpdating(false); }
  };

  const handleBulkMove = async () => {
    if (!selectedIds.size || !bulkTargetCategoryId) return;
    const cat = categories.find((c) => String(c.id) === bulkTargetCategoryId);
    if (!cat) { errorNotification('Select a valid category.'); return; }
    try {
      setIsBulkMoving(true);
      const targets = articles.filter((a) => selectedIds.has(a.id));
      await Promise.all(targets.map((a) => updateArticle(a.slug, buildPayload(a, { category: cat }) as any)));
      successNotification('Articles moved.');
      clearSelection();
      fetchArticles();
    } catch { errorNotification('Failed to move articles.'); }
    finally { setIsBulkMoving(false); }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    setShowDeleteConfirm(false);
    try {
      setIsDeleting(true);
      const targets = articles.filter((a) => selectedIds.has(a.id));
      await Promise.all(targets.map((a) => deleteArticle(a.slug)));
      successNotification(`${selectedIds.size} article(s) deleted.`);
      clearSelection();
      fetchArticles();
    } catch { errorNotification('Failed to delete articles.'); }
    finally { setIsDeleting(false); }
  };

  const handleArticleMenuAction = async (article: KBArticle, action: string) => {
    setOpenMenuId(null);
    if (action === 'edit') { navigate(`/knowledge/articles/${article.slug}/edit`); return; }
    if (action === 'view') { navigate(`/knowledge/articles/${article.slug}`); return; }
    if (action === 'share') {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/knowledge/articles/${article.slug}`);
        successNotification('Link copied.');
      } catch { errorNotification('Failed to copy link.'); }
      return;
    }
    if (action === 'delete') {
      if (!window.confirm(`Delete "${article.title}"?`)) return;
      try {
        await deleteArticle(article.slug);
        successNotification('Article deleted.');
        fetchArticles();
      } catch { errorNotification('Failed to delete article.'); }
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-[length:var(--font-page-title)] text-[var(--text-primary)]"
          style={{ fontWeight: 'var(--font-weight-title)' }}
        >
          Articles
        </h1>
        <Button
          type="button"
          size="sm"
          icon={Plus}
          onClick={() => navigate('/knowledge/articles/new')}
        >
          New Article
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-0.5 border-b border-[var(--border-color)]">
        {STATUS_TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setActiveTab(tab.key); clearSelection(); }}
              className={[
                'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[length:var(--font-label)] transition-colors',
                active
                  ? 'border-[var(--primary,#4F46E5)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              ].join(' ')}
              style={active ? { fontWeight: 'var(--font-weight-label)' } : undefined}
            >
              {tab.label}
              <span
                className="rounded-full px-1.5 py-0.5 text-[length:var(--font-meta)]"
                style={active
                  ? { backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)' }
                  : { backgroundColor: 'var(--surface-muted)', color: 'var(--text-muted)' }}
              >
                {tabCounts[tab.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[220px] max-w-[400px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles…"
            className="h-[var(--shell-search-height)] w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] pl-9 pr-3 text-[length:var(--font-body)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
        </div>

        {/* Category filter */}
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-[var(--shell-search-height)] appearance-none rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] pl-3 pr-8 text-[length:var(--font-body)] text-[var(--text-primary)]"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        </div>

        {/* Sort */}
        <button
          type="button"
          onClick={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')}
          className="flex h-[var(--shell-search-height)] items-center gap-1.5 rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] px-3 text-[length:var(--font-body)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
        >
          Modified
          <ChevronDown size={13} className={sortDir === 'asc' ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>

        {/* Refresh */}
        <button
          type="button"
          onClick={() => { fetchArticles(); fetchCategories(); successNotification('Refreshed.'); }}
          className="flex h-[var(--shell-search-height)] items-center justify-center rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] px-3 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
          aria-label="Refresh"
        >
          <RefreshCcw size={14} />
        </button>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-3">
          <span className="text-[length:var(--font-body)] text-[var(--text-primary)]">
            {selectedIds.size} selected
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Status change */}
            <div className="relative">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as Exclude<StatusTab, 'all'>)}
                className="appearance-none rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] py-1.5 pl-3 pr-7 text-[length:var(--font-body)] text-[var(--text-primary)]"
              >
                <option value="draft">Set: Draft</option>
                <option value="review">Set: Review</option>
                <option value="published">Set: Published</option>
                <option value="archived">Set: Archived</option>
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            </div>
            <Button type="button" size="sm" onClick={handleBulkStatusUpdate} disabled={isBulkUpdating}>
              {isBulkUpdating ? 'Applying…' : 'Apply'}
            </Button>

            {/* Move to category */}
            <div className="relative">
              <select
                value={bulkTargetCategoryId}
                onChange={(e) => setBulkTargetCategoryId(e.target.value)}
                className="appearance-none rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] py-1.5 pl-3 pr-7 text-[length:var(--font-body)] text-[var(--text-primary)]"
              >
                <option value="">Move to…</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            </div>
            {bulkTargetCategoryId && (
              <Button type="button" size="sm" onClick={handleBulkMove} disabled={isBulkMoving}>
                {isBulkMoving ? 'Moving…' : 'Move'}
              </Button>
            )}

            <Button type="button" size="sm" variant="danger" icon={Trash2} onClick={() => setShowDeleteConfirm(true)} disabled={isDeleting}>
              Delete
            </Button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-1.5 text-[length:var(--font-body)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)]">
        {/* Table header */}
        <div
          className="grid items-center gap-3 border-b border-[var(--border-color)] px-4 py-3 text-[length:var(--font-label)] text-[var(--text-secondary)]"
          style={{
            gridTemplateColumns: '32px minmax(200px,2fr) 120px 140px 160px 120px 40px',
            fontWeight: 'var(--font-weight-label)',
          }}
        >
          <div>
            <input
              ref={headerCheckboxRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded"
              style={{ accentColor: 'var(--primary,#4F46E5)' }}
            />
          </div>
          <div>Title</div>
          <div>Status</div>
          <div>Category</div>
          <div>Author</div>
          <div>Modified</div>
          <div />
        </div>

        {/* Loading shimmer — only shown when there's no cached data yet */}
        {isLoading && articles.length === 0 && (
          <div className="divide-y divide-[var(--border-color)]">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="grid items-center gap-3 px-4 py-3.5"
                style={{ gridTemplateColumns: '32px minmax(200px,2fr) 120px 140px 160px 120px 40px' }}
              >
                <div className="sd-shimmer h-4 w-4 rounded" />
                <div className="sd-shimmer h-3.5 w-3/4" />
                <div className="sd-shimmer h-5 w-20 rounded-full" />
                <div className="sd-shimmer h-5 w-24 rounded-full" />
                <div className="sd-shimmer h-3.5 w-28" />
                <div className="sd-shimmer h-3.5 w-16" />
                <div />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredArticles.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--surface-muted)' }}
            >
              <FileText size={22} className="text-[var(--text-muted)]" />
            </div>
            <div>
              <p className="text-[length:var(--font-body)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                No articles found
              </p>
              <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                {search || categoryFilter !== 'all' || activeTab !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'Create your first article to get started.'}
              </p>
            </div>
            {activeTab === 'all' && !search && categoryFilter === 'all' && (
              <Button type="button" size="sm" icon={Plus} onClick={() => navigate('/knowledge/articles/new')}>
                New Article
              </Button>
            )}
          </div>
        )}

        {/* Rows */}
        {filteredArticles.length > 0 && (
          <div className="divide-y divide-[var(--border-color)]">
            {filteredArticles.map((article) => (
              <div
                key={article.id}
                className="grid items-center gap-3 px-4 py-3 hover:bg-[var(--surface-subtle)]"
                style={{ gridTemplateColumns: '32px minmax(200px,2fr) 120px 140px 160px 120px 40px' }}
              >
                {/* Checkbox */}
                <div>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(article.id)}
                    onChange={() => toggleSelect(article.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded"
                    style={{ accentColor: 'var(--primary,#4F46E5)' }}
                  />
                </div>

                {/* Title */}
                <button
                  type="button"
                  onClick={() => navigate(`/knowledge/articles/${article.slug}`)}
                  className="flex items-center gap-2 text-left hover:text-[var(--text-primary)]"
                >
                  <FileText size={14} className="flex-shrink-0 text-[var(--text-muted)]" />
                  <span className="truncate text-[length:var(--font-body)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                    {article.title}
                  </span>
                </button>

                {/* Status badge */}
                <div>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[length:var(--font-meta)]"
                    style={{ ...statusBadgeStyle(article.status), fontWeight: 'var(--font-weight-label)' }}
                  >
                    {article.status || 'draft'}
                  </span>
                </div>

                {/* Category badge */}
                <div>
                  {article.category ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[length:var(--font-meta)]"
                      style={{ backgroundColor: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                    >
                      <Folder size={11} />
                      <span className="truncate max-w-[100px]">{article.category.name}</span>
                    </span>
                  ) : (
                    <span className="text-[length:var(--font-meta)] text-[var(--text-muted)]">—</span>
                  )}
                </div>

                {/* Author */}
                <div className="truncate text-[length:var(--font-body)] text-[var(--text-secondary)]">
                  {article.author?.display_name || article.author?.username || 'Admin'}
                </div>

                {/* Modified */}
                <div className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                  {formatDate(article.updated_at)}
                </div>

                {/* Row menu */}
                <div className="relative flex justify-end">
                  <button
                    type="button"
                    data-article-menu-btn
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === `a-${article.id}` ? null : `a-${article.id}`);
                    }}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <MoreVertical size={15} />
                  </button>
                  {openMenuId === `a-${article.id}` && (
                    <div
                      data-article-menu
                      className="absolute right-0 top-6 z-20 w-44 rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] py-1.5 shadow-[var(--shell-shadow-md)]"
                    >
                      {[
                        { action: 'view', icon: FileText, label: 'View' },
                        { action: 'edit', icon: Pencil, label: 'Edit' },
                        { action: 'share', icon: Share2, label: 'Copy Link' },
                        { action: 'delete', icon: Trash2, label: 'Delete', danger: true },
                      ].map(({ action, icon: Icon, label, danger }) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => handleArticleMenuAction(article, action)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-[length:var(--font-body)] hover:bg-[var(--surface-subtle)]"
                          style={{ color: danger ? 'var(--status-danger-text)' : 'var(--text-primary)' }}
                        >
                          <Icon size={13} />
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Total count */}
      {filteredArticles.length > 0 && (
        <p className="text-right text-[length:var(--font-meta)] text-[var(--text-muted)]">
          {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Delete confirm modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Articles">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--status-danger-bg)' }}
            >
              <Trash2 className="h-5 w-5" style={{ color: 'var(--status-danger-text)' }} />
            </div>
            <div>
              <p
                className="text-[length:var(--font-body)] text-[var(--text-primary)]"
                style={{ fontWeight: 'var(--font-weight-label)' }}
              >
                Permanently delete {selectedIds.size} article{selectedIds.size !== 1 ? 's' : ''}?
              </p>
              <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                This cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" variant="danger" onClick={handleBulkDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete Forever'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ArticleList;
