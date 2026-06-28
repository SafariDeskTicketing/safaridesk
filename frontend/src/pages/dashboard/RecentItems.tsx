import { formatDistanceToNowStrict } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import type { TaskItem, TicketItem } from '../../types';

const ticketStatusClasses: Record<string, string> = {
  open: 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]',
  in_progress: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
  reopened: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
  resolved: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]',
  closed: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]',
};

const taskStatusClasses: Record<string, string> = {
  open: 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]',
  in_progress: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
  resolved: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]',
  closed: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]',
};

const fallbackStatusClass = 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]';

const formatDueLabel = (value?: string | null) => {
  if (!value) {
    return 'Recent';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recent';
  }

  const now = new Date();
  const suffix = date.getTime() < now.getTime() ? 'ago' : '';
  const distance = formatDistanceToNowStrict(date);
  return suffix ? `Due ${distance} ${suffix}` : `Due ${distance}`;
};

const getInitials = (name?: string | null) =>
  (name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

type BaseRecentCardProps = {
  title: string;
  status: string;
  createdBy?: string | null;
  assignedTo?: string | null;
  dueDate?: string | null;
  onClick: () => void;
  statusTone: Record<string, string>;
};

const BaseRecentCard: React.FC<BaseRecentCardProps> = ({
  title,
  status,
  createdBy,
  assignedTo,
  dueDate,
  onClick,
  statusTone,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-3.5 text-left shadow-[var(--shell-shadow-sm)] transition-colors hover:border-[var(--shell-search-border)] hover:bg-[var(--surface-subtle)]"
  >
    <div className="flex items-start justify-between gap-3">
      <span
        className={`inline-flex rounded-full border px-2 py-0.5 text-[12px] font-medium capitalize ${statusTone[status] || fallbackStatusClass}`}
      >
        {status.replace('_', ' ')}
      </span>
      <span className="whitespace-nowrap text-[length:var(--font-meta)] text-[var(--text-secondary)]">
        {formatDueLabel(dueDate)}
      </span>
    </div>

    <h3 className="mt-3 line-clamp-2 text-[length:var(--font-body)] font-semibold text-[var(--text-primary)]">
      {title}
    </h3>

    <div className="mt-3 flex items-center justify-between gap-4 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
      <span className="min-w-0 truncate">Created By: {createdBy || 'System'}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        {assignedTo ? (
          <>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--status-info-text)] text-[10px] font-semibold text-white">
              {getInitials(assignedTo)}
            </span>
            <span className="max-w-[112px] truncate">{assignedTo}</span>
          </>
        ) : (
          <span className="text-[var(--text-muted)]">Unassigned</span>
        )}
      </span>
    </div>
  </button>
);

type TicketItemCardProps = {
  item: TicketItem;
};

export const RecentTicketItemCard: React.FC<TicketItemCardProps> = ({ item }) => {
  const navigate = useNavigate();

  return (
    <BaseRecentCard
      title={item.title}
      status={item.status}
      createdBy={item.creator_name}
      assignedTo={item.assigned_to}
      dueDate={item.due_date ?? item.created_at}
      onClick={() => navigate(`/ticket/${item.ticket_id}`)}
      statusTone={ticketStatusClasses}
    />
  );
};

type TaskItemCardProps = {
  item: TaskItem;
};

export const RecentTaskItemCard: React.FC<TaskItemCardProps> = ({ item }) => {
  const navigate = useNavigate();

  return (
    <BaseRecentCard
      title={item.title}
      status={item.status}
      createdBy={item.creator_name}
      assignedTo={item.assigned_to}
      dueDate={item.due_date ?? item.created_at}
      onClick={() => navigate(`/task/${item.task_id}`)}
      statusTone={taskStatusClasses}
    />
  );
};
