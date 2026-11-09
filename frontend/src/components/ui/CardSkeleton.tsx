import React from 'react';

interface CardSkeletonProps {
  count?: number;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, cardIndex) => (
        <div
          key={cardIndex}
          className="rounded-[14px] border border-[var(--border-color)] bg-[var(--card-bg)] p-3.5 shadow-[var(--shell-shadow-sm)]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="sd-shimmer h-4 w-16 rounded" />
            <div className="sd-shimmer h-5 w-14 rounded-full" />
          </div>
          <div className="sd-shimmer mt-2 h-4 w-3/4 rounded" />
          <div className="mt-3 space-y-1.5">
            <div className="sd-shimmer h-3.5 w-full rounded" />
            <div className="sd-shimmer h-3.5 w-5/6 rounded" />
          </div>
          <div className="mt-3.5 flex items-center gap-2">
            <div className="sd-shimmer h-6 w-6 rounded-full" />
            <div className="sd-shimmer h-3.5 w-20 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};
