import React from 'react';
import type { AppIcon } from '../../components/icons/AppIcons';
import { clsx } from 'clsx';

type StatCardProps = {
  title: string;
  value: number | string;
  icon: AppIcon;
  color?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  onClick?: () => void;
};

const toneClasses: Record<NonNullable<StatCardProps['color']>, string> = {
  info: 'text-[var(--status-info-text)]',
  success: 'text-[var(--status-success-text)]',
  warning: 'text-[var(--status-warning-text)]',
  danger: 'text-[var(--status-danger-text)]',
  neutral: 'text-[var(--text-secondary)]',
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  color = 'info',
  onClick,
}) => {
  const content = (
    <div
      className={clsx(
        'flex min-w-0 items-start gap-2 rounded-[var(--shell-radius)] px-2 py-1.5 transition-colors',
        onClick && 'hover:bg-[var(--surface-subtle)]'
      )}
    >
      <div className={clsx('mt-0.5 flex h-[24px] w-[24px] shrink-0 items-center justify-center', toneClasses[color])}>
        <Icon size={24} stroke={2.0} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[var(--font-meta)] font-medium leading-4 text-[var(--text-muted)]">
          {title}
        </p>
        <p className="mt-1 text-[var(--font-stat-value)] font-semibold leading-none text-[var(--text-primary)]">
          {value}
        </p>
      </div>
    </div>
  );

  if (!onClick) {
    return content;
  }

  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      {content}
    </button>
  );
};
