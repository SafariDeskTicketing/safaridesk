import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import Select from '../ui/Select';

interface AssetFormProps {
  onSubmit: (asset: any) => void;
  initialData?: any;
}

const AssetForm: React.FC<AssetFormProps> = ({ onSubmit, initialData }) => {
  const [formData, setFormData] = useState(initialData || {
    name: '',
    description: '',
    asset_tag: '',
    serial_number: '',
    category: '',
    vendor: '',
    brand: '',
    model: '',
    status: 'available',
    condition: 'good',
    location: '',
    purchase_price: '',
    purchase_date: '',
    supplier: '',
    invoice_number: '',
    warranty_expiry: '',
    last_maintenance: '',
    next_maintenance: '',
    notes: '',
    is_critical: false,
  });

  const [openSections, setOpenSections] = useState({
    basicInfo: true,
    purchaseDetails: false,
    maintenanceWarranty: false,
    otherDetails: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSelectChange = (selectedOption: any, name: string) => {
    setFormData({ ...formData, [name]: selectedOption ? selectedOption.value : '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const categoryOptions = [
    { value: 'Laptop', label: 'Laptop' },
    { value: 'Server', label: 'Server' },
    { value: 'Furniture', label: 'Furniture' },
    { value: 'Vehicle', label: 'Vehicle' },
    { value: 'Other', label: 'Other' },
  ];

  const statusOptions = [
    { value: 'available', label: 'Available' },
    { value: 'in_use', label: 'In Use' },
    { value: 'maintenance', label: 'Under Maintenance' },
    { value: 'repair', label: 'Under Repair' },
    { value: 'retired', label: 'Retired' },
    { value: 'lost', label: 'Lost' },
    { value: 'stolen', label: 'Stolen' },
  ];

  const conditionOptions = [
    { value: 'excellent', label: 'Excellent' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
    { value: 'damaged', label: 'Damaged' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 cursor-pointer" onClick={() => toggleSection('basicInfo')}>
          Basic Information {openSections.basicInfo ? '▲' : '▼'}
        </h3>
        {openSections.basicInfo && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Asset Name" name="name" value={formData.name} onChange={handleChange} required fullWidth />
            <Input label="Asset Tag" name="asset_tag" value={formData.asset_tag} onChange={handleChange} required fullWidth />
            <Input label="Serial Number" name="serial_number" value={formData.serial_number} onChange={handleChange} required fullWidth />
            <Select
              name="category"
              options={categoryOptions}
              value={categoryOptions.find(option => option.value === formData.category)}
              onChange={(option) => handleSelectChange(option, 'category')}
              placeholder="Select Category"
              isClearable
            />
            <Input label="Brand" name="brand" value={formData.brand} onChange={handleChange} fullWidth />
            <Input label="Model" name="model" value={formData.model} onChange={handleChange} fullWidth />
            <Select
              name="status"
              options={statusOptions}
              value={statusOptions.find(option => option.value === formData.status)}
              onChange={(option) => handleSelectChange(option, 'status')}
              placeholder="Select Status"
              isClearable
            />
            <Select
              name="condition"
              options={conditionOptions}
              value={conditionOptions.find(option => option.value === formData.condition)}
              onChange={(option) => handleSelectChange(option, 'condition')}
              placeholder="Select Condition"
              isClearable
            />
            <Input label="Location" name="location" value={formData.location} onChange={handleChange} fullWidth />
            <Input label="Description" name="description" value={formData.description} onChange={handleChange} fullWidth />
          </div>
        )}
      </div>

      {/* Purchase Details */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 cursor-pointer" onClick={() => toggleSection('purchaseDetails')}>
          Purchase Details {openSections.purchaseDetails ? '▲' : '▼'}
        </h3>
        {openSections.purchaseDetails && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Purchase Price" name="purchase_price" type="number" value={formData.purchase_price} onChange={handleChange} step="0.01" fullWidth />
            <Input label="Purchase Date" name="purchase_date" type="date" value={formData.purchase_date} onChange={handleChange} fullWidth />
            <Input label="Vendor" name="vendor" value={formData.vendor} onChange={handleChange} fullWidth />
            <Input label="Supplier" name="supplier" value={formData.supplier} onChange={handleChange} fullWidth />
            <Input label="Invoice Number" name="invoice_number" value={formData.invoice_number} onChange={handleChange} fullWidth />
          </div>
        )}
      </div>

      {/* Maintenance & Warranty */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 cursor-pointer" onClick={() => toggleSection('maintenanceWarranty')}>
          Maintenance & Warranty {openSections.maintenanceWarranty ? '▲' : '▼'}
        </h3>
        {openSections.maintenanceWarranty && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Warranty Expiry" name="warranty_expiry" type="date" value={formData.warranty_expiry} onChange={handleChange} fullWidth />
            <Input label="Last Maintenance" name="last_maintenance" type="date" value={formData.last_maintenance} onChange={handleChange} fullWidth />
            <Input label="Next Maintenance" name="next_maintenance" type="date" value={formData.next_maintenance} onChange={handleChange} fullWidth />
          </div>
        )}
      </div>

      {/* Other Details */}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4 cursor-pointer" onClick={() => toggleSection('otherDetails')}>
          Other Details {openSections.otherDetails ? '▲' : '▼'}
        </h3>
        {openSections.otherDetails && (
          <div className="grid grid-cols-1 gap-4">
            <Input label="Notes" name="notes" value={formData.notes} onChange={handleChange} fullWidth />
            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_critical"
                checked={formData.is_critical}
                onChange={(e) => setFormData({ ...formData, is_critical: e.target.checked })}
                className="mr-2"
              />
              <label>Is Critical Asset</label>
            </div>
          </div>
        )}
      </div>

      <Button type="submit" fullWidth>Save Asset</Button>
    </form>
  );
};

export default AssetForm;