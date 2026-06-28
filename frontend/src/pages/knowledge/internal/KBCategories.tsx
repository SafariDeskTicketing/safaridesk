import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Folder, Globe, Lock, Merge, MoreVertical } from 'lucide-react';
import { useKnowledgeStore } from '../../../stores/knowledgeStore';
import { KBCategory } from '../../../types/knowledge';
import { Modal } from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { successNotification, errorNotification } from '../../../components/ui/Toast';

// ── helpers ──────────────────────────────────────────────────────────────────

const ICON_COLORS = [
  '#4F46E5', '#0EA5E9', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6',
];

const hashColor = (name: string) =>
  ICON_COLORS[
    name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % ICON_COLORS.length
  ];

// ── component ─────────────────────────────────────────────────────────────────

const KBCategories: React.FC = () => {
  const {
    categories, articles, isLoadingCategories,
    fetchCategories, fetchArticles,
    createCategory, updateCategory, deleteCategory,
  } = useKnowledgeStore();

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPublic, setNewPublic] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Edit modal
  const [editingCat, setEditingCat] = useState<KBCategory | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPublic, setEditPublic] = useState(true);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Merge modal
  const [mergeSrc, setMergeSrc] = useState<KBCategory | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [isMerging, setIsMerging] = useState(false);

  // Row menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchArticles();
  }, [fetchCategories, fetchArticles]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-cat-menu]') &&
          !(e.target as HTMLElement).closest('[data-cat-menu-btn]')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Count articles per category from local state
  const articleCountMap: Record<number, number> = {};
  articles.forEach((a) => {
    if (a.category?.id) {
      articleCountMap[a.category.id] = (articleCountMap[a.category.id] || 0) + 1;
    }
  });

  const handleCreate = async () => {
    if (!newName.trim()) { errorNotification('Name is required.'); return; }
    try {
      setIsCreating(true);
      await createCategory({ name: newName.trim(), description: newDesc.trim() || undefined, is_public: newPublic });
      successNotification('Category created.');
      setShowCreate(false);
      setNewName(''); setNewDesc(''); setNewPublic(true);
    } catch { errorNotification('Failed to create category.'); }
    finally { setIsCreating(false); }
  };

  const openEdit = (cat: KBCategory) => {
    setEditingCat(cat);
    setEditName(cat.name);
    setEditDesc(cat.description || '');
    setEditPublic(cat.is_public ?? true);
    setOpenMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingCat || !editName.trim()) { errorNotification('Name is required.'); return; }
    try {
      setIsSavingEdit(true);
      await updateCategory(editingCat.slug, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        is_public: editPublic,
      });
      successNotification('Category updated.');
      setEditingCat(null);
    } catch { errorNotification('Failed to update category.'); }
    finally { setIsSavingEdit(false); }
  };

  const handleDelete = async (cat: KBCategory) => {
    setOpenMenuId(null);
    const count = articleCountMap[cat.id] || cat.article_count || 0;
    const msg = count > 0
      ? `Delete "${cat.name}"? It contains ${count} article(s). Articles will become uncategorized.`
      : `Delete "${cat.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await deleteCategory(cat.slug);
      successNotification('Category deleted.');
    } catch { errorNotification('Failed to delete category.'); }
  };

  const openMerge = (cat: KBCategory) => {
    setMergeSrc(cat);
    setMergeTargetId('');
    setOpenMenuId(null);
  };

  const handleMerge = async () => {
    if (!mergeSrc || !mergeTargetId) { errorNotification('Select a target category.'); return; }
    const targetCat = categories.find((c) => String(c.id) === mergeTargetId);
    if (!targetCat) return;
    try {
      setIsMerging(true);
      const srcArticles = articles.filter((a) => a.category?.id === mergeSrc.id);
      const { updateArticle } = useKnowledgeStore.getState();
      await Promise.all(
        srcArticles.map((a) => updateArticle(a.slug, {
          title: a.title, content: a.content || '', excerpt: a.excerpt || '',
          category: targetCat.id, status: a.status,
        } as any))
      );
      await deleteCategory(mergeSrc.slug);
      successNotification(`Merged into "${targetCat.name}".`);
      setMergeSrc(null);
      fetchArticles();
    } catch { errorNotification('Merge failed.'); }
    finally { setIsMerging(false); }
  };

  // ── render ────────────────────────────────────────────────────────────────

  const totalPublic = categories.filter((c) => c.is_public).length;
  const totalArticles = articles.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-[length:var(--font-page-title)] text-[var(--text-primary)]"
          style={{ fontWeight: 'var(--font-weight-title)' }}
        >
          Categories
        </h1>
        <Button type="button" size="sm" icon={Plus} onClick={() => setShowCreate(true)}>
          New Category
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Categories', value: categories.length },
          { label: 'Public', value: totalPublic },
          { label: 'Total Articles', value: totalArticles },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-3"
          >
            <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">{label}</p>
            <p
              className="mt-0.5 text-[length:var(--font-section-title)] text-[var(--text-primary)]"
              style={{ fontWeight: 'var(--font-weight-title)' }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Loading shimmer — only shown when there's no cached data yet */}
      {isLoadingCategories && categories.length === 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-5"
            >
              <div className="flex items-start gap-3">
                <div className="sd-shimmer h-10 w-10 flex-shrink-0 rounded-[var(--shell-radius)]" />
                <div className="flex-1 space-y-2">
                  <div className="sd-shimmer h-4 w-3/4" />
                  <div className="sd-shimmer h-3 w-full" />
                  <div className="sd-shimmer h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoadingCategories && categories.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] py-16 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--surface-muted)' }}
          >
            <Folder size={22} className="text-[var(--text-muted)]" />
          </div>
          <div>
            <p className="text-[length:var(--font-body)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
              No categories yet
            </p>
            <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
              Categories help you organise articles for your customers.
            </p>
          </div>
          <Button type="button" size="sm" icon={Plus} onClick={() => setShowCreate(true)}>
            New Category
          </Button>
        </div>
      )}

      {/* Category grid */}
      {categories.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const color = hashColor(cat.name);
            const count = articleCountMap[cat.id] ?? cat.article_count ?? 0;
            return (
              <div
                key={cat.id}
                className="group relative rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-5 transition-shadow hover:shadow-[var(--shell-shadow-sm)]"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Icon */}
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--shell-radius)]"
                    style={{ backgroundColor: `${color}18`, color }}
                  >
                    <Folder size={18} />
                  </div>

                  {/* Menu button */}
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      data-cat-menu-btn
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === `cat-${cat.id}` ? null : `cat-${cat.id}`);
                      }}
                      className="rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--text-primary)]"
                    >
                      <MoreVertical size={15} />
                    </button>
                    {openMenuId === `cat-${cat.id}` && (
                      <div
                        data-cat-menu
                        className="absolute right-0 top-6 z-20 w-44 rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] py-1.5 shadow-[var(--shell-shadow-md)]"
                      >
                        <button
                          type="button"
                          onClick={() => openEdit(cat)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openMerge(cat)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                        >
                          <Merge size={13} /> Merge into…
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cat)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-[length:var(--font-body)] hover:bg-[var(--surface-subtle)]"
                          style={{ color: 'var(--status-danger-text)' }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Name + description */}
                <div className="mt-3">
                  <p
                    className="text-[length:var(--font-body)] text-[var(--text-primary)]"
                    style={{ fontWeight: 'var(--font-weight-label)' }}
                  >
                    {cat.name}
                  </p>
                  {cat.description && (
                    <p className="mt-1 line-clamp-2 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                      {cat.description}
                    </p>
                  )}
                </div>

                {/* Footer: count + visibility */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                    {count} article{count !== 1 ? 's' : ''}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[length:var(--font-meta)]"
                    style={cat.is_public
                      ? { backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }
                      : { backgroundColor: 'var(--status-neutral-bg)', color: 'var(--status-neutral-text)' }}
                  >
                    {cat.is_public ? <Globe size={10} /> : <Lock size={10} />}
                    {cat.is_public ? 'Public' : 'Internal'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Category">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
              Name <span style={{ color: 'var(--status-danger-text)' }}>*</span>
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Getting Started"
              autoFocus
              className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
              Description
            </label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Brief description…"
              rows={2}
              className="w-full resize-none rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[length:var(--font-body)] text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={newPublic}
              onChange={(e) => setNewPublic(e.target.checked)}
              className="h-4 w-4 rounded"
              style={{ accentColor: 'var(--primary,#4F46E5)' }}
            />
            Visible to customers (public)
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleCreate} disabled={isCreating}>
              {isCreating ? 'Creating…' : 'Create Category'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={Boolean(editingCat)} onClose={() => setEditingCat(null)} title="Edit Category">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
              Name <span style={{ color: 'var(--status-danger-text)' }}>*</span>
            </label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
              Description
            </label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)]"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[length:var(--font-body)] text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={editPublic}
              onChange={(e) => setEditPublic(e.target.checked)}
              className="h-4 w-4 rounded"
              style={{ accentColor: 'var(--primary,#4F46E5)' }}
            />
            Visible to customers (public)
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditingCat(null)}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Merge modal */}
      <Modal isOpen={Boolean(mergeSrc)} onClose={() => setMergeSrc(null)} title="Merge Category">
        <div className="space-y-4">
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
            Move all articles from{' '}
            <span className="text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
              {mergeSrc?.name}
            </span>{' '}
            into another category, then delete the source.
          </p>
          <div>
            <label className="mb-1.5 block text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
              Merge into
            </label>
            <select
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
              className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3 py-2 text-[length:var(--font-body)] text-[var(--text-primary)]"
            >
              <option value="">Select target category</option>
              {categories.filter((c) => c.id !== mergeSrc?.id).map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" onClick={() => setMergeSrc(null)}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleMerge} disabled={isMerging || !mergeTargetId}>
              {isMerging ? 'Merging…' : 'Merge & Delete Source'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default KBCategories;
