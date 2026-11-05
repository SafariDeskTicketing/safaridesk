import { useQuery } from '@tanstack/react-query';
import { APIS } from '../services/apis';
import http from '../services/http';

export interface DepartmentOption {
  id: number;
  name: string;
}

const fetchDepartments = async (): Promise<DepartmentOption[]> => {
  const response = await http.get(`${APIS.LIST_DEPARTMENTS}?pagination=no`);
  return response.data.results || response.data || [];
};

export const DEPARTMENTS_QUERY_KEY = ['departments'] as const;

export const useFetchDepartments = (options: { enabled?: boolean } = {}) => {
  const query = useQuery<DepartmentOption[]>({
    queryKey: DEPARTMENTS_QUERY_KEY,
    queryFn: fetchDepartments,
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
