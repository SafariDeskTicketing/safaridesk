import React, { useState } from 'react';
import Button from '/home/habert/safari/safarifront/src/components/ui/Button';
import { Input } from '/home/habert/safari/safarifront/src/components/ui/Input';
import { Label } 
from '/home/habert/safari/safarifront/src/components/ui/Label';
import { X, PlusCircle } from 'lucide-react';
import { Modal } from '/home/habert/safari/safarifront/src/components/ui/Modal';

interface Option {
  value: string;
  label: string;
}

interface ManageOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: Option[];
  setOptions: React.Dispatch<React.SetStateAction<Option[]>>;
}

const ManageOptionsModal: React.FC<ManageOptionsModalProps> = ({
  isOpen,
  onClose,
  title,
  options,
  setOptions,
}) => {
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Option | null>(null);

  const handleAddItem = () => {
    setError('');
    if (newItem.trim() === '') {
      setError(`${title.slice(0, -1)} name cannot be empty.`);
      return;
    }
    if (options.some(opt => opt.value.toLowerCase() === newItem.trim().toLowerCase())) {
      setError(`${title.slice(0, -1)} already exists.`);
      return;
    }
    setOptions((prev) => [...prev, { value: newItem.trim(), label: newItem.trim() }]);
    setNewItem('');
  };

  const handleRemoveItemClick = (item: Option) => {
    setItemToDelete(item);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = () => {
    if (itemToDelete) {
      setOptions((prev) => prev.filter(opt => opt.value !== itemToDelete.value));
      setItemToDelete(null);
      setShowConfirmModal(false);
    }
  };

  const handleCancelDelete = () => {
    setItemToDelete(null);
    setShowConfirmModal(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage ${title}`}
    >
      <div className="flex space-x-2 mb-2">
        <Input
          placeholder={`New ${title.slice(0, -1)} Name`}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          fullWidth
          error={error}
        />
        <Button onClick={handleAddItem} icon={PlusCircle}>Add</Button>
      </div>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2 border rounded-md p-2 bg-gray-50 dark:bg-surface-hover">
        {options.length === 0 ? (
          <p className="text-gray-500 dark:text-[var(--text-primary)] text-sm">No {title.toLowerCase()} added yet.</p>
        ) : (
          options.map((opt) => (
            <div key={opt.value} className="flex justify-between items-center bg-white dark:bg-surface-elevated p-2 rounded-md shadow-sm">
              <span className="text-gray-900 dark:text-[var(--text-primary)]">{opt.label}</span>
              
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={showConfirmModal}
        onClose={handleCancelDelete}
        title="Confirm Deletion"
      >
        <p className="text-gray-700 dark:text-[var(--text-primary)] mb-4">
          Are you sure you want to delete "{itemToDelete?.label}"? This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleCancelDelete}>Cancel</Button>
          <Button variant="danger" onClick={handleConfirmDelete}>Delete</Button>
        </div>
      </Modal>
    </Modal>
  );
};

export default ManageOptionsModal;