import React, { useState } from 'react';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { successNotification, errorNotification } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import Select from '../ui/Select';
import Button from '../ui/Button';

interface UpdatePriorityModalProps {
  ticketId: string;
  currentPriority: string;
  isOpen: boolean;
  onClose: () => void;
  onPriorityUpdated: () => void;
}

const UpdatePriorityModal: React.FC<UpdatePriorityModalProps> = ({ 
  ticketId, 
  currentPriority, 
  isOpen, 
  onClose, 
  onPriorityUpdated 
}) => {
  const [selectedPriority, setSelectedPriority] = useState(currentPriority);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
    { value: 'urgent', label: 'Urgent' },
  ];

  const handleUpdatePriority = async () => {
    if (!selectedPriority) {
      errorNotification('Please select a priority.');
      return;
    }
    setIsSubmitting(true);
    try {
      await http.put(`${APIS.TICKET_UPDATE_PRIORITY}/${ticketId}`, {
        priority: selectedPriority,
      });
      successNotification('Priority updated successfully.');
      onPriorityUpdated();
      onClose();
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to update priority.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Priority"
    >
      <p className="text-sm text-gray-500 dark:text-[var(--text-muted)] mb-4">Change the priority of this ticket.</p>
      <div className="space-y-4">
        <Select
          id="priority"
          label="Priority"
          value={selectedPriority}
          onChange={setSelectedPriority}
          options={priorityOptions}
          placeholder="Select priority..."
          className="w-full"
        />
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleUpdatePriority} disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default UpdatePriorityModal;
