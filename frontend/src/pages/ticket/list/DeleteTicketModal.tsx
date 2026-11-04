import { Modal } from '../../../components/ui/Modal';

interface DeleteTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  ticketDisplayId?: string;
  isTrash: boolean;
}

export const DeleteTicketModal = ({
  isOpen,
  onClose,
  onConfirm,
  ticketDisplayId,
  isTrash,
}: DeleteTicketModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isTrash ? 'Delete Forever' : 'Delete Ticket'}
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-gray-700 dark:text-[var(--text-primary)]">
          Are you sure you want to delete ticket <strong>#{ticketDisplayId}</strong>?
        </p>
        <p className="text-[length:var(--font-body)] text-[var(--text-muted)]">
          {isTrash
            ? 'This action cannot be undone. The ticket will be permanently removed.'
            : 'This action cannot be undone. The ticket will be moved to trash.'}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-2.5 py-1.5 border border-gray-300 dark:border-subtle rounded-lg text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {isTrash ? 'Delete Forever' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
