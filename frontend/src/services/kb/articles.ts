import http from '../http';
import { APIS } from '../apis';
import {
  KBArticle,
  KBSearchFilters,
  KBPaginatedResponse,
  CreateKBArticleDto,
  UpdateKBArticleDto,
  KBSearchResult,
} from '../../types/knowledge';

export class KBArticleService {
  /**
   * Get all articles with optional filters
   */
  static async getArticles(filters?: KBSearchFilters): Promise<KBPaginatedResponse<KBArticle>> {
    const params = new URLSearchParams();
    
    // Handle search query
    if (filters?.q) params.append('search', filters.q);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.difficulty) params.append('difficulty', filters.difficulty);
    if (filters?.featured !== undefined) params.append('featured', filters.featured.toString());
    if (filters?.language) params.append('language', filters.language);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.author) params.append('author', filters.author);
    if (filters?.ordering) params.append('ordering', filters.ordering);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.page_size) params.append('page_size', filters.page_size.toString());
    
    const url = `${APIS.KB_ARTICLES}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await http.get<KBPaginatedResponse<KBArticle>>(url);
    return response.data;
  }

  /**
   * Get a single article by slug
   */
  static async getArticle(slug: string): Promise<KBArticle> {
    const response = await http.get<KBArticle>(`${APIS.KB_ARTICLE_DETAIL}${slug}/`);
    return response.data;
  }

  /**
   * Create a new article
   */
  static async createArticle(data: CreateKBArticleDto): Promise<KBArticle> {
    const response = await http.post<KBArticle>(APIS.KB_ARTICLES, data);
    return response.data;
  }

  /**
   * Update an existing article
   */
  static async updateArticle(slug: string, data: UpdateKBArticleDto): Promise<KBArticle> {
    const response = await http.put<KBArticle>(`${APIS.KB_ARTICLE_DETAIL}${slug}/`, data);
    return response.data;
  }

  /**
   * Delete an article
   */
  static async deleteArticle(slug: string): Promise<void> {
    await http.delete(`${APIS.KB_ARTICLE_DETAIL}${slug}/`);
  }

  /**
   * Duplicate an article
   */
  static async duplicateArticle(slug: string): Promise<KBArticle> {
    const response = await http.post<KBArticle>(`${APIS.KB_ARTICLE_DETAIL}${slug}/duplicate/`);
    return response.data;
  }

  /**
   * Search articles
   */
  static async searchArticles(query: string, filters?: KBSearchFilters): Promise<KBPaginatedResponse<KBSearchResult>> {
    const params = new URLSearchParams();
    params.append('q', query);
    
    if (filters?.category) params.append('category', filters.category);
    if (filters?.difficulty) params.append('difficulty', filters.difficulty);
    if (filters?.language) params.append('language', filters.language);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.page_size) params.append('page_size', filters.page_size.toString());
    
    const url = `${APIS.KB_ARTICLES_SEARCH}?${params.toString()}`;
    const response = await http.get<KBPaginatedResponse<KBSearchResult>>(url);
    return response.data;
  }

  /**
   * Get featured articles
   */
  static async getFeaturedArticles(): Promise<KBSearchResult[]> {
    const response = await http.get<KBSearchResult[]>(APIS.KB_ARTICLES_FEATURED);
    return response.data;
  }

  /**
   * Get popular articles
   */
  static async getPopularArticles(): Promise<KBSearchResult[]> {
    const response = await http.get<KBSearchResult[]>(APIS.KB_ARTICLES_POPULAR);
    return response.data;
  }

  /**
   * Approve an article (admin only)
   */
  static async approveArticle(slug: string): Promise<{ message: string; status: string }> {
    const response = await http.post<{ message: string; status: string }>(`${APIS.KB_ARTICLE_DETAIL}${slug}/approve/`);
    return response.data;
  }

  /**
   * Reject an article (admin only)
   */
  static async rejectArticle(slug: string, reason: string): Promise<{ message: string; status: string; reason: string }> {
    const response = await http.post<{ message: string; status: string; reason: string }>(`${APIS.KB_ARTICLE_DETAIL}${slug}/reject/`, {
      reason
    });
    return response.data;
  }

  /**
   * Interact with an article (like, helpful, etc.)
   */
  static async interactWithArticle(
    slug: string, 
    interaction: {
      type: string;
      content?: string;
      rating?: number;
      is_helpful?: boolean;
    }
  ): Promise<{ success: boolean; id?: string; message?: string }> {
    if (interaction.type === 'helpful') {
      // Use the specific helpful endpoint for voting
      const response = await http.post(`${APIS.KB_ARTICLE_DETAIL}${slug}/helpful/`, {
        is_helpful: interaction.is_helpful
      });
      return response.data;
    } else {
      // Use general interact endpoint for other interactions
      const response = await http.post(`${APIS.KB_ARTICLE_DETAIL}${slug}/interact/`, interaction);
      return response.data;
    }
  }

  /**
   * Upload an image for KB articles
   */
  static async uploadImage(imageFile: File): Promise<{ url: string; name: string; path: string }> {
    const formData = new FormData();
    formData.append('image', imageFile);

    console.log('Uploading image:', imageFile.name, 'Size:', imageFile.size);

    // Do NOT set Content-Type manually — Axios auto-sets multipart/form-data with the required
    // boundary when it detects FormData. Setting it manually removes the boundary and breaks parsing.
    const response = await http.post<{ url: string; name: string; path: string }>(
      APIS.KB_ARTICLES_UPLOAD_IMAGE,
      formData,
    );

    console.log('Upload response:', response.data);
    
    return response.data;
  }
}
