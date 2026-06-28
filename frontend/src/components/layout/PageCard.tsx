import React from 'react';
import { cn } from '../../lib/utils';

/**
 * PageCard — the canonical card surface used across authenticated pages.
 *
 * Matches the look that tickets and tasks already use: a rounded surface with
 * a subtle border, consistent shadow, white background (dark-aware), and
 * standardized inner padding.
 *
 * Typography for headings inside a card should come from the CSS variables in
 * src/index.css (--font-section-title, --font-label, --font-meta) — use the
 * PageCardHeader sub-component for that.
 */
interface PageCardProps {
  children: React.ReactNode;
  /** Padding preset. Defaults to `md`. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Extra classes (merged via tailwind-merge). */
  className?: string;
  /** HTML element to render as. Defaults to `section`. */
  as?: keyof JSX.IntrinsicElements;
}

const PADDING_CLASSES: Record<NonNullable<PageCardProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-4 sm:p-5',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-7',
};

export const PageCard: React.FC<PageCardProps> = ({
  children,
  padding = 'md',
  className,
  as: Component = 'section',
}) => {
  // TypeScript needs a little coaxing for the dynamic `as` prop.
  const Tag = Component as 'section';
  return (
    <Tag
      className={cn(
        'rounded-[var(--shell-radius)] border border-[var(--border-color)]',
        'bg-[var(--card-bg)] shadow-[var(--shell-shadow-sm)]',
        PADDING_CLASSES[padding],
        className
      )}
    >
      {children}
    </Tag>
  );
};

interface PageCardHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standardized header that lives inside a PageCard. Uses the section-title
 * token so every card header looks identical across the app.
 */
export const PageCardHeader: React.FC<PageCardHeaderProps> = ({
  title,
  description,
  actions,
  className,
}) => {
  return (
    <div
      className={cn(
        'mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <h2
          className="text-[length:var(--font-section-title)] leading-snug text-[var(--text-primary)]"
          style={{ fontWeight: 'var(--font-weight-title)' }}
        >
          {title}
        </h2>
        {description && (
          <p
            className="mt-1 text-[length:var(--font-meta)] leading-snug text-[var(--text-secondary)]"
            style={{ fontWeight: 'var(--font-weight-body)' }}
          >
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
};

export default PageCard;
