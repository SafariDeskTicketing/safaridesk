import { useQuery } from '@tanstack/react-query';
import { APIS } from '../services/apis';
import http from '../services/http';

export interface LinkableTicket {
  id: number;
  ticket_id: string;
  title: string;
}

const fetchLinkableTickets = async (): Promise<LinkableTicket[]> => {
  const response = await http.get(`${APIS.LIST_TICKETS}?pagination=no`);
  return response.data.results || response.data || [];
};

export const LINKABLE_TICKETS_QUERY_KEY = ['tickets', 'linkable'] as const;

// Unpaginated ticket list used by "link this task/ticket to..." pickers
// (CreateTaskModal's ticket dropdown, AttachToTicket). Rarely changes fast
// enough to need refetching on every modal open.
export const useFetchLinkableTickets = (options: { enabled?: boolean } = {}) => {
  const query = useQuery<LinkableTicket[]>({
    queryKey: LINKABLE_TICKETS_QUERY_KEY,
    queryFn: fetchLinkableTickets,
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
