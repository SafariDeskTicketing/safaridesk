import React from 'react';
import { Clock } from 'lucide-react';

const NoSlaComponent: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-surface-elevated dark:to-surface rounded-2xl border border-gray-200 dark:border-subtle p-12 text-center">
      <Clock className="mx-auto h-16 w-16 text-gray-400 dark:text-[var(--text-muted)] mb-6" />
      <h3 className="text-xl font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-3">No SLA Configuration</h3>
      <p className="text-gray-600 dark:text-[var(--text-muted)] max-w-md mx-auto">This ticket doesn't have an associated Service Level Agreement. Contact your administrator to set up SLA policies.</p>
    </div>
  );
};

export default NoSlaComponent;
