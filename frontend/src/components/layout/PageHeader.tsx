import React from 'react';
import { cn } from '../../lib/utils';

/**
 * PageHeader — the one and only page header for authenticated screens.
 *
 * Every page in the app should start with `<PageHeader title=... />` so that
 * typography, spacing, and action alignment stay identical everywhere. No more
 * bespoke `<h1 className="text-2xl font-bold">` sprinkled across files.
 *
 * Font sizes and weights come from CSS variables defined in src/index.css:
 *   --font-page-title   (title)
 *   --font-page-subtitle (subtitle)
 *   --font-weight-title  (title weight)
 *   --font-weight-body   (subtitle weight)
 */
interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional node rendered on the right side (usually action buttons). */
  actions?: React.ReactNode;
  /** Optional node rendered below the title row (tabs, breadcrumbs, etc.). */
  meta?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  meta,
  className,
}) => {
  return (
    <header className={cn('mb-6 flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-[length:var(--font-page-title)] leading-tight text-[var(--text-primary)]"
            style={{ fontWeight: 'var(--font-weight-title)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="mt-1 text-[length:var(--font-page-subtitle)] leading-snug text-[var(--text-secondary)]"
              style={{ fontWeight: 'var(--font-weight-body)' }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {meta && <div className="min-w-0">{meta}</div>}
    </header>
  );
};

export default PageHeader;
