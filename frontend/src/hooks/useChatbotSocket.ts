import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHAT_WS_BASE } from '../utils/base';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type ContactRequest = {
  fields: string[];
  invalid?: Record<string, string>;
};

export type ChatSocketOptions = {
  businessId: number | string | null | undefined;
  mode?: 'customer' | 'staff';
  token?: string | null;
  host?: string; // e.g., window.location.hostname
  port?: number; // explicitly force a port (defaults to current origin port)
};

export const useChatbotSocket = ({ businessId, mode = 'customer', token }: ChatSocketOptions) => {
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contactRequest, setContactRequest] = useState<ContactRequest | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const url = useMemo(() => {
    if (!businessId) return null;
    // CHAT_WS_BASE is e.g. "ws://localhost:8101"
    return `${CHAT_WS_BASE}/ws/chat/${businessId}/${mode}/`.replace(/\/$/, '');
  }, [businessId, mode]);

  // Token rides as a WebSocket subprotocol, not a query param — a query
  // string gets written to nginx access logs in plaintext, a header does not.
  const protocols = useMemo<string[] | undefined>(
    () => (mode === 'staff' && token ? ['access_token', token] : undefined),
    [mode, token],
  );

  const sendMessage = useCallback((content: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: 'message', content }));
    setMessages(prev => [...prev, { role: 'user', content }]);
  }, []);

  const sendContactInfo = useCallback((contact: { name?: string; email?: string; phone?: string }) => {
    const parts: string[] = [];
    if (contact.name) parts.push(`Name: ${contact.name}`);
    if (contact.email) parts.push(`Email: ${contact.email}`);
    if (contact.phone) parts.push(`Phone: ${contact.phone}`);
    if (!parts.length) return;
    const text = `Here are my contact details. ${parts.join(', ')}`;
    sendMessage(text);
    setContactRequest(null);
  }, [sendMessage]);

  useEffect(() => {
    if (!url) return;
    setError(null);
    const ws = new WebSocket(url, protocols);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'typing') {
          setTyping(!!data.status);
          return;
        }
        if (data.type === 'contact_request') {
          const fields = Array.isArray(data.fields) ? data.fields : [];
          const invalid = (data.invalid && typeof data.invalid === 'object') ? data.invalid : {};
          setContactRequest({ fields, invalid });
          setTyping(false);
          return;
        }
        if (data.type === 'message' && data.content) {
          setMessages(prev => [...prev, { role: data.role || 'assistant', content: data.content }]);
        }
      } catch (e) {
        // ignore
      }
    };
    ws.onclose = () => {
      setConnected(false);
    };
    ws.onerror = (e) => {
      setError('WebSocket error');
    };

    return () => {
      ws.close();
    };
  }, [url, protocols]);

  return { connected, typing, error, messages, contactRequest, sendMessage, sendContactInfo };
};
