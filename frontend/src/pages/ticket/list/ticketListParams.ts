import type { Agent, LabelItem } from '../../../types';
import { resolveLabelTokenIds } from '../../../utils/labels';
import { resolveFilterValue, isQueryBlockedByPendingLookups } from '../../../utils/searchTokenMiniLanguage';
import {
  parseSearchQuery,
  resolveStatusToken,
  resolvePriorityToken,
  resolveAssigneeToken,
  resolveDepartmentToken,
  resolveCategoryToken,
  resolveCreatedDateToken,
} from './ticketSearch';

export interface TicketListFilters {
  searchQuery: string;
  statusFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  departmentFilter: string;
  categoryFilter: string;
  labelFilterIds: number[];
  dateFromFilter: string;
  dateToFilter: string;
}

export interface TicketListLookups {
  agents: Agent[] | null;
  departments: Array<{ id: number; name: string }>;
  categories: Array<{ id: number; name: string; department?: number | null }>;
  labels: LabelItem[];
}

export interface TicketListLookupsLoading {
  agents: boolean;
  departments: boolean;
  categories: boolean;
  labels: boolean;
}

/**
 * True when the free-text search currently contains a token (e.g.
 * `assignee:jane`) whose matching lookup hasn't loaded yet. Used to hold off
 * fetching the ticket list (and its counts) until that lookup is in, instead
 * of fetching immediately, silently resolving the token to nothing, and
 * caching that wrong result forever under `staleTime: Infinity` (the lookup
 * finishing later doesn't change the query key, so it would never
 * self-correct). If a lookup fetch fails outright rather than still being in
 * flight, this deliberately does NOT keep blocking forever — `isLoading`
 * (unlike a hypothetical "never settled") is also false once a query gives
 * up after its retries, so the affected token just resolves to no match, the
 * same degraded-but-visible-eventually behavior an unmatched token already
 * gets. Blocking indefinitely on a dead lookup endpoint would be worse: every
 * list view with that token would simply never load.
 */
export const isTicketQueryBlockedByPendingLookups = (
  searchQuery: string,
  lookupsLoading: TicketListLookupsLoading,
): boolean =>
  isQueryBlockedByPendingLookups(searchQuery, parseSearchQuery, {
    assignee: lookupsLoading.agents,
    department: lookupsLoading.departments,
    category: lookupsLoading.categories,
    labels: lookupsLoading.labels,
  });

/**
 * Merges the token mini-language (parsed out of free-text search) with the
 * dropdown filter state into the final query params sent to the ticket-list
 * API. Tokens take priority over the equivalent dropdown filter when both are
 * present. Shared by the ticket-list fetch and the ticket-counts fetch so the
 * two can never drift out of sync with each other.
 */
export const buildTicketQueryParams = (
  filters: TicketListFilters,
  lookups: TicketListLookups,
): Record<string, string | number> => {
  const params: Record<string, string | number> = {};

  const parsedSearch = parseSearchQuery(filters.searchQuery);
  if (parsedSearch.cleanedQuery) {
    params.search = parsedSearch.cleanedQuery;
  }

  const tokenStatus = resolveStatusToken(parsedSearch.tokens.status);
  const tokenPriority = resolvePriorityToken(parsedSearch.tokens.priority);
  const tokenAssignee = resolveAssigneeToken(parsedSearch.tokens.assignee, lookups.agents);
  const tokenDepartment = resolveDepartmentToken(parsedSearch.tokens.department, lookups.departments);
  const tokenCategory = resolveCategoryToken(parsedSearch.tokens.category, lookups.categories);
  const tokenLabels = resolveLabelTokenIds(parsedSearch.tokens.labels, lookups.labels);
  const tokenCreatedDate = resolveCreatedDateToken(parsedSearch.tokens.created_at);

  const effectiveStatus = resolveFilterValue(tokenStatus, filters.statusFilter);
  const effectivePriority = resolveFilterValue(tokenPriority, filters.priorityFilter);
  const effectiveAssignee = resolveFilterValue(tokenAssignee, filters.assigneeFilter);
  const effectiveDepartment = resolveFilterValue(tokenDepartment, filters.departmentFilter);
  const effectiveCategory = resolveFilterValue(tokenCategory, filters.categoryFilter);
  const effectiveLabelIds = tokenLabels.length > 0 ? tokenLabels : filters.labelFilterIds;
  const effectiveDateFrom = tokenCreatedDate?.from ?? filters.dateFromFilter;
  const effectiveDateTo = tokenCreatedDate?.to ?? filters.dateToFilter;

  if (effectiveStatus) params.status = effectiveStatus;
  if (effectivePriority) params.priority = effectivePriority;
  if (effectiveAssignee) params.assigned_to = effectiveAssignee;
  if (effectiveDepartment) params.department = effectiveDepartment;
  if (effectiveCategory) params.category = effectiveCategory;
  if (effectiveLabelIds.length > 0) params.label_ids = effectiveLabelIds.join(',');
  if (effectiveDateFrom) params.date_from = effectiveDateFrom;
  if (effectiveDateTo) params.date_to = effectiveDateTo;

  return params;
};
