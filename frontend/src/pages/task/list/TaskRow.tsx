import { memo } from 'react';
import type { TaskObj } from '../../../types';
import { formatUserDisplayName, getStatusColor, getPriorityColor, formatDateWithTime } from '../../../utils/displayHelpers';
import LabelGroup from '../../../components/ui/LabelGroup';

interface TaskRowProps {
  task: TaskObj;
  isSelected: boolean;
  gridColsClassName: string;
  onRowClick: (task: TaskObj) => void;
  onSelectionChange: (taskId: number, selected: boolean) => void;
  onStatusClick: (task: TaskObj) => void;
  onPriorityClick: (task: TaskObj) => void;
  onAssigneeClick: (task: TaskObj) => void;
  onPreviewEnter: (task: TaskObj, element: HTMLElement) => void;
  onPreviewLeave: () => void;
}

export const TaskRow = memo(({
  task,
  isSelected,
  gridColsClassName,
  onRowClick,
  onSelectionChange,
  onStatusClick,
  onPriorityClick,
  onAssigneeClick,
  onPreviewEnter,
  onPreviewLeave,
}: TaskRowProps) => {
  const due = formatDateWithTime(task.due_date);

  return (
    // No role attribute by design: this row contains real interactive
    // descendants (checkbox, status/priority/assignee controls), and ARIA
    // forbids an interactive widget role (button/link) on an element with
    // focusable children - that's the exact bug this fixed. tabIndex +
    // onKeyDown keep it keyboard-activatable without a misleading role.
    <div
      onClick={() => onRowClick(task)}
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
          onRowClick(task);
        }
      }}
      className={`${gridColsClassName} items-center text-[14px] bg-gray-50 dark:bg-surface-elevated hover:bg-gray-100 dark:hover:bg-surface-hover cursor-pointer transition-colors`}
    >
      <label className="flex items-center justify-center py-3 px-3 cursor-pointer" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelectionChange(task.id, e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      </label>
      <div className="py-3 px-3 text-left whitespace-nowrap text-[length:var(--font-meta)] font-semibold tracking-wide text-primary-700 dark:text-primary-300">
        #{task.task_trackid}
      </div>
      <div className="py-3 px-3 text-left text-gray-900 dark:text-[var(--text-primary)]">
        <div className="relative group min-w-0">
          <span
            className="block truncate text-[14px] font-medium leading-5"
            onMouseEnter={(e) => onPreviewEnter(task, e.currentTarget)}
            onMouseLeave={onPreviewLeave}
          >
            {task.title}
          </span>
        </div>
      </div>
      <div className="py-3 px-3 text-left text-[14px] text-gray-900 dark:text-[var(--text-primary)]">
        <LabelGroup labels={task.labels || []} size="table" maxVisible={3} emptyText="—" />
      </div>
      <div className="py-3 px-3 flex justify-center">
        <button
          className="focus:outline-none"
          onClick={(e) => {
            e.stopPropagation();
            onStatusClick(task);
          }}
        >
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[14px] font-semibold border ${getStatusColor(task.task_status)}`}>
            {task.task_status.replace('_', ' ')}
          </span>
        </button>
      </div>
      <div className="py-3 px-3 flex justify-center">
        <button
          className="focus:outline-none"
          onClick={(e) => {
            e.stopPropagation();
            onPriorityClick(task);
          }}
        >
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[14px] font-semibold border ${getPriorityColor(task.priority)}`}>
            {task.priority}
          </span>
        </button>
      </div>
      <div className="py-3 px-3 text-left text-[14px] text-gray-700 dark:text-[var(--text-primary)]">
        <span className="block truncate font-medium">{task.department?.name || '—'}</span>
      </div>
      <div className="py-3 px-3 text-left text-[14px] text-gray-700 dark:text-[var(--text-primary)]">
        <button
          className="w-full truncate text-left font-medium"
          onClick={(e) => {
            e.stopPropagation();
            onAssigneeClick(task);
          }}
        >
          {formatUserDisplayName(task.assigned_to, 'Unassigned')}
        </button>
      </div>
      <div className="py-3 px-3 text-center text-[14px] text-gray-700 dark:text-[var(--text-primary)] truncate">
        {due}
      </div>
    </div>
  );
});

TaskRow.displayName = 'TaskRow';
