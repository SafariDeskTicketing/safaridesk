import { memo } from 'react';
import type { Ticket } from '../../../types';
import { formatUserDisplayName } from '../../../utils/displayHelpers';
import { NewBadge } from '../../../components/ui/NewBadge';
import LabelGroup from '../../../components/ui/LabelGroup';
import {
  formatCreatedDateForList,
  statusPillClass,
  priorityPillClass,
  statusLabel,
  LIST_GRID_COLS,
} from './ticketRowHelpers';

interface TicketRowProps {
  ticket: Ticket;
  isSelected: boolean;
  onRowClick: (ticket: Ticket) => void;
  onSelectionChange: (ticketId: Ticket['id'], selected: boolean) => void;
  onStatusClick: (ticket: Ticket) => void;
  onPriorityClick: (ticket: Ticket) => void;
  onDepartmentClick: (ticket: Ticket) => void;
  onAssigneeClick: (ticket: Ticket) => void;
  onTaskDialogOpen: (ticket: Ticket) => void;
  onPreviewEnter: (ticket: Ticket, element: HTMLElement) => void;
  onPreviewLeave: () => void;
}

const formatUserName = (user?: { firstName?: string; lastName?: string; email?: string; isActive?: boolean }) =>
  formatUserDisplayName(user, 'Unassigned');

export const TicketRow = memo(({
  ticket,
  isSelected,
  onRowClick,
  onSelectionChange,
  onStatusClick,
  onPriorityClick,
  onDepartmentClick,
  onAssigneeClick,
  onTaskDialogOpen,
  onPreviewEnter,
  onPreviewLeave,
}: TicketRowProps) => {
  const createdDate = formatCreatedDateForList(ticket.createdAt);
  const tasks = ticket.linked_tasks_count ?? 0;

  return (
    <div
      onClick={() => onRowClick(ticket)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onRowClick(ticket);
        }
      }}
      className={`${LIST_GRID_COLS} items-center text-[14px] bg-gray-50 dark:bg-surface-elevated hover:bg-gray-100 dark:hover:bg-surface-hover cursor-pointer transition-colors ${isSelected ? 'ring-1 ring-primary-400 bg-primary-50/70 dark:bg-primary-900/20' : ''
        }`}
    >
      <label className="flex items-center justify-center py-3 px-3 cursor-pointer" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelectionChange(ticket.id, e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary-400 focus:ring-primary-500"
        />
      </label>
      <div
        className="py-3 px-3 text-left truncate text-[length:var(--font-meta)] font-semibold tracking-wide text-primary-700 dark:text-primary-300"
        title={`#${ticket.ticket_id}`}
      >
        #{ticket.ticket_id}
      </div>
      <div className={`py-3 px-3 text-left text-gray-900 dark:text-[var(--text-primary)] ${(!ticket.is_opened || ticket.has_new_reply) ? 'font-bold' : 'font-normal'}`}>
        <div className="flex items-center gap-2">
          <div className="relative group min-w-0">
            <span
              className="block truncate text-[14px] leading-5"
              onMouseEnter={(e) => onPreviewEnter(ticket, e.currentTarget)}
              onMouseLeave={onPreviewLeave}
            >
              {ticket.title}
            </span>
          </div>
          {(!ticket.is_opened || ticket.has_new_reply) && <NewBadge />}
        </div>
        <LabelGroup labels={ticket.labels || []} size="table" maxVisible={3} className="mt-1" />
      </div>
      <div className="py-3 px-3 flex justify-center">
        <button
          className="focus:outline-none"
          onClick={(e) => {
            e.stopPropagation();
            onStatusClick(ticket);
          }}
        >
          <span className={statusPillClass(ticket.status)}>
            {statusLabel(ticket.status)}
          </span>
        </button>
      </div>
      <div className="py-3 px-3 flex justify-center">
        <button
          className="focus:outline-none"
          onClick={(e) => {
            e.stopPropagation();
            onPriorityClick(ticket);
          }}
        >
          <span className={priorityPillClass(ticket.priority)}>
            {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
          </span>
        </button>
      </div>
      <div className="py-3 px-3 text-left text-[14px] text-gray-700 dark:text-[var(--text-primary)]">
        <button
          className="w-full truncate text-left font-medium"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDepartmentClick(ticket);
          }}
        >
          {ticket.department?.name || '—'}
        </button>
      </div>
      <div className="py-3 px-3 text-left text-[14px] text-gray-700 dark:text-[var(--text-primary)]">
        <span className="block truncate font-medium">{formatUserName(ticket.requester)}</span>
      </div>
      <div className="py-3 px-3 text-left text-[14px] text-gray-700 dark:text-[var(--text-primary)]">
        <button
          className="w-full truncate text-left font-medium"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onAssigneeClick(ticket);
          }}
        >
          {formatUserName(ticket.assignee)}
        </button>
      </div>
      <div className="py-3 px-3 text-center whitespace-nowrap text-[14px] text-gray-700 dark:text-[var(--text-primary)]">
        <button
          className="w-full text-center font-medium"
          onClick={(e) => {
            e.stopPropagation();
            onTaskDialogOpen(ticket);
          }}
        >
          {createdDate}
        </button>
      </div>
      <div className="py-3 px-3 text-center whitespace-nowrap text-[14px] text-gray-900 dark:text-[var(--text-primary)]">
        <button
          className="w-full text-center font-semibold"
          onClick={(e) => {
            e.stopPropagation();
            onTaskDialogOpen(ticket);
          }}
        >
          {tasks}
        </button>
      </div>
    </div>
  );
});

TicketRow.displayName = 'TicketRow';
