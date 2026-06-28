import http from '../http';
import { APIS } from '../apis';
import {
  KBCategory,
  KBArticle,
  KBPaginatedResponse,
  KBCategoryTree,
  CreateKBCategoryDto,
  UpdateKBCategoryDto,
} from '../../types/knowledge';

export class KBCategoryService {
  /**
   * Get all categories
   */
  static async getCategories(params?: { show_all_statuses?: boolean }): Promise<KBPaginatedResponse<KBCategory>> {
    const url = params?.show_all_statuses 
      ? `${APIS.KB_CATEGORIES}?show_all_statuses=true` 
      : APIS.KB_CATEGORIES;
    const response = await http.get<KBPaginatedResponse<KBCategory>>(url);
    return response.data;
  }

  /**
   * Get category tree structure
   */
  static async getCategoryTree(): Promise<KBCategoryTree[]> {
    const response = await http.get<KBCategoryTree[]>(APIS.KB_CATEGORIES_TREE);
    return response.data;
  }

  /**
   * Get a single category by slug
   */
  static async getCategory(slug: string): Promise<KBCategory> {
    const response = await http.get<KBCategory>(`${APIS.KB_CATEGORY_DETAIL}${slug}/`);
    return response.data;
  }

  /**
   * Get articles in a category
   */
  static async getCategoryArticles(slug: string, params?: {
    search?: string;
    difficulty?: string;
    page?: number;
    page_size?: number;
  }): Promise<KBPaginatedResponse<KBArticle>> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.difficulty) searchParams.append('difficulty', params.difficulty);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.page_size) searchParams.append('page_size', params.page_size.toString());
    
    const url = `${APIS.KB_CATEGORY_DETAIL}${slug}/articles/${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const response = await http.get(url);
    return response.data;
  }

  /**
   * Create a new category
   */
  static async createCategory(data: CreateKBCategoryDto): Promise<KBCategory> {
    const response = await http.post<KBCategory>(APIS.KB_CATEGORIES, data);
    return response.data;
  }

  /**
   * Update an existing category
   */
  static async updateCategory(slug: string, data: UpdateKBCategoryDto): Promise<KBCategory> {
    const response = await http.put<KBCategory>(`${APIS.KB_CATEGORY_DETAIL}${slug}/`, data);
    return response.data;
  }

  /**
   * Delete a category
   */
  static async deleteCategory(slug: string): Promise<void> {
    await http.delete(`${APIS.KB_CATEGORY_DETAIL}${slug}/`);
  }
}
