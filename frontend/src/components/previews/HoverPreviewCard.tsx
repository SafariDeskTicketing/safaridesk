import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { X } from '../icons/AppIcons';
import type { AppIcon } from '../icons/AppIcons';

type PreviewPlacement = 'left' | 'right' | 'top' | 'bottom';

export type HoverPreviewField = {
  label: string;
  value: React.ReactNode;
  className?: string;
};

export type HoverPreviewLatestActivity = {
  label?: string;
  authorName?: string;
  authorAvatar?: string;
  createdAt?: string;
  content?: string;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

export interface HoverPreviewCardProps {
  icon: AppIcon;
  title: string;
  subtitle: string;
  onClose: () => void;
  placement?: PreviewPlacement;
  arrowOffset?: number;
  iconToneClassName?: string;
  summaryFields: HoverPreviewField[];
  detailFields?: HoverPreviewField[];
  description: string;
  latestActivity?: HoverPreviewLatestActivity;
  className?: string;
}

const placementArrowClasses: Record<PreviewPlacement, string> = {
  left: 'right-[-8px] -translate-y-1/2',
  right: 'left-[-8px] -translate-y-1/2',
  top: 'bottom-[-8px] left-1/2 -translate-x-1/2',
  bottom: 'top-[-8px] left-1/2 -translate-x-1/2',
};

const getInitials = (value?: string) => {
  if (!value) return 'U';

  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return initials || value.charAt(0).toUpperCase() || 'U';
};

const formatCreatedAt = (createdAt?: string) => {
  if (!createdAt) {
    return 'Just now';
  }

  const parsedDate = new Date(createdAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Just now';
  }

  return formatDistanceToNow(parsedDate, { addSuffix: true });
};

export const HoverPreviewCard: React.FC<HoverPreviewCardProps> = ({
  icon: Icon,
  title,
  subtitle,
  onClose,
  placement = 'right',
  arrowOffset,
  iconToneClassName = 'bg-[var(--shell-nav-hover-bg)] text-[var(--shell-nav-active-text)]',
  summaryFields,
  detailFields = [],
  description,
  latestActivity,
  className = '',
}) => {
  const arrowStyle =
    placement === 'left' || placement === 'right'
      ? { top: arrowOffset ? `${arrowOffset}px` : '50%' }
      : undefined;

  return (
    <div
      className={`relative w-[34rem] max-w-[88vw] overflow-hidden rounded-[16px] border border-[var(--border-color)] bg-[var(--card-bg)] shadow-[var(--shell-shadow-lg)] ${className}`}
      role="dialog"
      aria-label={`${title} preview`}
    >
      <span
        className={`pointer-events-none absolute h-3.5 w-3.5 rotate-45 border border-[var(--border-color)] bg-[var(--card-bg)] ${placementArrowClasses[placement]}`}
        style={arrowStyle}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between border-b border-[var(--border-color)] bg-gradient-to-r from-[rgba(0,0,0,0.02)] to-transparent px-4 py-3 dark:from-white/5">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${iconToneClassName}`}>
            <Icon size={16} stroke={1.9} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-semibold leading-5 text-[var(--text-primary)]">
              {title}
            </h3>
            <p className="mt-0.5 text-[13px] font-medium text-[var(--text-secondary)]">
              {subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-[var(--shell-radius)] p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--text-primary)]"
          aria-label="Close preview"
        >
          <X size={16} stroke={1.8} />
        </button>
      </div>

      <div className="max-h-[calc(100vh-9rem)] overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          {summaryFields.length > 0 && (
            <div className={`grid gap-2.5 ${summaryFields.length >= 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
              {summaryFields.map((field) => (
                <div
                  key={field.label}
                  className={`rounded-[12px] border border-[var(--border-color)] bg-[var(--surface-subtle)] px-2.5 py-2 ${field.className || ''}`}
                >
                  <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                    {field.label}
                  </p>
                  <div className="mt-1 truncate text-[13px] font-semibold text-[var(--text-primary)]">
                    {field.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
              Description
            </p>
            <p className="text-[14px] leading-5 text-[var(--text-primary)] line-clamp-4">
              {description}
            </p>
          </div>

          {latestActivity && (
            <div className="space-y-2">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                {latestActivity.label || 'Latest update'}
              </p>
              <div className="rounded-[14px] border border-[var(--border-color)] bg-[var(--surface-subtle)] px-3.5 py-3.5">
                {latestActivity.loading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-[var(--border-color)]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-2.5 w-32 rounded-full bg-[var(--border-color)]" />
                        <div className="h-2.5 w-24 rounded-full bg-[var(--border-color)]" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2.5 w-full rounded-full bg-[var(--border-color)]" />
                      <div className="h-2.5 w-5/6 rounded-full bg-[var(--border-color)]" />
                      <div className="h-2.5 w-2/3 rounded-full bg-[var(--border-color)]" />
                    </div>
                  </div>
                ) : latestActivity.empty ? (
                  <div className="text-left">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                      {latestActivity.emptyTitle || 'No recent activity'}
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">
                      {latestActivity.emptyDescription || 'The activity stream is empty for this record.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--shell-nav-hover-bg)] text-[13px] font-semibold text-[var(--shell-nav-active-text)]">
                          {latestActivity.authorAvatar ? (
                            <img
                              src={latestActivity.authorAvatar}
                              alt={latestActivity.authorName || 'Activity author'}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{getInitials(latestActivity.authorName)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                            {latestActivity.authorName || 'Unknown user'}
                          </p>
                          <p className="text-[12px] text-[var(--text-secondary)]">
                            {formatCreatedAt(latestActivity.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="mt-2.5 text-[13px] leading-5 text-[var(--text-primary)] line-clamp-4">
                      {latestActivity.content || 'No content provided'}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {detailFields.length > 0 && (
            <div className="grid gap-2.5 border-t border-[var(--border-color)] pt-3.5 sm:grid-cols-2">
              {detailFields.map((field) => (
                <div key={field.label} className="min-w-0">
                  <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                    {field.label}
                  </p>
                  <div className={`mt-0.5 truncate text-[13px] font-semibold text-[var(--text-primary)] ${field.className || ''}`}>
                    {field.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
