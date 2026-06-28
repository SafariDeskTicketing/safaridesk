import React from 'react';
import { cn } from '../../lib/utils';

/**
 * PageContainer — GitHub-style content constraint.
 *
 * - The SIDEBAR stays glued to the left edge of the viewport (handled by Layout.tsx)
 * - The AI panel stays glued to the right edge of the viewport (handled by Layout.tsx)
 * - THIS component only constrains the MAIN CONTENT, centering it with a sensible
 *   max width and a min width so very narrow viewports just scroll the content.
 *
 * Use this as the top-level wrapper inside every authenticated page component.
 *
 * Sizes (aligned with tokens in src/index.css):
 *   default → clamps to var(--shell-content-max-width) (~1260px)
 *   wide    → ~1440px for data-heavy pages (tables, analytics)
 *   narrow  → ~900px for forms, profile, settings detail screens
 *   full    → no max width (edge-to-edge, rarely needed)
 */
export type PageContainerWidth = 'narrow' | 'default' | 'wide' | 'full';

interface PageContainerProps {
  children: React.ReactNode;
  /** Content width preset. Defaults to `default` (GitHub-style ~1260px). */
  width?: PageContainerWidth;
  /** Extra classes merged via tailwind-merge. */
  className?: string;
  /**
   * Remove the default top/bottom padding. Useful for pages that own their
   * own full-bleed header (e.g. wizard screens).
   */
  flush?: boolean;
}

const WIDTH_CLASSES: Record<PageContainerWidth, string> = {
  narrow: 'max-w-[900px]',
  default: 'max-w-[var(--shell-content-max-width)]',
  wide: 'max-w-[1560px]',
  full: 'max-w-none',
};

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  width = 'default',
  className,
  flush = false,
}) => {
  return (
    <div
      className={cn(
        // Horizontal: centered with gutters from the shell-page-padding token.
        'mx-auto w-full min-w-0',
        // Vertical rhythm shared by every page.
        !flush && 'py-4 sm:py-5',
        WIDTH_CLASSES[width],
        className
      )}
      style={{ paddingInline: 'var(--shell-page-padding)' }}
    >
      {children}
    </div>
  );
};

export default PageContainer;
