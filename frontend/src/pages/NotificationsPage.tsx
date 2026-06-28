import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Inbox,
  Search,
  Ticket,
  CheckCircle,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  Clock
} from 'lucide-react';
import axios from 'axios';
import { APIS } from '../services/apis';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';

interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  notification_type: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  ticket?: {
    id: number;
    ticket_id: string;
    title: string;
    status: string;
    priority: string;
  } | null;
  task?: {
    id: number;
    task_trackid: string;
    title: string;
    task_status: string;
    priority: string;
  } | null;
}

type FilterType = 'all' | 'unread' | 'read';
type CategoryType = 'all' | 'tickets' | 'tasks' | 'mentions';
type SortType = 'newest' | 'oldest' | 'unread_first';

const ITEMS_PER_PAGE = 15;

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [category, setCategory] = useState<CategoryType>('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const token = localStorage.getItem('token') || localStorage.getItem('access_token');
      const response = await axios.get(APIS.NOTIFICATIONS_LIST, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const notificationsData = Array.isArray(response.data)
        ? response.data
        : (response.data?.results || response.data?.data || []);

      setNotifications(notificationsData);
      const unread = notificationsData.filter((n: Notification) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: number) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token');
      await axios.patch(
        `${APIS.NOTIFICATION_MARK_READ}${notificationId}/`,
        { is_read: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token');
      await axios.post(
        APIS.NOTIFICATION_MARK_ALL_READ,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      fetchNotifications(true);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    if (notification.task?.task_trackid) {
      navigate(`/task/${notification.task.task_trackid}`);
    } else if (notification.ticket?.ticket_id) {
      navigate(`/ticket/${notification.ticket.ticket_id}`);
    }
  };

  const filteredNotifications = notifications
    .filter((n) => {
      if (filter === 'unread') return !n.is_read;
      if (filter === 'read') return n.is_read;
      return true;
    })
    .filter((n) => {
      if (category === 'all') return true;
      if (category === 'tickets') {
        return n.notification_type.startsWith('ticket_') || n.notification_type.includes('sla_');
      }
      if (category === 'tasks') {
        return n.notification_type.startsWith('task_');
      }
      if (category === 'mentions') {
        return n.notification_type.includes('mention');
      }
      return true;
    })
    .filter((n) => {
      if (!searchQuery.trim()) return true;
      const searchLower = searchQuery.toLowerCase();
      return (
        n.message.toLowerCase().includes(searchLower) ||
        n.ticket?.title?.toLowerCase().includes(searchLower) ||
        n.task?.title?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'unread_first') {
        if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const totalPages = Math.ceil(filteredNotifications.length / ITEMS_PER_PAGE);
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, category, sortBy, searchQuery]);

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getPriorityColor = (priority: string | undefined) => {
    if (!priority) return 'text-[var(--text-muted)]';
    switch (priority.toLowerCase()) {
      case 'urgent':
      case 'high':
        return 'text-[var(--status-danger-text)]';
      case 'medium':
        return 'text-[var(--status-warning-text)]';
      case 'low':
        return 'text-[var(--status-info-text)]';
      default:
        return 'text-[var(--text-secondary)]';
    }
  };

  const getNotificationIcon = (type: string) => {
    if (type.includes('ticket')) return <Ticket className="w-5 h-5" />;
    if (type.includes('task')) return <CheckCircle className="w-5 h-5" />;
    if (type.includes('mention')) return <MessageSquare className="w-5 h-5" />;
    return <Bell className="w-5 h-5" />;
  };

  const getNotificationIconColor = (type: string, isRead: boolean) => {
    if (isRead) return 'bg-[var(--surface-muted)] text-[var(--text-muted)]';
    if (type.includes('ticket')) return 'bg-[var(--status-info-bg)] text-[var(--status-info-text)]';
    if (type.includes('task')) return 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]';
    return 'bg-[var(--surface-subtle)] text-primary-600';
  };

  const renderMessage = (notification: Notification) => {
    const type = (notification.notification_type || '').toLowerCase();
    const message = notification.message || '';

    if (!type.includes('mention')) {
      return <>{message}</>;
    }

    const actor =
      notification.metadata?.mentioned_by_display ||
      notification.metadata?.mentioned_by_name;

    if (actor) {
      const suffix = message.includes('mentioned you')
        ? message.substring(message.toLowerCase().indexOf('mentioned you'))
        : message;

      return (
        <>
          <span className="font-semibold text-primary-600">{actor}</span>
          {' '}
          <span>{suffix}</span>
        </>
      );
    }

    const match = message.match(/^(.*?)\s+(mentioned you.*)$/i);
    if (match) {
      return (
        <>
          <span className="font-semibold text-primary-600">{match[1]}</span>
          {' '}
          <span>{match[2]}</span>
        </>
      );
    }

    return <>{message}</>;
  };

  const FilterButton: React.FC<{
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    count?: number;
  }> = ({ active, onClick, children, count }) => (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 text-[length:var(--font-label)] font-medium rounded-lg transition-colors flex items-center gap-2
        ${active
          ? 'bg-[var(--status-info-bg)] text-[var(--status-info-text)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
        }
      `}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={`
          px-1.5 py-0.5 text-[length:var(--font-meta)] rounded-full
          ${active
            ? 'bg-primary-600 text-white'
            : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
          }
        `}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="w-full">
      {/* Header */}
      <div className="surface-card mb-6">
        <div className="p-6 border-b border-[var(--border-color)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[var(--surface-subtle)] flex items-center justify-center">
                <Bell className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h1
                  className="text-[length:var(--font-page-title)] leading-tight text-[var(--text-primary)]"
                  style={{ fontWeight: 'var(--font-weight-title)' }}
                >
                  Notifications
                </h1>
                <p
                  className="text-[length:var(--font-page-subtitle)] text-[var(--text-secondary)]"
                  style={{ fontWeight: 'var(--font-weight-body)' }}
                >
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNotifications(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAsRead}
                >
                  <CheckCheck className="w-4 h-4 mr-2" />
                  Mark all read
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--surface-muted)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[length:var(--font-label)] text-[var(--text-muted)] mr-2">Status:</span>
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </FilterButton>
            <FilterButton
              active={filter === 'unread'}
              onClick={() => setFilter('unread')}
              count={unreadCount}
            >
              Unread
            </FilterButton>
            <FilterButton active={filter === 'read'} onClick={() => setFilter('read')}>
              Read
            </FilterButton>

            <div className="w-px h-6 bg-[var(--border-color)] mx-2" />

            <span className="text-[length:var(--font-label)] text-[var(--text-muted)] mr-2">Type:</span>
            <FilterButton active={category === 'all'} onClick={() => setCategory('all')}>
              All
            </FilterButton>
            <FilterButton active={category === 'tickets'} onClick={() => setCategory('tickets')}>
              <Ticket className="w-3.5 h-3.5" />
              Tickets
            </FilterButton>
            <FilterButton active={category === 'tasks'} onClick={() => setCategory('tasks')}>
              <CheckCircle className="w-3.5 h-3.5" />
              Tasks
            </FilterButton>
            <FilterButton active={category === 'mentions'} onClick={() => setCategory('mentions')}>
              <MessageSquare className="w-3.5 h-3.5" />
              Mentions
            </FilterButton>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-[length:var(--font-label)] text-[var(--text-muted)]">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              className="text-[length:var(--font-label)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 bg-[var(--card-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="unread_first">Unread first</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="surface-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : paginatedNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
            <Inbox className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-[length:var(--font-body)] font-medium text-[var(--text-secondary)]">No notifications</p>
            <p className="text-[length:var(--font-label)] mt-1">
              {filter === 'unread' ? "You're all caught up!" : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-[var(--border-color)]">
              {paginatedNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    flex items-start gap-4 p-4 cursor-pointer transition-colors
                    ${!notification.is_read
                      ? 'bg-[var(--surface-subtle)] hover:bg-[var(--hover-bg)]'
                      : 'hover:bg-[var(--hover-bg)]'
                    }
                  `}
                >
                  {/* Icon */}
                  <div className={`
                    flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                    ${getNotificationIconColor(notification.notification_type, notification.is_read)}
                  `}>
                    {getNotificationIcon(notification.notification_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`
                      text-[length:var(--font-body)] leading-relaxed
                      ${notification.is_read
                        ? 'text-[var(--text-secondary)]'
                        : 'text-[var(--text-primary)] font-medium'
                      }
                    `}>
                      {renderMessage(notification)}
                    </p>

                    {(notification.ticket || notification.task) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {notification.ticket && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[length:var(--font-meta)]"
                            style={{
                              backgroundColor: 'var(--status-info-bg)',
                              color: 'var(--status-info-text)',
                            }}
                          >
                            <Ticket className="w-3 h-3" />
                            {notification.ticket.ticket_id}
                          </span>
                        )}
                        {notification.task && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[length:var(--font-meta)]"
                            style={{
                              backgroundColor: 'var(--status-neutral-bg)',
                              color: 'var(--status-neutral-text)',
                            }}
                          >
                            <CheckCircle className="w-3 h-3" />
                            {notification.task.task_trackid}
                          </span>
                        )}
                        {(notification.ticket?.priority || notification.task?.priority) && (
                          <span className={`text-[length:var(--font-meta)] font-medium ${getPriorityColor(notification.ticket?.priority || notification.task?.priority)}`}>
                            {notification.ticket?.priority || notification.task?.priority}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-2 text-[length:var(--font-meta)] text-[var(--text-muted)]">
                      <Clock className="w-3 h-3" />
                      {getTimeAgo(notification.created_at)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {!notification.is_read && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-600" title="Unread" />
                    )}
                    {!notification.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)] bg-[var(--surface-muted)]">
                <p className="text-[length:var(--font-meta)] text-[var(--text-muted)]">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredNotifications.length)} of {filteredNotifications.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[length:var(--font-meta)] text-[var(--text-secondary)] px-3">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-[var(--border-color)] hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
