import React, { useCallback, useEffect, useState } from 'react';

export interface ListViewColumn {
  key: string;
  label: string;
  align?: 'left' | 'center';
  locked?: boolean;
  minWidth?: number;
  defaultWidth?: number;
}

export interface ListViewRow {
  id: string | number;
  cells: Record<string, React.ReactNode>;
}

interface ListViewProps {
  columns: ListViewColumn[];
  rows: ListViewRow[];
  onRowClick?: (row: ListViewRow) => void;
  selectedRowIds?: Set<string | number>;
  onSelectionChange?: (rowId: string | number, selected: boolean) => void;
  onSelectAll?: (selected: boolean, totalRows: number) => void;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  renderCell?: (column: ListViewColumn, cell: React.ReactNode, row: ListViewRow) => React.ReactNode;
}

const MIN_WIDTH = 80;
const MAX_WIDTH = 360;
const LOCKED_WIDTHS: Partial<Record<string, number>> = {
  checkbox: 50,
  ticket_id: 110,
  status: 140,
  priority: 130,
  tasks: 80,
};

export const ListView: React.FC<ListViewProps> = ({
  columns,
  rows,
  onRowClick,
  selectedRowIds = new Set(),
  onSelectionChange,
  onSelectAll,
  isLoading = false,
  emptyState,
  renderCell,
}) => {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    columns.forEach((col) => {
      const lockedWidth = col.locked ? LOCKED_WIDTHS[col.key] : undefined;
      const baseWidth = col.defaultWidth ?? 150;
      const width = lockedWidth ?? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, baseWidth));
      initial[col.key] = width;
    });
    return initial;
  });

  const [resizing, setResizing] = useState<{ key: string; startX: number; startWidth: number } | null>(null);

  const clampWidth = useCallback((key: string, value: number) => {
    if (LOCKED_WIDTHS[key]) return LOCKED_WIDTHS[key] as number;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
  }, []);

  const handleResizeStart = useCallback((key: string, startWidth: number, startX: number) => {
    if (LOCKED_WIDTHS[key]) return;
    setResizing({ key, startWidth, startX });
  }, []);

  useEffect(() => {
    if (!resizing) return;

    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      setColumnWidths((prev) => {
        const newWidth = clampWidth(resizing.key, resizing.startWidth + delta);
        return { ...prev, [resizing.key]: newWidth };
      });
    };

    const onUp = () => setResizing(null);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing, clampWidth]);

  const buildGridTemplate = () =>
    columns
      .map((col) => {
        const lockedWidth = LOCKED_WIDTHS[col.key];
        const min = col.minWidth ?? MIN_WIDTH;
        if (lockedWidth) return `${lockedWidth}px`;
        const width = clampWidth(col.key, columnWidths[col.key] ?? min);
        const isTitle = col.key === 'title' || col.key === 'issue';
        const minTitle = Math.max(300, min);
        const maxTitle = Math.max(width, 420);
        return isTitle ? `minmax(${minTitle}px, ${maxTitle}px)` : `minmax(${min}px, ${width}px)`;
      })
      .join(' ');

  const allSelected = rows.length > 0 && rows.every((r) => selectedRowIds.has(r.id));

  return (
    <div className="border border-gray-200 dark:border-subtle bg-white dark:bg-surface rounded-lg overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        {/* Header */}
        <div
          className="grid w-full min-w-full max-w-full auto-cols-fr bg-primary-700/90 text-white text-sm font-semibold"
          style={{ gridTemplateColumns: buildGridTemplate() }}
        >
          {columns.map((col, idx) => (
            <div
              key={col.key}
              className={`relative py-3 px-4 flex items-center justify-between whitespace-nowrap ${
                idx > 0 ? 'border-l border-primary-600/70' : ''
              }`}
            >
              {col.key === 'checkbox' ? (
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAll?.(e.target.checked, rows.length)}
                  className="cursor-pointer"
                />
              ) : (
                <>
                  <span>{col.label}</span>
                  {!LOCKED_WIDTHS[col.key] && !col.locked && (
                    <span
                      className="absolute right-[-6px] top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary-200/40"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleResizeStart(col.key, columnWidths[col.key], e.clientX);
                      }}
                    />
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 dark:text-[var(--text-primary)]">Loading…</div>
        ) : rows.length === 0 ? (
          emptyState || <div className="p-4 text-center text-gray-500 dark:text-[var(--text-primary)]">No data</div>
        ) : (
          <div>
            {rows.map((row) => {
              const selected = selectedRowIds.has(row.id);
              return (
                <div
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={`grid w-full min-w-full max-w-full auto-cols-fr text-gray-900 dark:text-[var(--text-primary)] text-[14px] cursor-pointer hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors ${
                    selected ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-gray-50 dark:bg-surface'
                  }`}
                  style={{ gridTemplateColumns: buildGridTemplate() }}
                >
                  {columns.map((col, idx) => (
                    <div
                      key={col.key}
                      className={`py-3 px-4 flex items-center ${
                        col.align === 'center' ? 'justify-center text-center' : 'justify-start'
                      } ${idx > 0 ? 'border-l border-gray-200 dark:border-subtle' : ''} ${
                        col.key === 'checkbox' ? 'justify-center' : ''
                      }`}
                      style={
                        LOCKED_WIDTHS[col.key]
                          ? { minWidth: LOCKED_WIDTHS[col.key], maxWidth: LOCKED_WIDTHS[col.key] }
                          : { minWidth: col.minWidth ?? MIN_WIDTH, maxWidth: clampWidth(col.key, columnWidths[col.key] ?? MIN_WIDTH) }
                      }
                    >
                      {col.key === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={selected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onSelectionChange?.(row.id, e.target.checked)}
                          className="cursor-pointer"
                        />
                      ) : renderCell ? (
                        renderCell(col, row.cells[col.key], row)
                      ) : (
                        <span className="truncate">{row.cells[col.key]}</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
