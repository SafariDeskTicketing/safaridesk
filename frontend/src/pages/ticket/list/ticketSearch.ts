import { Search, CheckCircle, AlertTriangle, User, Building, Tag, Calendar, type LucideIcon } from 'lucide-react';
import type { Agent } from '../../../types';

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

export interface ParsedSearchQuery {
  tokens: Partial<Record<ColumnFilterKey, string>>;
  cleanedQuery: string;
}

/** Parses a token mini-language like `status:open priority:high free text` into
 * structured filter tokens plus the remaining free-text search. */
export const parseSearchQuery = (query: string): ParsedSearchQuery => {
  const regex = /\b(\w+):(?:"([^"]+)"|'([^']+)'|([^\s]+))/g;
  const tokens: Partial<Record<ColumnFilterKey, string>> = {};
  let match: RegExpExecArray | null;

  while ((match = regex.exec(query)) !== null) {
    const rawKey = match[1]?.toLowerCase();
    const mappedKey = rawKey ? SEARCH_TOKEN_KEY_MAP[rawKey] : undefined;
    if (!mappedKey) continue;
    const rawValue = match[2] ?? match[3] ?? match[4] ?? '';
    if (!rawValue) continue;
    tokens[mappedKey] = rawValue.trim();
  }

  const cleanedQuery = query
    .replace(regex, '')
    .replace(/\b\w+:\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { tokens, cleanedQuery };
};

export const formatSearchTokenValue = (value: string): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
};

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

export const resolveAssigneeToken = (value: string | undefined, agents: Agent[] | null): string | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (['unassigned', 'none', 'noone', 'no-one'].includes(normalized)) {
    return 'unassigned';
  }
  const match = agents?.find(agent => {
    const name = agent.name?.toLowerCase() || '';
    const email = agent.email?.toLowerCase() || '';
    return name.includes(normalized) || email.includes(normalized);
  });
  return match ? match.id.toString() : null;
};

export const resolveDepartmentToken = (
  value: string | undefined,
  departments: Array<{ id: number; name: string }>,
): string | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  const match = departments.find(dept => dept.name?.toLowerCase().includes(normalized));
  return match ? match.id.toString() : null;
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

export const resolveCreatedDateToken = (value?: string): { from?: string; to?: string } | null => {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.includes('..')) {
    const [fromRaw, toRaw] = normalized.split('..');
    const from = fromRaw?.trim() || undefined;
    const to = toRaw?.trim() || undefined;
    return { from, to };
  }
  if (normalized.startsWith('>=')) return { from: normalized.slice(2).trim() || undefined };
  if (normalized.startsWith('>')) return { from: normalized.slice(1).trim() || undefined };
  if (normalized.startsWith('<=')) return { to: normalized.slice(2).trim() || undefined };
  if (normalized.startsWith('<')) return { to: normalized.slice(1).trim() || undefined };
  return { from: normalized };
};
