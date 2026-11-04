import { useEffect } from 'react';
import { useCopilotStore } from '../../../stores/copilotStore';
import type { Ticket } from '../../../types';

/**
 * Keeps the global Copilot store's "active ticket" in sync with whichever
 * ticket is currently selected in the list, so Copilot panels elsewhere
 * in the app always reflect what the agent is looking at here.
 */
export const useCopilotActiveTicketSync = (selectedTicket: Ticket | null) => {
  const setCopilotActiveTicket = useCopilotStore((state) => state.setActiveTicket);

  useEffect(() => {
    if (!selectedTicket) {
      setCopilotActiveTicket(null);
      return;
    }

    setCopilotActiveTicket({
      id: Number(selectedTicket.id),
      ticketId: selectedTicket.ticket_id,
      title: selectedTicket.title,
      status: selectedTicket.status,
      priority: selectedTicket.priority,
      creatorName: selectedTicket.requester?.name,
      creatorEmail: selectedTicket.requester?.email,
      categoryName: typeof selectedTicket.category === 'string' ? selectedTicket.category : undefined,
      hasNewReply: selectedTicket.has_new_reply,
      breached: selectedTicket.breached,
      linkedTasksCount: selectedTicket.linked_tasks_count,
      commentsCount: selectedTicket.comments_count,
    });
  }, [selectedTicket, setCopilotActiveTicket]);
};
