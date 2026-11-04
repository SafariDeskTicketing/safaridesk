import { createPortal } from 'react-dom';
import { Ticket as TicketIcon } from 'lucide-react';
import { HoverPreviewCard } from '../../../components/previews/HoverPreviewCard';
import { getSourceLabel, formatUserDisplayName } from '../../../utils/displayHelpers';
import { statusLabel } from './ticketRowHelpers';
import type { Ticket } from '../../../types';

interface TicketPreviewState {
  ticket: Ticket;
  anchorRect: DOMRect;
  placement: 'left' | 'right';
}

interface LatestComment {
  authorName?: string;
  authorAvatar?: string;
  createdAt?: string;
  content?: string;
}

interface TicketHoverPreviewProps {
  ticketPreview: TicketPreviewState | null;
  position: { left: number; top: number; arrowOffset: number } | null;
  latestComment: LatestComment | null;
  latestCommentLoading: boolean;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const formatPriorityLabel = (priority?: string | null): string => {
  if (!priority) return 'Normal';
  const value = priority.replace(/_/g, ' ').trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Normal';
};

const getDescriptionPreview = (description?: string | null, maxLength = 220): string => {
  if (!description) return 'No description provided';
  const text = description
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return 'No description provided';
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

export const TicketHoverPreview = ({
  ticketPreview,
  position,
  latestComment,
  latestCommentLoading,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: TicketHoverPreviewProps) => {
  if (typeof document === 'undefined' || !ticketPreview || !position) return null;

  return createPortal(
    <div
      className="fixed z-[10000]"
      style={{ left: position.left, top: position.top }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <HoverPreviewCard
        icon={TicketIcon}
        title={ticketPreview.ticket.title}
        subtitle={`Ticket #${ticketPreview.ticket.ticket_id}`}
        placement={ticketPreview.placement}
        arrowOffset={position.arrowOffset}
        onClose={onClose}
        summaryFields={[
          { label: 'Priority', value: formatPriorityLabel(ticketPreview.ticket.priority) },
          { label: 'Status', value: statusLabel(ticketPreview.ticket.status) },
          { label: 'Source', value: getSourceLabel(ticketPreview.ticket.source) },
        ]}
        description={getDescriptionPreview(ticketPreview.ticket.description, 280)}
        latestActivity={{
          label: 'Latest update',
          loading: latestCommentLoading,
          empty: !latestComment && !latestCommentLoading,
          emptyTitle: 'No recent activity',
          emptyDescription: 'The latest comment will appear here when activity exists.',
          authorName: latestComment?.authorName,
          authorAvatar: latestComment?.authorAvatar,
          createdAt: latestComment?.createdAt,
          content: latestComment?.content,
        }}
        detailFields={[
          { label: 'Requester', value: formatUserDisplayName(ticketPreview.ticket.requester, 'Unassigned') },
          { label: 'Assignee', value: ticketPreview.ticket.assignee ? formatUserDisplayName(ticketPreview.ticket.assignee, 'Unassigned') : 'Unassigned' },
          { label: 'Department', value: ticketPreview.ticket.department?.name || '—' },
          { label: 'Linked tasks', value: String(ticketPreview.ticket.linked_tasks_count ?? 0) },
        ]}
      />
    </div>,
    document.body
  );
};
