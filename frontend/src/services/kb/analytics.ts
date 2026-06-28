import http from '../http';
import { APIS } from '../apis';
import {
  KBAnalyticsDashboard,
  KBAnalytics,
  KBPaginatedResponse,
} from '../../types/knowledge';

export class KBAnalyticsService {
  /**
   * Get analytics dashboard data
   */
  static async getDashboard(days: number = 7): Promise<KBAnalyticsDashboard> {
    const response = await http.get<KBAnalyticsDashboard>(
      `${APIS.KB_ANALYTICS_OVERVIEW}?days=${days}`
    );
    return response.data;
  }

  /**
   * Get all analytics data
   */
  static async getAnalytics(params?: {
    page?: number;
    page_size?: number;
    event_type?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<KBPaginatedResponse<KBAnalytics>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    if (params?.event_type) searchParams.append('event_type', params.event_type);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    
    const url = `${APIS.KB_ARTICLE_ANALYTICS}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const response = await http.get<KBPaginatedResponse<KBAnalytics>>(url);
    return response.data;
  }
}
