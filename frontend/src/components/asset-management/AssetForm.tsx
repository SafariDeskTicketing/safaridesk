import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import Select from '../ui/Select';
import ToggleSwitch from '../ui/ToggleSwitch';
import { Plus } from 'lucide-react';
import type { AssetFormValues, Category, Vendor } from '../../pages/asset-management/assetManagementData';

interface AssetFormProps {
  values: AssetFormValues;
  onChange: (values: AssetFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  categories: Category[];
  vendors: Vendor[];
  onCreateCategory: (name: string) => Promise<Category>;
  onCreateVendor: (name: string) => Promise<Vendor>;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'In Use' },
  { value: 'maintenance', label: 'Under Maintenance' },
  { value: 'repair', label: 'Under Repair' },
  { value: 'retired', label: 'Retired' },
  { value: 'lost', label: 'Lost' },
  { value: 'stolen', label: 'Stolen' },
];

const CONDITION_OPTIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'damaged', label: 'Damaged' },
];

/** Inline "+ add new" affordance for the category/vendor selects, which are
 * required-ish but may have nothing seeded yet. */
const QuickAddSelect: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  onCreate: (name: string) => Promise<{ id?: string | number }>;
  placeholder: string;
  required?: boolean;
}> = ({ label, value, options, onChange, onCreate, placeholder, required }) => {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await onCreate(newName.trim());
      if (created.id != null) {
        onChange(String(created.id));
      }
      setNewName('');
      setAdding(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[14px] font-medium text-[var(--text-secondary)]">
          {label}
        </label>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[length:var(--font-meta)] text-primary-600 hover:text-primary-700"
          onClick={() => setAdding((prev) => !prev)}
        >
          <Plus size={12} /> New
        </button>
      </div>
      {adding ? (
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`New ${label.toLowerCase()} name`}
            fullWidth
          />
          <Button type="button" size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? 'Adding...' : 'Add'}
          </Button>
        </div>
      ) : (
        <Select
          value={value}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          required={required}
        />
      )}
    </div>
  );
};

const AssetForm: React.FC<AssetFormProps> = ({
  values,
  onChange,
  onSubmit,
  onCancel,
  categories,
  vendors,
  onCreateCategory,
  onCreateVendor,
  isSubmitting = false,
  submitLabel = 'Save Asset',
}) => {
  const [openSections, setOpenSections] = useState({
    basicInfo: true,
    purchaseDetails: false,
    maintenanceWarranty: false,
    otherDetails: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const set = <K extends keyof AssetFormValues>(key: K, value: AssetFormValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    set(name as keyof AssetFormValues, value as never);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const categoryOptions = categories.map((category) => ({
    value: String(category.id),
    label: category.name,
  }));

  const vendorOptions = [
    { value: '', label: 'No vendor' },
    ...vendors.map((vendor) => ({ value: String(vendor.id), label: vendor.name })),
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="border border-[var(--border-color)] rounded-lg p-4">
        <h3
          className="text-lg font-semibold mb-4 cursor-pointer text-[var(--text-primary)]"
          onClick={() => toggleSection('basicInfo')}
        >
          Basic Information {openSections.basicInfo ? '▲' : '▼'}
        </h3>
        {openSections.basicInfo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Asset Name" name="name" value={values.name} onChange={handleChange} required fullWidth />
            <Input label="Asset Tag" name="asset_tag" value={values.asset_tag} onChange={handleChange} fullWidth />
            <Input label="Serial Number" name="serial_number" value={values.serial_number} onChange={handleChange} fullWidth />
            <QuickAddSelect
              label="Category"
              value={values.category}
              options={categoryOptions}
              onChange={(value) => set('category', value)}
              onCreate={onCreateCategory}
              placeholder="Select category"
              required
            />
            <Input label="Brand" name="brand" value={values.brand} onChange={handleChange} fullWidth />
            <Input label="Model" name="model" value={values.model} onChange={handleChange} fullWidth />
            <div>
              <label className="block text-[14px] font-medium text-[var(--text-secondary)] mb-1">Status</label>
              <Select value={values.status} onChange={(value) => set('status', value as AssetFormValues['status'])} options={STATUS_OPTIONS} />
            </div>
            <div>
              <label className="block text-[14px] font-medium text-[var(--text-secondary)] mb-1">Condition</label>
              <Select value={values.condition} onChange={(value) => set('condition', value as AssetFormValues['condition'])} options={CONDITION_OPTIONS} />
            </div>
            <QuickAddSelect
              label="Vendor"
              value={values.vendor}
              options={vendorOptions}
              onChange={(value) => set('vendor', value)}
              onCreate={onCreateVendor}
              placeholder="No vendor"
            />
            <Input label="Location" name="location" value={values.location} onChange={handleChange} fullWidth />
            <Textarea label="Description" name="description" value={values.description} onChange={handleChange} fullWidth className="md:col-span-2" />
          </div>
        )}
      </div>

      {/* Purchase Details */}
      <div className="border border-[var(--border-color)] rounded-lg p-4">
        <h3
          className="text-lg font-semibold mb-4 cursor-pointer text-[var(--text-primary)]"
          onClick={() => toggleSection('purchaseDetails')}
        >
          Purchase Details {openSections.purchaseDetails ? '▲' : '▼'}
        </h3>
        {openSections.purchaseDetails && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Purchase Price" name="purchase_price" type="number" value={values.purchase_price} onChange={handleChange} step="0.01" fullWidth />
            <Input label="Purchase Date" name="purchase_date" type="date" value={values.purchase_date} onChange={handleChange} fullWidth />
            <Input label="Supplier" name="supplier" value={values.supplier} onChange={handleChange} fullWidth />
            <Input label="Invoice Number" name="invoice_number" value={values.invoice_number} onChange={handleChange} fullWidth />
          </div>
        )}
      </div>

      {/* Maintenance & Warranty */}
      <div className="border border-[var(--border-color)] rounded-lg p-4">
        <h3
          className="text-lg font-semibold mb-4 cursor-pointer text-[var(--text-primary)]"
          onClick={() => toggleSection('maintenanceWarranty')}
        >
          Maintenance & Warranty {openSections.maintenanceWarranty ? '▲' : '▼'}
        </h3>
        {openSections.maintenanceWarranty && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Warranty Start" name="warranty_start_date" type="date" value={values.warranty_start_date} onChange={handleChange} fullWidth />
            <Input label="Warranty End" name="warranty_end_date" type="date" value={values.warranty_end_date} onChange={handleChange} fullWidth />
            <Input label="Last Maintenance" name="last_maintenance" type="date" value={values.last_maintenance} onChange={handleChange} fullWidth />
            <Input label="Next Maintenance" name="next_maintenance" type="date" value={values.next_maintenance} onChange={handleChange} fullWidth />
          </div>
        )}
      </div>

      {/* Other Details */}
      <div className="border border-[var(--border-color)] rounded-lg p-4">
        <h3
          className="text-lg font-semibold mb-4 cursor-pointer text-[var(--text-primary)]"
          onClick={() => toggleSection('otherDetails')}
        >
          Other Details {openSections.otherDetails ? '▲' : '▼'}
        </h3>
        {openSections.otherDetails && (
          <div className="space-y-4">
            <Textarea label="Notes" name="notes" value={values.notes} onChange={handleChange} fullWidth />
            <ToggleSwitch
              checked={values.is_critical}
              onChange={() => set('is_critical', !values.is_critical)}
              label="Mark as business critical asset"
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !values.name.trim() || !values.category}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default AssetForm;
