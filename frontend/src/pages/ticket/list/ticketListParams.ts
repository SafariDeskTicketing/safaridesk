import type { Agent, LabelItem } from '../../../types';
import { resolveLabelTokenIds } from '../../../utils/labels';
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

  const effectiveStatus = tokenStatus ?? (filters.statusFilter !== 'all' ? filters.statusFilter : null);
  const effectivePriority = tokenPriority ?? (filters.priorityFilter !== 'all' ? filters.priorityFilter : null);
  const effectiveAssignee = tokenAssignee ?? (filters.assigneeFilter !== 'all' ? filters.assigneeFilter : null);
  const effectiveDepartment = tokenDepartment ?? (filters.departmentFilter !== 'all' ? filters.departmentFilter : null);
  const effectiveCategory = tokenCategory ?? (filters.categoryFilter !== 'all' ? filters.categoryFilter : null);
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
