import React from 'react';

const shimmer =
  'animate-pulse rounded-[var(--shell-radius)] bg-gradient-to-r from-[var(--surface-muted)] via-white to-[var(--surface-muted)] dark:from-[var(--card-bg)] dark:via-[var(--hover-bg)] dark:to-[var(--card-bg)]';

const MetricRowSkeleton = () => (
  <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-b border-[var(--border-color)] pb-3 sm:grid-cols-3 xl:grid-cols-6">
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="flex items-start gap-2 rounded-[var(--shell-radius)] px-2 py-1.5">
        <div className={`mt-0.5 h-4 w-4 rounded-full ${shimmer}`} />
        <div className="min-w-0 flex-1">
          <div className={`h-3 w-12 ${shimmer}`} />
          <div className={`mt-1 h-3.5 w-8 ${shimmer}`} />
        </div>
      </div>
    ))}
  </div>
);

const ChartSkeleton = () => (
  <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white p-4 dark:bg-[var(--card-bg)]">
    <div className="mb-3 flex items-center gap-2">
      <div className={`h-[30px] w-[30px] ${shimmer}`} />
      <div className={`h-[30px] w-[140px] ${shimmer}`} />
    </div>
    <div className="h-[248px] rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-subtle)] p-4">
      <div className="flex h-full items-end justify-between gap-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className={`w-full rounded-t-[6px] ${shimmer}`}
            style={{ height: `${48 + (index % 4) * 12}%` }}
          />
        ))}
      </div>
    </div>
  </div>
);

const RailItemSkeleton = () => (
  <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white p-3 shadow-[var(--shell-shadow-sm)] dark:bg-[var(--card-bg)]">
    <div className="flex items-start justify-between gap-3">
      <div className={`h-5 w-12 rounded-full ${shimmer}`} />
      <div className={`h-3 w-14 ${shimmer}`} />
    </div>
    <div className={`mt-3 h-4 w-2/3 ${shimmer}`} />
    <div className="mt-3 flex items-center justify-between gap-3">
      <div className={`h-3 w-24 ${shimmer}`} />
      <div className="flex items-center gap-1.5">
        <div className={`h-4 w-4 rounded-full ${shimmer}`} />
        <div className={`h-3 w-16 ${shimmer}`} />
      </div>
    </div>
  </div>
);

const AnalyticsRowSkeleton = () => (
  <div className="overflow-hidden rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white p-4 shadow-[var(--shell-shadow-sm)] dark:bg-[var(--card-bg)] sm:p-5">
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_276px] xl:gap-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-color)] pb-3">
          <div className="min-w-0 flex-1">
            <div className={`h-4.5 w-32 ${shimmer}`} />
            <div className={`mt-2 h-3.5 w-64 max-w-full ${shimmer}`} />
          </div>
          <div className={`h-[30px] w-20 ${shimmer}`} />
        </div>

        <MetricRowSkeleton />
        <ChartSkeleton />
      </div>

      <div className="flex h-full flex-col xl:border-l xl:border-[var(--border-color)] xl:pl-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className={`h-4.5 w-28 ${shimmer}`} />
          <div className={`h-3.5 w-12 ${shimmer}`} />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <RailItemSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const HomeLoadingSkeleton = () => {
  return (
    <div className="sd-content-shell min-h-full bg-transparent">
      <div className="space-y-[var(--dashboard-section-gap)]">
        <section className="space-y-2">
          <div className={`h-6 w-56 ${shimmer}`} />
          <div className={`h-4 w-72 max-w-full ${shimmer}`} />
        </section>

        <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white p-4 shadow-[var(--shell-shadow-sm)] dark:bg-[var(--card-bg)] sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className={`h-4 w-20 ${shimmer}`} />
            <div className="flex flex-wrap items-center gap-2">
              <div className={`h-[34px] w-[34px] ${shimmer}`} />
              <div className={`h-[34px] w-[138px] ${shimmer}`} />
              <div className={`h-[34px] w-[110px] ${shimmer}`} />
            </div>
          </div>
        </div>

        <AnalyticsRowSkeleton />
        <AnalyticsRowSkeleton />
      </div>
    </div>
  );
};

export default HomeLoadingSkeleton;
