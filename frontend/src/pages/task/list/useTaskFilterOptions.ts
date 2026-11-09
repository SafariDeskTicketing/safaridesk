import { useQuery } from '@tanstack/react-query';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import { getActiveAgents } from '../../../services/agents';
import type { Agent, LabelItem } from '../../../types';

const STALE_TIME_MS = 30 * 60 * 1000;

const fetchAgents = async (): Promise<Agent[]> => {
  const response = await http.get(`${APIS.LIST_AGENTS}?pagination=no`);
  return getActiveAgents(response.data);
};

const fetchDepartments = async (): Promise<Array<{ id: number; name: string }>> => {
  const response = await http.get(APIS.LIST_DEPARTMENTS);
  return Array.isArray(response.data) ? response.data : response.data.results || [];
};

const fetchLabels = async (): Promise<LabelItem[]> => {
  const response = await http.get(APIS.LABELS_BASE, {
    params: { pagination: 'no', active_only: true },
  });
  return response.data?.results || response.data || [];
};

/**
 * Agents/departments/labels for the task filter dropdowns and the token
 * search mini-language's resolvers. Declarative useQuery instead of the
 * previous imperative fetch-in-a-mount-effect (same pattern as the ticket
 * list's equivalent hook).
 */
export const useTaskFilterOptions = () => {
  const agentsQuery = useQuery({ queryKey: ['filter-agents'], queryFn: fetchAgents, staleTime: STALE_TIME_MS });
  const departmentsQuery = useQuery({ queryKey: ['filter-departments'], queryFn: fetchDepartments, staleTime: STALE_TIME_MS });
  const labelsQuery = useQuery({ queryKey: ['filter-labels'], queryFn: fetchLabels, staleTime: STALE_TIME_MS });

  return {
    agents: agentsQuery.data ?? null,
    departments: departmentsQuery.data ?? [],
    labels: labelsQuery.data ?? [],
    refetchLabels: labelsQuery.refetch,
    lookupsLoading: {
      agents: agentsQuery.isLoading,
      departments: departmentsQuery.isLoading,
      labels: labelsQuery.isLoading,
    },
  };
};
