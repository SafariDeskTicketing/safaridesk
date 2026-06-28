import { APIS } from './apis';
import http from './http';

export interface TelegramIntegration {
  id: number;
  bot_username: string;
  webhook_url: string;
  is_active: boolean;
  auto_create_tickets: boolean;
  default_priority: string;
  welcome_message: string;
  ticket_created_message: string;
  confirm_ticket_creation: boolean;
  send_resolution_updates: boolean;
  send_agent_replies: boolean;
  created_at: string;
  updated_at: string;
}

export interface TelegramChat {
  id: number;
  chat_id: number;
  chat_type: string;
  user_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  is_active_conversation: boolean;
  ticket_id: number | null;
  created_at: string;
}

export interface TelegramConnectRequest {
  bot_token: string;
}

export interface TelegramConnectResponse {
  message: string;
  integration: TelegramIntegration;
}

export interface TelegramConfigurationUpdate {
  auto_create_tickets?: boolean;
  default_priority?: string;
  welcome_message?: string;
  ticket_created_message?: string;
  confirm_ticket_creation?: boolean;
  send_resolution_updates?: boolean;
  send_agent_replies?: boolean;
  is_active?: boolean;
}

export interface TelegramTestResponse {
  success: boolean;
  message: string;
  bot_info?: {
    id: number;
    username: string;
    first_name: string;
  };
  webhook_status?: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
  };
}

export const connectTelegramBot = async (request: TelegramConnectRequest): Promise<TelegramConnectResponse> => {
  const response = await http.post(APIS.TELEGRAM_CONNECT, request);
  return response.data;
};

export const getTelegramIntegration = async (): Promise<{ integration: TelegramIntegration | null }> => {
  const response = await http.get(APIS.TELEGRAM_INTEGRATION);
  return response.data;
};

export const updateTelegramConfiguration = async (config: TelegramConfigurationUpdate): Promise<{ integration: TelegramIntegration }> => {
  const response = await http.patch(APIS.TELEGRAM_INTEGRATION, config);
  return response.data;
};

export const disconnectTelegramIntegration = async (): Promise<{ message: string }> => {
  const response = await http.delete(APIS.TELEGRAM_INTEGRATION);
  return response.data;
};

export const testTelegramConnection = async (): Promise<TelegramTestResponse> => {
  const response = await http.post(APIS.TELEGRAM_TEST);
  return response.data;
};

export interface TelegramSendTestResponse {
  success: boolean;
  message?: string;
  error?: string;
  bot_username?: string;
  sent_count?: number;
  failed_count?: number;
}

export const sendTelegramTestMessage = async (chatId?: number): Promise<TelegramSendTestResponse> => {
  const response = await http.post(APIS.TELEGRAM_SEND_TEST, chatId ? { chat_id: chatId } : {});
  return response.data;
};

export const getTelegramChats = async (): Promise<{ chats: TelegramChat[] }> => {
  const response = await http.get(APIS.TELEGRAM_CHATS);
  return response.data;
};
