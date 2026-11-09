import { useQuery } from '@tanstack/react-query';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import type { TaskObj, LabelItem } from '../../../types';
import {
  buildTaskQueryParams,
  isTaskQueryBlockedByPendingLookups,
  type TaskListFilters,
  type TaskListLookups,
  type TaskListLookupsLoading,
} from './taskListParams';

export interface ApiTask {
  id: number;
  title: string;
  description: string;
  task_status: string;
  priority: string;
  task_trackid: string;
  assigned_to: {
    id: number;
    name?: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    avatar_url?: string;
    is_active?: boolean;
  } | null;
  created_by?: {
    id: number;
    name?: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
    avatar_url?: string;
  } | null;
  due_date: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
  department?: {
    id: number;
    name: string;
    slag?: string;
  } | null;
  is_converted_to_ticket?: boolean;
  linked_ticket?: any;
  labels?: LabelItem[];
}

export interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiTask[];
}

export const transformApiTask = (apiTask: ApiTask): TaskObj => {
  const priority = apiTask.priority?.toLowerCase();
  return {
    id: apiTask.id,
    title: apiTask.title || '',
    description: apiTask.description || '',
    task_status: (apiTask.task_status === 'open' ? 'todo' : apiTask.task_status) as TaskObj['task_status'],
    priority: ['low', 'medium', 'high', 'critical'].includes(priority) ? priority as TaskObj['priority'] : null,
    task_trackid: apiTask.task_trackid || '',
    assigned_to: apiTask.assigned_to ? {
      id: apiTask.assigned_to.id,
      name: apiTask.assigned_to.name || `${apiTask.assigned_to.first_name || ''} ${apiTask.assigned_to.last_name || ''}`.trim(),
      email: apiTask.assigned_to.email,
      phone_number: apiTask.assigned_to.phone_number,
      is_active: apiTask.assigned_to.is_active ?? true,
    } : null,
    created_by: apiTask.created_by ? {
      id: apiTask.created_by.id,
      name: apiTask.created_by.name || `${apiTask.created_by.first_name || ''} ${apiTask.created_by.last_name || ''}`.trim(),
      email: apiTask.created_by.email || '',
      phone_number: apiTask.created_by.phone_number || '',
    } : null,
    department: apiTask.department ? {
      id: apiTask.department.id,
      name: apiTask.department.name || '',
      slag: apiTask.department.slag || '',
    } : null,
    assigned_to_name: apiTask.assigned_to ? (apiTask.assigned_to.name || `${apiTask.assigned_to.first_name || ''} ${apiTask.assigned_to.last_name || ''}`.trim()) : null,
    due_date: apiTask.due_date,
    created_at: apiTask.created_at,
    updated_at: apiTask.updated_at || apiTask.created_at,
    completed_at: apiTask.completed_at || null,
    is_converted_to_ticket: apiTask.is_converted_to_ticket || false,
    linked_ticket: apiTask.linked_ticket || null,
    status: apiTask.task_status,
    labels: apiTask.labels || [],
  };
};

export interface TaskListQueryInput extends TaskListFilters {
  page: number;
  view: string;
  limit: number;
}

const fetchTasksPage = async (
  input: TaskListQueryInput,
  lookups: TaskListLookups,
  signal?: AbortSignal,
): Promise<ApiResponse> => {
  const offset = (input.page - 1) * input.limit;

  const params: Record<string, string | number> = {
    limit: input.limit,
    offset,
    view: input.view,
    ...buildTaskQueryParams(input, lookups),
  };

  const response = await http.get<ApiResponse>(APIS.LOAD_TASKS, { params, signal });
  return response.data;
};

/**
 * React Query handles the "stale response overwrites newer state" race by
 * construction: each distinct set of filters/view/page gets its own cache
 * entry, so a slow response for filters the user already changed away from
 * is simply never rendered for the current query key. `lookups` is
 * intentionally NOT part of the query key — see the ticket-list rewrite's
 * equivalent for why.
 *
 * `staleTime: Infinity` means the key this fetch commits under never gets a
 * second chance to resolve a token correctly once its lookup arrives later,
 * so `enabled` holds off fetching for this key while a present token's
 * lookup is still loading, instead of resolving that token to nothing and
 * caching the wrong result forever.
 */
export const useTasksListQuery = (
  input: TaskListQueryInput,
  lookups: TaskListLookups,
  lookupsLoading: TaskListLookupsLoading,
) =>
  useQuery<ApiResponse>({
    queryKey: ['tasks', input],
    queryFn: ({ signal }) => fetchTasksPage(input, lookups, signal),
    placeholderData: (prev) => prev,
    staleTime: Infinity, // task_event (WebSocket-driven) handles invalidation, not a timer
    enabled: !isTaskQueryBlockedByPendingLookups(input.searchQuery, lookupsLoading),
  });
