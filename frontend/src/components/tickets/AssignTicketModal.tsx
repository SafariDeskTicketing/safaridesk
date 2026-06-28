import React, { useState, useEffect } from 'react';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { successNotification, errorNotification } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import Select from '../ui/Select';
import Button from '../ui/Button';
import type { Agent } from '../../types';
import { getActiveAgents } from '../../services/agents';

interface AssignTicketModalProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
  onTicketAssigned: () => void;
  assignedAgentId?: number | null;
}

const AssignTicketModal: React.FC<AssignTicketModalProps> = ({ ticketId, isOpen, onClose, onTicketAssigned, assignedAgentId }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await http.get(`${APIS.LIST_AGENTS}?pagination=no`);
        setAgents(getActiveAgents(response.data));
      } catch (error: any) {
        errorNotification(error?.response?.data?.message || 'Failed to fetch agents.');
      }
    };
    if (isOpen) {
      fetchAgents();
    }
  }, [isOpen]);

  const handleAssignTicket = async () => {
    if (!selectedAgentId) {
      errorNotification('Please select an agent.');
      return;
    }
    
    // Defensive check: verify the selected agent is still active
    const selectedAgent = agents.find(a => a.id.toString() === selectedAgentId);
    if (!selectedAgent) {
      errorNotification('The selected agent is no longer available. This agent may have been deactivated or deleted. Please select a different agent.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await http.post(APIS.TICKET_ASSIGN, {
        ticket_id: ticketId,
        agent_id: selectedAgentId,
      });
      successNotification('Ticket assigned successfully.');
      onTicketAssigned();
      onClose();
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to assign ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Ticket"
    >
      <p className="text-sm text-gray-500 dark:text-[var(--text-muted)] mb-4">Assign this ticket to an agent.</p>
      <div className="space-y-4">
        <Select
          id="agent"
          label="Agent"
          value={selectedAgentId}
          onChange={setSelectedAgentId}
          options={agents
            .filter(agent => agent.id !== assignedAgentId)
            .map(agent => ({ value: agent.id.toString(), label: agent.name }))}
          placeholder="Select an agent..."
          className="w-full"
        />
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAssignTicket} disabled={isSubmitting}>
            {isSubmitting ? 'Assigning...' : 'Assign'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AssignTicketModal;
