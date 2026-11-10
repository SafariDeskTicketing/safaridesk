import { Search, CheckCircle, AlertTriangle, User, Building, Tag, Calendar } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  parseSearchQueryTokens,
  resolveDateRangeToken,
  type ParsedSearchQuery,
} from '../../../utils/searchTokenMiniLanguage';
export { resolveAssigneeToken, resolveDepartmentToken } from '../../../utils/searchTokenMiniLanguage';

export type ColumnFilterKey = 'status' | 'priority' | 'assignee' | 'department' | 'labels' | 'due_date';

export const SEARCH_FILTER_OPTIONS: { key: 'all' | ColumnFilterKey; label: string; description: string }[] = [
  { key: 'all', label: 'Search all', description: 'Search tasks' },
  { key: 'status', label: 'Status', description: 'Filter by status' },
  { key: 'priority', label: 'Priority', description: 'Filter by priority' },
  { key: 'assignee', label: 'Assignee', description: 'Filter by assignee' },
  { key: 'department', label: 'Department', description: 'Filter by department' },
  { key: 'labels', label: 'Labels', description: 'Filter by labels' },
  { key: 'due_date', label: 'Due date', description: 'Filter by due date' },
];

export const SEARCH_FILTER_ICONS: Record<'all' | ColumnFilterKey, LucideIcon> = {
  all: Search,
  status: CheckCircle,
  priority: AlertTriangle,
  assignee: User,
  department: Building,
  labels: Tag,
  due_date: Calendar,
};

const SEARCH_TOKEN_KEY_MAP: Record<string, ColumnFilterKey> = {
  status: 'status',
  priority: 'priority',
  assignee: 'assignee',
  assigned: 'assignee',
  department: 'department',
  dept: 'department',
  label: 'labels',
  labels: 'labels',
  due: 'due_date',
  duedate: 'due_date',
  due_date: 'due_date',
};

export const parseSearchQuery = (query: string): ParsedSearchQuery<ColumnFilterKey> =>
  parseSearchQueryTokens(query, SEARCH_TOKEN_KEY_MAP);

export const resolveStatusToken = (value?: string) => {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
  if (normalized === 'open' || normalized === 'todo') return 'open';
  if (normalized === 'on_hold') return 'hold';
  if (normalized === 'closed') return 'completed';
  const allowed = new Set(['open', 'in_progress', 'completed', 'cancelled', 'hold', 'draft', 'breached']);
  return allowed.has(normalized) ? normalized : null;
};

export const resolvePriorityToken = (value?: string) => {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
  const allowed = new Set(['low', 'medium', 'high', 'critical', 'urgent', 'normal']);
  return allowed.has(normalized) ? normalized : null;
};

// Thin named alias: the parsing logic is shared (see resolveDateRangeToken),
// only the field it's applied to (due date vs. created date) is task-specific.
export const resolveDueDateToken = resolveDateRangeToken;

export const statusLabel = (value: string) => {
  const map: Record<string, string> = {
    todo: 'Todo',
    open: 'Open',
    in_progress: 'In progress',
    completed: 'Completed',
    hold: 'On hold',
    cancelled: 'Cancelled',
    draft: 'Draft',
    breached: 'Breached',
  };
  return map[value] || value.replace(/_/g, ' ');
};
