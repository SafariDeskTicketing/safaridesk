import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Package, Plus, Trash2 } from 'lucide-react';
import { Search } from '../../components/icons/AppIcons';
import { PageHeader } from '../../components/layout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { TableSkeleton } from '../../components/ui/TableSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { errorNotification, successNotification } from '../../components/ui/Toast';
import AssetList from '../../components/asset-management/AssetList';
import AssetForm from '../../components/asset-management/AssetForm';
import type { Asset } from '../../types';
import {
  EMPTY_ASSET_FORM_VALUES,
  assetToFormValues,
  useAssetCategoriesQuery,
  useAssetVendorsQuery,
  useAssetsQuery,
  useBulkDeleteAssetsMutation,
  useCreateAssetCategoryMutation,
  useCreateAssetMutation,
  useCreateAssetVendorMutation,
  useDeleteAssetMutation,
  useUpdateAssetMutation,
  type AssetFormValues,
} from './assetManagementData';

const PAGE_SIZE = 20;

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'In Use' },
  { value: 'maintenance', label: 'Under Maintenance' },
  { value: 'repair', label: 'Under Repair' },
  { value: 'retired', label: 'Retired' },
  { value: 'lost', label: 'Lost' },
  { value: 'stolen', label: 'Stolen' },
];

type ModalMode = 'create' | 'edit' | null;

