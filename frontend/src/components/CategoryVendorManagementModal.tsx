import React, { useState } from 'react';
import Button from './ui/Button';
import { Card } from './ui/Card';
import { Modal } from './ui/Modal';
import { X } from 'lucide-react';
import ManageOptionsModal from './ManageOptionsModal';

interface Option {
  value: string;
  label: string;
}

interface CategoryVendorManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Option[];
  setCategories: React.Dispatch<React.SetStateAction<Option[]>>;
  vendors: Option[];
  setVendors: React.Dispatch<React.SetStateAction<Option[]>>;
}

const CategoryVendorManagementModal: React.FC<CategoryVendorManagementModalProps> = ({
  isOpen,
  onClose,
  categories,
  setCategories,
  vendors,
  setVendors,
}) => {
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Categories & Vendors"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Categories Section */}
        <Card muted className="flex flex-col items-center justify-center p-6 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)] mb-4">Categories</h3>
          <Button onClick={() => setShowCategoryModal(true)} className="w-full">Manage Categories</Button>
        </Card>

        {/* Vendors Section */}
        <Card muted className="flex flex-col items-center justify-center p-6 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 dark:text-[var(--text-primary)] mb-4">Vendors</h3>
          <Button onClick={() => setShowVendorModal(true)} className="w-full">Manage Vendors</Button>
        </Card>
      </div>

      {/* Nested Modals */}
      <ManageOptionsModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Categories"
        options={categories}
        setOptions={setCategories}
      />

      <ManageOptionsModal
        isOpen={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        title="Vendors"
        options={vendors}
        setOptions={setVendors}
      />
    </Modal>
  );
};

export default CategoryVendorManagementModal;
