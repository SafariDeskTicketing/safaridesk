import React from 'react';
import { Table } from './Table';

type LegacyDataTableColumn<T extends Record<string, any>> = {
  header: string;
  accessorKey?: keyof T;
  cell?: (ctx: { row: { original: T } }) => React.ReactNode;
  sortable?: boolean;
};

type DataTableProps<T extends Record<string, any>> = {
  columns: LegacyDataTableColumn<T>[];
  data: T[];
  className?: string;
};

export const DataTable = <T extends Record<string, any>>({ columns, data, className }: DataTableProps<T>) => {
  if (!data) {
    return null;
  }

  const normalizedColumns = columns
    .filter((column) => Boolean(column.accessorKey) || Boolean(column.cell))
    .map((column, index) => {
      const fallbackKey = (`__col_${index}` as unknown) as keyof T;
      const resolvedKey = (column.accessorKey || fallbackKey) as keyof T;

      return {
        key: resolvedKey,
        header: column.header,
        sortable: Boolean(column.sortable && column.accessorKey),
        render: column.cell
          ? (_value: unknown, row: T) => column.cell?.({ row: { original: row } })
          : undefined,
      };
    });

  return (
    <Table
      data={data}
      columns={normalizedColumns}
      showPagination={false}
      className={className}
    />
  );
};
