import React, { useState } from 'react';
import { sanitizePreviewHTML } from '../../utils/sanitize';
import {
  MoreVertical,
  MessageSquare,
  User,
  Calendar,
  AlertCircle,
  CheckCircle,
  Pause,
  Play,
  Clock,
  UserPlus,
  Tag,
  CheckSquare,
  Trash2
} from 'lucide-react';
import type { Ticket } from '../../types';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownItem } from '../ui/Dropdown';
import AddNoteModal from './AddNoteModal';
import AssignTicketModal from './AssignTicketModal';
import UpdateStatusModal from './UpdateStatusModal';
import AddTagModal from './AddTagModal';
import UpdatePriorityModal from './UpdatePriorityModal';
import UpdateCategoryModal from './UpdateCategoryModal';
import { TaskListDialog } from './TaskListDialog';
import { NewBadge } from '../ui/NewBadge';
import { formatUserDisplayName } from '../../utils/displayHelpers';
import LabelGroup from '../ui/LabelGroup';

interface TicketCardProps {
  ticket: Ticket;
  openDropdownId?: string | null;
  onDropdownToggle?: (taskId: string) => void;
  onDropdownClose?: () => void;
  onAction?: (action: string, ticket: Ticket) => void;
  onTicketUpdate?: (updatedTicket: Ticket) => void;
  isSelected?: boolean;
  onSelectionChange?: (ticketId: string, selected: boolean) => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  openDropdownId,
  onDropdownToggle,
  onDropdownClose,
  onAction,
  onTicketUpdate,
  isSelected = false,
  onSelectionChange
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

  // Priority configuration — uses design-system status tokens so dark mode just works
  const getPriorityConfig = (priority: string) => {
    const configs: Record<string, { icon: typeof AlertCircle; token: string; label: string }> = {
      urgent:  { icon: AlertCircle, token: 'danger',  label: 'Critical' },
      high:    { icon: AlertCircle, token: 'danger',  label: 'High'     },
      medium:  { icon: Clock,       token: 'warning', label: 'Medium'   },
      normal:  { icon: Clock,       token: 'info',    label: 'Normal'   },
      low:     { icon: Clock,       token: 'neutral', label: 'Low'      },
    };
    return configs[priority] ?? configs.medium;
  };

