import React from 'react';
import { Search } from 'lucide-react';
import type { LabelItem } from '../../types';
import LabelGroup from './LabelGroup';

interface LabelPickerProps {
  availableLabels: LabelItem[];
  selectedLabelIds: number[];
  onChange: (labelIds: number[]) => void;
  selectedLabels?: LabelItem[];
  label?: string;
  helperText?: string;
  disabled?: boolean;
  emptyText?: string;
}

export const LabelPicker: React.FC<LabelPickerProps> = ({
  availableLabels,
  selectedLabelIds,
  onChange,
  selectedLabels = [],
  label,
  helperText,
  disabled = false,
  emptyText = 'No labels available.',
}) => {
  const [search, setSearch] = React.useState('');

  const labelLookup = React.useMemo(() => {
    const map = new Map<number, LabelItem>();
    [...selectedLabels, ...availableLabels].forEach((labelItem) => {
      map.set(labelItem.id, labelItem);
    });
    return map;
  }, [availableLabels, selectedLabels]);

  const selectedItems = React.useMemo(
    () => selectedLabelIds.map((id) => labelLookup.get(id)).filter(Boolean) as LabelItem[],
    [labelLookup, selectedLabelIds],
  );

  const filteredLabels = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return availableLabels;
    return availableLabels.filter((labelItem) => {
      const haystack = `${labelItem.name} ${labelItem.description || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [availableLabels, search]);

  const toggleLabel = (labelId: number) => {
    if (disabled) return;

    if (selectedLabelIds.includes(labelId)) {
      onChange(selectedLabelIds.filter((currentId) => currentId !== labelId));
      return;
    }

    onChange([...selectedLabelIds, labelId]);
  };

  return (
    <div className="space-y-3">
      {label && (
        <div>
          <p className="text-[14px] font-medium text-[var(--text-primary)]">{label}</p>
          {helperText && (
            <p className="mt-1 text-[14px] text-[var(--text-muted)]">{helperText}</p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search labels"
            disabled={disabled}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-muted)] py-2.5 pl-9 pr-3 text-[14px] text-[var(--text-primary)] outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="mt-3">
          <LabelGroup labels={selectedItems} size="sm" emptyText="No labels selected" />
        </div>

        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
          {filteredLabels.length === 0 ? (
            <p className="text-[14px] text-[var(--text-muted)]">{emptyText}</p>
          ) : (
            filteredLabels.map((labelItem) => {
              const isSelected = selectedLabelIds.includes(labelItem.id);
              return (
                <label
                  key={labelItem.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition-colors ${
                    isSelected
                      ? 'border-primary-300 bg-[var(--surface-subtle)] dark:border-primary-700'
                      : 'border-[var(--border-color)] bg-[var(--surface-muted)] hover:bg-[var(--hover-bg)]'
                  } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={disabled}
                    onChange={() => toggleLabel(labelItem.id)}
                    className="mt-1 h-4 w-4 rounded border-[var(--border-color)] text-primary-600 focus:ring-primary-500"
                  />
                  <div className="min-w-0 flex-1">
                    <LabelGroup labels={[labelItem]} size="sm" />
                    {labelItem.description && (
                      <p className="mt-1 text-[14px] text-[var(--text-muted)]">
                        {labelItem.description}
                      </p>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default LabelPicker;
