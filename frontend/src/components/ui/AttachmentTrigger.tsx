import React from 'react';
import { Paperclip } from 'lucide-react';

interface AttachmentTriggerProps {
  className?: string;
  disabled?: boolean;
  htmlFor?: string;
  label?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

const baseClassName =
  'inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]';

const disabledClassName = 'cursor-not-allowed opacity-50 hover:bg-transparent';

const content = (label: string) => (
  <>
    <Paperclip size={14} className="shrink-0" />
    <span>{label}</span>
  </>
);

export const AttachmentTrigger: React.FC<AttachmentTriggerProps> = ({
  className = '',
  disabled = false,
  htmlFor,
  label = 'Paste, drop, or click to add files',
  onClick,
  children,
}) => {
  const mergedClassName = `${baseClassName} ${disabled ? disabledClassName : 'cursor-pointer'} ${className}`.trim();

  if (htmlFor || children) {
    return (
      <label
        htmlFor={disabled ? undefined : htmlFor}
        aria-disabled={disabled}
        className={mergedClassName}
      >
        {content(label)}
        {children}
      </label>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={mergedClassName}
      title={label}
      disabled={disabled}
    >
      {content(label)}
    </button>
  );
};

export default AttachmentTrigger;
