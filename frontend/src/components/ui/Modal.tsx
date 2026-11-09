import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import Button from './Button';

// Modal stack manager
class ModalStackManager {
  private static instance: ModalStackManager;
  private modalStack: string[] = [];
  private listeners: Set<() => void> = new Set();

  static getInstance(): ModalStackManager {
    if (!ModalStackManager.instance) {
      ModalStackManager.instance = new ModalStackManager();
    }
    return ModalStackManager.instance;
  }

  addModal(id: string): number {
    this.modalStack.push(id);
    this.notifyListeners();
    return this.modalStack.length;
  }

  removeModal(id: string): number {
    const index = this.modalStack.indexOf(id);
    if (index > -1) {
      this.modalStack.splice(index, 1);
    }
    this.notifyListeners();
    return this.modalStack.length;
  }

  getModalIndex(id: string): number {
    return this.modalStack.indexOf(id) + 1;
  }

  getStackSize(): number {
    return this.modalStack.length;
  }

  isTopModal(id: string): boolean {
    return this.modalStack[this.modalStack.length - 1] === id;
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  marginTop?: string;
  verticalAlign?: 'center' | 'top';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  marginTop = '0',
  verticalAlign = 'center',
}) => {
  const modalId = useRef<string>(Math.random().toString(36).substr(2, 9));
  const titleId = `modal-title-${modalId.current}`;
  const stackManager = ModalStackManager.getInstance();
  const baseZIndex = 1000;
  const [currentZIndex, setCurrentZIndex] = useState(baseZIndex); // Initialize with baseZIndex
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  const getFocusableElements = (): HTMLElement[] => {
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    return nodes ? Array.from(nodes) : [];
  };

  useEffect(() => {
    if (isOpen) {
      const stackSize = stackManager.addModal(modalId.current);
      setCurrentZIndex(baseZIndex + (stackSize * 10)); // Update zIndex based on new stack size

      // Only disable body scroll for the first modal
      if (stackSize === 1) {
        document.body.style.overflow = 'hidden';
      }

      return () => {
        const remainingModals = stackManager.removeModal(modalId.current);
        if (remainingModals === 0) {
          document.body.style.overflow = 'unset';
        }
      };
    }
  }, [isOpen, stackManager]);

  // Initial focus on open, and restore focus to the trigger element on close.
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement | null;
      const [firstFocusable] = getFocusableElements();
      (firstFocusable ?? dialogRef.current)?.focus();

      return () => {
        previouslyFocusedElement.current?.focus?.();
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!stackManager.isTopModal(modalId.current)) return;

      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        const activeIndex = focusableElements.indexOf(document.activeElement as HTMLElement);

        if (activeIndex === -1) {
          // Focus is outside the dialog's focusable set entirely (the backdrop was
          // clicked with closeOnBackdropClick off, or focus sits on the dialog
          // container itself) — pull it back in instead of letting Tab escape.
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, closeOnEscape, stackManager]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
    '3xl': 'max-w-6xl',
    '4xl': 'max-w-7xl',
    full: 'max-w-full h-full',
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      if (stackManager.isTopModal(modalId.current)) {
        onClose();
      }
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 overflow-y-auto"
      style={{ zIndex: currentZIndex }}
    >
      <div className={clsx(
        "flex min-h-screen justify-center",
        verticalAlign === 'top' ? 'items-start pt-16 sm:pt-20' : 'items-center',
        size !== 'full' && 'p-4' // Apply padding only if not full size
      )}
      style={{ marginTop }}>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/30 dark:bg-[var(--overlay-soft-bg)] backdrop-blur-sm transition-opacity"
          onClick={handleBackdropClick}
          style={{ 
            opacity: Math.min(1, 0.85 + (stackManager.getModalIndex(modalId.current) - 1) * 0.05),
          }}
        />
        
        {/* Modal */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          className={clsx(
            'relative w-full transform rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] shadow-[var(--shell-shadow-lg)] transition-all',
            sizeClasses[size],
            stackManager.getModalIndex(modalId.current) > 1 && '',
            size === 'full' && 'rounded-none' // Remove rounded corners for full size
          )}
          style={{
            zIndex: currentZIndex + 1,
          }}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
              {title && (
                <h3 id={titleId} className="text-[18px] font-semibold text-[var(--text-primary)]">
                  {title}
                </h3>
              )}
              
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  icon={X}
                  className="ml-auto"
                  aria-label="Close modal"
                />
              )}
            </div>
          )}
          
          {/* Content */}
          <div className={clsx("p-6", size === 'full' && 'flex-1 overflow-y-auto')}> {/* Added flex-1 and overflow-y-auto for full size content */}
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

// Optional: Export the stack manager for advanced use cases
export { ModalStackManager };
