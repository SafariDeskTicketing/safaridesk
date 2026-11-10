import React, { forwardRef, useId } from 'react';
import { clsx } from 'clsx';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, fullWidth = false, className, id, ...props }, ref) => {
    const fallbackId = useId();
    const textareaId = id ?? fallbackId;
    const baseClasses = 'block px-3.5 py-2.5 border border-[var(--border-color)] rounded-lg shadow-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 bg-[var(--shell-field-bg)] text-[14px] text-[var(--text-primary)]';
    
    const errorClasses = 'border-red-300 dark:border-red-500 focus:ring-red-500';

    return (
      <div className={clsx('relative', fullWidth && 'w-full')}>
        {label && (
          <label htmlFor={textareaId} className="block text-[14px] font-medium text-[var(--text-primary)] mb-1">
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            baseClasses,
            error && errorClasses,
            fullWidth && 'w-full',
            className
          )}
          {...props}
        />
        
        {error && (
          <p className="mt-1 text-[14px] text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
