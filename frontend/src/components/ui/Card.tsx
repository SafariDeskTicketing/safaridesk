import React from 'react';
import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  muted?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, muted = false, ...props }) => (
  <div
    className={clsx(
      muted ? 'sd-surface-muted' : 'sd-surface',
      className
    )}
    {...props}
  />
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={clsx('flex flex-col gap-1 px-5 py-4 sm:px-6', className)} {...props} />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h2 className={clsx('text-[var(--font-section-title)] font-semibold text-[var(--text-primary)]', className)} {...props} />
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <p className={clsx('text-[var(--font-body)] text-[var(--text-secondary)]', className)} {...props} />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={clsx('px-5 pb-5 sm:px-6 sm:pb-6', className)} {...props} />
);
