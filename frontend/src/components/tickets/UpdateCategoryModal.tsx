import React, { useState, useEffect, useMemo } from 'react';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { successNotification, errorNotification } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import Select from '../ui/Select';
import Button from '../ui/Button';

interface UpdateCategoryModalProps {
  ticketId: string;
  currentCategory: string;
  departmentId?: number | null;
  isOpen: boolean;
  onClose: () => void;
  onCategoryUpdated: () => void;
}

const UpdateCategoryModal: React.FC<UpdateCategoryModalProps> = ({ 
  ticketId, 
  currentCategory,
  departmentId,
  isOpen, 
  onClose, 
  onCategoryUpdated 
}) => {
  const [categories, setCategories] = useState<Array<{id: number; name: string; department?: number | null}>>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await http.get(APIS.LIST_TICKET_CATEGORIES + '?pagination=no');
        const cats = response.data || response.data.results || [];
        setCategories(cats);
        
        // Set current category as selected
        const currentCat = cats.find((c: any) => c.name === currentCategory);
        if (currentCat) {
          setSelectedCategoryId(currentCat.id.toString());
        }
      } catch (error: any) {
        errorNotification(error?.response?.data?.message || 'Failed to fetch categories.');
      }
    };
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen, currentCategory]);

  const filteredCategories = useMemo(() => {
    if (!departmentId) return categories;
    return categories.filter(
      (cat) => cat.department == null || cat.department === departmentId
    );
  }, [categories, departmentId]);

  const handleUpdateCategory = async () => {
    if (!selectedCategoryId) {
      errorNotification('Please select a category.');
      return;
    }
    setIsSubmitting(true);
    try {
      // Some backends accept either category_id or category; send both for safety
      await http.put(`${APIS.TICKET_UPDATE_CATEGORY}/${ticketId}`, {
        category_id: Number(selectedCategoryId),
        category: Number.isNaN(Number(selectedCategoryId)) ? selectedCategoryId : undefined,
      });
      successNotification('Category updated successfully.');
      onCategoryUpdated();
      onClose();
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to update category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Category"
    >
      <p className="text-sm text-gray-500 dark:text-[var(--text-muted)] mb-4">Change the category of this ticket.</p>
      <div className="space-y-4">
        <Select
          id="category"
          label="Category"
          value={selectedCategoryId}
          onChange={setSelectedCategoryId}
          options={filteredCategories.map(cat => ({ value: cat.id.toString(), label: cat.name }))}
          placeholder="Select category..."
          className="w-full"
        />
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleUpdateCategory} disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default UpdateCategoryModal;
