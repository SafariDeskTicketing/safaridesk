import React from 'react';
import { clsx } from 'clsx';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface Column<T> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  sortBy?: keyof T;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: keyof T) => void;
  className?: string;
  // Pagination props
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  showPagination?: boolean;
}

export function Table<T extends Record<string, any>>({
  data,
  columns,
  sortBy,
  sortDirection,
  onSort,
  className,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  showPagination = true,
}: TableProps<T>) {
  // Calculate pagination values
  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = showPagination ? data.slice(startIndex, endIndex) : data;

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && onPageChange) {
      onPageChange(page);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className={clsx('space-y-0', className)}>
      <div className="overflow-x-auto rounded-[var(--shell-radius)]">
        <table className="min-w-full border-separate border-spacing-0 text-[length:var(--font-body)]">
          <thead className="bg-[var(--surface-subtle)]">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={clsx(
                    'border-b border-[var(--border-color)] px-4 py-3.5 text-left text-[length:var(--font-label)] font-semibold uppercase tracking-[0.04em] text-[var(--text-secondary)]',
                    column.sortable && 'cursor-pointer hover:bg-[var(--surface-muted)]'
                  )}
                  onClick={() => column.sortable && onSort?.(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.header}</span>
                    {column.sortable && sortBy === column.key && (
                      <div className="flex flex-col">
                        {sortDirection === 'asc' ? (
                          <ChevronUp size={12} className="text-[var(--status-info-text)]" />
                        ) : (
                          <ChevronDown size={12} className="text-[var(--status-info-text)]" />
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-[var(--card-bg)]">
            {paginatedData.map((row, index) => (
              <tr
                key={startIndex + index}
                className="bg-[var(--card-bg)] transition-colors hover:bg-[var(--surface-subtle)]"
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className="border-b border-[var(--border-color)] px-4 py-3.5 align-middle text-[length:var(--font-body)] text-[var(--text-primary)]"
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && totalPages > 1 && (
        <div className="flex flex-col gap-3 border-t border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center text-[14px] text-[var(--text-secondary)]">
            <span>
              Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} results
            </span>
          </div>
          
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={clsx(
                'inline-flex h-[34px] items-center gap-1 rounded-full border px-3 text-[14px] font-medium',
                currentPage === 1
                  ? 'cursor-not-allowed border-[var(--border-color)] text-[var(--text-disabled)]'
                  : 'border-[var(--border-color)] hover:bg-[var(--surface-muted)]'
              )}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>

            <div className="hidden items-center space-x-1 sm:flex">
              {getPageNumbers().map((page, index) => (
                <React.Fragment key={index}>
                  {page === '...' ? (
                    <span className="px-2 text-[var(--text-muted)]">...</span>
                  ) : (
                    <button
                      onClick={() => handlePageChange(page as number)}
                      className={clsx(
                        'inline-flex h-[34px] min-w-[34px] items-center justify-center rounded-full border px-2 text-[14px] font-medium',
                        currentPage === page
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : 'border-[var(--border-color)] hover:bg-[var(--surface-muted)]'
                      )}
                    >
                      {page}
                    </button>
                  )}
                </React.Fragment>
              ))}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={clsx(
                'inline-flex h-[34px] items-center gap-1 rounded-full border px-3 text-[14px] font-medium',
                currentPage === totalPages
                  ? 'cursor-not-allowed border-[var(--border-color)] text-[var(--text-disabled)]'
                  : 'border-[var(--border-color)] hover:bg-[var(--surface-muted)]'
              )}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
