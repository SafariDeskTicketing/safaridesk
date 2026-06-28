import React from 'react';

const TicketDetailSkeleton = () => {
  return (
    <div className="flex flex-1 flex-col space-y-4 overflow-hidden p-5">
      <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
        <div className="sd-shimmer mb-3 h-5 w-3/5" />
        <div className="mb-3 flex items-center gap-3">
          <div className="sd-shimmer h-3 w-24" />
          <div className="sd-shimmer h-3 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <div className="sd-shimmer h-5 w-16 rounded-full" />
          <div className="sd-shimmer h-5 w-20 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
            <div className="sd-shimmer mb-3 h-3 w-20" />
            <div className="sd-shimmer h-4 w-28" />
          </div>
        ))}
      </div>

      <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
        <div className="sd-shimmer mb-4 h-3 w-20" />
        <div className="space-y-2">
          <div className="sd-shimmer h-3 w-full" />
          <div className="sd-shimmer h-3 w-full" />
          <div className="sd-shimmer h-3 w-5/6" />
        </div>
      </div>
    </div>
  );
};

export default TicketDetailSkeleton;
