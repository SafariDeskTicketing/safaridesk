import * as React from 'react';
import { MoreVertical, Eye, Pencil, Trash2 } from 'lucide-react';
import { Table } from '../ui/Table';
import { Dropdown } from '../ui/Dropdown';
import { Button } from '../ui/Button';
import type { Asset } from '../../types';

interface AssetListProps {
  assets: Asset[];
  onView: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  selectedIds: string[];
  onToggleSelected: (id: string, selected: boolean) => void;
  onToggleSelectAll: (selected: boolean) => void;
}

const STATUS_BADGE: Record<string, string> = {
  available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  in_use: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  maintenance: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  repair: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  retired: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  stolen: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const AssetList: React.FC<AssetListProps> = ({
  assets,
  onView,
  onEdit,
  onDelete,
  selectedIds,
  onToggleSelected,
  onToggleSelectAll,
}) => {
  const allSelected = assets.length > 0 && selectedIds.length === assets.length;

  const columns = [
    {
      key: 'id' as keyof Asset,
      header: '',
      render: (_: unknown, row: Asset) => (
        <input
          type="checkbox"
          className="rounded"
          checked={selectedIds.includes(row.id)}
          onChange={(e) => onToggleSelected(row.id, e.target.checked)}
          aria-label={`Select ${row.name}`}
        />
      ),
    },
    {
      key: 'name' as keyof Asset,
      header: 'Asset',
      render: (_: unknown, row: Asset) => (
        <div>
          <p className="font-medium text-[var(--text-primary)]">{row.name}</p>
          <p className="text-[length:var(--font-meta)] text-gray-500">
            {row.asset_tag || row.serial_number || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'category' as keyof Asset,
      header: 'Category',
      render: (_: unknown, row: Asset) => row.category?.name || '—',
    },
    {
      key: 'vendor' as keyof Asset,
      header: 'Vendor',
      render: (_: unknown, row: Asset) => row.vendor?.name || '—',
    },
    {
      key: 'status' as keyof Asset,
      header: 'Status',
      render: (_: unknown, row: Asset) => (
        <span
          className={`px-2 py-1 rounded-full text-[length:var(--font-meta)] font-medium ${
            STATUS_BADGE[row.status] || 'bg-gray-100 text-gray-700'
          }`}
        >
          {row.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'location' as keyof Asset,
      header: 'Location',
      render: (_: unknown, row: Asset) => row.location || '—',
    },
    {
      key: 'is_critical' as keyof Asset,
      header: 'Critical',
      render: (_: unknown, row: Asset) => (row.is_critical ? 'Yes' : 'No'),
    },
    {
      key: 'updated_at' as keyof Asset,
      header: 'Actions',
      render: (_: unknown, row: Asset) => (
        <Dropdown
          trigger={
            <Button variant="ghost" size="sm" icon={MoreVertical} aria-label="Asset actions" />
          }
          options={[
            { label: 'View', icon: Eye, onClick: () => onView(row) },
            { label: 'Edit', icon: Pencil, onClick: () => onEdit(row) },
            { label: 'Delete', icon: Trash2, variant: 'danger', onClick: () => onDelete(row) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-4 py-2.5">
        <input
          type="checkbox"
          className="rounded"
          checked={allSelected}
          onChange={(e) => onToggleSelectAll(e.target.checked)}
          aria-label="Select all assets"
        />
        <span className="text-[length:var(--font-meta)] text-gray-500">
          {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select all'}
        </span>
      </div>
      <Table<Asset> data={assets} columns={columns} showPagination={false} />
    </div>
  );
};

export default AssetList;
