import React from 'react';
import TicketListSkeleton from './TicketListSkeleton';

const TicketPageSkeleton = () => {
  return (
    <div className="flex h-screen bg-[var(--app-bg)]">
      {/* Sidebar Skeleton */}
      <div className="flex w-64 flex-col border-r border-[var(--border-color)] bg-[var(--card-bg)]">
        <div className="border-b border-[var(--border-color)] p-4">
          <div className="sd-shimmer h-5 w-1/2" />
        </div>
        <div className="border-b border-[var(--border-color)] p-4">
          <div className="sd-shimmer h-8 w-full" />
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="sd-shimmer h-5 w-3/4" />
          ))}
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header Skeleton */}
        <header className="border-b border-[var(--border-color)] bg-[var(--card-bg)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="sd-shimmer h-7 w-1/4" />
            <div className="flex items-center gap-4">
              <div className="sd-shimmer h-8 w-48" />
              <div className="sd-shimmer h-8 w-24" />
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Tickets List Skeleton */}
          <div className="flex w-1/4 flex-col border-r border-[var(--border-color)] bg-[var(--card-bg)]">
            <div className="border-b border-[var(--border-color)] p-4 space-y-3">
              <div className="sd-shimmer h-[var(--shell-search-height)] w-full rounded-[var(--shell-radius)]" />
              <div className="sd-shimmer h-[var(--shell-search-height)] w-full rounded-[var(--shell-radius)]" />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-color)]">
              <TicketListSkeleton />
              <TicketListSkeleton />
              <TicketListSkeleton />
              <TicketListSkeleton />
            </div>
          </div>

          {/* Ticket Details Skeleton */}
          <div className="flex flex-1 flex-col overflow-hidden p-5 space-y-4">
            <div className="sd-shimmer h-7 w-1/2" />
            <div className="sd-shimmer h-3.5 w-1/3" />
            <div className="sd-shimmer h-24 w-full rounded-[var(--shell-radius)]" />
            <div className="sd-shimmer h-48 w-full rounded-[var(--shell-radius)]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketPageSkeleton;
