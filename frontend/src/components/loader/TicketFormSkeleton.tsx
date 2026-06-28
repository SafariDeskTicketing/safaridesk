import React from 'react';

const TicketFormSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse">
      <div className="max-w-5xl mx-auto mt-10 p-6  my-5">
        <h2 className="text-2xl font-semibold mb-4">
          <div className="h-8 bg-gray-200 dark:bg-surface-hover rounded w-1/3"></div>
        </h2>

        <form className="space-y-6">
          {/* Title field skeleton */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
              <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-1/4"></div>
            </label>
            <div className="h-10 bg-gray-200 dark:bg-surface-hover rounded-lg"></div>
          </div>

          {/* Description field skeleton */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
              <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-1/3"></div>
            </label>
            <div className="h-24 bg-gray-200 dark:bg-surface-hover rounded-lg"></div>
          </div>

          {/* Grid fields skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                  <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-1/4"></div>
                </label>
                <div className="h-10 bg-gray-200 dark:bg-surface-hover rounded-lg"></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                  <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-1/6"></div>
                </label>
                <div className="h-10 bg-gray-200 dark:bg-surface-hover rounded-lg"></div>
              </div>
            </div>

            {/* Right column fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                  <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-1/5"></div>
                </label>
                <div className="h-10 bg-gray-200 dark:bg-surface-hover rounded-lg"></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                  <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-1/3"></div>
                </label>
                <div className="h-10 bg-gray-200 dark:bg-surface-hover rounded-lg"></div>
              </div>
            </div>
          </div>

          {/* Attachment section skeleton */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
              <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-1/5"></div>
            </label>
            <div className="border-2 border-dashed border-gray-300 dark:border-subtle rounded-lg p-6 text-center">
              <div className="h-6 bg-gray-200 dark:bg-surface-hover rounded w-1/2 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-1/3 mx-auto"></div>
            </div>
          </div>

          {/* Button skeleton */}
          <div className="flex justify-end gap-3">
            <div className="h-10 bg-gray-200 dark:bg-surface-hover rounded-lg w-24"></div>
            <div className="h-10 bg-primary-200 dark:bg-surface-hover rounded-lg w-32"></div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TicketFormSkeleton;
