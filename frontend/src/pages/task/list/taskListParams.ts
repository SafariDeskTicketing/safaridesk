import type { Agent, LabelItem } from '../../../types';
import { resolveLabelTokenIds } from '../../../utils/labels';
import { resolveFilterValue } from '../../../utils/searchTokenMiniLanguage';
import {
  parseSearchQuery,
  resolveStatusToken,
  resolvePriorityToken,
  resolveAssigneeToken,
  resolveDepartmentToken,
  resolveDueDateToken,
} from './taskSearch';

export interface TaskListFilters {
  searchQuery: string;
  statusFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  departmentFilter: string;
  labelFilterIds: number[];
  dateFromFilter: string;
  dateToFilter: string;
}

export interface TaskListLookups {
  agents: Agent[] | null;
  departments: Array<{ id: number; name: string }>;
  labels: LabelItem[];
}

export interface TaskListLookupsLoading {
  agents: boolean;
  departments: boolean;
  labels: boolean;
}

/**
 * True when the free-text search currently contains a token (e.g.
 * `assignee:jane`) whose matching lookup hasn't loaded yet. See the
 * ticket-list equivalent (`isTicketQueryBlockedByPendingLookups`) for why
 * this has to hold off the fetch rather than let it resolve the token to
 * nothing under `staleTime: Infinity`.
 */
export const isTaskQueryBlockedByPendingLookups = (
  searchQuery: string,
  lookupsLoading: TaskListLookupsLoading,
): boolean => {
  const { tokens } = parseSearchQuery(searchQuery);
  if (tokens.assignee && lookupsLoading.agents) return true;
  if (tokens.department && lookupsLoading.departments) return true;
  if (tokens.labels && lookupsLoading.labels) return true;
  return false;
};

/**
 * Merges the token mini-language (parsed out of free-text search) with the
 * dropdown filter state into the final query params sent to the task-list
 * API. Tokens take priority over the equivalent dropdown filter when both
 * are present. Shared by the task-list fetch and the task-counts fetch so
 * the two can never drift out of sync with each other.
 */
export const buildTaskQueryParams = (
  filters: TaskListFilters,
  lookups: TaskListLookups,
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
  const tokenLabels = resolveLabelTokenIds(parsedSearch.tokens.labels, lookups.labels);
  const tokenDueDate = resolveDueDateToken(parsedSearch.tokens.due_date);

  const rawStatus = resolveFilterValue(tokenStatus, filters.statusFilter);
  const effectiveStatus = rawStatus === 'todo' ? 'open' : rawStatus === 'closed' ? 'completed' : rawStatus;
  const effectivePriority = resolveFilterValue(tokenPriority, filters.priorityFilter);
  const effectiveAssignee = resolveFilterValue(tokenAssignee, filters.assigneeFilter);
  const effectiveDepartment = resolveFilterValue(tokenDepartment, filters.departmentFilter);
  const effectiveLabelIds = tokenLabels.length > 0 ? tokenLabels : filters.labelFilterIds;
  const effectiveDateFrom = tokenDueDate?.from ?? filters.dateFromFilter;
  const effectiveDateTo = tokenDueDate?.to ?? filters.dateToFilter;

  if (effectiveStatus) params.status = effectiveStatus;
  if (effectivePriority) params.priority = effectivePriority;
  if (effectiveAssignee) params.assigned_to = effectiveAssignee;
  if (effectiveDepartment) params.department = effectiveDepartment;
  if (effectiveLabelIds.length > 0) params.label_ids = effectiveLabelIds.join(',');
  if (effectiveDateFrom) params.date_from = effectiveDateFrom;
  if (effectiveDateTo) params.date_to = effectiveDateTo;

  return params;
};
