import { useEffect, useRef, useCallback } from "react";
import { Notification } from "../../types/notification";
import { SOCKET_URL } from "../../utils/base";
import { APIS } from "../apis";

type Callback = (notification: Notification) => void;
export const useNotificationSocket = (
  token: string | null | undefined,
  onMessage: Callback,
  onNotificationsList?: (list: Notification[]) => void,
  onUnreadCountUpdate?: (count: number) => void,
  onUnreadNotificationsList?: (list: Notification[]) => void
) => {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!token) return;

    // Close existing connection if any
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(`${SOCKET_URL}?token=${token}`);
      socketRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        ws.send(JSON.stringify({ type: "get_notifications" }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "notification_message":
            case "new_notification":
            case "notification": {
              const incoming = data.notification || data.data || data;
              if (incoming?.id) {
                onMessage(incoming);
              }
              break;
            }
            case "connection_established":
              break;
            case "unread_count_update":
            case "unread_count":
              onUnreadCountUpdate?.(data.count);
              if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({ type: "get_notifications" }));
              }
              break;
            case "notifications_list":
              onNotificationsList?.(data.notifications);
              break;
            case "unread_notifications_list":
              onUnreadNotificationsList?.(data.notifications);
              break;
            case "ticket_event":
              window.dispatchEvent(new CustomEvent("ticket_event", { detail: data }));
              break;
            case "task_event":
              window.dispatchEvent(new CustomEvent("task_event", { detail: data }));
              break;
            case "contact_event":
              window.dispatchEvent(new CustomEvent("contact_event", { detail: data }));
              break;
            case "request_event":
              window.dispatchEvent(new CustomEvent("request_event", { detail: data }));
              break;
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        socketRef.current = null;

        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
    }
  }, [token, onMessage, onNotificationsList, onUnreadCountUpdate, onUnreadNotificationsList]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const authHeaders = useCallback(() => ({
    "Authorization": `Bearer ${token}`,
    "X-CLIENT-DOMAIN": localStorage.getItem("subdomain") || "default",
    "Content-Type": "application/json",
  }), [token]);

  const requestNotifications = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "get_notifications" }));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch(APIS.NOTIFICATION_MARK_ALL_READ, {
        method: "POST",
        headers: authHeaders(),
      });
      if (response.ok) {
        requestNotifications();
      } else {
        console.error("Failed to mark all as read:", response.statusText);
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  }, [authHeaders, requestNotifications]);

  const markOneAsRead = useCallback(async (id: number) => {
    try {
      const response = await fetch(`${APIS.NOTIFICATION_MARK_READ}${id}/`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ is_read: true }),
      });
      if (response.ok) {
        requestNotifications();
      } else {
        console.error("Failed to mark notification as read:", response.statusText);
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }, [authHeaders, requestNotifications]);

  return {
    socketRef,
    requestNotifications,
    markAllAsRead,
    markOneAsRead,
    isConnected: socketRef.current?.readyState === WebSocket.OPEN,
  };
};
