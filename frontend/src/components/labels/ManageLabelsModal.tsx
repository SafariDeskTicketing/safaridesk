import React from 'react';
import Button from '../ui/Button';
import LabelPicker from '../ui/LabelPicker';
import { Modal } from '../ui/Modal';
import { APIS } from '../../services/apis';
import http from '../../services/http';
import { errorNotification, successNotification } from '../ui/Toast';
import type { LabelItem } from '../../types';

interface ManageLabelsModalProps {
  entityType: 'ticket' | 'task';
  entityId: number | string;
  isOpen: boolean;
  onClose: () => void;
  selectedLabels: LabelItem[];
  onSaved: (labels: LabelItem[]) => void;
  title?: string;
}

const ManageLabelsModal: React.FC<ManageLabelsModalProps> = ({
  entityType,
  entityId,
  isOpen,
  onClose,
  selectedLabels,
  onSaved,
  title = 'Manage Labels',
}) => {
  const [availableLabels, setAvailableLabels] = React.useState<LabelItem[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = React.useState<number[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchLabels = async () => {
      setLoading(true);
      try {
        const response = await http.get(APIS.LABELS_BASE, {
          params: {
            pagination: 'no',
            active_only: true,
          },
        });
        if (!mounted) return;
        const payload = response.data?.results || response.data || [];
        setAvailableLabels(payload);
        setSelectedLabelIds(selectedLabels.map((label) => label.id));
      } catch (error: any) {
        errorNotification(error?.response?.data?.message || 'Failed to load labels');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchLabels();
    return () => {
      mounted = false;
    };
  }, [isOpen, selectedLabels]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const endpoint =
        entityType === 'ticket'
          ? `${APIS.TICKET_UPDATE_LABELS}/${entityId}`
          : `${APIS.TASK_UPDATE_LABELS}/${entityId}/`;

      const response = await http.put(endpoint, { label_ids: selectedLabelIds });
      const labels = response.data?.labels || [];
      onSaved(labels);
      successNotification('Labels updated successfully');
      onClose();
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to update labels');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      {loading ? (
        <p className="text-sm text-gray-500 dark:text-[var(--text-muted)]">Loading labels...</p>
      ) : (
        <div className="space-y-4">
          <LabelPicker
            availableLabels={availableLabels}
            selectedLabelIds={selectedLabelIds}
            selectedLabels={selectedLabels}
            onChange={setSelectedLabelIds}
            helperText="Choose from the shared label catalog."
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save labels
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ManageLabelsModal;
