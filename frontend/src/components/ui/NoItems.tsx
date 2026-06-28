import React from 'react';
import { Search, Plus, FileText, AlertCircle, Ban, Users, Calendar, Settings } from 'lucide-react';
import Button from './Button';


interface NoItemsProps {
  title?: string;
  message?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actionLabel?: string;
  onAction?: () => void;
  showAction?: boolean;
  variant?: 'default' | 'search' | 'empty' | 'error';
  className?: string;
}

const NoItems: React.FC<NoItemsProps> = ({
  title,
  message,
  icon: Icon,
  actionLabel,
  onAction,
  showAction = true,
  variant = 'default',
  className = ''
}) => {
  // Default configurations based on variant
  const getVariantConfig = () => {
    switch (variant) {
      case 'search':
        return {
          defaultIcon: Search,
          defaultTitle: 'No results found',
          defaultMessage: 'Try adjusting your search terms or filters to find what you\'re looking for.',
          defaultActionLabel: 'Clear Search',
          iconColor: 'text-gray-400',
          showDefaultAction: false
        };
      case 'empty':
        return {
          defaultIcon: Ban,
          defaultTitle: 'No items yet',
          defaultMessage: 'Get started by creating your first item.',
          defaultActionLabel: 'Create New',
          iconColor: 'text-primary-400',
          showDefaultAction: true
        };
      case 'error':
        return {
          defaultIcon: AlertCircle,
          defaultTitle: 'Something went wrong',
          defaultMessage: 'We couldn\'t load the items. Please try again.',
          defaultActionLabel: 'Retry',
          iconColor: 'text-red-400',
          showDefaultAction: true
        };
      default:
        return {
          defaultIcon: FileText,
          defaultTitle: 'No items found',
          defaultMessage: 'There are no items to display at the moment.',
          defaultActionLabel: 'Add New',
          iconColor: 'text-gray-400',
          showDefaultAction: true
        };
    }
  };

  const config = getVariantConfig();
  const DisplayIcon = Icon || config.defaultIcon;
  const displayTitle = title || config.defaultTitle;
  const displayMessage = message || config.defaultMessage;
  const displayActionLabel = actionLabel || config.defaultActionLabel;
  const shouldShowAction = showAction && (onAction || config.showDefaultAction);

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className={`mb-4 p-3 rounded-full bg-gray-100 dark:bg-surface-elevated ${config.iconColor}`}>
        <DisplayIcon className="w-8 h-8" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-2">
        {displayTitle}
      </h3>
      
      <p className="text-gray-500 dark:text-[var(--text-primary)] mb-6 max-w-md">
        {displayMessage}
      </p>
      
      {shouldShowAction && onAction && (
        <Button
          onClick={onAction}
          icon={variant === 'empty' ? Plus : undefined}
          variant={variant === 'error' ? 'outline' : 'primary'}
        >
          {displayActionLabel}
        </Button>
      )}
    </div>
  );
};

// Preset components for common use cases
export const NoItemsFound: React.FC<Partial<NoItemsProps>> = (props) => (
  <NoItems
    icon={Calendar}
    title="No tasks found"
    message="No tasks match your current filters. Try adjusting your search or create a new task."
    actionLabel="Create Task"
    variant="empty"
    {...props}
  />
);

export const NoUsersFound: React.FC<Partial<NoItemsProps>> = (props) => (
  <NoItems
    icon={Users}
    title="No users found"
    message="No users match your search criteria. Try a different search term."
    variant="search"
    {...props}
  />
);

export const NoSearchResults: React.FC<Partial<NoItemsProps>> = (props) => (
  <NoItems
    variant="search"
    {...props}
  />
);

export const EmptyState: React.FC<Partial<NoItemsProps>> = (props) => (
  <NoItems
    variant="empty"
    {...props}
  />
);

export const ErrorState: React.FC<Partial<NoItemsProps>> = (props) => (
  <NoItems
    variant="error"
    {...props}
  />
);

export default NoItems;