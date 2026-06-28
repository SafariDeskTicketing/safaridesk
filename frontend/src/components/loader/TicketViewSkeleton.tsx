import React from 'react';

const TicketViewSkeleton = () => {
  return (
    <div className="space-y-5 p-5">
      <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
        <div className="flex gap-6">
          <div className="flex-1 space-y-2.5">
            <div className="sd-shimmer h-6 w-3/4" />
            <div className="sd-shimmer h-4 w-1/2" />
            <div className="flex items-center gap-2">
              <div className="sd-shimmer h-5 w-20 rounded-full" />
              <div className="sd-shimmer h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2.5">
              <div className="sd-shimmer h-3.5 w-1/4" />
              <div className="sd-shimmer h-3.5 w-3/4" />
              <div className="sd-shimmer h-3.5 w-1/2" />
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-2.5">
          <div className="sd-shimmer h-3.5 w-1/4" />
          <div className="rounded-[var(--shell-radius)] bg-[var(--surface-muted)] p-4 space-y-2">
            <div className="sd-shimmer h-3.5 w-full" />
            <div className="sd-shimmer h-3.5 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketViewSkeleton;
