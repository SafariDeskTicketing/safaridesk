import { useRef, useState } from "react";
import { clsx } from "clsx";
import { useClickOutside } from "../../hooks/ClickOutside";
import { Bell, Loader2, ArrowRight } from "lucide-react";
import NotificationItem from "./NotificationItem";
import { Notification } from "../../types/notification";
import { useNavigate } from "react-router-dom";

export const NotificationsDropdown: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAllAsRead?: () => void;
  onMarkOneAsRead?: (id: number) => void;
  placement?: 'right' | 'left' | 'outside-right' | 'outside-left' | 'center';
}> = ({
  isOpen,
  onClose,
  notifications = [],
  onMarkAllAsRead,
  onMarkOneAsRead,
  placement = 'right',
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const navigate = useNavigate();
  useClickOutside(dropdownRef, onClose);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const DISPLAY_LIMIT = 5;
  const displayedNotifications = notifications.slice(0, DISPLAY_LIMIT);

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true);
    try {
      // Call the callback which uses HTTP API
      await onMarkAllAsRead?.();
    } finally {
      setMarkingAll(false);
    }
  };

  if (!isOpen) return null;

  const placementClasses = {
    right: 'right-0 mt-2',
    left: 'left-0 mt-2',
    'outside-right': 'left-full top-0 ml-2',
    'outside-left': 'right-full top-0 mr-2',
    center: 'left-1/2 top-full mt-2 -translate-x-1/2',
  }[placement];

  return (
    <div
      ref={dropdownRef}
      className={clsx(
        "absolute z-50 w-[340px] max-w-[min(94vw,340px)] overflow-hidden rounded-[14px] border border-[var(--border-color)] bg-[var(--card-bg)] shadow-[var(--shell-shadow-md)] animate-slide-down",
        placementClasses
      )}
    >
      {/* Header */}
      <div className="space-y-2 border-b border-[var(--border-color)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-title)' }}>
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-2 py-0.5 text-[length:var(--font-meta)] text-[var(--status-info-text)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                {unreadCount} new
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
            {notifications.length} total
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className={`text-[length:var(--font-meta)] ${
                markingAll
                  ? "cursor-not-allowed text-[var(--text-muted)]"
                  : "text-primary-600 hover:text-primary-700"
              }`}
              style={{ fontWeight: 'var(--font-weight-label)' }}
            >
              {markingAll ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="animate-spin w-3 h-3" />
                  <span>Marking...</span>
                </span>
              ) : (
                "Mark all read"
              )}
            </button>
          )}
        </div>
      </div>

      {/* Notifications list */}
      <div className="max-h-[396px] overflow-y-auto bg-[var(--card-bg)]">
        {notifications.length === 0 ? (
          <div className="p-6 text-center">
            <Bell
              className="mx-auto mb-3 text-[var(--text-muted)]"
              size={32}
            />
            <p className="text-[length:var(--font-body)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
              No notifications yet
            </p>
            <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
              We'll notify you when something happens
            </p>
          </div>
        ) : (
          // Sort notifications to show unread first, then by date (limited to DISPLAY_LIMIT)
          [...displayedNotifications]
            .sort((a, b) => {
              // Unread notifications first
              if (a.is_read !== b.is_read) {
                return a.is_read ? 1 : -1;
              }
              // Then sort by date (newest first)
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            })
            .map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={() => onMarkOneAsRead?.(notification.id)} 
              />
            ))
        )}
      </div>

      <div className="border-t border-[var(--border-color)] p-2.5">
        <button
          onClick={() => {
            navigate('/notifications');
            onClose();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--shell-radius)] px-3 py-2 text-[length:var(--font-label)] text-primary-600 transition-colors hover:bg-[var(--shell-nav-hover-bg)] hover:text-primary-700"
          style={{ fontWeight: 'var(--font-weight-label)' }}
          title="View all notifications"
        >
          Open notifications
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