const AssetManagementPage: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const { data, isLoading, isFetching } = useAssetsQuery({ search, status, page, pageSize: PAGE_SIZE });
  const { data: categories = [] } = useAssetCategoriesQuery();
  const { data: vendors = [] } = useAssetVendorsQuery();

  const createAsset = useCreateAssetMutation();
  const updateAsset = useUpdateAssetMutation();
  const deleteAsset = useDeleteAssetMutation();
  const bulkDeleteAssets = useBulkDeleteAssetsMutation();
  const createCategory = useCreateAssetCategoryMutation();
  const createVendor = useCreateAssetVendorMutation();

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [formValues, setFormValues] = useState<AssetFormValues>(EMPTY_ASSET_FORM_VALUES);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [assetPendingDelete, setAssetPendingDelete] = useState<Asset | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  const assets = data?.results ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const openCreateModal = () => {
    setFormValues(EMPTY_ASSET_FORM_VALUES);
    setEditingAsset(null);
    setModalMode('create');
  };

  const openEditModal = (asset: Asset) => {
    setFormValues(assetToFormValues(asset));
    setEditingAsset(asset);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingAsset(null);
  };

  const handleSubmit = async () => {
    try {
      if (modalMode === 'edit' && editingAsset) {
        await updateAsset.mutateAsync({ id: editingAsset.id, values: formValues });
        successNotification('Asset updated successfully');
      } else {
        await createAsset.mutateAsync(formValues);
        successNotification('Asset created successfully');
      }
      closeModal();
    } catch (err) {
      errorNotification(axios.isAxiosError(err) && err.response?.data?.detail
        ? err.response.data.detail
        : 'Failed to save asset. Please try again.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!assetPendingDelete) return;
    try {
      await deleteAsset.mutateAsync(assetPendingDelete.id);
      successNotification('Asset deleted successfully');
      setSelectedIds((prev) => prev.filter((id) => id !== assetPendingDelete.id));
    } catch {
      errorNotification('Failed to delete asset');
    } finally {
      setAssetPendingDelete(null);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      await bulkDeleteAssets.mutateAsync(selectedIds);
      successNotification(`${selectedIds.length} asset(s) deleted successfully`);
      setSelectedIds([]);
    } catch {
      errorNotification('Failed to delete selected assets');
    } finally {
      setBulkDeleteConfirmOpen(false);
    }
  };

  const toggleSelected = (id: string, selected: boolean) => {
    setSelectedIds((prev) => (selected ? [...prev, id] : prev.filter((existing) => existing !== id)));
  };

  const toggleSelectAll = (selected: boolean) => {
    setSelectedIds(selected ? assets.map((asset) => asset.id) : []);
  };

  const handleCreateCategory = async (name: string) => {
    const created = await createCategory.mutateAsync({ name });
    return created;
  };

  const handleCreateVendor = async (name: string) => {
    const created = await createVendor.mutateAsync({ name });
    return created;
  };

  const rangeLabel = useMemo(() => {
    if (totalCount === 0) return '0 assets';
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, totalCount);
    return `${start}-${end} of ${totalCount} assets`;
  }, [page, totalCount]);

  return (
    <div className="sd-config-content">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Package className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            <span>Assets</span>
          </span>
        }
        subtitle="Track hardware, software, and other business assets across your organization"
        actions={
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={() => setBulkDeleteConfirmOpen(true)}
              >
                Delete {selectedIds.length} selected
              </Button>
            )}
            <Button icon={Plus} size="sm" onClick={openCreateModal}>
              New Asset
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          icon={Search}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search assets by name, tag, or serial number..."
          className="h-10 max-w-sm"
        />
        <div className="w-48">
          <Select
            value={status}
            onChange={setStatus}
            options={STATUS_FILTER_OPTIONS}
            size="sm"
          />
        </div>
      </div>

      {isLoading && <TableSkeleton />}

      {!isLoading && assets.length === 0 && (
        <EmptyState
          title="No assets found"
          message={search || status ? 'No assets match your filters.' : 'Get started by adding your first asset.'}
        />
      )}

      {!isLoading && assets.length > 0 && (
        <>
          <AssetList
            assets={assets}
            onView={setViewingAsset}
            onEdit={openEditModal}
            onDelete={setAssetPendingDelete}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            onToggleSelectAll={toggleSelectAll}
          />
          <div className="flex items-center justify-between border-t border-[var(--border-color)] px-4 py-3 bg-gray-50 dark:bg-[#202020]">
            <span className="text-[length:var(--font-body)] text-gray-600 dark:text-gray-400">
              {isFetching ? 'Loading…' : rangeLabel}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-[length:var(--font-body)] text-gray-600 dark:text-gray-400">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={modalMode !== null}
        onClose={closeModal}
        title={modalMode === 'edit' ? 'Edit Asset' : 'New Asset'}
        size="2xl"
      >
        <AssetForm
          values={formValues}
          onChange={setFormValues}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          categories={categories}
          vendors={vendors}
          onCreateCategory={handleCreateCategory}
          onCreateVendor={handleCreateVendor}
          isSubmitting={createAsset.isPending || updateAsset.isPending}
          submitLabel={modalMode === 'edit' ? 'Save Changes' : 'Create Asset'}
        />
      </Modal>

      <Modal
        isOpen={viewingAsset !== null}
        onClose={() => setViewingAsset(null)}
        title={viewingAsset?.name}
        size="lg"
      >
        {viewingAsset && (
          <div className="grid grid-cols-2 gap-4 text-[length:var(--font-body)]">
            <DetailRow label="Asset tag" value={viewingAsset.asset_tag} />
            <DetailRow label="Serial number" value={viewingAsset.serial_number} />
            <DetailRow label="Category" value={viewingAsset.category?.name} />
            <DetailRow label="Vendor" value={viewingAsset.vendor?.name} />
            <DetailRow label="Brand" value={viewingAsset.brand} />
            <DetailRow label="Model" value={viewingAsset.model} />
            <DetailRow label="Status" value={viewingAsset.status.replace('_', ' ')} />
            <DetailRow label="Condition" value={viewingAsset.condition} />
            <DetailRow label="Location" value={viewingAsset.location} />
            <DetailRow label="Critical" value={viewingAsset.is_critical ? 'Yes' : 'No'} />
            <DetailRow label="Purchase date" value={viewingAsset.purchase_date} />
            <DetailRow label="Purchase price" value={viewingAsset.purchase_price != null ? String(viewingAsset.purchase_price) : undefined} />
            <DetailRow label="Warranty start" value={viewingAsset.warranty_start_date} />
            <DetailRow label="Warranty end" value={viewingAsset.warranty_end_date} />
            {viewingAsset.description && (
              <div className="col-span-2">
                <DetailRow label="Description" value={viewingAsset.description} />
              </div>
            )}
            {viewingAsset.notes && (
              <div className="col-span-2">
                <DetailRow label="Notes" value={viewingAsset.notes} />
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        show={assetPendingDelete !== null}
        cancel={() => setAssetPendingDelete(null)}
        onConfirm={handleDeleteConfirm}
        message={`Are you sure you want to delete "${assetPendingDelete?.name}"? This cannot be undone.`}
        variant="danger"
        confirmText="Delete"
        state={deleteAsset.isPending}
      />

      <ConfirmDialog
        show={bulkDeleteConfirmOpen}
        cancel={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        message={`Are you sure you want to delete ${selectedIds.length} asset(s)? This cannot be undone.`}
        variant="danger"
        confirmText="Delete"
        state={bulkDeleteAssets.isPending}
      />
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div>
    <p className="text-[length:var(--font-meta)] text-gray-500">{label}</p>
    <p className="text-[var(--text-primary)]">{value || '—'}</p>
  </div>
);

export default AssetManagementPage;
