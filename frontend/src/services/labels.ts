import { useQuery } from '@tanstack/react-query';
import { APIS } from '../services/apis';
import http from '../services/http';
import type { LabelItem } from '../types';

const fetchActiveLabels = async (): Promise<LabelItem[]> => {
  const response = await http.get(APIS.LABELS_BASE, {
    params: { pagination: 'no', active_only: true },
  });
  return response.data?.results || response.data || [];
};

export const LABELS_QUERY_KEY = ['labels', 'active'] as const;

export const useFetchActiveLabels = (options: { enabled?: boolean } = {}) => {
  const query = useQuery<LabelItem[]>({
    queryKey: LABELS_QUERY_KEY,
    queryFn: fetchActiveLabels,
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
