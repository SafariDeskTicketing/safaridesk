import http from '../http';
import { APIS } from '../apis';
import {
  KBSettings,
  KBPaginatedResponse,
  KBPublicSettings,
} from '../../types/knowledge';

export class KBSettingsService {
  /**
   * Get public settings (no authentication required)
   */
  static async getPublicSettings(): Promise<KBPublicSettings> {
    const response = await http.get<KBPublicSettings>(APIS.KB_SETTINGS_PUBLIC);
    return response.data;
  }

  /**
   * Get all settings (admin only)
   */
  static async getSettings(): Promise<KBPaginatedResponse<KBSettings>> {
    const response = await http.get<KBPaginatedResponse<KBSettings>>(APIS.KB_SETTINGS);
    return response.data;
  }

  /**
   * Get a specific setting by key
   */
  static async getSetting(key: string): Promise<KBSettings> {
    const response = await http.get<KBSettings>(`${APIS.KB_SETTINGS}${key}/`);
    return response.data;
  }

  /**
   * Update a setting
   */
  static async updateSetting(key: string, value: string | number | boolean | Record<string, unknown>): Promise<KBSettings> {
    const response = await http.put<KBSettings>(`${APIS.KB_SETTINGS}${key}/`, {
      value: typeof value === 'string' ? value : JSON.stringify(value)
    });
    return response.data;
  }

  /**
   * Create a new setting
   */
  static async createSetting(data: Partial<KBSettings>): Promise<KBSettings> {
    const response = await http.post<KBSettings>(APIS.KB_SETTINGS, data);
    return response.data;
  }

  /**
   * Delete a setting
   */
  static async deleteSetting(key: string): Promise<void> {
    await http.delete(`${APIS.KB_SETTINGS}${key}/`);
  }
}
