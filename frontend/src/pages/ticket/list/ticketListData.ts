import { useQuery } from '@tanstack/react-query';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import type { Ticket, LabelItem } from '../../../types';
import { resolveStatusToken } from './ticketSearch';
import { buildTicketQueryParams, type TicketListFilters, type TicketListLookups } from './ticketListParams';

export interface ApiTicket {
  id: number;
  title: string;
  creator_name: string;
  creator_phone: string;
  creator_email: string;
  ticket_id: string;
  description: string;
  category: {
    id: number;
    name: string;
  };
  department: {
    id: number;
    name: string;
  };
  priority: string;
  priority_display: string;
  is_public: boolean;
  status: string;
  status_display: string;
  created_at: string;
  updated_at?: string;
  assigned_to: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    avatar_url?: string;
    is_active?: boolean;
  } | null;
  breached: boolean;
  due_date?: string;
  source?: 'email' | 'web' | 'phone' | 'chat' | 'chatbot' | 'api' | 'internal' | 'customer_portal';
  linked_tasks_count?: number;
  is_opened?: boolean;
  has_new_reply?: boolean;
  labels?: LabelItem[];
}

export interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiTicket[];
}

export const transformApiTicket = (apiTicket: ApiTicket): Ticket => {
  const normalizedStatus = (resolveStatusToken(apiTicket.status) ?? 'open') as Ticket['status'];

  return ({
    id: apiTicket.id.toString(),
    title: apiTicket.title || '',
    description: apiTicket.description || '',
    status: normalizedStatus,
    priority: apiTicket.priority_display?.toLowerCase() as Ticket['priority'] || 'normal',
    category: apiTicket.category?.name || 'Uncategorized',
    department: apiTicket.department ? {
      id: apiTicket.department.id,
      name: apiTicket.department.name,
    } : undefined,
    ticket_id: apiTicket.ticket_id || '',
    assigneeId: apiTicket.assigned_to?.id.toString(),
    assignee: apiTicket.assigned_to ? {
      id: apiTicket.assigned_to.id.toString(),
      email: apiTicket.assigned_to.email || '',
      firstName: apiTicket.assigned_to.first_name || '',
      lastName: apiTicket.assigned_to.last_name || '',
      role: 'agent',
      workspaceId: 'default-workspace-id',
      isActive: apiTicket.assigned_to?.is_active ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      avatar_url: apiTicket.assigned_to.avatar_url,
    } : undefined,
    requesterId: 'unknown-requester-id',
    requester: {
      id: 'unknown-requester-id',
      email: apiTicket.creator_email || '',
      firstName: (apiTicket.creator_name || '').split(' ')[0] || '',
      lastName: (apiTicket.creator_name || '').split(' ').slice(1).join(' ') || '',
      role: 'staff',
      workspaceId: 'default-workspace-id',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      phone: apiTicket.creator_phone || '',
    },
    workspaceId: 'default-workspace-id',
    tags: (apiTicket.labels || []).map((label) => label.name),
    labels: apiTicket.labels || [],
    attachments: [],
    comments: [],
    createdAt: apiTicket.created_at || new Date().toISOString(),
    updatedAt: apiTicket.updated_at || apiTicket.created_at || new Date().toISOString(),
    dueDate: apiTicket.due_date,
    resolvedAt: undefined,
    breached: apiTicket.breached,
    source: apiTicket.source || 'web',
    linked_tasks_count: apiTicket.linked_tasks_count ?? 0,
    is_opened: apiTicket.is_opened ?? false,
    has_new_reply: apiTicket.has_new_reply ?? false,
  });
};

export type SortField =
  | 'ticket_id'
  | 'title'
  | 'status'
  | 'priority'
  | 'department'
  | 'author'
  | 'assignee'
  | 'created_at'
  | 'tasks';

export interface SortState {
  field: SortField;
  direction: 'asc' | 'desc';
  explicit: boolean;
}

export const DEFAULT_SORT_STATE: SortState = { field: 'created_at', direction: 'desc', explicit: false };

export interface TicketListQueryInput extends TicketListFilters {
  page: number;
  view: string;
  limit: number;
  sortState: SortState;
}

const fetchTicketsPage = async (
  input: TicketListQueryInput,
  lookups: TicketListLookups,
  signal?: AbortSignal,
): Promise<ApiResponse> => {
  const offset = (input.page - 1) * input.limit;
  // `slow_queues` has a server-side default sort; only override it once the
  // user has explicitly picked a sort on that view.
  const shouldSendSort = input.view !== 'slow_queues' || input.sortState.explicit;

  const params: Record<string, string | number> = {
    page_size: input.limit,
    offset,
    view: input.view,
    ...(shouldSendSort
      ? { sort_by: input.sortState.field, sort_direction: input.sortState.direction }
      : {}),
    ...buildTicketQueryParams(input, lookups),
  };

  const response = await http.get<ApiResponse>(APIS.LIST_TICKETS, { params, signal });
  return response.data;
};

/**
 * React Query handles the "stale response overwrites newer state" race by
 * construction: each distinct set of filters/view/page/sort gets its own
 * cache entry, so a slow response for filters the user already changed away
 * from is simply never rendered for the current query key. `lookups` is
 * intentionally NOT part of the query key — it's only used to resolve the
 * token mini-language (e.g. `assignee:john`) into an id at fetch time, and
 * shouldn't itself trigger a refetch when the agents/departments/etc. list
 * reloads.
 */
export const useTicketsListQuery = (input: TicketListQueryInput, lookups: TicketListLookups) =>
  useQuery<ApiResponse>({
    queryKey: ['tickets', input],
    queryFn: ({ signal }) => fetchTicketsPage(input, lookups, signal),
    placeholderData: (prev) => prev,
    staleTime: Infinity, // ticket_event (WebSocket-driven) handles invalidation, not a timer
  });
