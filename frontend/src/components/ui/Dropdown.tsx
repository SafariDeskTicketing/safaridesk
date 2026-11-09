import React, { ReactNode, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { FloatingPortal } from '@floating-ui/react';
import { useAnchoredFloating } from './useAnchoredFloating';
import Button from './Button';

type DropdownMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  compact?: boolean;
};

/**
 * Controlled menu anchored to its parent element. Callers wrap the trigger and
 * the menu in one container, so a click on the trigger counts as "inside" and
 * toggles the menu instead of dismissing and immediately reopening it.
 */
export const DropdownMenu: React.FC<DropdownMenuProps> = ({ isOpen, onClose, children, compact = false }) => {
  const anchorProbeRef = useRef<HTMLSpanElement>(null);
  const { refs, floatingStyles, getFloatingProps } = useAnchoredFloating({
    open: isOpen,
    onOpenChange: (nextOpen) => {
      if (!nextOpen) onClose();
    },
    placement: 'bottom-end',
  });

  useLayoutEffect(() => {
    refs.setReference(anchorProbeRef.current?.parentElement ?? null);
  }, [refs]);

  return (
    <>
      <span ref={anchorProbeRef} hidden />
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            role="menu"
            className={clsx(
              'rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] shadow-[var(--shell-shadow-md)]',
              compact ? 'w-44 py-1' : 'w-56 py-2'
            )}
            {...getFloatingProps()}
          >
            {children}
          </div>
        </FloatingPortal>
      )}
    </>
  );
};

/**
 * Callers pass both Tabler (AppIcons) and Lucide icons. Only `size`/`className`
 * mean the same thing in both: `stroke` is stroke *width* in Tabler but stroke
 * *color* in Lucide, so it must not be passed here.
 */
type MenuIcon = React.ComponentType<{ size?: number | string; className?: string }>;

type DropdownItemProps = {
  icon?: MenuIcon;
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'danger';
  compact?: boolean;
};

export const DropdownItem: React.FC<DropdownItemProps> = ({
  icon: Icon,
  children,
  onClick,
  variant = 'default',
  compact = false,
}) => {
  const variants = {
    default: 'text-[var(--text-secondary)] hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)]',
    danger: 'text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]',
  };

  return (
    <button
      type="button"
      role="menuitem"
      className={clsx(
        variants[variant],
        'group flex w-full items-center rounded-[6px] transition-colors',
        compact ? 'px-3 py-1.5 text-sm' : 'px-3.5 py-2.5 text-[14px]'
      )}
      onClick={onClick}
    >
      {Icon && <Icon className={clsx('mr-2.5', compact ? 'h-4 w-4' : '')} size={16} />}
      {children}
    </button>
  );
};

interface DropdownProps {
  trigger: ReactNode;
  options: { label: string; onClick: () => void; icon?: MenuIcon; variant?: 'default' | 'danger' }[];
  compact?: boolean;
}

/**
 * `trigger` is usually already a real `<button>` (or our `Button`), which handles
 * its own keyboard activation natively. Only make the wrapper itself keyboard-operable
 * when the trigger isn't already focusable, otherwise it creates a nested interactive
 * element (two tab stops, duplicate accessible name) for the common case.
 */
function isNativelyInteractive(node: ReactNode): boolean {
  if (!React.isValidElement(node)) return false;
  if (typeof node.type === 'string') return node.type === 'button' || node.type === 'a';
  return node.type === Button;
}

export const Dropdown: React.FC<DropdownProps> = ({ trigger, options, compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = () => setIsOpen(false);
  const toggle = () => setIsOpen((open) => !open);
  const triggerIsInteractive = isNativelyInteractive(trigger);

  return (
    <div className="relative">
      <div
        onClick={toggle}
        {...(!triggerIsInteractive && {
          role: 'button',
          tabIndex: 0,
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggle();
            }
          },
        })}
      >
        {trigger}
      </div>
      <DropdownMenu isOpen={isOpen} onClose={handleClose} compact={compact}>
        {options.map((option, index) => (
          <DropdownItem
            key={index}
            icon={option.icon}
            onClick={() => {
              option.onClick();
              handleClose();
            }}
            variant={option.variant}
            compact={compact}
          >
            {option.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </div>
  );
};
