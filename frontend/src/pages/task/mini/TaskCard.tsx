import React from 'react';
import { sanitizePreviewHTML } from '../../../utils/sanitize';
import { Calendar, User, AlertCircle, MoreVertical, UserPlus, Clock, MessageSquare, Paperclip, Tag, Trash2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { DropdownMenu, DropdownItem } from '../../../components/ui/Dropdown';
import type { TaskObj } from '../../../types';
import { Badge } from '../../../components/ui/Badge';
import { useNavigate } from 'react-router-dom';
import LabelGroup from '../../../components/ui/LabelGroup';
import { getTaskRoute } from '../../../utils/taskRoutes';


interface TaskCardProps {
  task: TaskObj;
  isTrashView?: boolean;
  openDropdownId: number | null;
  onDropdownToggle: (taskId: number) => void;
  onDropdownClose: () => void;
  onAction: (action: string, task: TaskObj) => void;
  formatDate: (dateString: string) => string;
  getStatusVariant: (status: string) => 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  getDueDateStatus: (dueDate: string) => 'overdue' | 'due-soon' | 'upcoming' | 'normal' | 'none';
  isSelected?: boolean;
  onSelectionChange?: (taskId: number, selected: boolean) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isTrashView = false,
  openDropdownId,
  onDropdownToggle,
  onDropdownClose,
  onAction,
  formatDate,
  getStatusVariant,
  getDueDateStatus,
  isSelected = false,
  onSelectionChange
}) => {
  const navigate = useNavigate();
  const dueDateStatus = getDueDateStatus(task.due_date);
  const isOverdue = dueDateStatus === 'overdue';

  const isDropdownOpen = openDropdownId === task.id;

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDropdownToggle(task.id);
  };

  const handleAction = (action: string) => {
    onAction(action, task);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.menu-trigger') || 
        (e.target as HTMLElement).closest('.dropdown-menu') ||
        (e.target as HTMLElement).closest('[data-dropdown]')) {
      return;
    }
    const route = getTaskRoute(task);
    if (route) navigate(route);
  };

  const handleSelectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelectionChange?.(task.id, e.target.checked);
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`group relative z-10 flex h-full cursor-pointer flex-col rounded-[14px] border border-[var(--border-color)] bg-white p-3.5 shadow-[var(--shell-shadow-sm)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[var(--shell-shadow-md)] dark:bg-surface-elevated ${isSelected ? 'border-blue-400 ring-2 ring-blue-300' : ''}`}
      style={{ overflow: 'visible' }}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 rounded-[14px] bg-gradient-to-br from-transparent to-gray-50/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:to-surface-elevated-30" />
      
      {/* Overdue indicator */}
      {isOverdue && (
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-t-[20px] border-t-red-500">
          <AlertCircle size={12} className="absolute -top-4 -right-3 text-white" />
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
                <h3 className="flex items-center gap-1 text-[length:var(--font-meta)] font-semibold tracking-wide text-primary-700 dark:text-primary-300">
                  #{task.task_trackid}
                </h3>
                <p className="mt-1 truncate text-[15px] font-medium leading-5 text-gray-800 dark:text-[var(--text-primary)]">
                  {task.title}
                </p>
                <LabelGroup labels={task.labels || []} maxVisible={3} className="mt-1" />
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
                    <DropdownItem icon={Tag} onClick={() => handleAction('manage-labels')}>
                      Manage Labels
                    </DropdownItem>
                    <DropdownItem icon={MessageSquare} onClick={() => handleAction('attach-ticket')}>
                      Attach to ticket
                    </DropdownItem>
                    <DropdownItem icon={Paperclip} onClick={() => handleAction('attach-file')}>
                      Attach File
                    </DropdownItem>
                    {isTrashView && (
                      <DropdownItem icon={Clock} onClick={() => handleAction('restore')}>
                        Restore
                      </DropdownItem>
                    )}
                    <div className="border-t border-gray-100 dark:border-subtle my-1"></div>
                    <DropdownItem icon={Trash2} onClick={() => handleAction('delete')} variant="danger">
                      {isTrashView ? 'Delete Forever' : 'Move to Trash'}
                    </DropdownItem>
                  </div>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div
          className="mb-3 line-clamp-2 text-[length:var(--font-meta)] leading-5 text-gray-600 dark:text-[var(--text-muted)]"
          dangerouslySetInnerHTML={{
            __html: sanitizePreviewHTML(
              task.description && task.description.length > 150
                ? task.description.substring(0, 150) + '...'
                : task.description || ''
            ),
          }}
        />

        {/* Status and Linked Status */}
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge variant={getStatusVariant(task.task_status || 'todo')}>
              {task.task_status ? task.task_status.replace('_', ' ').toUpperCase() : 'TO DO'}
            </Badge>
            
            <div className="flex items-center gap-2">
              <span 
                className="bg-gray-100 dark:bg-surface-hover text-gray-700 dark:text-[var(--text-primary)] px-2.5 py-1 rounded-md text-[length:var(--font-meta)] font-medium"
              >
                {task.linked_ticket ? `#${task.linked_ticket.ticket_id}` : 'Not Linked'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[13px] text-gray-500 dark:text-[var(--text-muted)]">
          <div className="flex items-center space-x-4">
            {task.assigned_to && (
              <div className="flex items-center space-x-1.5">
                <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <User size={10} className="text-blue-600 dark:text-blue-400" />
                </div>
                <span className="font-medium text-gray-600 dark:text-[var(--text-muted)]">
                  {task.assigned_to.name}
                </span>
              </div>
            )}
            
            <div className="flex items-center space-x-1">
              <Calendar size={12} />
              <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                {isOverdue ? 'Overdue: ' : 'Due: '}{formatDate(task.due_date)}
              </span>
            </div>
          </div>

          <div className="text-[12px] font-semibold tracking-wide text-primary-700 dark:text-primary-300">
            #{task.task_trackid.split('-').pop()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
