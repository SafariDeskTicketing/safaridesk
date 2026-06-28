import React from 'react';
import { Check, Edit, Plus, Search, Tag, Trash2 } from 'lucide-react';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { errorNotification, successNotification } from '../ui/Toast';
import Button from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import LabelBadge from '../ui/LabelBadge';
import type { LabelItem } from '../../types';
import { getLabelTextColorFallback } from '../../utils/labels';
import { PageHeader } from '../layout';

interface LabelRecord extends LabelItem {
  created_at?: string;
  updated_at?: string;
}

interface LabelsResponse {
  count: number;
  results: LabelRecord[];
}

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;

const LABEL_COLOR_RGB_TUPLES: Array<[number, number, number]> = [
  [127, 29, 29],
  [154, 52, 18],
  [161, 98, 7],
  [22, 101, 52],
  [15, 118, 110],
  [29, 78, 216],
  [49, 46, 129],
  [107, 33, 168],
  [157, 23, 77],
  [51, 65, 85],
  [133, 77, 14],
  [21, 128, 61],
  [3, 105, 161],
  [30, 58, 138],
  [124, 45, 18],
  [54, 83, 20],
  [76, 29, 149],
  [131, 24, 67],
];

const LABEL_COLOR_OPTIONS = LABEL_COLOR_RGB_TUPLES.map(([r, g, b]) => toHex(r, g, b));
const DEFAULT_COLOR = LABEL_COLOR_OPTIONS[0];

const isColorLight = (hex: string) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return false;

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58;
};

