import React from 'react';
import type { LabelItem } from '../../types';
import LabelBadge from './LabelBadge';

interface LabelGroupProps {
  labels: LabelItem[];
  maxVisible?: number;
  size?: 'xs' | 'sm' | 'md' | 'table';
  className?: string;
  emptyText?: string;
}

export const LabelGroup: React.FC<LabelGroupProps> = ({
  labels,
  maxVisible,
  size = 'sm',
  className,
  emptyText,
}) => {
  const emptyTextClass =
    size === 'xs'
      ? 'text-[8px]'
      : size === 'table'
        ? 'text-[12px]'
      : size === 'md'
        ? 'text-[14px]'
        : 'text-[12px]';
  const overflowChipClass =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[8px]'
      : size === 'table'
        ? 'px-2 py-0.5 text-[12px]'
      : size === 'md'
        ? 'px-2 py-0.5 text-[14px]'
        : 'px-2 py-0.5 text-[12px]';

  if (!labels?.length) {
    return emptyText ? (
      <span className={`${emptyTextClass} italic text-gray-500 dark:text-[var(--text-muted)]`}>
        {emptyText}
      </span>
    ) : null;
  }

  const visibleLabels = typeof maxVisible === 'number' ? labels.slice(0, maxVisible) : labels;
  const hiddenCount = typeof maxVisible === 'number' ? Math.max(labels.length - maxVisible, 0) : 0;
  const hiddenLabels = typeof maxVisible === 'number' ? labels.slice(maxVisible) : [];
  const hiddenLabelNames = hiddenLabels.map((label) => label.name).join(', ');

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className || ''}`}>
      {visibleLabels.map((label) => (
        <LabelBadge key={label.id} label={label} size={size} />
      ))}
      {hiddenCount > 0 && (
        <div className="group relative inline-flex">
          <span
            className={`inline-flex cursor-default items-center rounded-full border border-gray-300/80 bg-white/80 ${overflowChipClass} font-medium text-gray-700 shadow-sm backdrop-blur-sm dark:border-subtle dark:bg-surface-hover/90 dark:text-[var(--text-primary)]`}
            title={hiddenLabelNames}
            aria-label={`${hiddenCount} more labels: ${hiddenLabelNames}`}
          >
            +{hiddenCount}
          </span>
          <div className="pointer-events-none invisible absolute left-0 top-full z-20 mt-2 min-w-[220px] max-w-[320px] translate-y-1 rounded-xl border border-gray-200 bg-white/95 p-3 opacity-0 shadow-2xl backdrop-blur-sm transition-all duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 dark:border-subtle dark:bg-surface-elevated/95">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-gray-500 dark:text-[var(--text-muted)]">
              More Labels
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hiddenLabels.map((label) => (
                <LabelBadge key={label.id} label={label} size={size === 'xs' ? 'xs' : 'sm'} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabelGroup;
