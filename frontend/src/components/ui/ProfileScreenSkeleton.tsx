import React from 'react';

type ProfileSkeletonTab = 'profile' | 'security' | 'notifications';

const shimmer = 'sd-shimmer rounded-[var(--shell-radius)]';

const TabsSkeleton = () => (
  <div className="overflow-x-auto rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white px-3 shadow-[var(--shell-shadow-sm)] dark:bg-[var(--card-bg)]">
    <div className="flex min-w-max items-center gap-4 py-2.5">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-center gap-1.5 py-2">
          <div className={`h-3.5 w-3.5 rounded-full ${shimmer}`} />
          <div className={`h-3.5 ${index === 0 ? 'w-[110px]' : 'w-[78px]'} ${shimmer}`} />
        </div>
      ))}
    </div>
  </div>
);

const ProfileTabSkeleton = () => (
  <div className="space-y-5">
    <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white p-5 shadow-[var(--shell-shadow-sm)] dark:bg-[var(--card-bg)]">
      <div className="flex items-center justify-between">
        <div className={`h-4.5 w-28 ${shimmer}`} />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-subtle)] p-4">
            <div className={`h-3.5 w-14 ${shimmer}`} />
            <div className="mt-3 grid grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((__, cardIndex) => (
                <div key={cardIndex} className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white p-4 dark:bg-[var(--card-bg)]">
                  <div className={`h-7 w-7 ${shimmer}`} />
                  <div className={`mt-3 h-5 w-10 ${shimmer}`} />
                  <div className={`mt-2 h-3.5 w-20 ${shimmer}`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white p-5 shadow-[var(--shell-shadow-sm)] dark:bg-[var(--card-bg)]">
      <div className="flex items-center justify-between gap-3">
        <div className={`h-4.5 w-32 ${shimmer}`} />
        <div className={`h-[30px] w-24 ${shimmer}`} />
      </div>
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
        <div className={`h-20 w-20 rounded-full ${shimmer}`} />
        <div className="flex-1">
          <div className={`h-4.5 w-36 ${shimmer}`} />
          <div className={`mt-2 h-3.5 w-44 ${shimmer}`} />
          <div className="mt-3 flex flex-wrap gap-2">
            <div className={`h-5 w-16 rounded-full ${shimmer}`} />
            <div className={`h-5 w-24 rounded-full ${shimmer}`} />
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index}>
            <div className={`mb-1.5 h-3 w-20 ${shimmer}`} />
            <div className={`h-[34px] w-full ${shimmer}`} />
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-subtle)] p-4">
            <div className={`h-3 w-16 ${shimmer}`} />
            <div className={`mt-2 h-3.5 w-24 ${shimmer}`} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const SecurityTabSkeleton = () => (
  <div className="space-y-5">
    <div className="rounded-[var(--shell-radius)] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4">
      <div className={`h-4 w-44 ${shimmer}`} />
      <div className={`mt-2 h-3.5 w-72 max-w-full ${shimmer}`} />
    </div>

    <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white p-5 shadow-[var(--shell-shadow-sm)] dark:bg-[var(--card-bg)]">
      <div className={`mb-5 h-4.5 w-32 ${shimmer}`} />
      <div className="max-w-md space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index}>
            <div className={`mb-1.5 h-3 w-24 ${shimmer}`} />
            <div className={`h-[34px] w-full ${shimmer}`} />
          </div>
        ))}
        <div className={`h-[34px] w-32 ${shimmer}`} />
      </div>
    </div>

    <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white p-5 shadow-[var(--shell-shadow-sm)] dark:bg-[var(--card-bg)]">
      <div className={`mb-2 h-4.5 w-40 ${shimmer}`} />
      <div className={`mb-6 h-3.5 w-56 ${shimmer}`} />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[var(--shell-radius)] border border-[var(--border-color)] p-4">
            <div className="flex items-center gap-3">
              <div className={`h-4 w-4 rounded-full ${shimmer}`} />
              <div className="flex-1">
                <div className={`h-3.5 w-32 ${shimmer}`} />
                <div className={`mt-2 h-3 w-44 ${shimmer}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const NotificationsTabSkeleton = () => (
  <div className="py-2">
    <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white p-5 shadow-[var(--shell-shadow-sm)] dark:bg-[var(--card-bg)] sm:p-6">
      <div className={`mb-6 h-4.5 w-36 ${shimmer}`} />
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-[var(--shell-radius)] border border-[var(--border-color)] p-4">
            <div className={`h-4 w-28 ${shimmer}`} />
            <div className={`mt-2 h-3.5 w-40 ${shimmer}`} />
            <div className="mt-4 space-y-3">
              {Array.from({ length: index === 0 ? 2 : 3 }).map((__, rowIndex) => (
                <div key={rowIndex} className="flex items-center justify-between">
                  <div className={`h-3.5 w-24 ${shimmer}`} />
                  <div className={`h-6 w-11 rounded-full ${shimmer}`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[var(--shell-radius)] border border-[var(--border-color)]">
        <div className="grid grid-cols-[minmax(0,1fr)_80px_80px] gap-0 border-b border-[var(--border-color)] bg-[var(--surface-subtle)] px-4 py-2">
          <div className={`h-3.5 w-12 ${shimmer}`} />
          <div className={`mx-auto h-3.5 w-10 ${shimmer}`} />
          <div className={`mx-auto h-3.5 w-10 ${shimmer}`} />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,1fr)_80px_80px] items-center border-t border-[var(--border-color)] px-4 py-3">
            <div>
              <div className={`h-3.5 w-32 ${shimmer}`} />
              <div className={`mt-2 h-3 w-48 max-w-full ${shimmer}`} />
            </div>
            <div className={`mx-auto h-4 w-4 rounded ${shimmer}`} />
            <div className={`mx-auto h-4 w-4 rounded ${shimmer}`} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

type ProfileScreenSkeletonProps = {
  tab?: ProfileSkeletonTab;
};

const ProfileScreenSkeleton: React.FC<ProfileScreenSkeletonProps> = ({ tab = 'profile' }) => {
  return (
    <div className="px-[var(--shell-page-padding)] py-[var(--shell-page-padding)] text-[14px]">
      <div className="pb-4">
        <TabsSkeleton />
      </div>
      <div className="min-h-[500px] bg-transparent">
        {tab === 'security' ? (
          <SecurityTabSkeleton />
        ) : tab === 'notifications' ? (
          <NotificationsTabSkeleton />
        ) : (
          <ProfileTabSkeleton />
        )}
      </div>
    </div>
  );
};

export default ProfileScreenSkeleton;
