import { APIS } from './apis';
import http from './http';

export const fetchDepartmentEmails = async (page: number) => {
  const response = await http.get(`${APIS.LOAD_DEPARTMENT_EMAILS}?page=${page}`);
  return response.data;
};

export const updateDepartmentEmail = async ({ id, data }: { id: number; data: unknown }) => {
  const response = await http.patch(`${APIS.UPDATE_DEPARTMENT_EMAIL}${id}/`, data);
  return response.data;
};

export const createDepartmentEmail = async (data: unknown) => {
  const response = await http.post(APIS.LOAD_DEPARTMENT_EMAILS, data);
  return response.data;
};

export const fetchAllDepartments = async () => {
  const response = await http.get(`${APIS.LIST_DEPARTMENTS}?pagination=no`);
  return response.data;
};

export type MailIntegrationProvider = 'gmail' | 'office365' | 'custom' | 'safaridesk';
export type MailIntegrationDirection = 'incoming' | 'outgoing' | 'both';

export interface MailIntegrationPayload {
  email_address?: string;
  display_name?: string;
  provider: MailIntegrationProvider;
  direction: MailIntegrationDirection;
  department?: number | null;
  imap_host?: string;
  imap_port?: number;
  imap_username?: string;
  imap_password?: string;
  imap_use_ssl?: boolean;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_use_ssl?: boolean;
  smtp_use_tls?: boolean;
}

export interface MailIntegrationRoutingPayload {
  display_name?: string;
  direction?: MailIntegrationDirection;
  department?: number | null;
  default_assignee?: number | null;
}

export interface ChangeMailIntegrationProviderPayload {
  provider: MailIntegrationProvider;
  direction?: MailIntegrationDirection;
}

export interface MailIntegration {
  id: number;
  email_address?: string | null;
  display_name?: string;
  provider: MailIntegrationProvider;
  direction: MailIntegrationDirection;
  department?: number | null;
  department_name?: string;
  default_assignee?: number | null;
  default_assignee_name?: string | null;
  imap_host?: string;
  imap_port?: number | null;
  imap_use_ssl?: boolean | null;
  smtp_host?: string;
  smtp_port?: number | null;
  smtp_use_ssl?: boolean | null;
  smtp_use_tls?: boolean | null;
  connection_status: string;
  connection_status_detail?: string;
  is_active: boolean;
  forwarding_address?: string;
  forwarding_status?: string;
  last_success_at?: string;
  last_error_at?: string;
  last_error_message?: string;
  provider_metadata?: Record<string, unknown>;
}

export interface MailCredentialValidationPayload {
  imap_host?: string;
  imap_port?: number;
  imap_username?: string;
  imap_password?: string;
  imap_use_ssl?: boolean;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  smtp_use_ssl?: boolean;
  smtp_use_tls?: boolean;
}

export const fetchMailIntegrations = async (): Promise<MailIntegration[]> => {
  const response = await http.get(APIS.MAIL_INTEGRATIONS);
  const data = response.data;
  if (Array.isArray(data)) {
    return data;
  }
  if (data?.results && Array.isArray(data.results)) {
    return data.results;
  }
  return [];
};

export const createMailIntegration = async (data: MailIntegrationPayload) => {
  const response = await http.post(APIS.MAIL_INTEGRATIONS, data);
  return response.data;
};

export const deleteMailIntegration = async (id: number) => {
  const response = await http.delete(`${APIS.MAIL_INTEGRATIONS}${id}/`);
  return response.data;
};

export const updateMailIntegrationRouting = async (id: number, data: MailIntegrationRoutingPayload) => {
  const response = await http.patch(`${APIS.MAIL_INTEGRATIONS}${id}/routing/`, data);
  return response.data;
};

export const updateMailIntegration = async ({ id, data }: { id: number; data: Partial<MailIntegrationPayload> }) => {
  const response = await http.patch(`${APIS.MAIL_INTEGRATIONS}${id}/`, data);
  return response.data;
};

export const changeMailIntegrationProvider = async (
  id: number,
  data: ChangeMailIntegrationProviderPayload,
) => {
  const response = await http.post(`${APIS.MAIL_INTEGRATIONS}${id}/provider/change/`, data);
  return response.data;
};

interface MailIntegrationOAuthStartPayload {
  return_url?: string;
}

export const startGoogleMailIntegration = async (id: number, data?: MailIntegrationOAuthStartPayload) => {
  const response = await http.post(`${APIS.MAIL_INTEGRATIONS}${id}/google/start/`, data ?? {});
  return response.data;
};

export const startMicrosoftMailIntegration = async (id: number, data?: MailIntegrationOAuthStartPayload) => {
  const response = await http.post(`${APIS.MAIL_INTEGRATIONS}${id}/microsoft/start/`, data ?? {});
  return response.data;
};

export const provisionForwardingAddress = async (id: number) => {
  const response = await http.post(`${APIS.MAIL_INTEGRATIONS}${id}/forwarding/provision/`);
  return response.data;
};

export const validateMailCredentials = async (payload: MailCredentialValidationPayload) => {
  const response = await http.post(APIS.MAIL_INTEGRATION_VALIDATE, payload);
  return response.data;
};

// ─── Email Filters ────────────────────────────────────────────────────────────

export interface EmailFilterListResponse {
  rules: string[];
  updated_at: string | null;
}

export interface EmailFilterLogEntry {
  id: number;
  sender: string;
  subject: string;
  rule_matched: string;
  rule_tier: 'exact' | 'domain' | 'contains' | 'positive_cache';
  blocked_at: string;
}

export interface EmailFilterLogResponse {
  count: number;
  results: EmailFilterLogEntry[];
}

export const fetchEmailFilters = async (): Promise<EmailFilterListResponse> => {
  const response = await http.get(APIS.EMAIL_FILTERS);
  return response.data;
};

export const saveEmailFilters = async (rules: string[]): Promise<EmailFilterListResponse> => {
  const response = await http.put(APIS.EMAIL_FILTERS, { rules });
  return response.data;
};

export const resetEmailFilters = async (): Promise<EmailFilterListResponse> => {
  const response = await http.post(APIS.EMAIL_FILTERS_RESET);
  return response.data;
};

export const fetchEmailFilterLog = async (): Promise<EmailFilterLogResponse> => {
  const response = await http.get(APIS.EMAIL_FILTERS_LOG);
  return response.data;
};

export const clearEmailFilterLog = async (): Promise<{ deleted: number }> => {
  const response = await http.delete(APIS.EMAIL_FILTERS_LOG);
  return response.data;
};
