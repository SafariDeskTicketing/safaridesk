import http from './http';
import { APIS } from './apis';

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

export const slackService = {
  // Get Slack OAuth URL for authorization
  getOAuthUrl: async (): Promise<SlackOAuthResponse> => {
    const response = await http.get(APIS.SLACK_OAUTH);
    return response.data;
  },

  // Get current Slack integration
  getIntegration: async (): Promise<SlackIntegration | null> => {
    const response = await http.get(APIS.SLACK_INTEGRATION);
    return response.data.integration;
  },

  // Update integration settings
  updateIntegration: async (data: Partial<SlackIntegration>): Promise<SlackIntegration> => {
    const response = await http.put(APIS.SLACK_INTEGRATION, data);
    return response.data.integration;
  },

  // Disconnect/delete integration
  disconnectIntegration: async (): Promise<void> => {
    await http.delete(APIS.SLACK_INTEGRATION);
  },

  // Get available Slack channels
  getChannels: async (): Promise<SlackChannel[]> => {
    const response = await http.get(APIS.SLACK_CHANNELS);
    return response.data.channels;
  },

  // Send test notification
  sendTestNotification: async (channelId: string): Promise<{ success: boolean; message: string }> => {
    const response = await http.post(APIS.SLACK_TEST_NOTIFICATION, {
      channel_id: channelId
    });
    return response.data;
  }
};