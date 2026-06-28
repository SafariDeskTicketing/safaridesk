import React, { useState } from 'react';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { successNotification, errorNotification } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import { Textarea } from '../ui/Textarea';
import Button from '../ui/Button';

interface AddNoteModalProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
  onNoteAdded: () => void;
}

const AddNoteModal: React.FC<AddNoteModalProps> = ({ ticketId, isOpen, onClose, onNoteAdded }) => {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddNote = async () => {
    if (!note.trim()) {
      errorNotification('Note cannot be empty.');
      return;
    }
    setIsSubmitting(true);
    try {
      await http.post(`${APIS.TICKET_BASE}/${ticketId}/add-note/`, { note });
      successNotification('Note added successfully.');
      onNoteAdded();
      onClose();
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to add note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Note"
    >
      <p className="text-sm text-gray-500 dark:text-[var(--text-muted)] mb-4">Add an internal note to this ticket.</p>
      <div className="space-y-4">
        <Textarea
          id="note"
          label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Type your note here..."
          rows={4}
          className="w-full"
        />
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAddNote} disabled={isSubmitting}>
            {isSubmitting ? 'Adding...' : 'Add Note'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AddNoteModal;