  // Status configuration — uses design-system status tokens so dark mode just works
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { icon: typeof Play; token: string; label: string }> = {
      open:        { icon: Play,         token: 'info',    label: 'Open'        },
      in_progress: { icon: Clock,        token: 'warning', label: 'In Progress' },
      pending:     { icon: Clock,        token: 'warning', label: 'Pending'     },
      on_hold:     { icon: Pause,        token: 'neutral', label: 'On Hold'     },
      hold:        { icon: Pause,        token: 'neutral', label: 'On Hold'     },
      resolved:    { icon: CheckCircle,  token: 'success', label: 'Resolved'    },
      closed:      { icon: CheckCircle,  token: 'success', label: 'Closed'      },
    };
    return configs[status] ?? configs.open;
  };

  const priorityConfig = getPriorityConfig(ticket.priority || 'medium');
  const statusConfig = getStatusConfig(ticket.status || 'open');
  const PriorityIcon = priorityConfig.icon as typeof AlertCircle;

  const priorityStyle = {
    backgroundColor: `var(--status-${priorityConfig.token}-bg)`,
    borderColor: `var(--status-${priorityConfig.token}-border)`,
    color: `var(--status-${priorityConfig.token}-text)`,
  } as React.CSSProperties;

  const statusDotStyle = {
    backgroundColor: `var(--status-${statusConfig.token}-text)`,
  } as React.CSSProperties;

  const statusTextStyle = {
    color: `var(--status-${statusConfig.token}-text)`,
  } as React.CSSProperties;

  const isDropdownOpen = openDropdownId === ticket.id;

  const handleCardClick = () => {
    navigate(`/ticket/${ticket.ticket_id}`);
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDropdownToggle) {
      onDropdownToggle(ticket.id);
    }
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
    } else if (onAction) {
      onAction(action, ticket);
    }
    if (onDropdownClose) {
      onDropdownClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleCardClick();
    }
  };

  // Safe date formatting without date-fns
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  // Helper to get assignee display name
  const getAssigneeDisplay = () => formatUserDisplayName(ticket.assignee);

  return (
    <div
      className="h-full flex flex-col relative rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] shadow-[var(--shell-shadow-sm)] hover:shadow-[var(--shell-shadow-md)] transition-all duration-200 group mb-3 p-4"
      style={ticket.breached ? { backgroundColor: 'var(--status-danger-bg)', borderColor: 'var(--status-danger-border)' } : undefined}
    >
      {/* Header Section: Checkbox, Priority, Ticket ID, Title, Actions */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Selection Checkbox */}
          <div className="flex-shrink-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onSelectionChange?.(ticket.id, e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 dark:bg-surface-hover dark:border-subtle rounded focus:ring-blue-500 focus:ring-2"
              aria-label={`Select ticket ${ticket.ticket_id}`}
            />
          </div>

          {/* Priority Indicator */}
          <div className="flex-shrink-0">
            <div
              className="p-1.5 rounded-md border"
              style={priorityStyle}
              title={`Priority: ${priorityConfig.label}`}
            >
              <PriorityIcon size={12} style={{ color: priorityStyle.color }} />
            </div>
          </div>

          {/* Ticket ID and Title */}
          <div className="flex-1 min-w-0">
            <button
              className="text-left w-full"
              onClick={handleCardClick}
              onKeyDown={handleKeyPress}
            >
              <div className="flex items-center gap-1">
                <span className="text-blue-600 font-semibold text-sm hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors">
                  #{ticket.ticket_id}
                </span>
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
              </div>
              <div className={`text-gray-900 dark:text-[var(--text-primary)] text-sm truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors mt-0.5 flex items-center gap-2 ${!ticket.is_opened ? 'font-bold' : 'font-medium'}`}>
                {ticket.title}
                {ticket.has_new_reply && <NewBadge />}
              </div>
              <LabelGroup labels={ticket.labels || []} maxVisible={3} className="mt-1" />
            </button>
          </div>
        </div>

        {/* Actions Menu */}
        {onDropdownToggle && onDropdownClose && (
          <div className="relative flex-shrink-0">
            <button
              onClick={handleDropdownToggle}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-surface-hover rounded opacity-0 group-hover:opacity-100 transition-all duration-200"
              aria-label="Ticket actions"
            >
              <MoreVertical size={14} className="text-gray-400 dark:text-[var(--text-muted)]" />
            </button>

            {isDropdownOpen && (
              <DropdownMenu isOpen={isDropdownOpen} onClose={onDropdownClose}>
                <div data-dropdown className="dropdown-menu">
                  <DropdownItem icon={UserPlus} onClick={() => handleAction('assign')}>
                    Assign Ticket
                  </DropdownItem>
                  <DropdownItem icon={Clock} onClick={() => handleAction('update-status')}>
                    Update Status
                  </DropdownItem>
                  <DropdownItem icon={Tag} onClick={() => handleAction('add-tag')}>
                    Manage Labels
                  </DropdownItem>
                  <DropdownItem icon={MessageSquare} onClick={() => handleAction('add-note')}>
                    Add Note
                  </DropdownItem>
                  <div className="border-t border-gray-100 my-1"></div>
                  <DropdownItem icon={Trash2} onClick={() => handleAction('delete')} variant="danger">
                    Delete Ticket
                  </DropdownItem>
                </div>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      {/* Description (optional) */}
      {ticket.description && (
        <div
          className="text-gray-600 dark:text-[var(--text-muted)] text-[14px] mb-3"
          dangerouslySetInnerHTML={{ __html: sanitizePreviewHTML(ticket.description || '') }}
        />
      )}

      {/* Details Section: Status, Requester, Assignee, Created Date, Comments */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-2 text-sm">
        {/* Status */}
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full mr-2" style={statusDotStyle}></div>
          <span className="font-medium text-[length:var(--font-meta)]" style={statusTextStyle}>{statusConfig.label}</span>
        </div>

        {/* Priority */}
        <div className="flex items-center">
          <PriorityIcon size={14} className="mr-2" style={{ color: priorityStyle.color }} />
          <span className="font-medium text-[length:var(--font-meta)]" style={{ color: priorityStyle.color }}>{priorityConfig.label}</span>
        </div>

        {/* Requester */}
        <div className="flex items-center text-gray-600 dark:text-[var(--text-muted)]">
          <User size={14} className="mr-2 text-gray-500 dark:text-[var(--text-muted)]" />
          <span className="truncate">
            <span className="font-semibold">Created By:</span> {ticket.requester ? `${ticket.requester.firstName} ${ticket.requester.lastName}` : 'No Requester'}
          </span>
        </div>

        {/* Assignee */}
        <div className="flex items-center text-gray-600 dark:text-[var(--text-muted)]">
          {ticket.assignee?.avatar_url ? (
            <img src={ticket.assignee.avatar_url} alt={ticket.assignee.firstName} className="w-4 h-4 rounded-full mr-1" />
          ) : (
            <UserPlus size={14} className="mr-2 text-gray-500 dark:text-[var(--text-muted)]" />
          )}
          <span className="truncate">
            <span className="font-semibold">Assigned To:</span> {getAssigneeDisplay()}
          </span>
        </div>

        {/* Created Date */}
        <div className="flex items-center text-gray-600 dark:text-[var(--text-muted)]">
          <Calendar size={14} className="mr-2 text-gray-500 dark:text-[var(--text-muted)]" />
          <span>{formatDate(ticket.createdAt)}</span>
        </div>

        {/* Category */}
        <div className="flex items-center text-gray-600 dark:text-[var(--text-muted)]">
          <Tag size={14} className="mr-2 text-gray-500 dark:text-[var(--text-muted)]" />
          <span
            className="truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            onClick={(e) => { e.stopPropagation(); setIsUpdateCategoryModalOpen(true); }}
            title="Click to edit category"
          >
            {ticket.category || 'No Category'}
          </span>
        </div>

        {/* Comments Count */}
        {((ticket.comments_count ?? ticket.comments?.length ?? 0) > 0) && (
          <div className="flex items-center text-blue-600 dark:text-blue-400">
            <MessageSquare size={14} className="mr-2" />
            <span className="font-medium">{ticket.comments_count ?? ticket.comments.length} Comments</span>
          </div>
        )}

        {/* Tasks Count */}
        {ticket.linked_tasks_count !== undefined && ticket.linked_tasks_count >= 0 && (
          <div
            className="flex items-center text-primary-600 dark:text-primary-400 cursor-pointer hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            onClick={(e) => { e.stopPropagation(); setIsTaskListDialogOpen(true); }}
            title="Click to view linked tasks"
          >
            <CheckSquare size={14} className="mr-2" />
            <span className="font-medium">
              Linked Tasks: {ticket.linked_tasks_count}
            </span>
          </div>
        )}

        {/* Unread Activity Count */}
        {ticket.unread_activity_count !== undefined && ticket.unread_activity_count > 0 && (
          <div className="flex items-center text-orange-600 dark:text-orange-400">
            <div className="relative">
              <MessageSquare size={14} className="mr-2" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                {ticket.unread_activity_count > 9 ? '9+' : ticket.unread_activity_count}
              </span>
            </div>
            <span className="font-medium ml-1">{ticket.unread_activity_count} Unread</span>
          </div>
        )}
      </div>
      <div onClick={(e) => e.stopPropagation()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); } }}>
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
          onTagAdded={(labels) => {
            if (onTicketUpdate && labels) {
              onTicketUpdate({
                ...ticket,
                labels,
                tags: labels.map((label) => label.name),
              });
            }
          }}
        />
        <UpdatePriorityModal
          ticketId={ticket.id}
          currentPriority={ticket.priority || 'medium'}
          isOpen={isUpdatePriorityModalOpen}
          onClose={() => setIsUpdatePriorityModalOpen(false)}
          onPriorityUpdated={() => {
            if (onTicketUpdate) {
              onTicketUpdate({ ...ticket, priority: ticket.priority });
            }
          }}
        />
        <UpdateCategoryModal
          ticketId={ticket.id}
          currentCategory={ticket.category || ''}
          departmentId={ticketDepartmentId}
          isOpen={isUpdateCategoryModalOpen}
          onClose={() => setIsUpdateCategoryModalOpen(false)}
          onCategoryUpdated={() => {
            if (onTicketUpdate) {
              onTicketUpdate({ ...ticket, category: ticket.category });
            }
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
