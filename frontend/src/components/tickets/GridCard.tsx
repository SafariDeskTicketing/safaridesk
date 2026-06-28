
import React, { useState } from 'react';
import { sanitizePreviewHTML } from '../../utils/sanitize';
import { format } from 'date-fns';
import AddNoteModal from './AddNoteModal';
import AssignTicketModal from './AssignTicketModal';
import UpdateStatusModal from './UpdateStatusModal';
import AddTagModal from './AddTagModal';
import UpdatePriorityModal from './UpdatePriorityModal';
import UpdateCategoryModal from './UpdateCategoryModal';
import {
  Clock,
  User,
  MoreVertical,
  MessageSquare,
  Paperclip,
  AlertTriangle,
  Tag,
  UserPlus,
  CheckSquare
} from 'lucide-react';
import type { Ticket } from '../../types';
import { Badge } from '../ui/Badge';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import { DropdownMenu, DropdownItem } from '../ui/Dropdown';
import { TaskListDialog } from './TaskListDialog';
import { NewBadge } from '../ui/NewBadge';
import { formatUserDisplayName } from '../../utils/displayHelpers';
import LabelGroup from '../ui/LabelGroup';

interface GridTicketCardProps {
  ticket: Ticket;
  openDropdownId: string | null;
  onDropdownToggle: (taskId: string) => void;
  onDropdownClose: () => void;
  onAction: (action: string, ticket: Ticket) => void;
  isActive: boolean;
  isSelected?: boolean;
  onSelectionChange?: (ticketId: string, selected: boolean) => void;
}

