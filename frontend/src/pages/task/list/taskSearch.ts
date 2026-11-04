import { Search, CheckCircle, AlertTriangle, User, Building, Tag, Calendar } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Agent } from '../../../types';

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

export const parseSearchQuery = (query: string) => {
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

// Takes the agents list directly (callers pass a ref's .current to avoid
// stale closures — see the all.tsx rewrite's equivalent for why this
// matters when the resolver is used inside a memoized fetcher).
export const resolveAssigneeToken = (value: string | undefined, agents: Agent[] | null) => {
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

export const resolveDepartmentToken = (value: string | undefined, departments: Array<{ id: number; name: string }>) => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  const match = departments.find(dept => dept.name?.toLowerCase().includes(normalized));
  return match ? match.id.toString() : null;
};

export const resolveDueDateToken = (value?: string) => {
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
