import React from 'react';
import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';

type IconType = LucideIcon;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconType;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  className,
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-[var(--shell-radius)] border text-[var(--font-button)] font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50';
  
  const variantClasses = {
    primary: 'border-primary-600 bg-primary-600 text-white shadow-[var(--shell-shadow-sm)] hover:border-primary-700 hover:bg-primary-700',
    secondary: 'border-[var(--text-secondary)] bg-[var(--text-secondary)] text-white shadow-[var(--shell-shadow-sm)] hover:opacity-95',
    outline: 'border-[var(--border-color)] bg-white text-[var(--text-secondary)] shadow-[var(--shell-shadow-sm)] hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)] dark:bg-[var(--card-bg)]',
    ghost: 'border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)]',
    danger: 'border-[var(--status-danger-text)] bg-[var(--status-danger-text)] text-white shadow-[var(--shell-shadow-sm)] hover:opacity-92',
  };
  
  const sizeClasses = {
    sm: 'h-[34px] gap-1.5 px-3',
    md: 'h-[38px] gap-2 px-3.5',
    lg: 'h-[42px] gap-2 px-4 text-[14px]',
  };
  
  const iconSize = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  return (
    <button
      className={clsx(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        Icon && iconPosition === 'left' && (
          <Icon size={iconSize[size]} className="shrink-0" />
        )
      )}
      
      {children}
      
      {Icon && iconPosition === 'right' && !loading && (
        <Icon size={iconSize[size]} className="shrink-0" />
      )}
    </button>
  );
};

export default Button;
export { Button };