export const GridTicketCard: React.FC<GridTicketCardProps> = ({
  ticket,
  openDropdownId,
  onDropdownToggle,
  onDropdownClose,
  onAction,
  isActive,
  isSelected = false,
  onSelectionChange,
}) => {
  const navigate = useNavigate();
  const ticketDepartmentId = ticket.department
    ? (typeof ticket.department === 'number' ? ticket.department : ticket.department.id)
    : null;
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isUpdateStatusModalOpen, setIsUpdateStatusModalOpen] = useState(false);
  const [isAddTagModalOpen, setIsAddTagModalOpen] = useState(false);
  const [isUpdatePriorityModalOpen, setIsUpdatePriorityModalOpen] = useState(false);
  const [isUpdateCategoryModalOpen, setIsUpdateCategoryModalOpen] = useState(false);
  const [isTaskListDialogOpen, setIsTaskListDialogOpen] = useState(false);

  const getStatusVariant = () => {
    switch (ticket.status) {
      case 'created':
        return 'info';
      case 'assigned':
        return 'warning';
      case 'in_progress':
        return 'warning';
      case 'hold':
        return 'default';
      case 'closed':
        return 'success';
      default:
        return 'default';
    }
  };

  const getPriorityVariant = () => {
    switch (ticket.priority) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'default';
    }
  };

  const isOverdue = ticket.dueDate && new Date(ticket.dueDate) < new Date() && ticket.status !== 'closed';



  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation when clicking on dropdown menu or its trigger
    if ((e.target as HTMLElement).closest('.menu-trigger') ||
      (e.target as HTMLElement).closest('.dropdown-menu') ||
      (e.target as HTMLElement).closest('[data-dropdown]')) {
      return;
    }
    navigate(`/ticket/${ticket.ticket_id}`);
  };

  const isDropdownOpen = openDropdownId === ticket.id;

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when opening dropdown
    onDropdownToggle(ticket.id);
  };

  const handleAction = (action: string) => {
    if (action === 'add-note') {
      setIsAddNoteModalOpen(true);
    } else if (action === 'assign') {
      setIsAssignModalOpen(true);
    } else if (action === 'update-status') {
      setIsUpdateStatusModalOpen(true);
    } else if (action === 'add-tag') {
      setIsAddTagModalOpen(true);
    } else {
      onAction(action, ticket);
    }
    onDropdownClose(); // Close dropdown after action
  };

  const handleSelectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelectionChange?.(ticket.id, e.target.checked);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative z-10 flex h-full cursor-pointer flex-col rounded-[14px] border border-[var(--border-color)] bg-[var(--card-bg)] p-3.5 shadow-[var(--shell-shadow-sm)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[var(--shell-shadow-md)] ${isDropdownOpen ? '!z-50' : ''} ${isActive ? 'ring-2 ring-primary-500 border-primary-500' : ''} ${isSelected ? 'border-primary-400 ring-2 ring-primary-300' : ''} ${ticket.breached ? '' : 'bg-[var(--card-bg)]'}`}
      style={{
        overflow: 'visible',
        ...(ticket.breached
          ? { backgroundColor: 'var(--status-danger-bg)', borderColor: 'var(--status-danger-border)' }
          : {}),
      }}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 rounded-[14px] bg-gradient-to-br from-transparent to-gray-50/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:to-surface-elevated-30" />

      {/* Overdue indicator */}
      {isOverdue && (
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-t-[20px] border-t-red-500">
          <AlertTriangle size={12} className="absolute -top-4 -right-3 text-white" />
        </div>
      )}

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleSelectionChange}
              onClick={(e) => e.stopPropagation()}
              className="h-3.5 w-3.5 accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between items-center flex-1 min-w-0">
              <span className="flex-1 min-w-0">
                <h3 className="flex items-center gap-1 text-[length:var(--font-meta)] font-semibold tracking-wide text-primary-700 transition-colors dark:text-primary-300">
                  #{ticket.ticket_id}
                  {ticket.breached && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[length:var(--font-meta)] font-medium border"
                      style={{ backgroundColor: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', borderColor: 'var(--status-danger-border)' }}
                    >
                      Breached
                    </span>
                  )}
                  {ticket.is_merged && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[length:var(--font-meta)] font-medium border"
                      style={{ backgroundColor: 'var(--status-neutral-bg)', color: 'var(--status-neutral-text)', borderColor: 'var(--status-neutral-border)' }}
                    >
                      Merged{ticket.merged_into?.ticket_id ? ` → ${ticket.merged_into.ticket_id}` : ''}
                    </span>
                  )}
                </h3>
                <p className={`mt-1 truncate text-[15px] leading-5 text-gray-800 dark:text-[var(--text-primary)] flex items-center gap-2 ${!ticket.is_opened ? 'font-semibold' : 'font-medium'}`}>
                  {ticket.title}
                  {(!ticket.is_opened || ticket.has_new_reply) && <NewBadge />}
                </p>
                <LabelGroup labels={ticket.labels || []} maxVisible={3} className="mt-1" />
              </span>
              <span>
                <div
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); setIsUpdatePriorityModalOpen(true); }}
                  title="Click to edit priority"
                >
                  <Badge
                    variant={getPriorityVariant()}
                    size="sm"
                  >
                    {ticket.priority}
                  </Badge>
                </div>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-2">
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                icon={MoreVertical}
                onClick={handleDropdownToggle}
                className="menu-trigger opacity-0 group-hover:opacity-100 transition-opacity relative z-50"
                title="More options"
              />
              {isDropdownOpen && (
                <DropdownMenu isOpen={isDropdownOpen} onClose={onDropdownClose}>
                  <div data-dropdown className="dropdown-menu">
                    <div className="border-t border-gray-100 dark:border-subtle my-1"></div>
                    <DropdownItem icon={UserPlus} onClick={() => handleAction('assign')}>
                      Assign/Reassign
                    </DropdownItem>
                    <DropdownItem icon={Clock} onClick={() => handleAction('update-status')}>
                      Update Status
                    </DropdownItem>
                    <DropdownItem icon={Tag} onClick={() => handleAction('add-note')}>
                      Add Note
                    </DropdownItem>
                    <DropdownItem icon={MessageSquare} onClick={() => handleAction('add-tag')}>
                      Manage Labels
                    </DropdownItem>
                  </div>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div
          className="mb-3 line-clamp-2 text-[13px] leading-5 text-gray-600 dark:text-[var(--text-muted)]"
          dangerouslySetInnerHTML={{
            __html: sanitizePreviewHTML(
              ticket.description && ticket.description.length > 150
                ? ticket.description.substring(0, 150) + '...'
                : ticket.description || ''
            ),
          }}
        />

        {/* Status and Category */}
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge variant={getStatusVariant()} size="sm">
              {ticket.status.replace('_', ' ')}
            </Badge>

            <div className="flex items-center gap-2">
              <span
                className="bg-gray-100 dark:bg-surface-hover text-gray-700 dark:text-[var(--text-primary)] px-2.5 py-1 rounded-md text-[14px] font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-surface-hover transition-colors"
                onClick={(e) => { e.stopPropagation(); setIsUpdateCategoryModalOpen(true); }}
                title="Click to edit category"
              >
                {ticket.category}
              </span>
            </div>
          </div>

          {/* Attachments, Comments, Tasks and Activities indicators */}
          <div className="flex items-center space-x-3 text-gray-500 dark:text-[var(--text-muted)]">
            {((ticket.attachments_count ?? ticket.attachments.length) > 0) && (
              <div className="flex items-center space-x-1">
                <Paperclip size={12} />
              <span className="text-[14px]">{ticket.attachments_count ?? ticket.attachments.length}</span>
              </div>
            )}
            {((ticket.comments_count ?? ticket.comments.length) > 0) && (
              <div className="flex items-center space-x-1">
                <MessageSquare size={12} />
              <span className="text-[14px]">{ticket.comments_count ?? ticket.comments.length}</span>
              </div>
            )}
            {ticket.linked_tasks_count !== undefined && ticket.linked_tasks_count >= 0 && (
              <div
                className="flex items-center space-x-1 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                onClick={(e) => { e.stopPropagation(); setIsTaskListDialogOpen(true); }}
                title={`${ticket.linked_tasks_count} linked task${ticket.linked_tasks_count !== 1 ? 's' : ''} - click to view`}
              >
                <CheckSquare size={12} />
              <span className="text-[14px]">{ticket.linked_tasks_count}</span>
              </div>
            )}
            {ticket.unread_activity_count !== undefined && ticket.unread_activity_count > 0 && (
              <div className="flex items-center space-x-1 text-orange-500 dark:text-orange-400" title={`${ticket.unread_activity_count} unread activit${ticket.unread_activity_count !== 1 ? 'ies' : 'y'}`}>
                <div className="relative">
                  <MessageSquare size={12} />
                  <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-orange-500 text-[8px] font-bold text-white">
                    {ticket.unread_activity_count > 9 ? '9+' : ticket.unread_activity_count}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[13px] text-gray-500 dark:text-[var(--text-muted)]">
          <div className="flex items-center space-x-4">
            {ticket.assignee && (
              <div className="flex items-center space-x-1.5">
                <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  {ticket.assignee.avatar_url ? (
                    <img src={ticket.assignee.avatar_url} alt={ticket.assignee.firstName} className="w-4 h-4 rounded-full mr-1" />
                  ) : (
                    <User size={10} className="text-blue-600 dark:text-blue-400" />

                  )}
                </div>
                <span className="font-medium text-gray-600 dark:text-[var(--text-muted)]">
                  {formatUserDisplayName(ticket.assignee, 'Unassigned')}
                </span>
              </div>
            )}

            <div className="flex items-center space-x-1">
              <Clock size={12} />
              <span>Created {format(new Date(ticket.createdAt), 'MMM d, yyyy')}</span>
            </div>
          </div>

          <div className="text-[12px] font-semibold tracking-wide text-primary-700 dark:text-primary-300">
            #{ticket.ticket_id.split('-').pop()}
          </div>
        </div>

      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <AddNoteModal
          ticketId={ticket.id}
          isOpen={isAddNoteModalOpen}
          onClose={() => setIsAddNoteModalOpen(false)}
          onNoteAdded={() => {
            // Optionally, you can add a callback to refresh the ticket data
          }}
        />
        <AssignTicketModal
          ticketId={ticket.id}
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          onTicketAssigned={() => {
            // Optionally, you can add a callback to refresh the ticket data
          }}
          assignedAgentId={ticket.assignee ? Number(ticket.assignee.id) : undefined}
        />
        <UpdateStatusModal
          ticketId={ticket.id}
          currentStatus={ticket.status}
          isOpen={isUpdateStatusModalOpen}
          onClose={() => setIsUpdateStatusModalOpen(false)}
          onStatusUpdated={() => {
            // Optionally, you can add a callback to refresh the ticket data
          }}
        />
        <AddTagModal
          ticketId={ticket.id}
          isOpen={isAddTagModalOpen}
          onClose={() => setIsAddTagModalOpen(false)}
          selectedLabels={ticket.labels || []}
          onTagAdded={() => {
            // Parent list handles refresh when needed.
          }}
        />
        <UpdatePriorityModal
          ticketId={ticket.id}
          currentPriority={ticket.priority || 'medium'}
          isOpen={isUpdatePriorityModalOpen}
          onClose={() => setIsUpdatePriorityModalOpen(false)}
          onPriorityUpdated={() => {
            // Optionally refresh ticket data
          }}
        />
        <UpdateCategoryModal
          ticketId={ticket.id}
          currentCategory={ticket.category || ''}
          departmentId={ticketDepartmentId}
          isOpen={isUpdateCategoryModalOpen}
          onClose={() => setIsUpdateCategoryModalOpen(false)}
          onCategoryUpdated={() => {
            // Optionally refresh ticket data
          }}
        />
        <TaskListDialog
          ticketId={ticket.id}
          isOpen={isTaskListDialogOpen}
          onClose={() => setIsTaskListDialogOpen(false)}
        />
      </div>
    </div>
  );
};
