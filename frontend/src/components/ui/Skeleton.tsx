import React from 'react';

const LoadingSkeleton = () => {
  return (
    <div className="w-full overflow-y-auto p-[var(--dashboard-card-padding)] space-y-[var(--dashboard-section-gap)]">
      {/* Ticket ID header */}
      <div className="flex items-center gap-4">
        <div className="sd-shimmer h-9 w-9 rounded-[var(--shell-radius)]" />
        <div className="sd-shimmer h-7 w-48" />
      </div>

      {/* Title card */}
      <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 space-y-2.5">
              <div className="sd-shimmer h-6 w-3/4" />
              <div className="flex items-center gap-3">
                <div className="sd-shimmer h-3.5 w-24" />
                <div className="sd-shimmer h-3.5 w-32" />
              </div>
              <div className="flex items-center gap-2">
                <div className="sd-shimmer h-5 w-16 rounded-full" />
                <div className="sd-shimmer h-5 w-12 rounded-full" />
                <div className="sd-shimmer h-5 w-24 rounded-full" />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="sd-shimmer h-9 w-9 rounded-[var(--shell-radius)]" />
              ))}
              <div className="sd-shimmer h-9 w-24 rounded-[var(--shell-radius)]" />
            </div>
          </div>
        </div>

        {/* Status stepper */}
        <div className="px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center justify-between gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                <div className="sd-shimmer h-8 w-8 rounded-full" />
                <div className="sd-shimmer h-3 w-14" />
              </div>
            ))}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`px-6 py-5 space-y-3 ${i < 2 ? 'border-b lg:border-b-0 lg:border-r border-[var(--border-color)]' : ''}`}>
              <div className="sd-shimmer h-3.5 w-20" />
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="sd-shimmer h-3.5 w-3.5 rounded-full shrink-0" />
                  <div className="sd-shimmer h-3.5 w-32" />
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="sd-shimmer h-3.5 w-3.5 rounded-full shrink-0" />
                  <div className="sd-shimmer h-3.5 w-40" />
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="sd-shimmer h-3.5 w-3.5 rounded-full shrink-0" />
                  <div className="sd-shimmer h-3.5 w-28" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Description */}
        <div className="px-6 py-5 border-t border-[var(--border-color)]">
          <div className="sd-shimmer h-3.5 w-24 mb-3" />
          <div className="space-y-2">
            <div className="sd-shimmer h-3 w-full" />
            <div className="sd-shimmer h-3 w-full" />
            <div className="sd-shimmer h-3 w-3/4" />
          </div>
        </div>
      </div>

      {/* Activity section */}
      <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="sd-shimmer h-4 w-4" />
          <div className="sd-shimmer h-4 w-28" />
        </div>
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-3 border-t border-[var(--border-color)]">
            <div className="sd-shimmer h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <div className="sd-shimmer h-3.5 w-24" />
                <div className="sd-shimmer h-3 w-16" />
              </div>
              <div className="sd-shimmer h-3 w-full" />
              <div className="sd-shimmer h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoadingSkeleton;
