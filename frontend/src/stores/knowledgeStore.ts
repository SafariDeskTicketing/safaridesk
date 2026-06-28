import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  KBArticle,
  KBCategory, 
  KBCategoryTree, 
  KBSearchFilters, 
  KBSearchResult,
  KBAnalyticsDashboard,
  CreateKBArticleDto,
  UpdateKBArticleDto,
  CreateKBCategoryDto,
  UpdateKBCategoryDto,
  KBPublicSettings
} from '../types/knowledge';
import { 
  KBArticleService, 
  KBCategoryService, 
  KBAnalyticsService, 
  KBSettingsService 
} from '../services/kb';

interface KnowledgeStore {
  // State
  articles: KBArticle[];
  categories: KBCategory[];
  categoryTree: KBCategoryTree[];
  currentArticle: KBArticle | null;
  currentCategory: KBCategory | null;
  searchResults: KBSearchResult[];
  featuredArticles: KBSearchResult[];
  popularArticles: KBSearchResult[];
  analyticsDashboard: KBAnalyticsDashboard | null;
  publicSettings: KBPublicSettings | null;
  
  // Loading states
  isLoading: boolean;
  isLoadingArticle: boolean;
  isLoadingCategories: boolean;
  isLoadingSearch: boolean;
  isLoadingAnalytics: boolean;
  
  // Pagination
  pagination: {
    count: number;
    next: string | null;
    previous: string | null;
    currentPage: number;
    pageSize: number;
  };
  
  // Filters
  currentFilters: KBSearchFilters;
  
  // Error state
  error: string | null;
  
  // Actions
  fetchArticles: (filters?: KBSearchFilters) => Promise<void>;
  fetchArticle: (slug: string) => Promise<void>;
  createArticle: (data: CreateKBArticleDto) => Promise<KBArticle>;
  updateArticle: (slug: string, data: UpdateKBArticleDto) => Promise<KBArticle>;
  fetchCategories: () => Promise<void>;
  fetchCategoryTree: () => Promise<void>;
  fetchCategory: (slug: string) => Promise<void>;
  fetchCategoriesForManagement: () => Promise<void>; // Fetch all categories including inactive
  searchArticles: (query: string, filters?: KBSearchFilters) => Promise<void>;
  fetchFeaturedArticles: () => Promise<void>;
  fetchPopularArticles: () => Promise<void>;
  fetchAnalyticsDashboard: (days?: number) => Promise<void>;
  fetchPublicSettings: () => Promise<void>;
  clearCurrentArticle: () => void;
  clearCurrentCategory: () => void;
  clearSearchResults: () => void;
  clearError: () => void;
  setFilters: (filters: KBSearchFilters) => void;
  setActiveFilters: (filters: KBSearchFilters) => void;
  interactWithArticle: (slug: string, interaction: {
    type: string;
    content?: string;
    rating?: number;
    is_helpful?: boolean;
  }) => Promise<void>;
  deleteArticle: (slug: string) => Promise<void>;
  duplicateArticle: (slug: string) => Promise<KBArticle>;
  markArticleHelpful: (slug: string) => Promise<void>;
  markArticleNotHelpful: (slug: string) => Promise<void>;
  createCategory: (data: CreateKBCategoryDto) => Promise<KBCategory>;
  updateCategory: (slug: string, data: Partial<CreateKBCategoryDto>) => Promise<KBCategory>;
  deleteCategory: (slug: string) => Promise<void>;
  approveArticle: (slug: string) => Promise<void>;
  rejectArticle: (slug: string, reason: string) => Promise<void>;
}

