import { Mail, Phone, MessageCircle, Code, UserCheck, Home } from 'lucide-react';

/**
 * Shared display helper functions for tickets and tasks
 * These functions are used across multiple components to ensure consistency
 */

// Type for Lucide icons
type IconComponent = typeof Mail;

// Status color mapping for tickets and tasks
export const getStatusColor = (status: string): string => {
  const statusLower = status?.toLowerCase() || '';
  switch (statusLower) {
    case 'open':
    case 'created':
    case 'todo':
    case 'assigned':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'in_progress':
    case 'in progress':
    case 'in-progress':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'on_hold':
    case 'on hold':
    case 'hold':
    case 'blocked':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'resolved':
    case 'completed':
      return 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400';
    case 'closed':
      return 'bg-gray-100 text-gray-800 dark:bg-surface-hover dark:text-[var(--text-primary)]';
    case 'reopened':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'draft':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400';
    case 'cancelled':
    case 'canceled':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-surface-hover dark:text-[var(--text-primary)]';
  }
};

// Priority color mapping for tickets and tasks
export const getPriorityColor = (priority: string | null): string => {
  const priorityLower = priority?.toLowerCase() || '';
  switch (priorityLower) {
    case 'low':
      return 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'high':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'critical':
    case 'urgent':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-surface-hover dark:text-[var(--text-primary)]';
  }
};

// Format date to readable string (compact format for tables)
export const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: '2-digit',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
};

// Format date with time (for detail views)
export const formatDateWithTime = (dateString: string | null): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

// Format date with relative time (e.g., "2 hours ago")
export const formatDateWithRelativeTime = (dateString: string): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
};

// Format due date with relative language for near-term dates (matches TicketTasks view)
export const formatDueDate = (dateString: string | null): string => {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    const now = new Date();
    // Compare calendar days, not millisecond differences, to avoid intra-day misclassification
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffInDays = Math.round((dateDay.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Due today';
    if (diffInDays === 1) return 'Due tomorrow';
    if (diffInDays < 0) return `Overdue by ${Math.abs(diffInDays)}d`;
    if (diffInDays <= 7) return `Due in ${diffInDays}d`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateString;
  }
};

// Format due date with relative language AND clock time (for detail panels and table columns)
export const formatDueDateWithTime = (dateString: string | null): string => {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    const now = new Date();
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffInDays = Math.round((dateDay.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24));

    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    if (diffInDays === 0) return `Due today at ${timeStr}`;
    if (diffInDays === 1) return `Due tomorrow at ${timeStr}`;
    if (diffInDays < 0) return `Overdue by ${Math.abs(diffInDays)}d`;
    if (diffInDays <= 7) return `Due in ${diffInDays}d at ${timeStr}`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
};

// Format date for short display
export const formatShortDate = (dateString: string | null): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'Invalid Date';
  }
};

// Source icon mapping
export const getSourceIcon = (source?: string): IconComponent => {
  switch (source?.toLowerCase()) {
    case 'email': return Mail;
    case 'phone': return Phone;
    case 'chat': return MessageCircle;
    case 'chatbot': return MessageCircle;
    case 'api': return Code;
    case 'internal': return UserCheck;
    case 'customer_portal': return Home;
    case 'web':
    case 'portal':
    default: return Home;
  }
};

// Source label mapping
export const getSourceLabel = (source?: string): string => {
  const sourceMap: Record<string, string> = {
    'email': 'Email',
    'web': 'Web/Portal',
    'phone': 'Phone',
    'chat': 'Live Chat',
    'chatbot': 'AI Chatbot',
    'api': 'API',
    'internal': 'Internal',
    'customer_portal': 'Customer Portal',
    'portal': 'Portal',
    'other': 'Other'
  };
  return sourceMap[source?.toLowerCase() || 'web'] || source || 'Unknown';
};

// Valid source options for dropdowns
export const SOURCE_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'web', label: 'Web/Portal' },
  { value: 'phone', label: 'Phone' },
  { value: 'chat', label: 'Live Chat' },
  { value: 'chatbot', label: 'AI Chatbot' },
  { value: 'api', label: 'API/Integrations' },
  { value: 'internal', label: 'Internal/Staff-created' },
  { value: 'customer_portal', label: 'Customer Portal' }
] as const;

// Valid task status options for dropdowns (synced with backend)
export const TASK_STATUS_OPTIONS = [
  { value: '', label: 'Select Status', disabled: true },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' }
] as const;

// Status display label
export const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    'open': 'Open',
    'pending': 'Pending',
    'in_progress': 'In Progress',
    'in progress': 'In Progress',
    'resolved': 'Resolved',
    'completed': 'Completed',
    'closed': 'Closed',
    'on_hold': 'On Hold',
    'on hold': 'On Hold',
    'reopened': 'Reopened',
    'draft': 'Draft',
    'cancelled': 'Cancelled',
    'canceled': 'Cancelled'
  };
  return statusMap[status?.toLowerCase()] || status || 'Unknown';
};

// Priority display label
export const getPriorityLabel = (priority: string | null): string => {
  const priorityMap: Record<string, string> = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'critical': 'Critical',
    'urgent': 'Urgent'
  };
  return priorityMap[priority?.toLowerCase() || ''] || priority || 'Unknown';
};

type DisplayUser = {
  name?: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  isActive?: boolean;
  is_active?: boolean;
};

export const formatUserDisplayName = (user?: DisplayUser | null, fallback: string = 'Unassigned'): string => {
  if (!user) return fallback;

  const firstName = user.firstName ?? user.first_name ?? '';
  const lastName = user.lastName ?? user.last_name ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  const baseName = user.name || fullName || user.email || fallback;
  const isInactive = user.isActive === false || user.is_active === false;

  return isInactive ? `${baseName} (Deactivated Agent)` : baseName;
};
