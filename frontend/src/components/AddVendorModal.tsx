import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';

interface AddVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVendor: (vendorName: string) => void;
  onUpdateVendor?: (id: string, newName: string) => void; // New prop for updating
  initialVendor?: { value: string; label: string }; // New prop for initial value
  existingVendors: Array<{ value: string; label: string }>;
}

const AddVendorModal: React.FC<AddVendorModalProps> = ({
  isOpen,
  onClose,
  onAddVendor,
  onUpdateVendor,
  initialVendor,
  existingVendors,
}) => {
  const [newVendorName, setNewVendorName] = useState(initialVendor?.label || '');
  const [error, setError] = useState('');

  useEffect(() => {
    setNewVendorName(initialVendor?.label || '');
    setError('');
  }, [initialVendor, isOpen]);

  const handleSave = () => {
    setError('');
    if (newVendorName.trim() === '') {
      setError('Vendor name cannot be empty.');
      return;
    }

    // Check for duplicates, excluding the current vendor if editing
    const isDuplicate = existingVendors.some(
      (opt) =>
        opt.value.toLowerCase() !== initialVendor?.value.toLowerCase() &&
        opt.label.toLowerCase() === newVendorName.trim().toLowerCase()
    );

    if (isDuplicate) {
      setError('Vendor already exists.');
      return;
    }

    if (initialVendor && onUpdateVendor) {
      onUpdateVendor(initialVendor.value, newVendorName.trim());
    } else {
      onAddVendor(newVendorName.trim());
    }
    setNewVendorName('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialVendor ? "Edit Vendor" : "Add New Vendor"}
    >
      <div className="mb-4">
        <Input
          label="Vendor Name"
          placeholder="New Vendor Name"
          value={newVendorName}
          onChange={(e) => setNewVendorName(e.target.value)}
          fullWidth
          error={error}
        />
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave}>{initialVendor ? "Update" : "Save"}</Button>
      </div>
    </Modal>
  );
};

export default AddVendorModal;