export const useKnowledgeStore = create<KnowledgeStore>()(
  persist(
    (set: (partial: Partial<KnowledgeStore>) => void, get: () => KnowledgeStore) => ({
  // Initial state
  articles: [],
  categories: [],
  categoryTree: [],
  currentArticle: null,
  currentCategory: null,
  searchResults: [],
  featuredArticles: [],
  popularArticles: [],
  analyticsDashboard: null,
  publicSettings: null,
  
  // Loading states
  isLoading: false,
  isLoadingArticle: false,
  isLoadingCategories: false,
  isLoadingSearch: false,
  isLoadingAnalytics: false,
  
  // Pagination
  pagination: {
    count: 0,
    next: null,
    previous: null,
    currentPage: 1,
    pageSize: 20,
  },
  
  // Filters
  currentFilters: {},
  
  // Error state
  error: null,
  
  // Actions
  fetchArticles: async (filters = {}) => {
    try {
      set({ isLoading: true, error: null });
      const response = await KBArticleService.getArticles(filters);
      set({
        articles: response.results,
        pagination: {
          count: response.count,
          next: response.next,
          previous: response.previous,
          currentPage: (filters as KBSearchFilters).page || 1,
          pageSize: (filters as KBSearchFilters).page_size || 20,
        },
        currentFilters: filters,
        isLoading: false,
      });
    } catch (error: Error | unknown) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch articles', 
        isLoading: false 
      });
    }
  },

  fetchArticle: async (slug: string) => {
    try {
      set({ isLoadingArticle: true, error: null });
      const article = await KBArticleService.getArticle(slug);
      set({ currentArticle: article, isLoadingArticle: false });
    } catch (error: Error | unknown) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch article', 
        isLoadingArticle: false 
      });
    }
  },

  fetchCategories: async () => {
    try {
      set({ isLoadingCategories: true, error: null });
      const response = await KBCategoryService.getCategories();
      set({ categories: response.results, isLoadingCategories: false });
    } catch (error: Error | unknown) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch categories', 
        isLoadingCategories: false 
      });
    }
  },

  fetchCategoriesForManagement: async () => {
    try {
      set({ isLoadingCategories: true, error: null });
      const response = await KBCategoryService.getCategories({ show_all_statuses: true });
      set({ categories: response.results, isLoadingCategories: false });
    } catch (error: Error | unknown) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch categories', 
        isLoadingCategories: false 
      });
    }
  },

  createArticle: async (data: CreateKBArticleDto): Promise<KBArticle> => {
    try {
      const article = await KBArticleService.createArticle(data);
      // Refresh articles list to include the new article
      get().fetchArticles();
      return article;
    } catch (error: Error | unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create article';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  updateArticle: async (slug: string, data: UpdateKBArticleDto): Promise<KBArticle> => {
    try {
      const article = await KBArticleService.updateArticle(slug, data);
      // Update the current article if it's the one being edited
      if (get().currentArticle?.slug === slug) {
        set({ currentArticle: article });
      }
      // Refresh articles list to reflect the updates
      get().fetchArticles();
      return article;
    } catch (error: Error | unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update article';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  fetchCategoryTree: async () => {
    try {
      set({ isLoadingCategories: true, error: null });
      const tree = await KBCategoryService.getCategoryTree();
      set({ categoryTree: tree, isLoadingCategories: false });
    } catch (error: Error | unknown) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch category tree', 
        isLoadingCategories: false 
      });
    }
  },

  fetchCategory: async (slug: string) => {
    try {
      set({ isLoadingCategories: true, error: null });
      const category = await KBCategoryService.getCategory(slug);
      set({ currentCategory: category, isLoadingCategories: false });
    } catch (error: Error | unknown) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch category', 
        isLoadingCategories: false 
      });
    }
  },

  searchArticles: async (query: string, filters = {}) => {
    try {
      set({ isLoadingSearch: true, error: null });
      const response = await KBArticleService.searchArticles(query, filters);
      set({ 
        searchResults: response.results, 
        pagination: {
          count: response.count,
          next: response.next,
          previous: response.previous,
          currentPage: (filters as KBSearchFilters).page || 1,
          pageSize: (filters as KBSearchFilters).page_size || 20,
        },
        isLoadingSearch: false 
      });
    } catch (error: Error | unknown) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to search articles', 
        isLoadingSearch: false 
      });
    }
  },

  fetchFeaturedArticles: async () => {
    try {
      set({ isLoading: true, error: null });
      const articles = await KBArticleService.getFeaturedArticles();
      set({ featuredArticles: articles, isLoading: false });
    } catch (error: Error | unknown) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch featured articles', 
        isLoading: false 
      });
    }
  },

  fetchPopularArticles: async () => {
    try {
      set({ isLoading: true, error: null });
      const articles = await KBArticleService.getPopularArticles();
      set({ popularArticles: articles, isLoading: false });
    } catch (error: Error | unknown) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch popular articles', 
        isLoading: false 
      });
    }
  },

  fetchAnalyticsDashboard: async (days = 7) => {
    try {
      set({ isLoadingAnalytics: true, error: null });
      const dashboard = await KBAnalyticsService.getDashboard(days);
      set({ analyticsDashboard: dashboard, isLoadingAnalytics: false });
    } catch (error: Error | unknown) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch analytics', 
        isLoadingAnalytics: false 
      });
    }
  },

  fetchPublicSettings: async () => {
    try {
      const settings = await KBSettingsService.getPublicSettings();
      set({ publicSettings: settings });
    } catch (error: Error | unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch public settings' });
    }
  },

  interactWithArticle: async (slug: string, interaction: {
    type: string;
    content?: string;
    rating?: number;
    is_helpful?: boolean;
  }) => {
    try {
      await KBArticleService.interactWithArticle(slug, interaction);
      // Optionally refresh the current article to get updated counts
      if (get().currentArticle?.slug === slug) {
        get().fetchArticle(slug);
      }
    } catch (error: Error | unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to interact with article' });
    }
  },

  // Clear actions
  clearCurrentArticle: () => set({ currentArticle: null }),
  clearCurrentCategory: () => set({ currentCategory: null }),
  clearSearchResults: () => set({ searchResults: [] }),
  clearError: () => set({ error: null }),
  
  // Set filters
  setFilters: (filters: KBSearchFilters) => set({ currentFilters: filters }),
  setActiveFilters: (filters: KBSearchFilters) => set({ currentFilters: filters }),
  
  deleteArticle: async (slug: string) => {
    try {
      await KBArticleService.deleteArticle(slug);
      // Remove the article from the current articles list
      const currentArticles = get().articles.filter(article => article.slug !== slug);
      set({ articles: currentArticles });
    } catch (error: Error | unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete article' });
    }
  },
  
  duplicateArticle: async (slug: string): Promise<KBArticle> => {
    try {
      const duplicated = await KBArticleService.duplicateArticle(slug);
      // Refresh articles list to include the new duplicated article
      get().fetchArticles();
      return duplicated;
    } catch (error: Error | unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to duplicate article';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  markArticleHelpful: async (slug: string): Promise<void> => {
    try {
      await KBArticleService.interactWithArticle(slug, {
        type: 'helpful',
        is_helpful: true
      });
      // Optionally refresh the current article to update counts
      if (get().currentArticle?.slug === slug) {
        await get().fetchArticle(slug);
      }
    } catch (error: Error | unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to mark article as helpful' });
    }
  },

  markArticleNotHelpful: async (slug: string): Promise<void> => {
    try {
      await KBArticleService.interactWithArticle(slug, {
        type: 'helpful',
        is_helpful: false
      });
      // Optionally refresh the current article to update counts
      if (get().currentArticle?.slug === slug) {
        await get().fetchArticle(slug);
      }
    } catch (error: Error | unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to mark article as not helpful' });
    }
  },

  createCategory: async (data: CreateKBCategoryDto): Promise<KBCategory> => {
    try {
      const category = await KBCategoryService.createCategory(data);
      const state = get();
      set({
        categories: [...state.categories, category]
      });
      // Refresh category tree
      await get().fetchCategoryTree();
      return category;
    } catch (error: Error | unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to create category' });
      throw error;
    }
  },

  updateCategory: async (slug: string, data: Partial<CreateKBCategoryDto>): Promise<KBCategory> => {
    try {
      const updateData: UpdateKBCategoryDto = { ...data, id: 0 }; // id will be ignored by backend when using slug
      const category = await KBCategoryService.updateCategory(slug, updateData);
      const state = get();
      set({
        categories: state.categories.map((cat: KBCategory) => cat.slug === slug ? category : cat)
      });
      // Refresh category tree
      await get().fetchCategoryTree();
      return category;
    } catch (error: Error | unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to update category' });
      throw error;
    }
  },

  deleteCategory: async (slug: string): Promise<void> => {
    try {
      await KBCategoryService.deleteCategory(slug);
      const state = get();
      set({
        categories: state.categories.filter((cat: KBCategory) => cat.slug !== slug)
      });
      // Refresh category tree
      await get().fetchCategoryTree();
    } catch (error: Error | unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete category' });
      throw error;
    }
  },

  approveArticle: async (slug: string): Promise<void> => {
    try {
      await KBArticleService.approveArticle(slug);
      // Refresh articles after approval
      await get().fetchArticles({ status: 'draft' });
    } catch (error: Error | unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to approve article' });
      throw error;
    }
  },

  rejectArticle: async (slug: string, reason: string): Promise<void> => {
    try {
      await KBArticleService.rejectArticle(slug, reason);
      // Refresh articles after rejection
      await get().fetchArticles({ status: 'draft' });
    } catch (error: Error | unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to reject article' });
      throw error;
    }
  },
    }),
    {
      name: 'sd:knowledge-cache',
      // Persist only the data arrays; never persist loading/error/per-session state
      partialize: (state) => ({
        articles: state.articles,
        categories: state.categories,
        categoryTree: state.categoryTree,
        analyticsDashboard: state.analyticsDashboard,
        publicSettings: state.publicSettings,
      }),
    },
  )
);