export const LabelsSettings: React.FC = () => {
  const [labels, setLabels] = React.useState<LabelRecord[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize] = React.useState(12);
  const [totalCount, setTotalCount] = React.useState(0);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [editingLabel, setEditingLabel] = React.useState<LabelRecord | null>(null);
  const [deletingLabel, setDeletingLabel] = React.useState<LabelRecord | null>(null);
  const [formState, setFormState] = React.useState({
    name: '',
    description: '',
    color: DEFAULT_COLOR,
    is_active: true,
  });

  const fetchLabels = React.useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const response = await http.get<LabelsResponse>(APIS.LABELS_BASE, {
        params: {
          page,
          page_size: pageSize,
        },
      });
      setLabels(response.data.results || []);
      setTotalCount(response.data.count || 0);
      setCurrentPage(page);
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to load labels');
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  React.useEffect(() => {
    fetchLabels(1);
  }, [fetchLabels]);

  const filteredLabels = React.useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return labels;
    return labels.filter((labelItem) => {
      const haystack = `${labelItem.name} ${labelItem.description || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [labels, searchTerm]);

  const resetForm = () => {
    setFormState({
      name: '',
      description: '',
      color: DEFAULT_COLOR,
      is_active: true,
    });
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    resetForm();
  };

  const closeEditModal = () => {
    setEditingLabel(null);
    resetForm();
  };

  const openEditModal = (labelItem: LabelRecord) => {
    setEditingLabel(labelItem);
    setFormState({
      name: labelItem.name,
      description: labelItem.description || '',
      color: labelItem.color || DEFAULT_COLOR,
      is_active: labelItem.is_active,
    });
  };

  const handleCreate = async () => {
    if (!formState.name.trim()) {
      errorNotification('Label name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await http.post(APIS.LABELS_BASE, {
        name: formState.name.trim(),
        description: formState.description.trim(),
        color: formState.color,
        is_active: formState.is_active,
      });
      successNotification('Label created successfully');
      closeCreateModal();
      await fetchLabels(currentPage);
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to create label');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingLabel) return;
    if (!formState.name.trim()) {
      errorNotification('Label name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await http.patch(`${APIS.LABELS_BASE}${editingLabel.id}/`, {
        name: formState.name.trim(),
        description: formState.description.trim(),
        color: formState.color,
        is_active: formState.is_active,
      });
      successNotification('Label updated successfully');
      closeEditModal();
      await fetchLabels(currentPage);
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to update label');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingLabel) return;
    setIsSubmitting(true);
    try {
      await http.delete(`${APIS.LABELS_BASE}${deletingLabel.id}/`);
      successNotification('Label deleted successfully');
      setDeletingLabel(null);
      await fetchLabels(currentPage);
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to delete label');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (labelItem: LabelRecord) => {
    try {
      await http.patch(`${APIS.LABELS_BASE}${labelItem.id}/`, {
        is_active: !labelItem.is_active,
      });
      successNotification(`Label ${labelItem.is_active ? 'disabled' : 'enabled'}`);
      await fetchLabels(currentPage);
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to update label state');
    }
  };

  const renderForm = () => (
    <div className="space-y-4">
      <Input
        label="Name"
        value={formState.name}
        onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
        placeholder="bug"
        fullWidth
      />
      <div>
        <label className="mb-1 block text-[length:var(--font-label)] font-medium text-gray-700 dark:text-[var(--text-primary)]">
          Description
        </label>
        <textarea
          rows={3}
          value={formState.description}
          onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Used for defects and regressions."
          className="w-full rounded-[var(--shell-radius)] border border-gray-300 bg-white px-3 py-2 text-[length:var(--font-body)] text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-subtle dark:bg-surface-elevated dark:text-[var(--text-primary)]"
        />
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-2 block text-[length:var(--font-label)] font-medium text-gray-700 dark:text-[var(--text-primary)]">
            Color
          </label>
          <p className="mb-3 text-[length:var(--font-meta)] text-gray-500 dark:text-[var(--text-muted)]">
            Click a swatch to choose the label color. Use the hex field only if you want a custom tone.
          </p>
          <div className="grid grid-cols-6 gap-2 md:grid-cols-9" role="radiogroup" aria-label="Label colors">
            {LABEL_COLOR_OPTIONS.map((color) => {
              const isSelected = color.toLowerCase() === formState.color.toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormState((prev) => ({ ...prev, color }))}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all hover:-translate-y-0.5 ${
                    isSelected
                      ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-400 dark:border-white dark:ring-gray-500 dark:ring-offset-surface-elevated'
                      : 'border-gray-200 hover:border-gray-300 dark:border-subtle dark:hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: `${color}20` }}
                  title={color}
                  aria-label={`Select ${color}`}
                  aria-pressed={isSelected}
                  role="radio"
                  aria-checked={isSelected}
                >
                  <span
                    className="absolute inset-[4px] rounded-full border border-white/70 shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  {isSelected && (
                    <Check
                      className={`relative z-10 h-4 w-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] ${
                        isColorLight(color) ? 'text-gray-900' : 'text-white'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <Input
            label="Hex Color"
            value={formState.color}
            onChange={(event) => setFormState((prev) => ({ ...prev, color: event.target.value }))}
            placeholder="#D73A4A"
            fullWidth
          />
          <LabelBadge
            label={{
              id: 0,
              name: formState.name.trim() || 'preview',
              description: formState.description,
              color: formState.color || DEFAULT_COLOR,
              text_color: getLabelTextColorFallback(formState.color || DEFAULT_COLOR),
              is_active: formState.is_active,
            }}
            size="md"
          />
        </div>
      </div>
      <label className="flex items-center gap-3 text-[length:var(--font-body)] text-gray-700 dark:text-[var(--text-primary)]">
        <input
          type="checkbox"
          checked={formState.is_active}
          onChange={(event) => setFormState((prev) => ({ ...prev, is_active: event.target.checked }))}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        Active and available for new ticket/task assignment
      </label>
    </div>
  );

  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);

  return (
    <div className="sd-config-content">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Tag className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            <span>Labels</span>
          </span>
        }
        subtitle="Shared GitHub-style labels used by both tickets and tasks."
        actions={
          <Button icon={Plus} size="sm" onClick={() => setShowCreateModal(true)}>
            New Label
          </Button>
        }
      />

      <div className="space-y-4">

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input
            icon={Search}
            placeholder="Search labels..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-9 max-w-sm text-[length:var(--font-body)]"
          />
          <div className="text-[length:var(--font-body)] text-gray-500 dark:text-[var(--text-muted)]">
            {searchTerm ? `${filteredLabels.length} filtered` : `${totalCount} total`}
          </div>
        </div>

        <div className="surface-card overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_120px] gap-4 border-b border-[var(--border-color)] px-5 py-3 text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--text-muted)]">
            <span>Label</span>
            <span>Description</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-[length:var(--font-body)] text-gray-500 dark:text-[var(--text-muted)]">Loading labels...</div>
          ) : filteredLabels.length === 0 ? (
            <div className="px-5 py-10 text-[length:var(--font-body)] text-gray-500 dark:text-[var(--text-muted)]">No labels found.</div>
          ) : (
            filteredLabels.map((labelItem) => (
              <div
                key={labelItem.id}
                className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_120px] gap-4 border-b border-[var(--border-color)] px-5 py-4 last:border-b-0"
              >
                <div className="min-w-0 space-y-1">
                  <LabelBadge label={labelItem} size="md" />
                  <div className="text-[length:var(--font-meta)] text-gray-500 dark:text-[var(--text-muted)]">
                    {labelItem.color}
                  </div>
                </div>
                <div className="min-w-0 text-[length:var(--font-body)] text-gray-600 dark:text-[var(--text-primary)]">
                  {labelItem.description || 'No description'}
                </div>
                <div className="flex items-center">
                  <label className="inline-flex items-center gap-2 text-[length:var(--font-body)] text-gray-700 dark:text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={labelItem.is_active}
                      onChange={() => handleToggleActive(labelItem)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    {labelItem.is_active ? 'Active' : 'Inactive'}
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" icon={Edit} onClick={() => openEditModal(labelItem)} />
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeletingLabel(labelItem)} />
                </div>
              </div>
            ))
          )}
        </div>

        {!searchTerm && totalPages > 1 && (
          <div className="flex items-center justify-between text-[length:var(--font-body)] text-gray-600 dark:text-[var(--text-muted)]">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchLabels(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchLabels(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showCreateModal} onClose={closeCreateModal} title="Create Label">
        <div className="space-y-4">
          {renderForm()}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeCreateModal}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={isSubmitting}>
              Create label
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(editingLabel)} onClose={closeEditModal} title="Edit Label">
        <div className="space-y-4">
          {renderForm()}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeEditModal}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} loading={isSubmitting}>
              Save changes
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(deletingLabel)} onClose={() => setDeletingLabel(null)} title="Delete Label" size="sm">
        <div className="space-y-4">
          <p className="text-[length:var(--font-body)] text-gray-600 dark:text-[var(--text-primary)]">
            Delete <span className="font-semibold">{deletingLabel?.name}</span>? Existing ticket and task history may still reference it.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeletingLabel(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={isSubmitting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LabelsSettings;
