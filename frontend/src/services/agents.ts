import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { APIS } from '../services/apis';
import http from '../services/http';
import type { AgentType, ApiResponse } from '../types/agents';
import { errorNotification } from '../components/ui/Toast';

export const getActiveAgents = (payload: ApiResponse | AgentType[] | unknown): AgentType[] => {
  const agents = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === 'object' && 'results' in payload
      ? (payload as ApiResponse).results
      : []);

  return (agents || []).filter((agent): agent is AgentType => Boolean(agent && agent.is_active && agent.status === 'A'));
};

const fetchAgents = async (): Promise<ApiResponse> => {
  const response = await http.get<ApiResponse>(APIS.LIST_AGENTS);
  const raw = response.data;
  return raw ? { ...raw, results: getActiveAgents(raw) } : raw;
};

export const AGENTS_QUERY_KEY = ['agents'] as const;

export const useFetchAgents = (options: { enabled?: boolean } = {}) => {
  const query = useQuery<ApiResponse>({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: fetchAgents,
    staleTime: 5 * 60 * 1000,  // agents rarely change; 5-minute cache
    gcTime: 15 * 60 * 1000,
    enabled: options.enabled ?? true,
  });

  useEffect(() => {
    if (!query.isError) return;
    const message = query.error instanceof Error ? query.error.message : 'Failed to load agents';
    errorNotification(message);
  }, [query.error, query.isError]);

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
};
