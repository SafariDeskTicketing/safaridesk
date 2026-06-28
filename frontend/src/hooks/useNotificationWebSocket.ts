import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { WS_NOTIFICATIONS_URL } from '../utils/base';

interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  notification_type: string;
  metadata: {
    comment_id?: number;
    mentioned_by?: number;
    mentioned_by_name?: string;
    [key: string]: unknown;
  };
  ticket: {
    id: number;
    ticket_id: string;
    title: string;
    status: string;
    priority: string;
  };
}

interface UseNotificationWebSocketReturn {
  isConnected: boolean;
  lastNotification: Notification | null;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
}

export const useNotificationWebSocket = (): UseNotificationWebSocketReturn => {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const { user } = useAuthStore();

  const [isConnected, setIsConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState<Notification | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected');

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    if (!user) {
      setConnectionStatus('disconnected');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');

    const wsUrl = WS_NOTIFICATIONS_URL;

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;

        const pingInterval = setInterval(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          } else {
            clearInterval(pingInterval);
          }
        }, 30000);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connection_established' || data.type === 'pong') return;

          if (data.notification_type === 'ticket_mention' || data.type === 'notification_message') {
            setLastNotification(data);

            if ('Notification' in window && Notification.permission === 'default') {
              Notification.requestPermission();
            }
            if ('Notification' in window && Notification.permission === 'granted') {
              showBrowserNotification(data);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onerror = () => {
        setConnectionStatus('error');
      };

      ws.current.onclose = (event) => {
        setIsConnected(false);
        setConnectionStatus('disconnected');

        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeout.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          setConnectionStatus('error');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionStatus('error');
    }
  }, [user]);

  const showBrowserNotification = (notification: Notification) => {
    try {
      const options: NotificationOptions = {
        body: notification.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `notification-${notification.id}`,
        requireInteraction: false,
        data: {
          notificationId: notification.id,
          ticketId: notification.ticket?.id,
          url: `/ticket/${notification.ticket?.id}`,
        },
      };

      const browserNotification = new Notification(
        `${notification.ticket?.ticket_id} - New Mention`,
        options
      );

      browserNotification.onclick = () => {
        window.focus();
        window.location.href = `/ticket/${notification.ticket?.id}`;
        browserNotification.close();
      };

      setTimeout(() => browserNotification.close(), 10000);
    } catch (error) {
      console.error('Error showing browser notification:', error);
    }
  };

  useEffect(() => {
    if (user) connect();

    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (ws.current) ws.current.close();
    };
  }, [connect, user]);

  return { isConnected, lastNotification, connectionStatus };
};
