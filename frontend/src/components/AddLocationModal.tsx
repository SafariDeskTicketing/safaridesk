import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLocation: (locationName: string) => void;
  onUpdateLocation?: (id: string, newName: string) => void;
  initialLocation?: { value: string; label: string };
  existingLocations: Array<{ value: string; label: string }>;
}

const AddLocationModal: React.FC<AddLocationModalProps> = ({
  isOpen,
  onClose,
  onAddLocation,
  onUpdateLocation,
  initialLocation,
  existingLocations,
}) => {
  const [newLocationName, setNewLocationName] = useState(initialLocation?.label || '');
  const [error, setError] = useState('');

  useEffect(() => {
    setNewLocationName(initialLocation?.label || '');
    setError('');
  }, [initialLocation, isOpen]);

  const handleSave = () => {
    setError('');
    if (newLocationName.trim() === '') {
      setError('Location name cannot be empty.');
      return;
    }

    const isDuplicate = existingLocations.some(
      (opt) =>
        opt.value.toLowerCase() !== initialLocation?.value.toLowerCase() &&
        opt.label.toLowerCase() === newLocationName.trim().toLowerCase()
    );

    if (isDuplicate) {
      setError('Location already exists.');
      return;
    }

    if (initialLocation && onUpdateLocation) {
      onUpdateLocation(initialLocation.value, newLocationName.trim());
    } else {
      onAddLocation(newLocationName.trim());
    }
    setNewLocationName('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialLocation ? 'Edit Location' : 'Add New Location'}
    >
      <div className="mb-4">
        <Input
          label="Location Name"
          placeholder="New Location Name"
          value={newLocationName}
          onChange={(e) => setNewLocationName(e.target.value)}
          fullWidth
          error={error}
        />
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave}>{initialLocation ? 'Update' : 'Save'}</Button>
      </div>
    </Modal>
  );
};

export default AddLocationModal;