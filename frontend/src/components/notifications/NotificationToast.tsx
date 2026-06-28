import React, { useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NotificationToastProps {
  notification: {
    id: number;
    message: string;
    ticket: {
      id: number;
      ticket_id: string;
      title: string;
      priority: string;
    };
    metadata?: {
      mentioned_by_name?: string;
      mentioned_by_display?: string;
    };
  };
  onClose: () => void;
  autoHideDuration?: number;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  autoHideDuration = 5000,
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (autoHideDuration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoHideDuration);

      return () => clearTimeout(timer);
    }
  }, [autoHideDuration, onClose]);

  const handleClick = () => {
    navigate(`/ticket/${notification.ticket.id}`);
    onClose();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
      case 'high':
        return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400';
      case 'low':
        return 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400';
      default:
        return 'bg-gray-100 dark:bg-surface-hover text-gray-600 dark:text-[var(--text-primary)]';
    }
  };

  return (
    <div
      onClick={handleClick}
      className="flex items-start gap-3 p-4 bg-white dark:bg-surface-elevated rounded-lg shadow-2xl border border-gray-200 dark:border-subtle cursor-pointer hover:shadow-3xl transition-all transform hover:scale-[1.02] max-w-md animate-slide-in-right"
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
          <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-bounce-once" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            New Mention
          </p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityColor(notification.ticket.priority)}`}>
            {notification.ticket.priority}
          </span>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-[var(--text-primary)] line-clamp-2 mb-2">
          {(notification.metadata?.mentioned_by_display || notification.metadata?.mentioned_by_name) ? (
            <>
              <span className="font-semibold text-primary-600 dark:text-primary-400">
                {notification.metadata?.mentioned_by_display || notification.metadata?.mentioned_by_name}
              </span>
              {' mentioned you in '}
              <span className="font-medium text-primary-600 dark:text-primary-400">
                #{notification.ticket.ticket_id}
              </span>
            </>
          ) : (
            notification.message
          )}
        </p>
        
        <p className="text-xs text-gray-500 dark:text-[var(--text-primary)] truncate">
          {notification.ticket.title}
        </p>
      </div>

      {/* Close Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
