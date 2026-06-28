import React from 'react';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  minWidth?: number;
  showToolbar?: boolean;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 6,
  columns = 8,
  minWidth = 920,
  showToolbar = true,
}) => {
  const gridColumns = `repeat(${columns}, minmax(0, 1fr))`;

  return (
    <div className="p-4">
      <div className="overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] shadow-[var(--shell-shadow-sm)]">
        <div style={{ minWidth }}>
          {showToolbar && (
            <div className="flex items-center gap-2 border-b border-[var(--border-color)] bg-[var(--surface-subtle)] px-3 py-2">
              <div className="sd-shimmer h-7 w-20 rounded-lg" />
              <div className="sd-shimmer h-7 w-24 rounded-lg" />
            </div>
          )}

          <div className="border-b border-[var(--border-color)] bg-[var(--surface-subtle)] px-3 py-3">
            <div className="grid gap-2" style={{ gridTemplateColumns: gridColumns }}>
              {Array.from({ length: columns }).map((_, columnIndex) => (
                <div
                  key={`header-${columnIndex}`}
                  className={`sd-shimmer h-3.5 rounded ${columnIndex === 0 ? 'w-8 justify-self-center' : 'w-3/4'}`}
                />
              ))}
            </div>
          </div>

          <div>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <div key={`row-${rowIndex}`} className="border-b border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-3 last:border-b-0">
                <div className="grid items-center gap-2" style={{ gridTemplateColumns: gridColumns }}>
                  {Array.from({ length: columns }).map((__, columnIndex) => (
                    <div
                      key={`cell-${rowIndex}-${columnIndex}`}
                      className={`sd-shimmer rounded ${columnIndex === 0 ? 'h-4 w-4 justify-self-center' : columnIndex === 2 ? 'h-4 w-11/12' : 'h-3.5 w-3/4'}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
