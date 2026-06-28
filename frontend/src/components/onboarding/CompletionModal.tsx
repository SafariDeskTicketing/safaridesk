import React from 'react';
import { CheckCircle, Sparkles } from 'lucide-react';

interface CompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompletionModal: React.FC<CompletionModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 dark:bg-[var(--overlay-bg)] backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gradient-to-br from-white via-blue-50 to-primary-50 dark:from-surface-elevated dark:via-surface-elevated dark:to-surface-elevated rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 border-2 border-primary-200 dark:border-primary-700">
        {/* Celebratory Animation */}
        <div className="absolute top-4 right-4">
          <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
        </div>
        <div className="absolute top-4 left-4">
          <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" style={{ animationDelay: '0.3s' }} />
        </div>

        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-primary-100 dark:bg-primary-900/30 rounded-full">
          <CheckCircle className="w-10 h-10 text-primary-600 dark:text-primary-400" />
        </div>

        {/* Content */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)] mb-3">
            🎉 You're All Set!
          </h2>
          <p className="text-gray-700 dark:text-[var(--text-primary)] mb-6 leading-relaxed">
            You are all set to start using SafariDesk! We hope SafariDesk serves you well. If any errors occur, don't hesitate to contact{' '}
            <a 
              href="mailto:support@safaridesk.io" 
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              support@safaridesk.io
            </a>
            .
          </p>
        </div>

        {/* Action */}
        <button
          onClick={onClose}
          className="w-full px-6 py-3 text-base font-semibold text-white bg-gradient-to-r from-primary-600 to-blue-600 hover:from-primary-700 hover:to-blue-700 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          Get Started
        </button>
      </div>
    </div>
  );
};
