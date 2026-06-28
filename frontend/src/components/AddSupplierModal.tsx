import React, { useState, useEffect } from "react";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import Button from "./ui/Button";
import { Label } from "./ui/Label";

interface AddSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSupplier: (name: string) => void;
  onUpdateSupplier: (id: string, name: string) => void;
  initialSupplier?: { value: string; label: string };
  existingSuppliers: Array<{ value: string; label: string }>;
}

const AddSupplierModal: React.FC<AddSupplierModalProps> = ({
  isOpen,
  onClose,
  onAddSupplier,
  onUpdateSupplier,
  initialSupplier,
  existingSuppliers,
}) => {
  const [supplierName, setSupplierName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialSupplier) {
      setSupplierName(initialSupplier.label);
    } else {
      setSupplierName("");
    }
    setError("");
  }, [isOpen, initialSupplier]);

  const handleSubmit = () => {
    if (!supplierName.trim()) {
      setError("Supplier name cannot be empty.");
      return;
    }
    if (
      existingSuppliers.some(
        (sup) =>
          sup.label.toLowerCase() === supplierName.trim().toLowerCase() &&
          sup.value !== initialSupplier?.value,
      )
    ) {
      setError("Supplier with this name already exists.");
      return;
    }

    if (initialSupplier) {
      onUpdateSupplier(initialSupplier.value, supplierName.trim());
    } else {
      onAddSupplier(supplierName.trim());
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialSupplier ? "Edit Supplier" : "Add New Supplier"}
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="supplierName">Supplier Name</Label>
          <Input
            id="supplierName"
            type="text"
            value={supplierName}
            onChange={(e) => {
              setSupplierName(e.target.value);
              setError("");
            }}
            placeholder="e.g., Dell"
            fullWidth
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {initialSupplier ? "Update" : "Add"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AddSupplierModal;
