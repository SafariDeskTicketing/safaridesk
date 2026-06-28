import { QueryClient } from '@tanstack/react-query';

// Non-PII query keys that are safe to persist in localStorage across sessions.
// Tickets, tasks, and contacts contain customer PII — those stay in-memory only.
const PERSISTABLE_KEYS = new Set([
  'filter-agents',
  'filter-departments',
  'filter-categories',
  'filter-labels',
  'agents',
  'agents-admin',
]);

export const shouldPersistQuery = (queryKey: readonly unknown[]): boolean =>
  typeof queryKey[0] === 'string' && PERSISTABLE_KEYS.has(queryKey[0]);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
});
