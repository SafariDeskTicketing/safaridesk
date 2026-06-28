/**
 * Base configuration using Vite environment variables.
 * Same-domain self-hosting defaults route through the root Nginx service:
 *   /api/v1 -> backend
 *   /ws     -> channels
 */

const browserOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
const browserHost = typeof window !== 'undefined' ? window.location.host : 'localhost';
const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsOrigin = `${wsProtocol}//${browserHost}`;

// API Base URL
export const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Site URL
export const SITE_URL = import.meta.env.VITE_SITE_URL || `${browserOrigin}/site`;

// WebSocket URL for notifications
export const WS_NOTIFICATIONS_URL = import.meta.env.VITE_WS_NOTIFICATIONS_URL || `${wsOrigin}/ws/notifications/`;

// Backward compatibility alias
export const SOCKET_URL = WS_NOTIFICATIONS_URL;

// WebSocket base URL for chatbot
export const CHAT_WS_BASE = import.meta.env.VITE_CHAT_WS_BASE || import.meta.env.VITE_WS_URL || wsOrigin;



