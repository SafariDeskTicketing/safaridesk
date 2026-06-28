import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import type { AppIcon } from '../icons/AppIcons';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: AppIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon: Icon, iconPosition = 'left', fullWidth = false, rightElement, className, ...props }, ref) => {
    const baseClasses = 'block h-[44px] w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3.5 text-[14px] text-[var(--text-primary)] shadow-[var(--shell-shadow-sm)] transition-colors duration-200 placeholder:text-[var(--text-muted)] hover:border-[var(--shell-search-border)] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:text-[var(--text-disabled)] disabled:bg-[var(--surface-muted)] dark:bg-[var(--shell-field-bg)]';

    const errorClasses = 'border-[var(--status-danger-text)] text-[var(--status-danger-text)] focus:border-[var(--status-danger-text)] focus:ring-[rgba(224,82,69,0.14)]';

    const iconClasses = Icon ? (iconPosition === 'left' ? 'pl-9' : 'pr-9') : '';

    return (
      <div className={clsx('relative space-y-1.5', fullWidth && 'w-full')}>
        {label && (
          <label className="block text-[14px] font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        
        <div className="relative">
          {Icon && (
            <div className={clsx(
              'absolute inset-y-0 flex items-center pointer-events-none',
              iconPosition === 'left' ? 'left-0 pl-3' : 'right-0 pr-3'
            )}>
              <Icon size={16} stroke={1.8} className={clsx(error ? 'text-[var(--status-danger-text)]' : 'text-[var(--text-muted)]')} />
            </div>
          )}
          
          <input
            ref={ref}
            className={clsx(
              baseClasses,
              iconClasses,
              rightElement && 'pr-10',
              error && errorClasses,
              fullWidth && 'w-full',
              className
            )}
            {...props}
          />

          {rightElement && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {rightElement}
            </div>
          )}
        </div>
        
        {error && (
          <p className="text-[14px] text-[var(--status-danger-text)]">{error}</p>
        )}

        {!error && helperText && (
          <p className="text-[14px] text-[var(--text-muted)]">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
