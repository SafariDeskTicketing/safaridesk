import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCategory: (categoryName: string) => void;
  onUpdateCategory?: (id: string, newName: string) => void; // New prop for updating
  initialCategory?: { value: string; label: string }; // New prop for initial value
  existingCategories: Array<{ value: string; label: string }>;
}

const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  isOpen,
  onClose,
  onAddCategory,
  onUpdateCategory,
  initialCategory,
  existingCategories,
}) => {
  const [newCategoryName, setNewCategoryName] = useState(initialCategory?.label || '');
  const [error, setError] = useState('');

  useEffect(() => {
    setNewCategoryName(initialCategory?.label || '');
    setError('');
  }, [initialCategory, isOpen]);

  const handleSave = () => {
    setError('');
    if (newCategoryName.trim() === '') {
      setError('Category name cannot be empty.');
      return;
    }

    // Check for duplicates, excluding the current category if editing
    const isDuplicate = existingCategories.some(
      (opt) =>
        opt.value.toLowerCase() !== initialCategory?.value.toLowerCase() &&
        opt.label.toLowerCase() === newCategoryName.trim().toLowerCase()
    );

    if (isDuplicate) {
      setError('Category already exists.');
      return;
    }

    if (initialCategory && onUpdateCategory) {
      onUpdateCategory(initialCategory.value, newCategoryName.trim());
    } else {
      onAddCategory(newCategoryName.trim());
    }
    setNewCategoryName('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialCategory ? "Edit Category" : "Add New Category"}
    >
      <div className="mb-4">
        <Input
          label="Category Name"
          placeholder="New Category Name"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          fullWidth
          error={error}
        />
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave}>{initialCategory ? "Update" : "Save"}</Button>
      </div>
    </Modal>
  );
};

export default AddCategoryModal;