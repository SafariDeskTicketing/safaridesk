import React from 'react';

const SkinLoader = () => {
  return (
    <div className="grid grid-cols-4 gap-4 p-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div 
          key={index} 
          className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle p-4 shadow-sm animate-pulse"
        >
          {/* Task Title */}
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 bg-gray-300 dark:bg-surface-hover rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-16"></div>
          </div>
          
          {/* Task Description */}
          <div className="mb-4">
            <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-2/3"></div>
          </div>
          
          {/* Status and Link Tags */}
          <div className="flex gap-2 mb-4">
            <div className="h-6 bg-primary-100 dark:bg-primary-900 rounded-full w-16"></div>
            <div className="h-6 bg-gray-100 dark:bg-surface-hover rounded-full w-20"></div>
          </div>
          
          {/* Due Date */}
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 w-4 bg-gray-300 dark:bg-surface-hover rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-24"></div>
          </div>
          
          {/* Assignee */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-gray-300 dark:bg-surface-hover rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-20"></div>
          </div>
          
          {/* Optional Ticket Link */}
          {index % 3 === 0 && (
            <div className="mt-3">
              <div className="h-4 bg-blue-100 dark:bg-blue-900 rounded w-16"></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SkinLoader;