import React from 'react';
import { X, AlertCircle } from 'lucide-react';

interface ConfirmExitModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmExitModal: React.FC<ConfirmExitModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 dark:bg-[var(--overlay-bg)] backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-surface-elevated rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 border border-gray-200 dark:border-subtle">
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
          <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
        </div>

        {/* Content */}
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-3">
            Exit Onboarding Tutorial?
          </h3>
          <p className="text-gray-600 dark:text-[var(--text-primary)] mb-6">
            Are you sure you want to exit the onboarding tutorial? If you encounter any issues, please contact{' '}
            <a 
              href="mailto:support@safaridesk.io" 
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              support@safaridesk.io
            </a>
            .
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] bg-gray-100 dark:bg-surface-hover hover:bg-gray-200 dark:hover:bg-surface-hover rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Exit Tutorial
          </button>
        </div>
      </div>
    </div>
  );
};
