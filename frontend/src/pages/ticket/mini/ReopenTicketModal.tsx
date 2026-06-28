import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Textarea } from '../../../components/ui/Textarea';
import Button from '../../../components/ui/Button';

interface ReopenTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isSubmitting: boolean;
}

export const ReopenTicketModal: React.FC<ReopenTicketModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (reason.trim()) {
      onSubmit(reason);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reopen Ticket">
      <div className="p-4">
        <Textarea
          id="reopen-reason"
          label="Reason for reopening"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Please provide a reason for reopening this ticket..."
          rows={4}
          required
          className="w-full"
        />
        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
          >
            {isSubmitting ? 'Submitting...' : 'Reopen Ticket'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
