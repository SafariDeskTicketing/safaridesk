import React, { useState } from "react";
import { DropdownMenu, DropdownItem } from "./ui/Dropdown";
import Button from "./ui/Button";
import { Edit, Trash2, ChevronDown } from "lucide-react";
import ConfirmDeleteModal from "./ConfirmDeleteModal"; // Import the new modal

interface Option {
  value: string;
  label: string;
}

interface ManageOptionsDropdownProps {
  title: string;
  options: Option[];
  onEdit: (option: Option) => void;
  onDelete: (option: Option) => void;
  onAdd?: () => void; // New optional prop for adding
}

const ManageOptionsDropdown: React.FC<ManageOptionsDropdownProps> = ({
  title,
  options,
  onEdit,
  onDelete,
  onAdd,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [optionToDelete, setOptionToDelete] = useState<Option | null>(null);

  const handleDeleteClick = (option: Option) => {
    setOptionToDelete(option);
    setShowConfirmDeleteModal(true);
  };

  const confirmDelete = () => {
    if (optionToDelete) {
      onDelete(optionToDelete);
      setShowConfirmDeleteModal(false);
      setOptionToDelete(null);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        icon={ChevronDown}
      >
        Manage {title.endsWith('y') ? title.slice(0, -1) + 'ies' : title + 's'}
      </Button>
      <DropdownMenu isOpen={isOpen} onClose={() => setIsOpen(false)}>
        {onAdd && (
          <DropdownItem
            onClick={() => {
              onAdd();
              setIsOpen(false);
            }}
          >
            Add New {title}
          </DropdownItem>
        )}
        {options.length === 0 && !onAdd ? (
          <DropdownItem>No {title.toLowerCase()}s found</DropdownItem>
        ) : (
          options.map((option) => (
            <div
              key={option.value}
              className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover"
            >
              <span>{option.label}</span>
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Edit}
                  onClick={() => {
                    onEdit(option);
                    setIsOpen(false);
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => {
                    handleDeleteClick(option);
                    setIsOpen(false);
                  }}
                />
              </div>
            </div>
          ))
        )}
      </DropdownMenu>

      <ConfirmDeleteModal
        isOpen={showConfirmDeleteModal}
        onClose={() => setShowConfirmDeleteModal(false)}
        onConfirm={confirmDelete}
        title={`Delete ${title}`}
        message={`Are you sure you want to delete ${title.toLowerCase()} "${optionToDelete?.label}"? This action cannot be undone.`}
      />
    </div>
  );
};

export default ManageOptionsDropdown;