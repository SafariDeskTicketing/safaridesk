import { APIS } from './apis';
import http from './http';

export interface SlackIntegration {
  id: number;
  team_id: string;
  team_name: string;
  workspace_url: string;
  default_channel?: string;
  default_channel_name?: string;
  notify_new_tickets: boolean;
  notify_assignments: boolean;
  notify_status_updates: boolean;
  notify_sla_breaches: boolean;
  notify_comments: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
}

export interface SlackOAuthResponse {
  oauth_url: string;
  state: string;
}

export interface SlackConfigurationUpdate {
  default_channel?: string;
  default_channel_name?: string;
  notify_new_tickets?: boolean;
  notify_assignments?: boolean;
  notify_status_updates?: boolean;
  notify_sla_breaches?: boolean;
  notify_comments?: boolean;
}

export interface SlackTestNotificationRequest {
  channel_id: string;
}

export interface SlackTestNotificationResponse {
  success: boolean;
  message: string;
}

// Get Slack OAuth URL
export const getSlackOAuthUrl = async (): Promise<SlackOAuthResponse> => {
  const response = await http.get(APIS.SLACK_OAUTH);
  return response.data;
};

// Get current Slack integration
export const getSlackIntegration = async (): Promise<{ integration: SlackIntegration | null }> => {
  const response = await http.get(APIS.SLACK_INTEGRATION);
  return response.data;
};

// Update Slack integration configuration
export const updateSlackConfiguration = async (config: SlackConfigurationUpdate): Promise<{ integration: SlackIntegration }> => {
  const response = await http.put(APIS.SLACK_INTEGRATION, config);
  return response.data;
};

// Delete/disconnect Slack integration
export const disconnectSlackIntegration = async (): Promise<{ message: string }> => {
  const response = await http.delete(APIS.SLACK_INTEGRATION);
  return response.data;
};

// Get Slack channels
export const getSlackChannels = async (): Promise<{ channels: SlackChannel[] }> => {
  const response = await http.get(APIS.SLACK_CHANNELS);
  return response.data;
};

// Send test notification
export const sendSlackTestNotification = async (request: SlackTestNotificationRequest): Promise<SlackTestNotificationResponse> => {
  const response = await http.post(APIS.SLACK_TEST_NOTIFICATION, request);
  return response.data;
};