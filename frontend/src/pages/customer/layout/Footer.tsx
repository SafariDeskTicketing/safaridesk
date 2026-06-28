import React from 'react';

export const CustomerFooter: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-surface-elevated border-t border-gray-200 dark:border-subtle py-4 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 dark:text-[var(--text-primary)] text-sm">
        &copy; {new Date().getFullYear()} SafariDesk. All rights reserved.
      </div>
    </footer>
  );
};
