import React from 'react';
import ManageLabelsModal from '../labels/ManageLabelsModal';
import type { LabelItem } from '../../types';

interface AddTagModalProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
  onTagAdded: (labels?: LabelItem[]) => void;
  selectedLabels?: LabelItem[];
}

const AddTagModal: React.FC<AddTagModalProps> = ({
  ticketId,
  isOpen,
  onClose,
  onTagAdded,
  selectedLabels = [],
}) => {
  return (
    <ManageLabelsModal
      entityType="ticket"
      entityId={ticketId}
      isOpen={isOpen}
      onClose={onClose}
      selectedLabels={selectedLabels}
      onSaved={(labels) => onTagAdded(labels)}
      title="Manage Labels"
    />
  );
};

export default AddTagModal;
