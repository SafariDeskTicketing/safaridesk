import React, { useEffect, useState } from 'react';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { successNotification, errorNotification } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import Select from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import Button from '../ui/Button';

interface UpdateStatusModalProps {
  ticketId: string;
  currentStatus: string;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated: () => void;
}

const UpdateStatusModal: React.FC<UpdateStatusModalProps> = ({ ticketId, currentStatus, isOpen, onClose, onStatusUpdated }) => {
  const [status, setStatus] = useState(currentStatus);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStatus(currentStatus);
      setNotes('');
    }
  }, [isOpen, currentStatus]);

  const handleUpdateStatus = async () => {
    setIsSubmitting(true);
    try {
      await http.put(`${APIS.TICKET_UPDATE_STATUS}/${ticketId}`, { status, notes });
      successNotification('Status updated successfully.');
      onStatusUpdated();
      onClose();
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to update status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const options = currentStatus === 'on_hold'
    ? [
        { value: "in_progress", label: "Unhold" },
        { value: "closed", label: "Closed" }
      ]
    : [
        { value: "in_progress", label: "In Progress" },
        { value: "on_hold", label: "Hold" },
        { value: "closed", label: "Closed" }
      ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Status"
    >
      <p className="text-sm text-gray-500 dark:text-[var(--text-muted)] mb-4">Update the status of this ticket.</p>
      <div className="space-y-4">
        <Select
          id="status"
          label="Status"
          value={status}
          onChange={setStatus}
          options={options}
          placeholder="Select a status..."
          className="w-full"
        />
        <Textarea
          id="notes"
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="w-full"
        />
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleUpdateStatus} disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default UpdateStatusModal;
