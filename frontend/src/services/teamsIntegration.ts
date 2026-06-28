import { APIS } from './apis';
import http from './http';

export interface TeamsIntegration {
  id: number;
  tenant_id: string;
  tenant_name?: string;
  team_id?: string;
  team_name?: string;
  team_url?: string;
  user_display_name?: string;
  user_email?: string;
  default_channel_id?: string;
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

export interface TeamsTeam {
  id: string;
  name: string;
  description: string;
}

export interface TeamsChannel {
  id: string;
  name: string;
  description: string;
  membership_type: string;
}

export interface TeamsOAuthResponse {
  oauth_url: string;
  state: string;
}

export interface TeamsConfigurationUpdate {
  team_id?: string;
  team_name?: string;
  default_channel_id?: string;
  default_channel_name?: string;
  notify_new_tickets?: boolean;
  notify_assignments?: boolean;
  notify_status_updates?: boolean;
  notify_sla_breaches?: boolean;
  notify_comments?: boolean;
}

export interface TeamsTestNotificationRequest {
  team_id: string;
  channel_id: string;
}

export interface TeamsTestNotificationResponse {
  success: boolean;
  message: string;
}

// Get Teams OAuth URL
export const getTeamsOAuthUrl = async (): Promise<TeamsOAuthResponse> => {
  const response = await http.get(APIS.TEAMS_OAUTH);
  return response.data;
};

// Get current Teams integration
export const getTeamsIntegration = async (): Promise<{ integration: TeamsIntegration | null }> => {
  const response = await http.get(APIS.TEAMS_INTEGRATION);
  return response.data;
};

// Update Teams integration configuration
export const updateTeamsConfiguration = async (config: TeamsConfigurationUpdate): Promise<{ integration: TeamsIntegration }> => {
  const response = await http.patch(APIS.TEAMS_INTEGRATION, config);
  return response.data;
};

// Delete/disconnect Teams integration
export const disconnectTeamsIntegration = async (): Promise<{ message: string }> => {
  const response = await http.delete(APIS.TEAMS_INTEGRATION);
  return response.data;
};

// Get list of Teams the user has joined
export const getTeamsList = async (): Promise<{ teams: TeamsTeam[] }> => {
  const response = await http.get(APIS.TEAMS_LIST);
  return response.data;
};

// Get channels for a specific Team
export const getTeamsChannels = async (teamId: string): Promise<{ channels: TeamsChannel[] }> => {
  const response = await http.get(`${APIS.TEAMS_CHANNELS}?team_id=${teamId}`);
  return response.data;
};

// Send test notification
export const sendTeamsTestNotification = async (request: TeamsTestNotificationRequest): Promise<TeamsTestNotificationResponse> => {
  const response = await http.post(APIS.TEAMS_TEST_NOTIFICATION, request);
  return response.data;
};
