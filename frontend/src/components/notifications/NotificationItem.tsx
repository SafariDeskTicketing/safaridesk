import { useNavigate } from "react-router-dom";
import { formatTimestamp } from "../../utils/dates";
import type { Notification } from "../../types/notification";

const formatNotificationType = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const NotificationItem: React.FC<{
  notification: Notification;
  onMarkRead?: () => void;
}> = ({ notification, onMarkRead }) => {
  const navigate = useNavigate();

  const goToTicket = () => {
    // Handle task notifications
    if (notification.task?.task_trackid) {
      navigate(`/task/${notification.task.task_trackid}`);
    }
    // Handle ticket notifications
    else if (notification.ticket?.ticket_id) {
      navigate(`/ticket/${notification.ticket.ticket_id}`);
    }
  };

  const renderMessage = () => {
    const type = (notification.notification_type || '').toLowerCase();
    const message = notification.message || '';

    if (!type.includes('mention')) {
      return <>{message}</>;
    }

    const actor = notification.metadata?.mentioned_by_display || notification.metadata?.mentioned_by_name;
    if (actor) {
      const suffix = message.includes('mentioned you')
        ? message.substring(message.toLowerCase().indexOf('mentioned you'))
        : message;

      return (
        <>
          <span className="font-semibold text-primary-600 dark:text-primary-400">{actor}</span>
          {' '}
          <span>{suffix}</span>
        </>
      );
    }

    const match = message.match(/^(.*?)\s+(mentioned you.*)$/i);
    if (match) {
      return (
        <>
          <span className="font-semibold text-primary-600 dark:text-primary-400">{match[1]}</span>
          {' '}
          <span>{match[2]}</span>
        </>
      );
    }

    return <>{message}</>;
  };

  const priority = notification.ticket?.priority || notification.task?.priority;

  return (
    <div
      onClick={goToTicket}
      className={`relative cursor-pointer border-b border-[var(--border-color)] px-4 py-3 transition-colors group hover:bg-[var(--surface-subtle)] ${
        !notification.is_read ? "bg-[var(--card-bg)]" : ""
      }`}
    >
      {!notification.is_read && (
        <div className="absolute left-2.5 top-4.5 h-2 w-2 rounded-full bg-emerald-500"></div>
      )}

      <div className="ml-2.5 flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-start justify-between gap-2.5">
            <div className="mb-1 flex items-center">
              <span className="text-[length:var(--font-meta)] uppercase tracking-[0.05em] text-[var(--text-muted)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                {formatNotificationType(notification.notification_type || 'Notification')}
              </span>
            </div>
            {priority && (
              <span className="rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-2 py-0.5 text-[length:var(--font-meta)] capitalize text-[var(--status-info-text)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                {priority.toLowerCase()}
              </span>
            )}
          </div>

          <h4
            className="mb-1 text-[length:var(--font-body)] leading-6 text-[var(--text-primary)]"
            style={{ fontWeight: 'var(--font-weight-label)' }}
          >
            {notification.task?.title || notification.ticket?.title || "Untitled Notification"}
          </h4>

          <p className="line-clamp-2 text-[length:var(--font-body)] leading-6 text-[var(--text-secondary)]">
            {renderMessage()}
          </p>

          <div className="mt-2.5 flex items-center gap-3">
            <span className="block text-[length:var(--font-meta)] text-[var(--text-muted)]">
              {formatTimestamp(notification.created_at)}
            </span>

            {!notification.is_read && (
              <span
                onClick={(event) => {
                  event.stopPropagation();
                  onMarkRead?.();
                }}
                className="flex cursor-pointer items-center gap-1 text-[length:var(--font-meta)] text-primary-600 underline underline-offset-4"
                style={{ fontWeight: 'var(--font-weight-label)' }}
              >
                <span>Mark as read</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
