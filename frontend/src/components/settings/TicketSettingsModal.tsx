import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import Button from '../ui/Button';
import { Input } from '../ui/Input';
import { Save, Loader2 } from 'lucide-react';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { successNotification, errorNotification } from '../ui/Toast';

interface TicketConfig {
  id_format: string;
  title_format: string;
}

interface TicketSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TicketSettingsModal: React.FC<TicketSettingsModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<TicketConfig>({
    id_format: 'ITK-{YYYY}-{####}',
    title_format: '{summary}',
  });

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await http.get(`${APIS.TICKET_BASE}/get_config/`);
      setConfig({
        id_format: response.data?.id_format || 'ITK-{YYYY}-{####}',
        title_format: response.data?.title_format || '{summary}',
      });
    } catch (error: unknown) {
      console.error('Failed to fetch ticket config:', error);
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status !== 403) {
        errorNotification('Failed to load settings');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await http.post(`${APIS.TICKET_BASE}/update_config/`, {
        id_format: config.id_format,
        title_format: config.title_format,
      });
      successNotification('Ticket settings saved successfully');
      onClose();
    } catch (error: unknown) {
      console.error('Failed to save ticket config:', error);
      const axiosError = error as { response?: { data?: { error?: string } } };
      errorNotification(axiosError.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Ticket Settings" size="lg">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ticket Settings" size="lg">
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        {/* ID Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
            Ticket ID Format
          </label>
          <Input
            value={config.id_format}
            onChange={(e) => setConfig({ ...config, id_format: e.target.value })}
            placeholder="ITK-{YYYY}-{####}"
          />
          <p className="text-xs text-gray-500 mt-1">
            Example: ITK-2025-0001. {`{YYYY}`} is the year, {`{####}`} is the next number. You can change the letters at the start.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
            Ticket Title Format
          </label>
          <Input
            value={config.title_format}
            onChange={(e) => setConfig({ ...config, title_format: e.target.value })}
            placeholder="{summary}"
          />
          <p className="text-xs text-gray-500 mt-1">
            Tokens: {`{summary}`}, {`{ticket_id}`}, {`{source}`}, {`{YYYY}`}, {`{YY}`}, {`{MM}`}, {`{DD}`}.
            Example: {`{ticket_id} - {summary}`}.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-subtle">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
};

export default TicketSettingsModal;
