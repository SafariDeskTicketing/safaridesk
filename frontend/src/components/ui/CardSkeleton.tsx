import React from 'react';
import { Card } from './Card';

interface CardSkeletonProps {
  count?: number;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, cardIndex) => (
        <Card key={cardIndex} className="rounded-[14px] p-3.5">
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
        </Card>
      ))}
    </div>
  );
};
