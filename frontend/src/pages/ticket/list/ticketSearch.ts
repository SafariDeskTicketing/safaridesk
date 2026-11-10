import { Search, CheckCircle, AlertTriangle, User, Building, Tag, Calendar, type LucideIcon } from 'lucide-react';
import {
  parseSearchQueryTokens,
  resolveDateRangeToken,
  type ParsedSearchQuery,
} from '../../../utils/searchTokenMiniLanguage';
export {
  formatSearchTokenValue,
  resolveAssigneeToken,
  resolveDepartmentToken,
} from '../../../utils/searchTokenMiniLanguage';

export type ColumnFilterKey =
  | 'status'
  | 'priority'
  | 'assignee'
  | 'department'
  | 'category'
  | 'labels'
  | 'created_at';

export const SEARCH_FILTER_OPTIONS: { key: 'all' | ColumnFilterKey; label: string; description: string }[] = [
  { key: 'all', label: 'Search all', description: 'Search tickets' },
  { key: 'status', label: 'Status', description: 'Filter by status' },
  { key: 'priority', label: 'Priority', description: 'Filter by priority' },
  { key: 'assignee', label: 'Assignee', description: 'Filter by assignee' },
  { key: 'department', label: 'Department', description: 'Filter by department' },
  { key: 'category', label: 'Category', description: 'Filter by category' },
  { key: 'labels', label: 'Labels', description: 'Filter by labels' },
  { key: 'created_at', label: 'Created date', description: 'Filter by created date' },
];

export const SEARCH_FILTER_ICONS: Record<'all' | ColumnFilterKey, LucideIcon> = {
  all: Search,
  status: CheckCircle,
  priority: AlertTriangle,
  assignee: User,
  department: Building,
  category: Tag,
  labels: Tag,
  created_at: Calendar,
};

const SEARCH_TOKEN_KEY_MAP: Record<string, ColumnFilterKey> = {
  status: 'status',
  priority: 'priority',
  assignee: 'assignee',
  assigned: 'assignee',
  department: 'department',
  dept: 'department',
  category: 'category',
  cat: 'category',
  label: 'labels',
  labels: 'labels',
  created: 'created_at',
  createdat: 'created_at',
  created_date: 'created_at',
  created_at: 'created_at',
  due: 'created_at',
  duedate: 'created_at',
  due_date: 'created_at',
};

/** Parses a token mini-language like `status:open priority:high free text` into
 * structured filter tokens plus the remaining free-text search. */
export const parseSearchQuery = (query: string): ParsedSearchQuery<ColumnFilterKey> =>
  parseSearchQueryTokens(query, SEARCH_TOKEN_KEY_MAP);

export const resolveStatusToken = (value?: string): string | null => {
  if (!value) return null;
  let normalized = value.toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
  if (normalized === 'hold') normalized = 'on_hold';
  if (normalized === 'assigned' || normalized === 'todo') normalized = 'open';
  if (normalized === 'solved' || normalized === 'resolved') normalized = 'closed';
  const allowed = new Set(['open', 'in_progress', 'pending', 'on_hold', 'closed']);
  return allowed.has(normalized) ? normalized : null;
};

export const resolvePriorityToken = (value?: string): string | null => {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
  const allowed = new Set(['low', 'medium', 'high', 'urgent', 'normal']);
  return allowed.has(normalized) ? normalized : null;
};

export const resolveCategoryToken = (
  value: string | undefined,
  categories: Array<{ id: number; name: string; department?: number | null }>,
): string | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  const match = categories.find(cat => cat.name?.toLowerCase().includes(normalized));
  return match ? match.id.toString() : null;
};

// Thin named alias: the parsing logic is shared (see resolveDateRangeToken),
// only the field it's applied to (created date vs. due date) is ticket-specific.
export const resolveCreatedDateToken = resolveDateRangeToken;
