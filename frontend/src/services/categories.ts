import { useQuery } from '@tanstack/react-query';
import { APIS } from '../services/apis';
import http from '../services/http';

export interface CategoryOption {
  id: number;
  name: string;
  department?: number | null;
}

const fetchCategories = async (): Promise<CategoryOption[]> => {
  const response = await http.get(`${APIS.LIST_TICKET_CATEGORIES}?pagination=no`);
  return response.data.results || response.data || [];
};

export const CATEGORIES_QUERY_KEY = ['categories'] as const;

export const useFetchCategories = (options: { enabled?: boolean } = {}) => {
  const query = useQuery<CategoryOption[]>({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    enabled: options.enabled ?? true,
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
