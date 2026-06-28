import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AlertCircle, Bell, Menu, Moon, Search, Sparkles, Sun } from '../icons/AppIcons';
import { useQuery } from '@tanstack/react-query';
import { Header } from './Header';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { GlobalSearchModal } from '../GlobalSearch/GlobalSearchModal';
import AISupportModal from '../AISupportModal';
import { PageContainer } from './PageContainer';
import axios from 'axios';
import { APIS } from '../../services/apis';
import type { Notification } from '../../types/notification';
import { useNotificationSocket } from '../../services/notifications/sockets';
import { NotificationsDropdown } from '../notifications/NotificationsMenu';
import {
  LOCAL_NOTIFICATION_CREATED_EVENT,
  playNotificationSound,
  primeNotificationSound,
} from '../../utils/notificationSound';
import { useCopilotStore } from '../../stores/copilotStore';
import { fetchLicenseStatus } from '../../services/license';

export const Layout: React.FC = () => {
  const location = useLocation();
  const isFullHeightRoute = /^\/(tickets?|tasks?)(\/|$)/.test(location.pathname);
  const isDashboardRoute = /^\/dashboard(\/|$)/.test(location.pathname);
  const pageContainerWidth = isDashboardRoute ? 'wide' : 'default';
  const { isAuthenticated, user, fetchCurrentUserProfile } = useAuthStore();
  const { sidebarOpen, setSidebarOpen, theme, toggleTheme } = useUIStore();
  const { isOpen: showAISupportPanel, toggleOpen: toggleCopilot, setOpen: setCopilotOpen } = useCopilotStore();
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationButtonRef = useRef<HTMLDivElement>(null);
  const playedNotificationIdsRef = useRef<Set<number>>(new Set());
  const knownNotificationIdsRef = useRef<Set<number>>(new Set());
  const hasHydratedNotificationsRef = useRef(false);
  const { data: licenseStatus } = useQuery({
    queryKey: ['license-status'],
    queryFn: fetchLicenseStatus,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  const showLicenseWarning =
    user?.role?.toLowerCase() === 'admin' &&
    Boolean(licenseStatus?.license_warning);
  const licenseWarningText = licenseStatus?.license_violation
    ? 'License violation: this self-hosted enterprise installation has run without a valid license for 5 continuous days.'
    : 'This self-hosted enterprise installation is running without a valid license. Please update your license.';

  const unlockAudioContext = useCallback(() => {
    try {
      primeNotificationSound();
    } catch {
      // Ignore unlock errors; notifications should still function without sound.
    }
  }, []);

  const mergeNotifications = useCallback((incoming: Notification[]) => {
    setNotifications((prev) => {
      // prev first so incoming (fresher) always wins for the same id
      const merged = [...prev, ...incoming];
      const byId = new Map<number, Notification>();
      for (const item of merged) {
        byId.set(item.id, item);
      }
      return Array.from(byId.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, []);

  const shouldPlayAlert = useCallback((notification: Notification) => {
    const type = notification.notification_type?.toLowerCase() || '';
    // Task notifications always get a sound
    if (type.startsWith('task_')) return true;
    // Ticket notifications
    const message = notification.message?.toLowerCase() || '';
    const isTicketChannel = Boolean(notification.ticket) || type.includes('ticket');
    if (!isTicketChannel) return false;
    return (
      type.includes('created') ||
      type.includes('new') ||
      type.includes('assigned') ||
      type.includes('status') ||
      message.includes('ticket') ||
      message.includes('assigned to')
    );
  }, []);

  const handleIncomingNotification = useCallback((notification: Notification) => {
    mergeNotifications([notification]);
    setUnreadCount((prev) => prev + (notification.is_read ? 0 : 1));
    knownNotificationIdsRef.current.add(notification.id);

    if (playedNotificationIdsRef.current.has(notification.id)) {
      return;
    }
    playedNotificationIdsRef.current.add(notification.id);

    const priority =
      notification.ticket?.priority?.toLowerCase() ||
      (notification.metadata as Record<string, string> | null)?.priority?.toLowerCase() || '';
    const isUrgent = priority === 'urgent';
    if (shouldPlayAlert(notification)) {
      unlockAudioContext();
      void playNotificationSound(isUrgent ? 'urgent' : priority);
    }
  }, [mergeNotifications, shouldPlayAlert, unlockAudioContext]);

  const handleNotificationsList = useCallback((list: Notification[]) => {
    const incoming = list || [];

    if (!hasHydratedNotificationsRef.current) {
      incoming.forEach((n) => knownNotificationIdsRef.current.add(n.id));
      hasHydratedNotificationsRef.current = true;
    } else {
      const newlySeen = incoming.filter((n) => !knownNotificationIdsRef.current.has(n.id));
      newlySeen.forEach((n) => {
        knownNotificationIdsRef.current.add(n.id);
        if (playedNotificationIdsRef.current.has(n.id)) return;
        playedNotificationIdsRef.current.add(n.id);

        if (!n.is_read && shouldPlayAlert(n)) {
          const priority =
            n.ticket?.priority?.toLowerCase() ||
            (n.metadata as Record<string, string> | null)?.priority?.toLowerCase() || '';
          const isUrgent = priority === 'urgent';
          unlockAudioContext();
          void playNotificationSound(isUrgent ? 'urgent' : priority);
        }
      });
    }

    mergeNotifications(incoming);
    const count = incoming.filter((n) => !n.is_read).length;
    setUnreadCount(count);
  }, [mergeNotifications, shouldPlayAlert, unlockAudioContext]);

  const accessToken = localStorage.getItem('token') || localStorage.getItem('access_token');
  const {
    markOneAsRead,
  } = useNotificationSocket(
    accessToken,
    handleIncomingNotification,
    handleNotificationsList,
    setUnreadCount
  );

  const loadNotificationsFallback = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await axios.get(APIS.NOTIFICATIONS_LIST, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = Array.isArray(response.data)
        ? response.data
        : (response.data?.results || response.data?.data || []);
      handleNotificationsList(payload);
    } catch {
      // Keep websocket flow alive even if fallback HTTP fetch fails.
    }
  }, [accessToken, handleNotificationsList]);

  const markAllNotificationsAsRead = useCallback(async () => {
    if (!accessToken) return;
    // Optimistic update immediately so UI reflects the change without waiting for network
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await axios.post(
        APIS.NOTIFICATION_MARK_ALL_READ,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch {
      // Refresh from backend on failure to restore accurate state
      await loadNotificationsFallback();
    }
  }, [accessToken, loadNotificationsFallback]);

  useEffect(() => {
    // Fetch current user profile when user is authenticated
    // This ensures avatar and user data are fresh from backend, not just from JWT
    if (isAuthenticated) {
      fetchCurrentUserProfile();
    }
  }, [isAuthenticated, fetchCurrentUserProfile]);

  useEffect(() => {
    loadNotificationsFallback();
    // 8-second fallback poll so the bell stays fresh when WebSocket is unavailable
    const id = window.setInterval(loadNotificationsFallback, 8000);
    return () => window.clearInterval(id);
  }, [loadNotificationsFallback]);

  useEffect(() => {
    const handleLocalNotificationCreated = () => {
      void loadNotificationsFallback();
    };

    window.addEventListener(LOCAL_NOTIFICATION_CREATED_EVENT, handleLocalNotificationCreated);
    return () => {
      window.removeEventListener(LOCAL_NOTIFICATION_CREATED_EVENT, handleLocalNotificationCreated);
    };
  }, [loadNotificationsFallback]);

  useEffect(() => {
    const handleFirstInteraction = () => {
      unlockAudioContext();
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [unlockAudioContext]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationButtonRef.current && !notificationButtonRef.current.contains(target)) {
        setShowNotificationsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleGlobalSearchShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isEditable =
        target?.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT';

      if (isEditable) {
        return;
      }

      event.preventDefault();
      setShowGlobalSearch(true);
    };

    window.addEventListener('keydown', handleGlobalSearchShortcut);
    return () => window.removeEventListener('keydown', handleGlobalSearchShortcut);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--app-bg)]">
      <Header />
      <main className="relative flex-1 min-w-0 overflow-hidden bg-[var(--app-bg)]">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed left-4 top-4 z-40 rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white p-2 shadow-[var(--shell-shadow-sm)] lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5 text-[var(--text-secondary)] dark:text-[var(--text-primary)]" />
          </button>
        )}

        <div className="flex h-full flex-col bg-transparent">
          <header className="relative z-10 bg-[var(--surface-subtle)] backdrop-blur">
            <div className="relative mx-auto flex h-[var(--shell-topbar-height)] w-full max-w-none items-center px-[var(--shell-page-padding)]">
              {/* Search — centered in the topbar content area */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <button
                  onClick={() => setShowGlobalSearch(true)}
                  className="pointer-events-auto hidden h-[var(--shell-search-height)] w-[var(--shell-search-width)] items-center gap-2 rounded-[var(--shell-radius)] border border-[var(--shell-search-border)] bg-[var(--shell-field-bg)] px-3 text-left text-[length:var(--font-body)] text-[var(--text-muted)] shadow-[var(--shell-shadow-sm)] transition-colors hover:border-[var(--shell-search-border)] hover:bg-[var(--surface-muted)] sm:flex"
                >
                  <Search size={16} stroke={1.8} />
                  <span className="truncate">Search or go to...</span>
                  <span className="ml-auto inline-flex items-center rounded-[6px] border border-[var(--border-color)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[length:var(--font-meta)] font-medium tracking-wide text-[var(--text-secondary)]">
                    Ctrl K
                  </span>
                </button>
              </div>

              <div className="relative z-10 ml-auto flex items-center gap-[var(--shell-control-gap)]">
                <button
                  onClick={toggleTheme}
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--shell-radius)] border border-transparent text-[var(--text-secondary)] transition-colors hover:border-[var(--shell-nav-active-border)] hover:bg-[var(--shell-topbar-hover-bg)] hover:text-[var(--shell-nav-hover-text)] dark:text-[var(--text-primary)]"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <Sun size={18} stroke={1.8} /> : <Moon size={18} stroke={1.8} />}
                </button>

                <div className="relative" ref={notificationButtonRef}>
                  <button
                    onClick={() => {
                      setShowNotificationsMenu((prev) => {
                        const next = !prev;
                        if (next) {
                          void loadNotificationsFallback();
                        }
                        return next;
                      });
                    }}
                    className="relative flex h-8 w-8 items-center justify-center rounded-[var(--shell-radius)] border border-transparent text-[var(--text-secondary)] transition-colors hover:border-[var(--shell-nav-active-border)] hover:bg-[var(--shell-topbar-hover-bg)] hover:text-[var(--shell-nav-hover-text)] dark:text-[var(--text-primary)]"
                    aria-label="Notifications"
                  >
                    <Bell size={18} stroke={1.8} />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 h-4 min-w-[16px] rounded-full bg-red-600 px-1 text-center text-[11px] font-semibold leading-4 text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                  <NotificationsDropdown
                    isOpen={showNotificationsMenu}
                    onClose={() => setShowNotificationsMenu(false)}
                    notifications={notifications}
                    onMarkAllAsRead={async () => {
                      await markAllNotificationsAsRead();
                    }}
                    onMarkOneAsRead={async (id) => {
                      await markOneAsRead(id);
                      setNotifications((prev) =>
                        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
                      );
                      setUnreadCount((prev) => Math.max(0, prev - 1));
                      void loadNotificationsFallback();
                    }}
                    placement="right"
                  />
                </div>

                <button
                  onClick={toggleCopilot}
                  className="group rounded-[var(--shell-radius)] bg-[linear-gradient(90deg,hsl(var(--primary-300-hsl))_0%,hsl(var(--primary-500-hsl))_58%,var(--status-info-text)_100%)] p-px shadow-[var(--shell-shadow-sm)]"
                  aria-label="Ask AI"
                  aria-pressed={showAISupportPanel}
                >
                  <span className="flex h-[36px] items-center gap-2 rounded-[calc(var(--shell-radius)-2px)] bg-[var(--shell-field-bg)] px-3.5 text-[length:var(--font-button)] font-semibold text-[var(--text-primary)] transition-colors group-hover:bg-[var(--surface-subtle)] dark:bg-[var(--card-bg)] dark:group-hover:bg-[var(--surface-subtle)]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[var(--shell-nav-hover-bg)] text-[var(--shell-nav-active-text)]">
                      <Sparkles size={16} stroke={2} />
                    </span>
                    <span>Ask AI</span>
                  </span>
                </button>
              </div>
            </div>
          </header>

          {showLicenseWarning && (
            <div className="border-y border-amber-300 bg-amber-50 px-[var(--shell-page-padding)] py-2 text-amber-900 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-200">
              <div className="mx-auto flex w-full max-w-none items-center gap-2 text-[length:var(--font-body)]">
                <AlertCircle size={16} stroke={2} className="shrink-0" />
                <span>{licenseWarningText}</span>
              </div>
            </div>
          )}

          <div className="flex min-h-0 flex-1 bg-[var(--app-bg)]">
            <div className={`min-w-0 flex-1 bg-[var(--app-bg)] ${isFullHeightRoute ? 'overflow-hidden h-full' : 'overflow-y-auto'}`}>
              {isFullHeightRoute ? (
                <Outlet />
              ) : (
                <PageContainer width={pageContainerWidth}>
                  <Outlet />
                </PageContainer>
              )}
            </div>
            <AISupportModal
              isOpen={showAISupportPanel}
              onClose={() => setCopilotOpen(false)}
            />
          </div>
        </div>
      </main>

      <GlobalSearchModal
        isOpen={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
      />
    </div>
  );
};
