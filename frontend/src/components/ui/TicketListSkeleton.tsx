import React from 'react';

const TicketListSkeleton = () => {
  return (
    <div className="border-b border-[var(--border-color)] px-4 py-3.5">
      <div className="grid grid-cols-[34px_minmax(0,1fr)_72px] items-start gap-3">
        <div className="sd-shimmer h-8 w-8 rounded-full" />
        <div className="min-w-0 space-y-2.5">
          <div className="sd-shimmer h-3.5 w-2/3" />
          <div className="sd-shimmer h-3 w-11/12" />
          <div className="flex items-center gap-2">
            <div className="sd-shimmer h-4.5 w-14 rounded-full" />
            <div className="sd-shimmer h-4.5 w-12 rounded-full" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="sd-shimmer ml-auto h-3 w-10" />
          <div className="sd-shimmer ml-auto h-3 w-14" />
        </div>
      </div>
    </div>
  );
};

export default TicketListSkeleton;
