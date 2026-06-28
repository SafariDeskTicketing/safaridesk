import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sanitizeHTML } from '../../utils/sanitize';
import { createPortal } from 'react-dom';
import {
  Search, Plus, User, Clock, MessageCircle, FileText, Calendar, Tag, CheckCircle, Edit3, UserCheck, X, Archive, Trash2, Download, RotateCcw, AlertTriangle, ChevronDown, Settings, Building, List, UserX, ShieldAlert, AlertCircle
} from 'lucide-react';

// import { Link as RouterLink } from "react-router-dom";
// import { Link as LinkIcon } from "lucide-react";

import { format } from 'date-fns';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { APIS } from '../../services/apis';
import http from '../../services/http';
import { exportSelectedTasks } from '../../services/exports';
import type { ExportFormat } from '../../services/exports';
import { errorNotification, successNotification } from '../../components/ui/Toast';
import type { Agent, LabelItem, TaskObj} from '../../types';
import { TaskActivityStream } from './mini/TaskActivityStream';
import { formatRelativeTime } from '../../utils/helper';
import { getStatusColor, getPriorityColor, formatDate, formatDueDateWithTime, formatDateWithTime, formatUserDisplayName } from '../../utils/displayHelpers';
import Select from '../../components/ui/Select';
import { Tooltip } from '../../components/ui/Tool';
import { getActiveAgents, useFetchAgents } from '../../services/agents';
import type { AgentType, ApiResponse as AgentApiResponse } from '../../types/agents';
import UpdateTaskStatus from './mini/updateStatus';
import EmptyState from '../../components/ui/EmptyState';
import TicketDetailSkeleton from '../../components/ui/TicketDetailSkeleton';
import { TableSkeleton } from '../../components/ui/TableSkeleton';
import { Modal } from '../../components/ui/Modal';
import CreateTaskModal from '../../components/tasks/CreateTaskModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import TaskCard from './mini/TaskCard';
import { useLocation, useNavigate, useBlocker } from 'react-router-dom';
import UpdatePriorityModal from '../../components/tickets/UpdatePriorityModal';
import { ViewModeDropdown } from '../../components/tickets/ViewModeDropdown';
import { AGENT_TASK_VIEW_ITEMS, TASK_VIEW_ITEMS } from '../../components/layout/taskViewConfigs';
import TaskSettingsModal from '../../components/settings/TaskSettingsModal';
import { getTaskRoute } from '../../utils/taskRoutes';
import { HoverPreviewCard } from '../../components/previews/HoverPreviewCard';
import LabelGroup from '../../components/ui/LabelGroup';
import ManageLabelsModal from '../../components/labels/ManageLabelsModal';
import { getLabelNamesByIds, resolveLabelTokenIds } from '../../utils/labels';
import { useHoverPreviewActivity } from '../../hooks/useHoverPreviewActivity';

type BulkExportFormat = Exclude<ExportFormat, 'pdf'>;

const BULK_EXPORT_FORMAT_OPTIONS = [
  { value: 'xlsx', label: 'Excel' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];

// Type definitions based on your API response
interface ApiTask {
  id: number;
  title: string;
  description: string;
  task_status: string;
  priority: string;
  task_trackid: string;
  assigned_to: {
    id: number;
    name?: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    avatar_url?: string;
    is_active?: boolean;
  } | null;
  created_by?: {
    id: number;
    name?: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
    avatar_url?: string;
  } | null;
  due_date: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
  department?: {
    id: number;
    name: string;
    slag?: string;
  } | null;
  is_converted_to_ticket?: boolean;
  linked_ticket?: any;
  labels?: LabelItem[];
}

interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiTask[];
}

interface Watcher {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface TaskPreviewState {
  task: TaskObj;
  anchorRect: DOMRect;
  placement: 'left' | 'right';
}

const PREVIEW_OPEN_DELAY_MS = 350;
const PREVIEW_CLOSE_DELAY_MS = 160;
const PREVIEW_CARD_WIDTH = 544;
const PREVIEW_CARD_SAFE_HEIGHT = 560;
const PREVIEW_VIEWPORT_PADDING = 20;
type TaskViewMode = 'detailed' | 'card' | 'list';

const getStoredTaskViewMode = (): 'card' | 'list' => (
  localStorage.getItem('taskViewMode') === 'card' ? 'card' : 'list'
);

const getDescriptionPreview = (description?: string | null, maxLength = 220): string => {
  if (!description) return 'No description provided';
  const text = description
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return 'No description provided';
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const formatPriorityLabel = (priority?: string | null): string => {
  if (!priority) return 'Normal';
  const value = priority.replace(/_/g, ' ').trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Normal';
};

const formatStatusLabel = (status?: string | null): string => {
  if (!status) return 'Open';
  const value = status.replace(/_/g, ' ').trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Open';
};

interface AssignTaskPayload {
  task_id: string;
  agent_id: number;
}

interface AddWatchersPayload {
  watchers: number[];
}

export default function TaskManagementSystem() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const shouldOpenCreateTask = Boolean((location.state as { openCreate?: boolean } | null)?.openCreate);
  const role = user?.role?.toLowerCase();
  const isAdmin =
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'superuser' ||
    role === 'administrator';
  const canExport = role === 'admin';
  const defaultView = role ? (isAdmin ? 'all_tasks' : 'my_tasks') : 'all_tasks';
  const viewItems = role ? (isAdmin ? TASK_VIEW_ITEMS : AGENT_TASK_VIEW_ITEMS) : TASK_VIEW_ITEMS;

  // API state management
  const [tasks, setTasks] = useState<TaskObj[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskObj | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(() => {
    const saved = localStorage.getItem('taskPageSize');
    return saved ? Number(saved) : 10;
  });
  const [createTaskModal, setCreateTaskModal] = useState(false);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [activeView, setActiveView] = useState('all_tasks');

  useEffect(() => {
    if (!shouldOpenCreateTask) return;
    setCreateTaskModal(true);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
  }, [shouldOpenCreateTask, navigate, location.pathname, location.search]);

  // State from ViewTask
  const [reloader, setReloader] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(false);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const agentsRef = useRef<Agent[] | null>(null);
  const departmentsRef = useRef<Array<{ id: number; name: string }>>([]);
  const labelsRef = useRef<LabelItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [statusDescription, setStatusDescription] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [selectedWatchers, setSelectedWatchers] = useState<number[]>([]);
  const [taskWatchers, setTaskWatchers] = useState<Watcher[]>([]);
  const [labelFilterIds, setLabelFilterIds] = useState<number[]>([]);
  const [showLabelsModal, setShowLabelsModal] = useState(false);
  const [shareLink, setShareLink] = useState(window.location.href);
  const { data: agentResponse = [] } = useFetchAgents();
  const agentsData: AgentType[] = (agentResponse as AgentApiResponse)?.results || [];
  const isUserWatcher = taskWatchers.some(watcher => watcher.id === user?.user_id);

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('activity');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [viewMode, setViewMode] = useState<TaskViewMode>(getStoredTaskViewMode());
  const [isCreateTaskModalDirty, setIsCreateTaskModalDirty] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSearchFilterDropdown, setShowSearchFilterDropdown] = useState(false);
  const [showSearchValueDropdown, setShowSearchValueDropdown] = useState(false);
  const [activeSearchFilterKey, setActiveSearchFilterKey] = useState<ColumnFilterKey | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  type ColumnFilterKey = 'status' | 'priority' | 'assignee' | 'department' | 'labels' | 'due_date';
  const [activeColumnFilter, setActiveColumnFilter] = useState<ColumnFilterKey | null>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [filterPosition, setFilterPosition] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState('');

  useEffect(() => {
    if (viewMode === 'detailed') {
      setViewMode('list');
      localStorage.setItem('taskViewMode', 'list');
      return;
    }
    localStorage.setItem('taskViewMode', viewMode);
  }, [viewMode]);
  const [showCreateTaskCloseConfirm, setShowCreateTaskCloseConfirm] = useState(false);
  const [detailPanelOpen, setDetailPanelOpen] = useState(true);
  const [taskPreview, setTaskPreview] = useState<TaskPreviewState | null>(null);
  const columnFilterRef = useRef<HTMLDivElement>(null);
  const taskPreviewOpenTimeoutRef = useRef<number | null>(null);
  const taskPreviewHideTimeoutRef = useRef<number | null>(null);
  const { ensureLatestComment, getLatestCommentPreview, isLoading: isLatestCommentLoading } = useHoverPreviewActivity();

  const clearTaskPreviewOpenTimeout = () => {
    if (taskPreviewOpenTimeoutRef.current) {
      window.clearTimeout(taskPreviewOpenTimeoutRef.current);
      taskPreviewOpenTimeoutRef.current = null;
    }
  };

  const clearTaskPreviewHideTimeout = () => {
    if (taskPreviewHideTimeoutRef.current) {
      window.clearTimeout(taskPreviewHideTimeoutRef.current);
      taskPreviewHideTimeoutRef.current = null;
    }
  };

  const showTaskPreview = (task: TaskObj, element: HTMLElement) => {
    clearTaskPreviewOpenTimeout();
    clearTaskPreviewHideTimeout();
    const anchorRect = element.getBoundingClientRect();
    const placement = anchorRect.right + PREVIEW_CARD_WIDTH + 14 <= window.innerWidth - 16 ? 'right' : 'left';

    taskPreviewOpenTimeoutRef.current = window.setTimeout(() => {
      setTaskPreview({ task, anchorRect, placement });
      void ensureLatestComment('task', task.id);
    }, PREVIEW_OPEN_DELAY_MS);
  };

  const scheduleHideTaskPreview = () => {
    clearTaskPreviewOpenTimeout();
    clearTaskPreviewHideTimeout();
    taskPreviewHideTimeoutRef.current = window.setTimeout(() => {
      setTaskPreview(null);
    }, PREVIEW_CLOSE_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      clearTaskPreviewOpenTimeout();
      clearTaskPreviewHideTimeout();
    };
  }, []);

  // Handlers for create task modal close confirmation
  const handleCloseCreateTaskModal = () => {
    if (isCreateTaskModalDirty) {
      setShowCreateTaskCloseConfirm(true);
      return;
    }
    setCreateTaskModal(false);
    setIsCreateTaskModalDirty(false);
  };

  const confirmCloseCreateTaskModal = () => {
    setShowCreateTaskCloseConfirm(false);
    setCreateTaskModal(false);
    setIsCreateTaskModalDirty(false);
  };

  // Sorting state
  type TaskSortField = 'id' | 'title' | 'status' | 'priority' | 'department' | 'assignee' | 'due_date';
  const taskSortField: TaskSortField = 'due_date';
  const taskSortDirection: 'asc' | 'desc' = 'asc';
  const searchFilterOptions: { key: 'all' | ColumnFilterKey; label: string; description: string }[] = [
    { key: 'all', label: 'Search all', description: 'Search tasks' },
    { key: 'status', label: 'Status', description: 'Filter by status' },
    { key: 'priority', label: 'Priority', description: 'Filter by priority' },
    { key: 'assignee', label: 'Assignee', description: 'Filter by assignee' },
    { key: 'department', label: 'Department', description: 'Filter by department' },
    { key: 'labels', label: 'Labels', description: 'Filter by labels' },
    { key: 'due_date', label: 'Due date', description: 'Filter by due date' },
  ];
  const searchFilterIcons: Record<'all' | ColumnFilterKey, React.ComponentType<{ size?: number; className?: string }>> = {
    all: Search,
    status: CheckCircle,
    priority: AlertTriangle,
    assignee: User,
    department: Building,
    labels: Tag,
    due_date: Calendar,
  };
  const searchTokenKeyMap: Record<string, ColumnFilterKey> = {
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

  const statusLabel = (value: string) => {
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

  const parseSearchQuery = (query: string) => {
    const regex = /\b(\w+):(?:"([^"]+)"|'([^']+)'|([^\s]+))/g;
    const tokens: Partial<Record<ColumnFilterKey, string>> = {};
    let match: RegExpExecArray | null;

    while ((match = regex.exec(query)) !== null) {
      const rawKey = match[1]?.toLowerCase();
      const mappedKey = rawKey ? searchTokenKeyMap[rawKey] : undefined;
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

  const resolveStatusToken = (value?: string) => {
    if (!value) return null;
    const normalized = value.toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
    if (normalized === 'open' || normalized === 'todo') return 'open';
    if (normalized === 'on_hold') return 'hold';
    if (normalized === 'closed') return 'completed';
    const allowed = new Set(['open', 'in_progress', 'completed', 'cancelled', 'hold', 'draft', 'breached']);
    return allowed.has(normalized) ? normalized : null;
  };

  const resolvePriorityToken = (value?: string) => {
    if (!value) return null;
    const normalized = value.toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
    const allowed = new Set(['low', 'medium', 'high', 'critical', 'urgent', 'normal']);
    return allowed.has(normalized) ? normalized : null;
  };

  const resolveAssigneeToken = (value?: string) => {
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

  const resolveDepartmentToken = (value?: string) => {
    if (!value) return null;
    const normalized = value.toLowerCase();
    const match = departmentsRef.current.find(dept => dept.name?.toLowerCase().includes(normalized));
    return match ? match.id.toString() : null;
  };

  const resolveDueDateToken = (value?: string) => {
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

  const priorityOrder: Record<string, number> = {
    critical: 4,
    urgent: 3,
    high: 2,
    medium: 1,
    normal: 1,
    low: 0,
  };

  const filteredTasks = useMemo(() => {
    const { cleanedQuery } = parseSearchQuery(searchQuery);
    if (!cleanedQuery) return tasks;
    const query = cleanedQuery.toLowerCase();
    return tasks.filter(task => {
      const assigneeName = task.assigned_to
        ? (task.assigned_to.name || `${task.assigned_to.first_name || ''} ${task.assigned_to.last_name || ''}`.trim())
        : '';
      const departmentName = task.department?.name || '';
      return (
        task.task_trackid?.toLowerCase().includes(query) ||
        task.title?.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        assigneeName.toLowerCase().includes(query) ||
        departmentName.toLowerCase().includes(query)
      );
    });
  }, [tasks, searchQuery]);

  // Sort tasks based on current sort field
  const sortedTasks = React.useMemo(() => {
    const toComparable = (task: TaskObj, field: TaskSortField) => {
      switch (field) {
        case 'id':
          return task.task_trackid?.toLowerCase() || '';
        case 'title':
          return task.title?.toLowerCase() || '';
        case 'status':
          return task.task_status?.toLowerCase() || '';
        case 'priority':
          return priorityOrder[task.priority?.toLowerCase()] ?? 0;
        case 'department':
          return task.department?.name?.toLowerCase() || '';
        case 'assignee':
          return task.assigned_to?.name?.toLowerCase() || '';
        case 'due_date':
          return task.due_date ? new Date(task.due_date).getTime() : Infinity;
        default:
          return '';
      }
    };

    return [...filteredTasks].sort((a, b) => {
      const aVal = toComparable(a, taskSortField);
      const bVal = toComparable(b, taskSortField);

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return taskSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr === bStr) return 0;
      if (taskSortDirection === 'asc') {
        return aStr > bStr ? 1 : -1;
      }
      return aStr < bStr ? 1 : -1;
    });
  }, [filteredTasks, taskSortField, taskSortDirection]);

  useEffect(() => {
    if (viewMode === 'detailed') {
      setViewMode('list');
      localStorage.setItem('taskViewMode', 'list');
      return;
    }
    localStorage.setItem('taskViewMode', viewMode);
  }, [viewMode]);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  // Selection state for bulk actions
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [bulkExportFormat, setBulkExportFormat] = useState<BulkExportFormat>('xlsx');

  // Warn before browser close/refresh when tasks are selected
  useEffect(() => {
    if (selectedTasks.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [selectedTasks.size]);

  // Block all in-app navigation (NavLink, navigate(), back/forward) when items are selected
  const blocker = useBlocker(selectedTasks.size > 0);

  // Sync selection count to global store so Sidebar can still show the count in its dialog
  const { setSelectionCount } = useUIStore();
  useEffect(() => {
    setSelectionCount(selectedTasks.size);
    return () => setSelectionCount(0);
  }, [selectedTasks.size]);

  // Selection handlers
  const handleTaskSelection = (taskId: number, selected: boolean) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(taskId);
      } else {
        newSet.delete(taskId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(task => task.id)));
    }
  };

  // Bulk action handlers
  const handleBulkArchive = async () => {
    if (selectedTasks.size === 0) return;
    try {
      const response = await http.post('/task/bulk/archive/', {
        task_ids: Array.from(selectedTasks)
      });
      console.log('Archive response:', response.data);
      setSelectedTasks(new Set());
      // Refresh tasks list
      fetchTasks(currentPage, activeView);
    } catch (error) {
      console.error('Error archiving tasks:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0) return;
    try {
      setIsDeleting(true);
      const response = await http.post('/task/bulk/delete/', {
        task_ids: Array.from(selectedTasks)
      });
      console.log('Delete response:', response.data);
      const isTrash = getViewContext() === 'trash';
      successNotification(isTrash ? 'Tasks permanently deleted' : 'Tasks moved to trash');
      setSelectedTasks(new Set());
      // Refresh tasks list
      fetchTasks(currentPage, activeView);
    } catch (error) {
      console.error('Error deleting tasks:', error);
      errorNotification('Failed to delete selected tasks');
    } finally {
      setIsDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  };

  const showBulkDeleteConfirmation = () => {
    if (selectedTasks.size === 0) return;
    setShowBulkDeleteConfirm(true);
  };

  const handleBulkExport = async () => {
    if (selectedTasks.size === 0) return;
    try {
      await exportSelectedTasks(Array.from(selectedTasks), bulkExportFormat);
      setSelectedTasks(new Set());
    } catch (error) {
      console.error('Error exporting tasks:', error);
    }
  };

  // Get current view context
  const getViewContext = () => {
    if (activeView === 'archived_tasks') return 'archived';
    if (activeView === 'trash_tasks') return 'trash';
    return 'normal';
  };

  // Additional bulk action handlers
  const handleBulkUnarchive = async () => {
    if (selectedTasks.size === 0) return;
    try {
      const response = await http.post('/task/bulk/unarchive/', {
        task_ids: Array.from(selectedTasks)
      });
      console.log('Unarchive response:', response.data);
      setSelectedTasks(new Set());
      fetchTasks(currentPage, activeView);
    } catch (error) {
      console.error('Error unarchiving tasks:', error);
    }
  };

  const handleBulkRestore = async () => {
    if (selectedTasks.size === 0) return;
    try {
      const response = await http.post('/task/bulk/restore/', {
        task_ids: Array.from(selectedTasks)
      });
      console.log('Restore response:', response.data);
      setSelectedTasks(new Set());
      fetchTasks(currentPage, activeView);
    } catch (error) {
      console.error('Error restoring tasks:', error);
    }
  };

  // Get bulk actions based on current view context
  const getBulkActions = () => {
    const context = getViewContext();
    const withExport = (actions: Array<{ key: string; label: string; icon: typeof Download; action: () => void; className: string }>) =>
      canExport ? actions : actions.filter((action) => action.key !== 'export');

    switch (context) {
      case 'archived':
        return withExport([
          { key: 'unarchive', label: 'Unarchive', icon: Archive, action: handleBulkUnarchive, className: 'bg-primary-600 hover:bg-primary-700' },
          { key: 'delete', label: 'Delete', icon: Trash2, action: handleBulkDelete, className: 'bg-red-600 hover:bg-red-700' },
          { key: 'export', label: 'Export', icon: Download, action: handleBulkExport, className: 'bg-primary-600 hover:bg-primary-700' }
        ]);
      case 'trash':
        return withExport([
          { key: 'restore', label: 'Restore', icon: RotateCcw, action: handleBulkRestore, className: 'bg-yellow-600 hover:bg-yellow-700' },
          { key: 'delete', label: 'Delete Forever', icon: Trash2, action: showBulkDeleteConfirmation, className: 'bg-red-600 hover:bg-red-700' },
          { key: 'export', label: 'Export', icon: Download, action: handleBulkExport, className: 'bg-primary-600 hover:bg-primary-700' }
        ]);
      default:
        return withExport([
          { key: 'archive', label: 'Archive', icon: Archive, action: handleBulkArchive, className: 'bg-primary-600 hover:bg-primary-700' },
          { key: 'delete', label: 'Delete', icon: Trash2, action: showBulkDeleteConfirmation, className: 'bg-red-600 hover:bg-red-700' },
          { key: 'export', label: 'Export', icon: Download, action: handleBulkExport, className: 'bg-primary-600 hover:bg-primary-700' }
        ]);
    }
  };

  const getStatusVariant = (status: string): "default" | "primary" | "danger" | "success" | "warning" | "info" => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'todo':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Modal states for task actions
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [updateStatusModalOpen, setUpdateStatusModalOpen] = useState(false);
  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [attachTicketModalOpen, setAttachTicketModalOpen] = useState(false);
  const [attachFileModalOpen, setAttachFileModalOpen] = useState(false);
  const [showLinkedTicketModal, setShowLinkedTicketModal] = useState(false);

  // State for attach ticket functionality
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [tickets, setTickets] = useState<any[]>([]);

  // Fetch tickets for attach functionality
  const fetchTickets = async () => {
    try {
      const response = await http.get(APIS.LIST_TICKETS + '?pagination=no');
      setTickets(response.data.results || response.data);
    } catch (error: any) {
      console.error("Failed to fetch tickets:", error);
    }
  };

  // Handle attach task to ticket
  const handleAttachToTicket = async () => {
    if (!selectedTask || !selectedTicketId) return;
    try {
      setIsSubmitting(true);
      console.log('Attaching task:', selectedTask.id, 'to ticket:', selectedTicketId);
      const response = await http.post(`${APIS.TASK_BASE}/${selectedTask.id}/attach-to-ticket/`, {
        ticket_id: parseInt(selectedTicketId)
      });
      console.log('Attach response:', response.data);
      successNotification(response.data.message);
      fetchTasks(currentPage);
      setAttachTicketModalOpen(false);
      setSelectedTicketId("");
    } catch (error: any) {
      console.error('Attach error:', error);
      errorNotification(error?.response?.data?.message || error?.response?.data?.error || 'Failed to attach task to ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch tickets when attach modal opens
  useEffect(() => {
    if (attachTicketModalOpen) {
      fetchTickets();
    }
  }, [attachTicketModalOpen]);

  // Action handlers for task cards
  const handleTaskAction = async (action: string, task: TaskObj) => {
    setSelectedTask(task);
    switch (action) {
      case 'assign':
        setAssignModalOpen(true);
        break;
      case 'update-status':
        setUpdateStatusModalOpen(true);
        break;
      case 'manage-labels':
        setShowLabelsModal(true);
        break;
      case 'attach-ticket':
        setAttachTicketModalOpen(true);
        break;
      case 'attach-file':
        setAttachFileModalOpen(true);
        break;
      case 'delete':
        setSelectedTasks(new Set([task.id]));
        setShowBulkDeleteConfirm(true);
        break;
      case 'restore':
        try {
          setIsSubmitting(true);
          await http.post('/task/bulk/restore/', {
            task_ids: [task.id],
          });
          successNotification('Task restored from trash');
          fetchTasks(currentPage, activeView);
        } catch (error: any) {
          errorNotification(error?.response?.data?.message || 'Failed to restore task');
        } finally {
          setIsSubmitting(false);
        }
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  const sidebarItems = viewItems
    .map((item) => {
      const query = item.path.split('?')[1] || '';
      const viewKey = new URLSearchParams(query).get('view');
      return viewKey ? { name: item.name, key: viewKey, icon: item.icon } : null;
    })
    .filter(
      (item): item is { name: string; key: string; icon: React.ComponentType<{ size?: number; className?: string }> } =>
        item !== null,
    );

  const activeViewName =
    sidebarItems.find(item => item.key === activeView)?.name ||
    sidebarItems[0]?.name ||
    'All Tasks';
  const isTrashView = activeView === 'trash_tasks';
  const openTaskViewKey = 'open_tasks';
  const closedTaskViewKey = 'completed_tasks';
  const openTaskCount = taskCounts[openTaskViewKey] ?? 0;
  const closedTaskCount = taskCounts[closedTaskViewKey] ?? 0;
  const taskListGridCols = 'grid w-full min-w-full grid-cols-[50px_minmax(94px,118px)_minmax(220px,2fr)_minmax(130px,1fr)_minmax(120px,150px)_minmax(110px,130px)_minmax(110px,130px)_minmax(110px,130px)_minmax(140px,160px)]';
  const showDetailPanel = viewMode === 'detailed' && detailPanelOpen;
  const splitLayoutClass =
    viewMode === 'detailed' && showDetailPanel
      ? 'grid grid-cols-[clamp(300px,30vw,420px)_minmax(0,1fr)]'
      : 'flex';

  const taskPreviewGap = 14;
  const taskPreviewPosition = useMemo(() => {
    if (!taskPreview) return null;

    let left = taskPreview.placement === 'right'
      ? taskPreview.anchorRect.right + taskPreviewGap
      : taskPreview.anchorRect.left - PREVIEW_CARD_WIDTH - taskPreviewGap;

    if (left + PREVIEW_CARD_WIDTH > window.innerWidth - PREVIEW_VIEWPORT_PADDING) {
      left = window.innerWidth - PREVIEW_CARD_WIDTH - PREVIEW_VIEWPORT_PADDING;
    }
    left = Math.max(PREVIEW_VIEWPORT_PADDING, left);

    const anchorCenterY = taskPreview.anchorRect.top + (taskPreview.anchorRect.height / 2);
    let top = anchorCenterY - (PREVIEW_CARD_SAFE_HEIGHT / 2);
    top = Math.max(
      PREVIEW_VIEWPORT_PADDING,
      Math.min(top, window.innerHeight - PREVIEW_CARD_SAFE_HEIGHT - PREVIEW_VIEWPORT_PADDING)
    );

    const arrowOffset = Math.max(
      48,
      Math.min(anchorCenterY - top, PREVIEW_CARD_SAFE_HEIGHT - 48)
    );

    return { left, top, arrowOffset };
  }, [taskPreview]);

  const taskLatestComment = taskPreview ? getLatestCommentPreview('task', taskPreview.task.id) : null;
  const taskLatestCommentLoading = taskPreview ? isLatestCommentLoading('task', taskPreview.task.id) : false;

  const transformApiTask = (apiTask: ApiTask): TaskObj => {
    const priority = apiTask.priority?.toLowerCase();
    return {
      id: apiTask.id,
      title: apiTask.title || '',
      description: apiTask.description || '',
      task_status: (apiTask.task_status === 'open' ? 'todo' : apiTask.task_status) as TaskObj['task_status'],
      priority: ['low', 'medium', 'high', 'critical'].includes(priority) ? priority as TaskObj['priority'] : null,
      task_trackid: apiTask.task_trackid || '',
      assigned_to: apiTask.assigned_to ? {
        id: apiTask.assigned_to.id,
        name: apiTask.assigned_to.name || `${apiTask.assigned_to.first_name || ''} ${apiTask.assigned_to.last_name || ''}`.trim(),
        email: apiTask.assigned_to.email,
        phone_number: apiTask.assigned_to.phone_number,
        is_active: apiTask.assigned_to.is_active ?? true,
      } : null,
      created_by: apiTask.created_by ? {
        id: apiTask.created_by.id,
        name: apiTask.created_by.name || `${apiTask.created_by.first_name || ''} ${apiTask.created_by.last_name || ''}`.trim(),
        email: apiTask.created_by.email || '',
        phone_number: apiTask.created_by.phone_number || '',
      } : null,
      department: apiTask.department ? {
        id: apiTask.department.id,
        name: apiTask.department.name || '',
        slag: apiTask.department.slag || '',
      } : null,
      assigned_to_name: apiTask.assigned_to ? (apiTask.assigned_to.name || `${apiTask.assigned_to.first_name || ''} ${apiTask.assigned_to.last_name || ''}`.trim()) : null,
      due_date: apiTask.due_date,
      created_at: apiTask.created_at,
      updated_at: apiTask.updated_at || apiTask.created_at,
      completed_at: apiTask.completed_at || null,
      is_converted_to_ticket: apiTask.is_converted_to_ticket || false,
      linked_ticket: apiTask.linked_ticket || null,
      status: apiTask.task_status,
      labels: apiTask.labels || [],
    };
  };

  const fetchTasks = React.useCallback(async (page: number = 1, view: string = 'all_tasks', limitOverride?: number) => {
    setIsLoading(true);

    try {
      const effectiveLimit = limitOverride ?? limit;
      const offset = (page - 1) * effectiveLimit;
      const params: Record<string, string | number> = {
        limit: effectiveLimit,
        offset,
        view: view,
      };

      const parsedSearch = parseSearchQuery(searchQuery);
      if (parsedSearch.cleanedQuery) {
        params.search = parsedSearch.cleanedQuery;
      }

      const tokenStatus = resolveStatusToken(parsedSearch.tokens.status);
      const tokenPriority = resolvePriorityToken(parsedSearch.tokens.priority);
      const tokenAssignee = resolveAssigneeToken(parsedSearch.tokens.assignee);
      const tokenDepartment = resolveDepartmentToken(parsedSearch.tokens.department);
      const tokenLabels = resolveLabelTokenIds(parsedSearch.tokens.labels, labelsRef.current);
      const tokenDueDate = resolveDueDateToken(parsedSearch.tokens.due_date);

      const rawStatus = tokenStatus ?? (statusFilter !== 'all' ? statusFilter : null);
      const effectiveStatus = rawStatus === 'todo' ? 'open' : rawStatus === 'closed' ? 'completed' : rawStatus;
      const effectivePriority = tokenPriority ?? (priorityFilter !== 'all' ? priorityFilter : null);
      const effectiveAssignee = tokenAssignee ?? (assigneeFilter !== 'all' ? assigneeFilter : null);
      const effectiveDepartment = tokenDepartment ?? (departmentFilter !== 'all' ? departmentFilter : null);
      const effectiveLabelIds = tokenLabels.length > 0 ? tokenLabels : labelFilterIds;
      const effectiveDateFrom = tokenDueDate?.from ?? dateFromFilter;
      const effectiveDateTo = tokenDueDate?.to ?? dateToFilter;

      if (effectiveStatus) params.status = effectiveStatus;
      if (effectivePriority) params.priority = effectivePriority;
      if (effectiveAssignee) params.assigned_to = effectiveAssignee;
      if (effectiveDepartment) params.department = effectiveDepartment;
      if (effectiveLabelIds.length > 0) params.label_ids = effectiveLabelIds.join(',');
      if (effectiveDateFrom) params.date_from = effectiveDateFrom;
      if (effectiveDateTo) params.date_to = effectiveDateTo;

      // Seed from React Query cache so navigating back feels instant
      const cacheKey = ['tasks', params];
      const cached = queryClient.getQueryData<ApiResponse>(cacheKey);
      if (cached?.results) {
        setTasks(cached.results.map(transformApiTask));
        setTotalCount(cached.count);
        setCurrentPage(page);
        setIsLoading(false);
      }

      const response = await http.get<ApiResponse>(APIS.LOAD_TASKS, {
        params,
      });

      // Cache for next navigation
      queryClient.setQueryData(cacheKey, response.data);

      const transformedTasks = response.data.results.map(transformApiTask);
      setTasks(transformedTasks);
      setTotalCount(response.data.count);
      setCurrentPage(page);

      if (transformedTasks.length === 0) {
        setSelectedTask(null);
      }

    } catch (error: any) {
      errorNotification(error?.response?.data?.message || "An error occurred")

    } finally {
      setTimeout(() => setIsLoading(false), 100);
    }
  }, [limit, statusFilter, priorityFilter, assigneeFilter, departmentFilter, labelFilterIds, dateFromFilter, dateToFilter, searchQuery]);

  // Get active filter labels for display
  const getActiveFilterLabels = () => {
    const labels: string[] = [];
    if (statusFilter && statusFilter !== 'all') labels.push(`Status: ${statusFilter.replace('_', ' ')}`);
    if (priorityFilter && priorityFilter !== 'all') labels.push(`Priority: ${priorityFilter}`);
    if (assigneeFilter && assigneeFilter !== 'all') {
      const agent = agents?.find(a => a.id.toString() === assigneeFilter);
      labels.push(`Assignee: ${agent?.name || (assigneeFilter === 'unassigned' ? 'Unassigned' : 'Selected')}`);
    }
    if (departmentFilter && departmentFilter !== 'all') {
      const dept = departments.find(d => d.id.toString() === departmentFilter);
      labels.push(`Dept: ${dept?.name || 'Selected'}`);
    }
    if (labelFilterIds.length > 0) {
      const labelNames = getLabelNamesByIds(labelFilterIds, labelsRef.current);
      labels.push(`Labels: ${labelNames || 'Selected'}`);
    }
    if (dateFromFilter || dateToFilter) labels.push(`Date Range`);
    return labels;
  };

  const hasActiveFilters =
    (statusFilter && statusFilter !== 'all') ||
    (priorityFilter && priorityFilter !== 'all') ||
    (assigneeFilter && assigneeFilter !== 'all') ||
    (departmentFilter && departmentFilter !== 'all') ||
    labelFilterIds.length > 0 ||
    (dateFromFilter !== '') ||
    (dateToFilter !== '');
  const hasActiveSearch = searchQuery.trim() !== '';
  const showClearFilters = hasActiveFilters || hasActiveSearch;

  // Clear all filters
  const clearAllFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssigneeFilter('all');
    setDepartmentFilter('all');
    setLabelFilterIds([]);
    setDateFromFilter('');
    setDateToFilter('');
    setSearchQuery('');
    setShowSearchFilterDropdown(false);
    setShowSearchValueDropdown(false);
    setActiveSearchFilterKey(null);
    closeColumnFilter();
  };

  const columnFilterActive = {
    status: statusFilter !== 'all',
    priority: priorityFilter !== 'all',
    assignee: assigneeFilter !== 'all',
    department: departmentFilter !== 'all',
    labels: labelFilterIds.length > 0,
    due_date: Boolean(dateFromFilter || dateToFilter),
  };

  const handleViewSelect = (viewKey: string) => {
    const params = new URLSearchParams(location.search);
    params.delete('status');
    params.set('view', viewKey);
    navigate({ pathname: location.pathname, search: params.toString() });
    setActiveView(viewKey);
    setCurrentPage(1);
    setSelectedTask(null);
    setSelectedTasks(new Set());
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);
    if (showSearchValueDropdown) {
      setShowSearchValueDropdown(false);
      setActiveSearchFilterKey(null);
    }

    if (!value.trim()) {
      setShowSearchFilterDropdown(true);
      return;
    }

    const { cleanedQuery } = parseSearchQuery(value);
    if (!cleanedQuery) {
      setShowSearchFilterDropdown(false);
      return;
    }

    setShowSearchFilterDropdown(false);
  };

  const applySearchFilterValue = (key: ColumnFilterKey, value: string) => {
    if (key === 'status') setStatusFilter(value || 'all');
    if (key === 'priority') setPriorityFilter(value || 'all');
    if (key === 'assignee') setAssigneeFilter(value || 'all');
    if (key === 'department') setDepartmentFilter(value || 'all');
    if (key === 'labels') setLabelFilterIds(resolveLabelTokenIds(value, labelsRef.current));
    if (key === 'due_date') {
      if (value) {
        const { from, to } = resolveDueDateToken(value) || {};
        setDateFromFilter(from || '');
        setDateToFilter(to || '');
      } else {
        setDateFromFilter('');
        setDateToFilter('');
      }
    }

    setSearchQuery('');
    setShowSearchValueDropdown(false);
    setActiveSearchFilterKey(null);
    setShowSearchFilterDropdown(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const clearSearchFilterKey = (key: ColumnFilterKey) => {
    if (key === 'status') setStatusFilter('all');
    if (key === 'priority') setPriorityFilter('all');
    if (key === 'assignee') setAssigneeFilter('all');
    if (key === 'department') setDepartmentFilter('all');
    if (key === 'labels') setLabelFilterIds([]);
    if (key === 'due_date') {
      setDateFromFilter('');
      setDateToFilter('');
    }
  };

  const searchFilterChips = useMemo(() => {
    const chips: Array<{ key: ColumnFilterKey; label: string }> = [];
    if (statusFilter && statusFilter !== 'all') chips.push({ key: 'status', label: `Status: ${statusLabel(statusFilter)}` });
    if (priorityFilter && priorityFilter !== 'all') chips.push({ key: 'priority', label: `Priority: ${priorityFilter}` });
    if (assigneeFilter && assigneeFilter !== 'all') {
      const agent = agents?.find(a => a.id.toString() === assigneeFilter);
      const label = assigneeFilter === 'unassigned' ? 'Unassigned' : (agent?.name || agent?.email || 'Selected');
      chips.push({ key: 'assignee', label: `Assignee: ${label}` });
    }
    if (departmentFilter && departmentFilter !== 'all') {
      const dept = departments.find(d => d.id.toString() === departmentFilter);
      chips.push({ key: 'department', label: `Department: ${dept?.name || 'Selected'}` });
    }
    if (labelFilterIds.length > 0) {
      const labelNames = getLabelNamesByIds(labelFilterIds, labels);
      chips.push({ key: 'labels', label: `Labels: ${labelNames || 'Selected'}` });
    }
    if (dateFromFilter || dateToFilter) {
      const rangeLabel = dateFromFilter && dateToFilter
        ? `${dateFromFilter}..${dateToFilter}`
        : dateFromFilter || dateToFilter;
      chips.push({ key: 'due_date', label: `Due: ${rangeLabel}` });
    }
    return chips;
  }, [statusFilter, priorityFilter, assigneeFilter, departmentFilter, labelFilterIds, dateFromFilter, dateToFilter, agents, departments, labels]);

  const handleSearchFilterSelect = (key: 'all' | ColumnFilterKey) => {
    setShowSearchFilterDropdown(false);
    if (key === 'all') {
      setSearchQuery('');
      setShowSearchValueDropdown(false);
      setActiveSearchFilterKey(null);
      requestAnimationFrame(() => searchInputRef.current?.focus());
      return;
    }
    setActiveSearchFilterKey(key);
    setShowSearchValueDropdown(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const openColumnFilter = (key: ColumnFilterKey) => (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (activeColumnFilter === key) {
      setActiveColumnFilter(null);
      setFilterAnchorEl(null);
      return;
    }
    setActiveColumnFilter(key);
    setFilterAnchorEl(event.currentTarget as HTMLElement);
    setColumnFilterSearch('');
    setShowSearchFilterDropdown(false);
  };

  const closeColumnFilter = () => {
    setActiveColumnFilter(null);
    setFilterAnchorEl(null);
    setColumnFilterSearch('');
  };

  const updateFilterPosition = useCallback(() => {
    if (!filterAnchorEl) return;
    const rect = filterAnchorEl.getBoundingClientRect();
    const minWidth = 240;
    const viewportPadding = 12;
    const maxLeft = window.innerWidth - minWidth - viewportPadding;
    const clampedLeft = Math.max(viewportPadding, Math.min(rect.left, maxLeft));
    setFilterPosition({
      top: rect.bottom + 6,
      left: clampedLeft,
      minWidth,
    });
  }, [filterAnchorEl]);

  useEffect(() => {
    if (!activeColumnFilter) return;
    updateFilterPosition();
    const handleScroll = () => updateFilterPosition();
    window.addEventListener('resize', handleScroll);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [activeColumnFilter, updateFilterPosition]);

  useEffect(() => {
    if (!activeColumnFilter) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (columnFilterRef.current?.contains(target)) return;
      if (filterAnchorEl?.contains(target)) return;
      closeColumnFilter();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeColumnFilter();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeColumnFilter, filterAnchorEl]);

  useEffect(() => {
    if (!showSearchFilterDropdown && !showSearchValueDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchContainerRef.current?.contains(target)) return;
      setShowSearchFilterDropdown(false);
      setShowSearchValueDropdown(false);
      setActiveSearchFilterKey(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchFilterDropdown, showSearchValueDropdown]);

  const fetchTaskCounts = async () => {
    try {
      const views = ['all_tasks', 'my_tasks', 'open_tasks', 'in_progress_tasks', 'completed_tasks', 'overdue_tasks', 'archived_tasks', 'trash_tasks'];
      const counts: Record<string, number> = {};

      // Gather all active filters
      const parsedSearch = parseSearchQuery(searchQuery);
      const tokenStatus = resolveStatusToken(parsedSearch.tokens.status);
      const tokenPriority = resolvePriorityToken(parsedSearch.tokens.priority);
      const tokenAssignee = resolveAssigneeToken(parsedSearch.tokens.assignee);
      const tokenDepartment = resolveDepartmentToken(parsedSearch.tokens.department);
      const tokenLabels = resolveLabelTokenIds(parsedSearch.tokens.labels, labelsRef.current);
      const tokenDueDate = resolveDueDateToken(parsedSearch.tokens.due_date);

      const rawStatus = tokenStatus ?? (statusFilter !== 'all' ? statusFilter : null);
      const effectiveStatus = rawStatus === 'todo' ? 'open' : rawStatus === 'closed' ? 'completed' : rawStatus;
      const effectivePriority = tokenPriority ?? (priorityFilter !== 'all' ? priorityFilter : null);
      const effectiveAssignee = tokenAssignee ?? (assigneeFilter !== 'all' ? assigneeFilter : null);
      const effectiveDepartment = tokenDepartment ?? (departmentFilter !== 'all' ? departmentFilter : null);
      const effectiveLabelIds = tokenLabels.length > 0 ? tokenLabels : labelFilterIds;
      const effectiveDateFrom = tokenDueDate?.from ?? dateFromFilter;
      const effectiveDateTo = tokenDueDate?.to ?? dateToFilter;
      const cleanedQuery = parsedSearch.cleanedQuery;

      for (const view of views) {
        try {
          const params: Record<string, string | number> = {
            view: view,
            limit: 1,
            offset: 0,
          };
          if (effectiveStatus) params.status = effectiveStatus;
          if (effectivePriority) params.priority = effectivePriority;
          if (effectiveAssignee) params.assigned_to = effectiveAssignee;
          if (effectiveDepartment) params.department = effectiveDepartment;
          if (effectiveLabelIds.length > 0) params.label_ids = effectiveLabelIds.join(',');
          if (effectiveDateFrom) params.date_from = effectiveDateFrom;
          if (effectiveDateTo) params.date_to = effectiveDateTo;
          if (cleanedQuery) params.search = cleanedQuery;

          const response = await http.get(APIS.LOAD_TASKS, { params });
          counts[view] = response.data.count || 0;
        } catch (error) {
          console.error(`Failed to fetch count for view ${view}:`, error);
          counts[view] = 0;
        }
      }

      setTaskCounts(counts);
    } catch (error) {
      console.error("Failed to fetch task counts:", error);
    }
  };

  React.useEffect(() => {
    fetchTasks(currentPage, activeView);
    fetchTaskCounts();
  }, [fetchTasks, currentPage, activeView, statusFilter, priorityFilter, assigneeFilter, departmentFilter, labelFilterIds, dateFromFilter, dateToFilter, searchQuery]);

  // Real-time: refresh tasks list on WebSocket task_event (task created/updated by anyone)
  React.useEffect(() => {
    const handler = () => fetchTasks(currentPage, activeView);
    window.addEventListener('task_event', handler);
    return () => window.removeEventListener('task_event', handler);
  }, [fetchTasks, currentPage, activeView]);

  // Watch for URL parameter changes and update activeView
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewParam = searchParams.get('view');
    // Valid views: all_tasks, my_tasks, open_tasks, in_progress_tasks, completed_tasks, overdue_tasks, archived_tasks, trash_tasks
    const validViews = ['all_tasks', 'my_tasks', 'open_tasks', 'in_progress_tasks', 'completed_tasks', 'overdue_tasks', 'archived_tasks', 'trash_tasks'];
    const targetView = viewParam && validViews.includes(viewParam) ? viewParam : defaultView;

    if (targetView !== activeView) {
      setActiveView(targetView);
      setCurrentPage(1);
    }
  }, [location.search, activeView, defaultView]);

  useEffect(() => {
    if (viewMode === 'detailed') {
      if (tasks.length > 0) {
        setSelectedTask(currentSelected => {
          const isSelectedInList = tasks.some(t => t.id === currentSelected?.id);
          if (isSelectedInList) {
            return currentSelected;
          }
          return tasks[0];
        });
      } else {
        setSelectedTask(null);
      }
    } else {
      setSelectedTask(null);
    }
  }, [tasks, viewMode]);

  useEffect(() => {
    // Avoid carrying stale selections across normal/trash/archive views.
    setSelectedTasks(new Set());
  }, [activeView]);

  const handleNextTask = () => {
    if (!selectedTask || filteredTasks.length <= 1) return;
    const currentIndex = filteredTasks.findIndex(t => t.id === selectedTask.id);
    const nextIndex = (currentIndex + 1) % filteredTasks.length;
    setSelectedTask(filteredTasks[nextIndex]);
  };

  const handlePreviousTask = () => {
    if (!selectedTask || filteredTasks.length <= 1) return;
    const currentIndex = filteredTasks.findIndex(t => t.id === selectedTask.id);
    const prevIndex = (currentIndex - 1 + filteredTasks.length) % filteredTasks.length;
    setSelectedTask(filteredTasks[prevIndex]);
  };

  const handleNextPage = () => {
    const totalPages = Math.ceil(totalCount / limit);
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Using shared utility functions from displayHelpers

  const getAgentDisplayName = (agent?: Partial<Agent> & { first_name?: string; last_name?: string }) => {
    if (!agent) return 'Unknown Agent';
    const fallbackFullName = `${agent.first_name || ''} ${agent.last_name || ''}`.trim();
    return agent.name?.trim()
      || fallbackFullName
      || agent.email
      || `Agent #${agent.id ?? ''}`;
  };

  const fetchAgents = async () => {
    try {
      const response = await http.get(`${APIS.LIST_AGENTS}?pagination=no`);
      const activeAgents = getActiveAgents(response.data);
      setAgents(activeAgents);
      agentsRef.current = activeAgents;
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || "An error occurred")
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await http.get(APIS.LIST_DEPARTMENTS);
      const payload = Array.isArray(response.data) ? response.data : response.data.results || [];
      setDepartments(payload);
      departmentsRef.current = payload;
    } catch (error: any) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchLabels = async () => {
    try {
      const response = await http.get(APIS.LABELS_BASE, {
        params: {
          pagination: 'no',
          active_only: true,
        },
      });
      const payload = response.data?.results || response.data || [];
      setLabels(payload);
      labelsRef.current = payload;
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to load labels');
    }
  };

  const fetchWatchers = async (currentTaskId: string) => {
    // For now, tasks don't have watchers like tickets
    setTaskWatchers([]);
  };

  useEffect(() => {
    fetchAgents();
    fetchDepartments();
    fetchLabels();
  }, []);

  useEffect(() => {
    if (selectedTask) {
      setSelectedStatus(selectedTask.task_status);
      fetchWatchers(selectedTask.id.toString());
    }
  }, [selectedTask]);

  // Sync selectedTask with updated task data when tasks array changes
  useEffect(() => {
    if (selectedTask && tasks.length > 0) {
      const updatedTask = tasks.find(t => t.id === selectedTask.id);
      if (updatedTask && JSON.stringify(updatedTask) !== JSON.stringify(selectedTask)) {
        setSelectedTask(updatedTask);
      }
    }
  }, [tasks]);

  async function handleStatusUpdate() {
    if (!selectedTask) return;
    try {
      setIsSubmitting(true)
      const response = await http.post(`${APIS.UPDATE_TASK_STATUS}${selectedTask.id}/`, {
        status: selectedStatus
      });
      await fetchTasks(currentPage);
      successNotification(response.data.message)
      setUpdateStatus(false);
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAssignToMe = async () => {
    if (!selectedTask) return;
    setIsAssigning(true);
    try {
      const response = await http.get(`${APIS.ASSIGN_TASK}${selectedTask.id}`);
      successNotification(response.data.message);
      await fetchTasks(currentPage);
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to assign task');
    } finally {
      setIsAssigning(false);
    }
  };

  async function handleAssign() {
    if (!selectedTask) return;
    try {
      setIsSubmitting(true)
      const response = await http.post(`${APIS.ASSIGN_TASK}${selectedTask.id}/`, {
        user_id: Number(selectedAgentId)
      });
      await fetchTasks(currentPage);
      successNotification(response.data.message)
      setSelectedAgentId(''); // Reset selection
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleComment(files?: FileList) {
    if (!selectedTask) return;
    try {
      setIsSubmitting(true)
      const formData = new FormData();
      formData.append('comment', comment);
      formData.append('is_internal', isInternal.toString());
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          formData.append('files', files[i]);
        }
      }
      const response = await http.post(`${APIS.TASK_ADD_COMMENT}${selectedTask.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setComment("")
      setIsInternal(false)
      setReloader(prev => prev + 1);
      successNotification(response.data.message)
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAddWatchers() {
    // For now, tasks don't support watchers
    successNotification("Watchers feature not yet implemented for tasks");
  }

  const handleLabelsSaved = (updatedLabels: LabelItem[]) => {
    if (!selectedTask) return;
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === selectedTask.id
          ? {
              ...task,
              labels: updatedLabels,
            }
          : task,
      ),
    );
    setSelectedTask((currentTask) =>
      currentTask
        ? {
            ...currentTask,
            labels: updatedLabels,
          }
        : currentTask,
    );
  };

  async function handlePriorityUpdate() {
    if (!selectedTask || !selectedPriority) return;
    try {
      setIsSubmitting(true);
      const response = await http.patch(`${APIS.TASK_BASE}/${selectedTask.id}/`, {
        priority: selectedPriority
      });
      await fetchTasks(currentPage);
      successNotification(response.data?.message || "Priority updated successfully");
      setSelectedPriority('');
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || "Failed to update priority");
    } finally {
      setIsSubmitting(false);
    }
  }

  const renderColumnFilterContent = () => {
    if (!activeColumnFilter) return null;
    if (activeColumnFilter === 'status') {
      const options = [
        { value: 'all', label: 'All statuses', icon: List },
        { value: 'todo', label: 'Todo', icon: CheckCircle },
        { value: 'in_progress', label: 'In progress', icon: Clock },
        { value: 'completed', label: 'Completed', icon: CheckCircle },
        { value: 'hold', label: 'On hold', icon: AlertCircle },
        { value: 'cancelled', label: 'Cancelled', icon: AlertCircle },
        { value: 'draft', label: 'Draft', icon: Edit3 },
        { value: 'breached', label: 'Breached', icon: ShieldAlert },
      ];
      return (
        <div className="flex flex-col gap-2">
          <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
            <CheckCircle size={12} className="opacity-70" />
            Filter by status
          </span>
          <div className="space-y-1">
            {options.map(option => {
              const Icon = option.icon;
              return (
              <button
                key={option.value}
                onClick={() => {
                  setStatusFilter(option.value);
                  closeColumnFilter();
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[length:var(--font-body)] transition-colors ${statusFilter === option.value
                  ? 'bg-primary-600 text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <Icon size={14} className="opacity-70" />
                  {option.label}
                </span>
              </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeColumnFilter === 'priority') {
      const options = [
        { value: 'all', label: 'All priorities', icon: List },
        { value: 'low', label: 'Low', icon: ChevronDown },
        { value: 'medium', label: 'Medium', icon: AlertCircle },
        { value: 'high', label: 'High', icon: AlertTriangle },
        { value: 'critical', label: 'Critical', icon: ShieldAlert },
      ];
      return (
        <div className="flex flex-col gap-2">
          <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
            <AlertTriangle size={12} className="opacity-70" />
            Filter by priority
          </span>
          <div className="space-y-1">
            {options.map(option => {
              const Icon = option.icon;
              return (
              <button
                key={option.value}
                onClick={() => {
                  setPriorityFilter(option.value);
                  closeColumnFilter();
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[length:var(--font-body)] transition-colors ${priorityFilter === option.value
                  ? 'bg-primary-600 text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <Icon size={14} className="opacity-70" />
                  {option.label}
                </span>
              </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeColumnFilter === 'assignee') {
      const normalizedQuery = columnFilterSearch.trim().toLowerCase();
      const filteredAgents = (agents || []).filter(agent => {
        const name = (agent.name || '').toLowerCase();
        const email = (agent.email || '').toLowerCase();
        return name.includes(normalizedQuery) || email.includes(normalizedQuery);
      });
      return (
        <div className="flex flex-col gap-3">
          <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
            <User size={12} className="opacity-70" />
            Filter by assignee
          </span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[var(--text-muted)]" size={14} />
            <input
              type="text"
              placeholder="Filter assignees"
              value={columnFilterSearch}
              onChange={(event) => setColumnFilterSearch(event.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[length:var(--font-body)] rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-muted)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            <button
              onClick={() => {
                setAssigneeFilter('all');
                closeColumnFilter();
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-[length:var(--font-body)] transition-colors ${assigneeFilter === 'all'
                ? 'bg-primary-600 text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                }`}
            >
              <span className="flex items-center gap-2">
                <List size={14} className="opacity-70" />
                All assignees
              </span>
            </button>
            <button
              onClick={() => {
                setAssigneeFilter('unassigned');
                closeColumnFilter();
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-[length:var(--font-body)] transition-colors ${assigneeFilter === 'unassigned'
                ? 'bg-primary-600 text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                }`}
            >
              <span className="flex items-center gap-2">
                <UserX size={14} className="opacity-70" />
                Unassigned
              </span>
            </button>
            {filteredAgents.map(agent => (
              <button
                key={agent.id}
                onClick={() => {
                  setAssigneeFilter(agent.id.toString());
                  closeColumnFilter();
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[length:var(--font-body)] transition-colors ${assigneeFilter === agent.id.toString()
                  ? 'bg-primary-600 text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <User size={14} className="opacity-70" />
                  {agent.name || agent.email || 'Unknown agent'}
                </span>
              </button>
            ))}
            {filteredAgents.length === 0 && (
              <div className="px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-muted)]">No assignees found.</div>
            )}
          </div>
        </div>
      );
    }

    if (activeColumnFilter === 'department') {
      return (
        <div className="flex flex-col gap-2">
          <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
            <Building size={12} className="opacity-70" />
            Filter by department
          </span>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            <button
              onClick={() => {
                setDepartmentFilter('all');
                closeColumnFilter();
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-[length:var(--font-body)] transition-colors ${departmentFilter === 'all'
                ? 'bg-primary-600 text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                }`}
            >
              <span className="flex items-center gap-2">
                <List size={14} className="opacity-70" />
                All departments
              </span>
            </button>
            {departments.map(dept => (
              <button
                key={dept.id}
                onClick={() => {
                  setDepartmentFilter(dept.id.toString());
                  closeColumnFilter();
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[length:var(--font-body)] transition-colors ${departmentFilter === dept.id.toString()
                  ? 'bg-primary-600 text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <Building size={14} className="opacity-70" />
                  {dept.name}
                </span>
              </button>
            ))}
            {departments.length === 0 && (
              <div className="px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-muted)]">No departments found.</div>
            )}
          </div>
        </div>
      );
    }

    if (activeColumnFilter === 'labels') {
      const filteredLabels = labels.filter((labelItem) =>
        labelItem.name.toLowerCase().includes(columnFilterSearch.trim().toLowerCase()) ||
        (labelItem.description || '').toLowerCase().includes(columnFilterSearch.trim().toLowerCase()),
      );

      return (
        <div className="flex flex-col gap-3">
          <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
            <Tag size={12} className="opacity-70" />
            Filter by labels
          </span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[var(--text-muted)]" size={14} />
            <input
              type="text"
              placeholder="Search labels"
              value={columnFilterSearch}
              onChange={(event) => setColumnFilterSearch(event.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[length:var(--font-body)] rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-muted)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            <button
              onClick={() => {
                setLabelFilterIds([]);
                closeColumnFilter();
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-[length:var(--font-body)] transition-colors ${
                labelFilterIds.length === 0
                  ? 'bg-primary-600 text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
              }`}
            >
              <span className="flex items-center gap-2">
                <List size={14} className="opacity-70" />
                All labels
              </span>
            </button>
            {filteredLabels.map((labelItem) => {
              const isSelected = labelFilterIds.includes(labelItem.id);
              return (
                <button
                  key={labelItem.id}
                  onClick={() => {
                    setLabelFilterIds((current) =>
                      isSelected ? current.filter((id) => id !== labelItem.id) : [...current, labelItem.id],
                    );
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-[length:var(--font-body)] transition-colors ${
                    isSelected
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <LabelGroup labels={[labelItem]} size="sm" />
                    <input type="checkbox" readOnly checked={isSelected} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
                  </div>
                </button>
              );
            })}
            {filteredLabels.length === 0 && (
              <div className="px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-muted)]">No labels found.</div>
            )}
          </div>
        </div>
      );
    }

    if (activeColumnFilter === 'due_date') {
      return (
        <div className="flex flex-col gap-3">
          <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
            <Calendar size={12} className="opacity-70" />
            Filter by due date
          </span>
          <div className="grid grid-cols-1 gap-2">
            <label className="text-[length:var(--font-meta)] text-[var(--text-muted)]">From</label>
            <input
              type="date"
              value={dateFromFilter}
              onChange={(event) => setDateFromFilter(event.target.value)}
              className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <label className="text-[length:var(--font-meta)] text-[var(--text-muted)]">To</label>
            <input
              type="date"
              value={dateToFilter}
              onChange={(event) => setDateToFilter(event.target.value)}
              className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setDateFromFilter('');
                setDateToFilter('');
                closeColumnFilter();
              }}
              className="px-2.5 py-1.5 text-[length:var(--font-body)] rounded-[var(--shell-radius)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            >
              <span className="flex items-center gap-2">
                <X size={14} className="opacity-70" />
                Clear
              </span>
            </button>
            <button
              onClick={closeColumnFilter}
              className="px-2.5 py-1.5 text-[length:var(--font-body)] rounded-md bg-primary-600 text-white hover:bg-primary-700"
            >
              <span className="flex items-center gap-2">
                <CheckCircle size={14} />
                Apply
              </span>
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <ConfirmDialog
        show={blocker.state === 'blocked'}
        title="Leave page?"
        message={`You have ${selectedTasks.size} task${selectedTasks.size !== 1 ? 's' : ''} selected. Navigating away will clear your selection.`}
        confirmText="Leave"
        cancelText="Stay"
        variant="warning"
        cancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    <div className="flex h-full min-w-0 w-full flex-1 flex-col bg-transparent text-[var(--text-primary)]">
      {/* Main Content */}
      <div className="flex-1 flex min-w-0 flex-col overflow-hidden">

      {/* Top Header */}
      <header className="bg-[var(--card-bg)] border-b border-[var(--border-color)] px-5 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">{activeViewName}</h1>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCreateTaskModal(true)}
                  className="bg-primary-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-primary-700 flex items-center space-x-2 text-[length:var(--font-body)] font-medium"
                >
                  <Plus size={14} />
                  <span>Create Task</span>
                </button>
                <div className="lg:hidden">
                  <ViewModeDropdown viewMode={viewMode === 'card' ? 'card' : 'list'} onViewChange={(mode) => setViewMode(mode)} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[240px] max-w-[520px]">
                <div ref={searchContainerRef} className="relative w-full">
                  <div className="relative w-full">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search tasks"
                    value={searchQuery}
                    onChange={handleSearchChange}
                  onFocus={() => {
                    const { cleanedQuery } = parseSearchQuery(searchQuery);
                    if (activeSearchFilterKey) {
                      setShowSearchValueDropdown(true);
                      setShowSearchFilterDropdown(false);
                    } else if (!searchQuery.trim()) {
                      setShowSearchFilterDropdown(true);
                    } else if (!cleanedQuery) {
                      setShowSearchFilterDropdown(false);
                    }
                  }}
                    className="w-full h-[var(--shell-search-height)] pl-3.5 pr-20 text-[length:var(--font-body)] border border-[var(--border-color)] bg-[var(--surface-muted)] text-[var(--text-primary)] rounded-[var(--shell-radius)] focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-[var(--text-muted)]"
                  />
                  <div className="absolute right-0 top-0 h-full flex items-center">
                    {showClearFilters && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="h-full px-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        aria-label="Clear filters"
                      >
                        <X size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => searchInputRef.current?.focus()}
                      className="h-full px-3 border-l border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--hover-bg)] flex items-center justify-center rounded-r-[var(--shell-radius)]"
                      aria-label="Search"
                    >
                      <Search size={14} />
                    </button>
                  </div>
                  </div>

                  {searchFilterChips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {searchFilterChips.map(chip => (
                        <button
                          key={`${chip.key}-${chip.label}`}
                          type="button"
                          onClick={() => clearSearchFilterKey(chip.key)}
                          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-gray-200 dark:border-subtle bg-white dark:bg-surface-elevated text-[length:var(--font-meta)] text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover"
                        >
                          <span>{chip.label}</span>
                          <X size={12} className="opacity-70" />
                        </button>
                      ))}
                    </div>
                  )}

                {showSearchFilterDropdown && !searchQuery.trim() && (
                  <div className="sd-floating-popover absolute left-0 top-full z-50 mt-2 w-64 p-1.5">
                    <div className="px-2 py-1 text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Search filters</div>
                    <div className="mt-1 space-y-1">
                      {searchFilterOptions.map(option => {
                        const Icon = searchFilterIcons[option.key];
                        return (
                          <button
                            key={option.key}
                            onClick={() => handleSearchFilterSelect(option.key)}
                            className="w-full text-left px-2.5 py-2 rounded-md text-[length:var(--font-body)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                          >
                            <div className="flex items-center gap-2 font-medium">
                              <Icon size={14} className="text-[var(--text-muted)]" />
                              <span>{option.label}</span>
                            </div>
                            <div className="text-[length:var(--font-meta)] text-[var(--text-muted)]">{option.description}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {showSearchValueDropdown && activeSearchFilterKey && (
                  <div className="sd-floating-popover absolute left-0 top-full z-50 mt-2 w-72 p-1.5">
                      {activeSearchFilterKey === 'status' && (
                        <>
                          <div className="px-2 py-1 text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Select status</div>
                          <div className="mt-1 space-y-1">
                            {[
                              { value: 'all', label: 'All statuses', icon: List },
                              { value: 'todo', label: 'Todo', icon: CheckCircle },
                              { value: 'in_progress', label: 'In progress', icon: Clock },
                              { value: 'completed', label: 'Completed', icon: CheckCircle },
                              { value: 'hold', label: 'On hold', icon: AlertCircle },
                              { value: 'cancelled', label: 'Cancelled', icon: AlertCircle },
                              { value: 'draft', label: 'Draft', icon: Edit3 },
                              { value: 'breached', label: 'Breached', icon: ShieldAlert },
                            ].map(option => {
                              const Icon = option.icon;
                              return (
                              <button
                                key={option.value}
                                onClick={() => applySearchFilterValue('status', option.value)}
                                className="w-full text-left px-2.5 py-2 rounded-md text-[length:var(--font-body)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                              >
                                <span className="flex items-center gap-2">
                                  <Icon size={14} className="opacity-70" />
                                  {option.label}
                                </span>
                              </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                      {activeSearchFilterKey === 'priority' && (
                        <>
                          <div className="px-2 py-1 text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Select priority</div>
                          <div className="mt-1 space-y-1">
                            {[
                              { value: 'all', label: 'All priorities', icon: List },
                              { value: 'low', label: 'Low', icon: ChevronDown },
                              { value: 'medium', label: 'Medium', icon: AlertCircle },
                              { value: 'high', label: 'High', icon: AlertTriangle },
                              { value: 'critical', label: 'Critical', icon: ShieldAlert },
                            ].map(option => {
                              const Icon = option.icon;
                              return (
                              <button
                                key={option.value}
                                onClick={() => applySearchFilterValue('priority', option.value)}
                                className="w-full text-left px-2.5 py-2 rounded-md text-[length:var(--font-body)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                              >
                                <span className="flex items-center gap-2">
                                  <Icon size={14} className="opacity-70" />
                                  {option.label}
                                </span>
                              </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    {activeSearchFilterKey === 'assignee' && (
                      <>
                        <div className="px-2 py-1 text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Select assignee</div>
                        <div className="mt-1 space-y-1 max-h-60 overflow-y-auto">
                            <button
                              onClick={() => applySearchFilterValue('assignee', 'all')}
                              className="w-full text-left px-2.5 py-2 rounded-md text-[length:var(--font-body)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                            >
                              <span className="flex items-center gap-2">
                                <List size={14} className="opacity-70" />
                                All assignees
                              </span>
                            </button>
                            <button
                              onClick={() => applySearchFilterValue('assignee', 'unassigned')}
                              className="w-full text-left px-2.5 py-2 rounded-md text-[length:var(--font-body)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                            >
                              <span className="flex items-center gap-2">
                                <UserX size={14} className="opacity-70" />
                                Unassigned
                              </span>
                            </button>
                            {agents?.map(agent => {
                              const name = agent.name || `${agent.first_name || ''} ${agent.last_name || ''}`.trim();
                              return (
                                <button
                                  key={agent.id}
                                  onClick={() => applySearchFilterValue('assignee', agent.id.toString())}
                                  className="w-full text-left px-2.5 py-2 rounded-md text-[length:var(--font-body)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                                >
                                  <span className="flex items-center gap-2">
                                    <User size={14} className="opacity-70" />
                                    {name || agent.email}
                                  </span>
                                </button>
                              );
                            })}
                          {!agents?.length && (
                            <div className="px-2.5 py-2 text-[length:var(--font-body)] text-[var(--text-muted)]">No assignees found.</div>
                          )}
                        </div>
                      </>
                    )}
                    {activeSearchFilterKey === 'department' && (
                      <>
                        <div className="px-2 py-1 text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Select department</div>
                        <div className="mt-1 space-y-1 max-h-60 overflow-y-auto">
                            <button
                              onClick={() => applySearchFilterValue('department', 'all')}
                              className="w-full text-left px-2.5 py-2 rounded-md text-[length:var(--font-body)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                            >
                              <span className="flex items-center gap-2">
                                <List size={14} className="opacity-70" />
                                All departments
                              </span>
                            </button>
                            {departments.map(dept => (
                              <button
                                key={dept.id}
                                onClick={() => applySearchFilterValue('department', dept.id.toString())}
                                className="w-full text-left px-2.5 py-2 rounded-md text-[length:var(--font-body)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                              >
                                <span className="flex items-center gap-2">
                                  <Building size={14} className="opacity-70" />
                                  {dept.name}
                                </span>
                              </button>
                            ))}
                          {departments.length === 0 && (
                            <div className="px-2.5 py-2 text-[length:var(--font-body)] text-[var(--text-muted)]">No departments found.</div>
                          )}
                        </div>
                      </>
                    )}
                    {activeSearchFilterKey === 'labels' && (
                      <>
                        <div className="px-2 py-1 text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Select labels</div>
                        <div className="mt-1 space-y-1 max-h-60 overflow-y-auto">
                          {labelFilterIds.length > 0 && (
                            <button
                              onClick={() => setLabelFilterIds([])}
                              className="w-full text-left px-2.5 py-2 rounded-md text-[length:var(--font-body)] text-primary-600 dark:text-primary-400 hover:bg-gray-100 dark:hover:bg-surface-hover"
                            >
                              Clear labels
                            </button>
                          )}
                          {labels.map((labelItem) => {
                            const isSelected = labelFilterIds.includes(labelItem.id);
                            return (
                              <button
                                key={labelItem.id}
                                onClick={() => {
                                  setLabelFilterIds((current) =>
                                    isSelected ? current.filter((id) => id !== labelItem.id) : [...current, labelItem.id],
                                  );
                                }}
                                className={`w-full text-left px-2.5 py-2 rounded-md text-[length:var(--font-body)] ${
                                  isSelected
                                    ? 'bg-primary-50 dark:bg-primary-900/20'
                                    : 'hover:bg-gray-100 dark:hover:bg-surface-hover'
                                }`}
                              >
                                <LabelGroup labels={[labelItem]} size="sm" />
                              </button>
                            );
                          })}
                          {labels.length === 0 && (
                            <div className="px-2.5 py-2 text-[length:var(--font-body)] text-[var(--text-muted)]">No labels found.</div>
                          )}
                        </div>
                      </>
                    )}
                    {activeSearchFilterKey === 'due_date' && (
                      <>
                        <div className="px-2 py-1 text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Select due date</div>
                        <div className="mt-2 grid grid-cols-1 gap-2 px-1">
                          <label className="text-[length:var(--font-meta)] text-[var(--text-muted)]">From</label>
                          <input
                            type="date"
                            value={dateFromFilter}
                            onChange={(event) => setDateFromFilter(event.target.value)}
                            className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <label className="text-[length:var(--font-meta)] text-[var(--text-muted)]">To</label>
                          <input
                            type="date"
                            value={dateToFilter}
                            onChange={(event) => setDateToFilter(event.target.value)}
                            className="w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-muted)] px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-3 px-1">
                            <button
                              onClick={() => applySearchFilterValue('due_date', '')}
                              className="px-2.5 py-1.5 text-[length:var(--font-body)] rounded-[var(--shell-radius)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                            >
                              <span className="flex items-center gap-2">
                                <X size={14} className="opacity-70" />
                                Clear
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                const tokenValue = dateFromFilter && dateToFilter
                                  ? `${dateFromFilter}..${dateToFilter}`
                                  : dateFromFilter || dateToFilter || '';
                                applySearchFilterValue('due_date', tokenValue);
                              }}
                              className="px-2.5 py-1.5 text-[length:var(--font-body)] rounded-md bg-primary-600 text-white hover:bg-primary-700"
                            >
                              <span className="flex items-center gap-2">
                                <CheckCircle size={14} />
                                Apply
                              </span>
                            </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <button
                  onClick={() => {
                    const nextView = isTrashView ? defaultView : 'trash_tasks';
                    handleViewSelect(nextView);
                  }}
                  className={`px-2.5 py-1.5 text-[length:var(--font-body)] font-medium rounded-lg border border-gray-200 dark:border-subtle flex items-center gap-2 transition-colors ${
                    isTrashView
                      ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40'
                      : 'bg-white dark:bg-surface-elevated text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover'
                  }`}
                >
                  <Trash2 size={14} />
                  <span>Trash</span>
                </button>
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="px-2.5 py-1.5 text-[length:var(--font-body)] font-medium rounded-lg border border-gray-200 dark:border-subtle bg-white dark:bg-surface-elevated text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover flex items-center gap-2"
                >
                  <Settings size={14} />
                  <span>Settings</span>
                </button>
                <div className="hidden lg:flex">
                  <ViewModeDropdown viewMode={viewMode === 'card' ? 'card' : 'list'} onViewChange={(mode) => setViewMode(mode)} />
                </div>
                {viewMode === 'detailed' && (
                  <button
                    onClick={() => setDetailPanelOpen(prev => !prev)}
                    className="px-2.5 py-1.5 text-[length:var(--font-body)] font-medium rounded-lg border border-gray-200 dark:border-subtle bg-white dark:bg-surface-elevated text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
                  >
                    {detailPanelOpen ? 'Hide Details' : 'Show Details'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className={`flex-1 min-w-0 overflow-hidden ${splitLayoutClass}`}>
          {/* Tasks List */}
          <div className={`${viewMode === 'detailed' && showDetailPanel ? 'min-w-0' : 'w-full'} min-w-0 flex flex-col`} style={{ background: 'var(--card-bg)', borderRight: '1px solid var(--border-color)' }}>

            {/* Bulk Actions - Show when tasks are selected */}
            {selectedTasks.size > 0 && (
              <div className="m-4 flex items-center gap-2 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                <span className="text-[length:var(--font-body)] font-medium text-primary-700 dark:text-primary-300">
                  {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  {canExport && <div className="w-28">
                    <Select
                      value={bulkExportFormat}
                      onChange={(value) => setBulkExportFormat(value as BulkExportFormat)}
                      options={BULK_EXPORT_FORMAT_OPTIONS}
                      placeholder="Format"
                    />
                  </div>}
                  {getBulkActions().map((action) => {
                    const IconComponent = action.icon;
                    return (
                      <button
                        key={action.key}
                        onClick={action.action}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-[length:var(--font-body)] text-white rounded-lg transition-colors ${action.className}`}
                        title={action.label}
                      >
                        <IconComponent size={14} />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tasks */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <TableSkeleton rows={7} columns={9} minWidth={1140} />
              ) : viewMode === 'list' ? (
                <div className="p-4">
                  <div className="overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] shadow-sm">
                    <div className="min-w-[1140px] w-full">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--card-bg)]">
                        {!isTrashView && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleViewSelect(openTaskViewKey)}
                              disabled={activeView === openTaskViewKey}
                              className={`px-3 py-1.5 text-[14px] rounded-lg transition-colors ${activeView === openTaskViewKey
                                ? 'bg-transparent text-gray-900 dark:text-white font-semibold cursor-default'
                                : 'bg-white dark:bg-surface-elevated text-gray-500 dark:text-gray-400 opacity-80 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-hover cursor-pointer'
                              }`}
                            >
                              <span>Open</span>
                              <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[14px] text-gray-700 dark:bg-surface-hover dark:text-[var(--text-primary)]">
                                {openTaskCount}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleViewSelect(closedTaskViewKey)}
                              disabled={activeView === closedTaskViewKey}
                              className={`px-3 py-1.5 text-[14px] rounded-lg transition-colors ${activeView === closedTaskViewKey
                                ? 'bg-transparent text-gray-900 dark:text-white font-semibold cursor-default'
                                : 'bg-white dark:bg-surface-elevated text-gray-500 dark:text-gray-400 opacity-80 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-hover cursor-pointer'
                              }`}
                            >
                              <span>Closed</span>
                              <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[14px] text-gray-700 dark:bg-surface-hover dark:text-[var(--text-primary)]">
                                {closedTaskCount}
                              </span>
                            </button>
                          </>
                        )}
                        {isTrashView && (
                          <div className="text-[14px] text-gray-500 dark:text-gray-400 italic">
                            Showing all deleted tasks
                          </div>
                        )}
                      </div>
                      <div className={`${taskListGridCols} text-[14px] font-semibold tracking-wide bg-white dark:bg-surface-hover text-gray-800 dark:text-[var(--text-primary)] rounded-t-lg border-b border-gray-200 dark:border-subtle`}>
                        <div className="flex items-center justify-center py-3 px-3">
                          <input
                            type="checkbox"
                            checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0}
                            onChange={() => {
                              if (selectedTasks.size === filteredTasks.length) setSelectedTasks(new Set());
                              else setSelectedTasks(new Set(filteredTasks.map(t => t.id)));
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                        </div>
                        <div className="py-3 px-3 text-left whitespace-nowrap">Task ID</div>
                        <div className="py-3 px-3 text-left">Subject</div>
                        <button
                          onClick={openColumnFilter('labels')}
                          className={`py-3 px-3 text-left whitespace-nowrap flex items-center gap-1 ${columnFilterActive.labels ? 'text-primary-600 dark:text-primary-400' : ''}`}
                        >
                          Labels <ChevronDown size={12} className={activeColumnFilter === 'labels' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                        <button
                          onClick={openColumnFilter('status')}
                          className={`py-3 px-3 text-center whitespace-nowrap flex items-center justify-center gap-1 ${columnFilterActive.status ? 'text-primary-600 dark:text-primary-400' : ''}`}
                        >
                          Status <ChevronDown size={12} className={activeColumnFilter === 'status' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                        <button
                          onClick={openColumnFilter('priority')}
                          className={`py-3 px-3 text-center whitespace-nowrap flex items-center justify-center gap-1 ${columnFilterActive.priority ? 'text-primary-600 dark:text-primary-400' : ''}`}
                        >
                          Priority <ChevronDown size={12} className={activeColumnFilter === 'priority' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                        <button
                          onClick={openColumnFilter('department')}
                          className={`py-3 px-3 text-left whitespace-nowrap flex items-center gap-1 ${columnFilterActive.department ? 'text-primary-600 dark:text-primary-400' : ''}`}
                        >
                          Department <ChevronDown size={12} className={activeColumnFilter === 'department' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                        <button
                          onClick={openColumnFilter('assignee')}
                          className={`py-3 px-3 text-left whitespace-nowrap flex items-center gap-1 ${columnFilterActive.assignee ? 'text-primary-600 dark:text-primary-400' : ''}`}
                        >
                          Assignee <ChevronDown size={12} className={activeColumnFilter === 'assignee' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                        <button
                          onClick={openColumnFilter('due_date')}
                          className={`py-3 px-3 text-center whitespace-nowrap flex items-center justify-center gap-1 ${columnFilterActive.due_date ? 'text-primary-600 dark:text-primary-400' : ''}`}
                        >
                          Due Date <ChevronDown size={12} className={activeColumnFilter === 'due_date' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                      </div>
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {sortedTasks.length === 0 ? (
                          <div className="px-6 py-10 text-center text-[length:var(--font-body)] text-[var(--text-muted)]">
                            <p>No tasks found.</p>
                            {(statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all' || departmentFilter !== 'all' || labelFilterIds.length > 0 || dateFromFilter || dateToFilter) ? (
                              <p className="mt-1">Try adjusting your filters.</p>
                            ) : (
                              <p className="mt-1">Tasks will appear here once created.</p>
                            )}
                          </div>
                        ) : (
                          sortedTasks.map(task => {
                            const isSelected = selectedTasks.has(task.id);
                            const due = formatDateWithTime(task.due_date);
                            return (
                              <div
                                key={task.id}
                                onClick={() => {
                                  const route = getTaskRoute(task);
                                  if (route) navigate(route);
                                }}
                                className={`${taskListGridCols} items-center text-[14px] bg-gray-50 dark:bg-surface-elevated hover:bg-gray-100 dark:hover:bg-surface-hover cursor-pointer transition-colors`}
                              >
                                <div className="flex items-center justify-center py-3 px-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleTaskSelection(task.id, e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  />
                                </div>
                                <div className="py-3 px-3 text-left whitespace-nowrap text-[length:var(--font-meta)] font-semibold tracking-wide text-primary-700 dark:text-primary-300">
                                  #{task.task_trackid}
                                </div>
                                <div className="py-3 px-3 text-left text-gray-900 dark:text-[var(--text-primary)]">
                                  <div className="relative group min-w-0">
                                    <span
                                      className="block truncate text-[14px] font-medium leading-5"
                                      onMouseEnter={(e) => showTaskPreview(task, e.currentTarget)}
                                      onMouseLeave={scheduleHideTaskPreview}
                                    >
                                      {task.title}
                                    </span>
                                  </div>
                                </div>
                                <div className="py-3 px-3 text-left text-[14px] text-gray-900 dark:text-[var(--text-primary)]">
                                  <LabelGroup labels={task.labels || []} size="table" maxVisible={3} emptyText="—" />
                                </div>
                                <div className="py-3 px-3 flex justify-center">
                                  <button
                                    className="focus:outline-none"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTask(task);
                                      setSelectedStatus(task.task_status);
                                      setUpdateStatusModalOpen(true);
                                    }}
                                  >
                                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[14px] font-semibold border ${getStatusColor(task.task_status)}`}>
                                      {task.task_status.replace('_', ' ')}
                                    </span>
                                  </button>
                                </div>
                                <div className="py-3 px-3 flex justify-center">
                                  <button
                                    className="focus:outline-none"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTask(task);
                                      setSelectedPriority(task.priority);
                                      setPriorityModalOpen(true);
                                    }}
                                  >
                                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[14px] font-semibold border ${getPriorityColor(task.priority)}`}>
                                      {task.priority}
                                    </span>
                                  </button>
                                </div>
                                <div className="py-3 px-3 text-left text-[14px] text-gray-700 dark:text-[var(--text-primary)]">
                                  <span className="block truncate font-medium">{task.department?.name || '—'}</span>
                                </div>
                                <div className="py-3 px-3 text-left text-[14px] text-gray-700 dark:text-[var(--text-primary)]">
                                  <button
                                    className="w-full truncate text-left font-medium"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTask(task);
                                      setAssignModalOpen(true);
                                    }}
                                  >
                                    {formatUserDisplayName(task.assigned_to as any, 'Unassigned')}
                                  </button>
                                </div>
                                <div className="py-3 px-3 text-center text-[14px] text-gray-700 dark:text-[var(--text-primary)] truncate">
                                  {due}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : filteredTasks.length === 0 ? (
                <EmptyState />
              ) : viewMode === 'detailed' ? (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`mx-3 my-1.5 cursor-pointer rounded-[12px] border p-3 transition-colors ${selectedTask?.id === task.id
                      ? 'border-primary-300 bg-primary-50/70 dark:border-primary-700 dark:bg-primary-900/20'
                      : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-subtle dark:bg-surface-elevated dark:hover:bg-surface-hover'
                      }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-9 h-9 bg-primary-500 rounded-full flex items-center justify-center text-white font-medium text-[length:var(--font-meta)]">
                        {task.title.charAt(0)?.toUpperCase() || 'T'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="truncate text-[length:var(--font-body)] font-semibold text-gray-900 dark:text-[var(--text-primary)]">{task.title}</h3>
                          <span className="text-[length:var(--font-meta)] font-medium text-[var(--text-muted)]">{format(new Date(task.created_at), 'dd MMM')}</span>
                        </div>
                        <LabelGroup labels={task.labels || []} maxVisible={3} className="mb-2" />
                        <p className="mb-2 line-clamp-1 text-[length:var(--font-meta)] font-semibold tracking-wide text-primary-700 dark:text-primary-300">#{task.task_trackid}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-[length:var(--font-meta)] font-medium border ${getStatusColor(task.task_status)}`}>
                              {task.task_status.replace('_', ' ')}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-[length:var(--font-meta)] font-medium ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-[length:var(--font-meta)] text-[var(--text-muted)]">
                            <MessageCircle size={14} />
                            <span>{task.comments_count || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : viewMode === 'card' ? (
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isTrashView={isTrashView}
                      openDropdownId={openDropdownId}
                      onDropdownToggle={(taskId) =>
                        setOpenDropdownId(openDropdownId === Number(taskId) ? null : Number(taskId))
                      }
                      onDropdownClose={() => setOpenDropdownId(null)}
                      onAction={handleTaskAction}
                      formatDate={formatDate}
                      getStatusVariant={getStatusVariant}
                      getDueDateStatus={(dueDate) => 'normal'}
                      isSelected={selectedTasks.has(task.id)}
                      onSelectionChange={handleTaskSelection}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-[var(--border-color)]">
              <div className="flex items-center justify-between text-[length:var(--font-body)] text-[var(--text-secondary)]">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-[var(--border-color)] rounded-lg bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span>
                    {(currentPage - 1) * limit + 1}–{Math.min(currentPage * limit, totalCount)} of {totalCount}
                  </span>
                  <span className="text-[var(--text-muted)]">|</span>
                  <Select
                    value={String(limit)}
                    onChange={(val) => {
                      const newLimit = Number(val);
                      setLimit(newLimit);
                      localStorage.setItem('taskPageSize', String(newLimit));
                      setCurrentPage(1);
                    }}
                    options={[
                      { value: '10', label: '10' },
                      { value: '25', label: '25' },
                      { value: '50', label: '50' },
                      { value: '100', label: '100' },
                    ]}
                    size="sm"
                    direction="up"
                    className="w-20"
                  />
                  <span>per page</span>
                </div>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage * limit >= totalCount}
                  className="px-3 py-1 border border-[var(--border-color)] rounded-lg bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Task Details */}
          {isLoading ? (
            <TicketDetailSkeleton />
          ) : selectedTask && showDetailPanel ? (
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-gray-50 dark:bg-surface">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Header and Summary Section */}
                <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle overflow-hidden">
                  {/* Header Section */}
                  <div className="px-5 py-3 border-b border-gray-200 dark:border-subtle">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-1 truncate">
                          {selectedTask.title}
                        </h1>
                        <LabelGroup labels={selectedTask.labels || []} className="mb-3" emptyText="" />
                        <div className="flex items-center space-x-4 mb-3">
                          <span className="text-[length:var(--font-body)] font-medium text-gray-600 dark:text-[var(--text-muted)]">
                            {selectedTask.task_trackid}
                          </span>
                          <span className="text-[length:var(--font-body)] text-[var(--text-muted)]">
                            Created {formatRelativeTime(selectedTask.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center flex-wrap gap-2">
                          <span className={`px-3 py-1 rounded-full text-[length:var(--font-meta)] font-semibold border ${getStatusColor(selectedTask.task_status)}`}>
                            {selectedTask.task_status.replace("_", " ").toUpperCase()}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-[length:var(--font-meta)] font-semibold border ${getPriorityColor(selectedTask.priority)}`}>
                            {selectedTask.priority?.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="ml-4 flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {!selectedTask.assigned_to && (
                          <button
                            onClick={handleAssignToMe}
                            disabled={isAssigning}
                            className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-[length:var(--font-body)] font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            {isAssigning ? 'Assigning...' : 'Assign to me'}
                          </button>
                        )}

                        <button
                          onClick={() => setShowLabelsModal(true)}
                          className="inline-flex items-center px-4 py-2.5 border border-gray-200 dark:border-subtle bg-white dark:bg-surface-elevated text-[length:var(--font-body)] font-semibold rounded-xl text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
                        >
                          <Tag className="w-4 h-4 mr-2" />
                          Manage Labels
                        </button>

                        <div className="flex items-center bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-subtle p-1 shadow-sm">
                          <div className="flex items-center space-x-1">
                            <Tooltip
                              key={`status-tooltip-${selectedTask.task_status}`}
                              content={
                                <div className="p-4">
                                  <UpdateTaskStatus
                                    handleStatusUpdate={handleStatusUpdate}
                                    isSubmitting={isSubmitting}
                                    selectedOption={selectedStatus}
                                    setSelectedOption={setSelectedStatus}
                                    statusDescription={statusDescription}
                                    setStatusDescription={setStatusDescription}
                                    currentStatus={selectedTask.task_status}
                                  />
                                </div>
                              }
                            >
                              <button
                                className="inline-flex items-center justify-center w-10 h-10 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all duration-200 group"
                                title="Update Status"
                              >
                                <Edit3 size={18} className="group-hover:scale-110 transition-transform" />
                              </button>
                            </Tooltip>

                            {user?.role.toUpperCase() === "ADMIN" && (
                              <Tooltip
                                content={
                                  <div className="p-4">
                                    <Select
                                      id="assign-agent"
                                      label="Select Agent"
                                      value={selectedAgentId}
                                      onChange={setSelectedAgentId}
                                      options={[
                                        { value: "", label: "Choose agent...", disabled: true },
                                        ...(agents && agents.length > 0
                                          ? agents
                                            .filter(agent => agent.id !== selectedTask.assigned_to?.id)
                                            .map(agent => ({
                                              value: agent.id.toString(),
                                              label: getAgentDisplayName(agent)
                                            }))
                                          : [{ value: "", label: "No agents found", disabled: true }]
                                        )
                                      ]}
                                      placeholder="Choose agent..."
                                      size="md"
                                      required={true}
                                      allowSearch={true}
                                    />
                                    <div className="flex justify-end space-x-2 mt-4 pt-3 border-t border-gray-200">
                                      <button
                                        onClick={handleAssign}
                                        disabled={isSubmitting || !selectedAgentId}
                                        className="px-2.5 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors text-[length:var(--font-body)] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {isSubmitting ? "Please wait.. " : "Reassign"}
                                      </button>
                                    </div>
                                  </div>
                                }
                              >
                                <button
                                  className="inline-flex items-center justify-center w-10 h-10 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all duration-200 group"
                                  title={selectedTask.assigned_to ? "Reassign Task" : "Assign Task"}
                                >
                                  <UserCheck size={18} className="group-hover:scale-110 transition-transform" />
                                </button>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                      <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                        <div className="flex items-center mb-3">
                          <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mr-3">
                            <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                          </div>
                          <h3 className="text-[length:var(--font-body)] font-semibold text-gray-900 dark:text-[var(--text-primary)]">Assignee</h3>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center text-[length:var(--font-body)] text-gray-700 dark:text-[var(--text-primary)]">
                    <User className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                            <span
                              className="font-medium cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                              title="Click to change assignee"
                              onClick={() => setAssignModalOpen(true)}
                            >
                              {formatUserDisplayName(selectedTask.assigned_to as any, 'Unassigned')}
                              <Edit3 size={12} className="inline ml-1 opacity-50" />
                            </span>
                          </div>
                          <div className="flex items-center text-[length:var(--font-body)] text-gray-600 dark:text-[var(--text-muted)]">
                    <Tag className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                            General
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                        <div className="flex items-center mb-3">
                          <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mr-3">
                            <CheckCircle className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                          </div>
                          <h3 className="text-[length:var(--font-body)] font-semibold text-gray-900 dark:text-[var(--text-primary)]">Status & Priority</h3>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center text-[length:var(--font-body)] text-gray-700 dark:text-[var(--text-primary)]">
                    <CheckCircle className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                            <span
                              className="font-medium cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors capitalize"
                              title="Click to change status"
                              onClick={() => setUpdateStatusModalOpen(true)}
                            >
                              {selectedTask.task_status.replace('_', ' ')}
                              <Edit3 size={12} className="inline ml-1 opacity-50" />
                            </span>
                          </div>
                          <div className="flex items-center text-[length:var(--font-body)] text-gray-700 dark:text-[var(--text-primary)]">
                    <AlertTriangle className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                            <span
                              className="font-medium cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 transition-colors capitalize"
                              title="Click to change priority"
                              onClick={() => setPriorityModalOpen(true)}
                            >
                              {selectedTask.priority || 'N/A'}
                              <Edit3 size={12} className="inline ml-1 opacity-50" />
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center mb-3">
                          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mr-3">
                            <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <h3 className="text-[length:var(--font-body)] font-semibold text-gray-900 dark:text-[var(--text-primary)]">Timeline</h3>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center text-[length:var(--font-body)] text-gray-600 dark:text-[var(--text-muted)]">
                    <Calendar className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                            Created: {formatDate(selectedTask.created_at)}
                          </div>
                          <div className="flex items-center text-[length:var(--font-body)] text-gray-600 dark:text-[var(--text-muted)]">
                    <Clock className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                            Due: {formatDueDateWithTime(selectedTask.due_date)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-subtle dark:bg-surface-elevated">
                      <div className="mb-3 flex items-center gap-2">
                        <Tag className="h-4 w-4 text-[var(--text-muted)]" />
                        <h3 className="text-[length:var(--font-body)] font-semibold text-gray-900 dark:text-[var(--text-primary)]">Labels</h3>
                      </div>
                      <LabelGroup labels={selectedTask.labels || []} size="md" emptyText="No labels assigned" />
                    </div>

                    <div className="bg-gray-50 dark:bg-surface-elevated rounded-lg p-4">
                      <div className="flex items-center mb-3">
                        <FileText className="w-4 h-4 text-gray-600 dark:text-[var(--text-muted)] mr-2" />
                        <h3 className="text-[length:var(--font-body)] font-semibold text-gray-900 dark:text-[var(--text-primary)]">Description</h3>
                      </div>
                      {selectedTask.description ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none  overflow-y-auto"
                          dangerouslySetInnerHTML={{ __html: sanitizeHTML(selectedTask.description) }}
                        />
                      ) : (
                        <span className="text-[length:var(--font-body)] text-[var(--text-muted)] italic">No description provided</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle">
                  <div className="border-b border-gray-200 dark:border-subtle">
                    <nav className="flex space-x-8 overflow-x-auto whitespace-nowrap px-6" aria-label="Tabs">
                      <button onClick={() => setActiveTab('activity')} className={`py-4 px-1 border-b-2 font-medium text-[length:var(--font-body)] flex items-center space-x-2 ${activeTab === 'activity' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-[var(--text-primary)] dark:hover:text-gray-300'}`}>
                        <MessageCircle className="w-4 h-4" />
                        <span>Activity Stream</span>
                      </button>
                    </nav>
                  </div>

                  <div className="p-6">
                    {activeTab === 'activity' && (
                      <TaskActivityStream
                        taskId={selectedTask.id}
                        reloader={reloader}
                        isCustomerView={false}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : viewMode === 'detailed' && showDetailPanel ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState title="No task selected" message="Please select a task to view its details." />
            </div>
          ) : null}
        </div>
      </div>

      {/* Create task modal */}
      <Modal
        size='4xl'
        isOpen={createTaskModal}
        onClose={handleCloseCreateTaskModal}
        title="Create New Task"
        closeOnBackdropClick={false}
      >
        {
          createTaskModal && <CreateTaskModal
            reload={() => fetchTasks(currentPage)}
            onclose={handleCloseCreateTaskModal}
            onSuccess={confirmCloseCreateTaskModal}
            onDirtyChange={setIsCreateTaskModalDirty}
          />
        }
      </Modal>

      {/* Unsaved Changes Confirmation Dialog */}
      <ConfirmDialog
        show={showCreateTaskCloseConfirm}
        cancel={() => setShowCreateTaskCloseConfirm(false)}
        onConfirm={confirmCloseCreateTaskModal}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to close without saving?"
        variant="warning"
        confirmText="Close Anyway"
        cancelText="Keep Editing"
      />


      {/* Assign Task Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Task"
      >
        <div className="p-4">
          <div className="mb-4">
            <label className="block text-[length:var(--font-body)] font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
              Select Agent
            </label>
            <Select
              id="assign-agent-modal"
              value={selectedAgentId}
              onChange={setSelectedAgentId}
              options={[
                { value: "", label: "Choose agent...", disabled: true },
                ...(agents && agents.length > 0
                  ? agents
                    .filter(agent => agent.id !== selectedTask?.assigned_to?.id)
                    .map(agent => ({
                      value: agent.id.toString(),
                      label: getAgentDisplayName(agent)
                    }))
                  : [{ value: "", label: "No agents found", disabled: true }]
                )
              ]}
              placeholder="Choose agent..."
              size="md"
              required={true}
              allowSearch={true}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setAssignModalOpen(false)}
              className="px-2.5 py-1.5 text-gray-600 hover:text-gray-800 dark:text-[var(--text-primary)] dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                handleAssign();
                setAssignModalOpen(false);
              }}
              disabled={isSubmitting || !selectedAgentId}
              className="px-2.5 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors text-[length:var(--font-body)] font-medium disabled:opacity-50"
            >
              {isSubmitting ? "Assigning..." : "Assign"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={updateStatusModalOpen}
        onClose={() => setUpdateStatusModalOpen(false)}
        title="Update Task Status"
      >
        <div className="p-4">
          <UpdateTaskStatus
            handleStatusUpdate={() => {
              handleStatusUpdate();
              setUpdateStatusModalOpen(false);
            }}
            isSubmitting={isSubmitting}
            selectedOption={selectedStatus}
            setSelectedOption={setSelectedStatus}
            statusDescription={statusDescription}
            setStatusDescription={setStatusDescription}
            currentStatus={selectedTask?.task_status || 'todo'}
          />
        </div>
      </Modal>

      <UpdatePriorityModal
        ticketId={selectedTask?.id?.toString() || ''}
        currentPriority={selectedPriority || selectedTask?.priority || 'medium'}
        isOpen={priorityModalOpen}
        onClose={() => setPriorityModalOpen(false)}
        onPriorityUpdated={() => fetchTasks(currentPage)}
      />

      {/* Attach to Ticket Modal */}
      <Modal
        isOpen={attachTicketModalOpen}
        onClose={() => setAttachTicketModalOpen(false)}
        title="Attach Task to Ticket"
      >
        <div className="p-4">
          <div className="mb-4">
            <label className="block text-[length:var(--font-body)] font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
              Select Ticket
            </label>
            <Select
              id="attach-ticket-modal"
              value={selectedTicketId}
              onChange={setSelectedTicketId}
              options={[
                { value: "", label: "Choose ticket...", disabled: true },
                ...(tickets && tickets.length > 0
                  ? tickets.map(ticket => ({
                    value: ticket.id.toString(),
                    label: `${ticket.ticket_id} - ${ticket.title}`
                  }))
                  : [{ value: "", label: "No tickets found", disabled: true }]
                )
              ]}
              placeholder="Choose ticket..."
              size="md"
              required={true}
              allowSearch={true}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setAttachTicketModalOpen(false)}
              className="px-2.5 py-1.5 text-gray-600 hover:text-gray-800 dark:text-[var(--text-primary)] dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                handleAttachToTicket();
                setAttachTicketModalOpen(false);
              }}
              disabled={isSubmitting || !selectedTicketId}
              className="px-2.5 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors text-[length:var(--font-body)] font-medium disabled:opacity-50"
            >
              {isSubmitting ? "Attaching..." : "Attach"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Attach File Modal */}
      <Modal
        isOpen={attachFileModalOpen}
        onClose={() => setAttachFileModalOpen(false)}
        title="Attach File to Task"
      >
        <div className="p-4">
          <p className="text-[length:var(--font-body)] text-gray-600 dark:text-[var(--text-muted)] mb-4">
            File attachment feature is not yet implemented for tasks.
          </p>
          <div className="flex justify-end">
            <button
              onClick={() => setAttachFileModalOpen(false)}
              className="px-2.5 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        title={getViewContext() === 'trash' ? 'Delete Forever' : 'Delete Tasks'}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] mb-1">
                {getViewContext() === 'trash'
                  ? `Permanently delete ${selectedTasks.size} task${selectedTasks.size > 1 ? 's' : ''}?`
                  : `Delete ${selectedTasks.size} task${selectedTasks.size > 1 ? 's' : ''}?`}
              </p>
              <p className="text-sm text-gray-600 dark:text-secondary">
                {getViewContext() === 'trash'
                  ? 'This action cannot be undone. The selected tasks will be permanently removed.'
                  : 'The selected tasks will be moved to trash and can be restored later.'}
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              onClick={() => setShowBulkDeleteConfirm(false)}
              className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-subtle rounded-lg text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
              disabled={isDeleting}
            >
              {getViewContext() === 'trash' ? 'Delete Forever' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {typeof document !== 'undefined' && activeColumnFilter && filterPosition &&
        createPortal(
          <div
            ref={columnFilterRef}
            className="sd-floating-popover fixed z-[9999] p-1.5"
            style={{
              top: filterPosition.top,
              left: filterPosition.left,
              width: filterPosition.minWidth,
              maxWidth: filterPosition.minWidth,
            }}
          >
            {renderColumnFilterContent()}
          </div>,
          document.body
        )}

      {typeof document !== 'undefined' && taskPreview && taskPreviewPosition &&
        createPortal(
          <div
            className="fixed z-[10000]"
            style={{ left: taskPreviewPosition.left, top: taskPreviewPosition.top }}
            onMouseEnter={clearTaskPreviewHideTimeout}
            onMouseLeave={scheduleHideTaskPreview}
          >
            <HoverPreviewCard
              icon={FileText}
              title={taskPreview.task.title}
              subtitle={`Task #${taskPreview.task.task_trackid}`}
              placement={taskPreview.placement}
              arrowOffset={taskPreviewPosition.arrowOffset}
              onClose={() => setTaskPreview(null)}
              summaryFields={[
                { label: 'Priority', value: formatPriorityLabel(taskPreview.task.priority) },
                { label: 'Status', value: formatStatusLabel(taskPreview.task.task_status) },
                { label: 'Due date', value: taskPreview.task.due_date ? formatDueDateWithTime(taskPreview.task.due_date) : '—' },
              ]}
              description={getDescriptionPreview(taskPreview.task.description, 280)}
              latestActivity={{
                label: 'Latest update',
                loading: taskLatestCommentLoading,
                empty: !taskLatestComment && !taskLatestCommentLoading,
                emptyTitle: 'No recent activity',
                emptyDescription: 'The latest task comment will appear here when activity exists.',
                authorName: taskLatestComment?.authorName,
                authorAvatar: taskLatestComment?.authorAvatar,
                createdAt: taskLatestComment?.createdAt,
                content: taskLatestComment?.content,
              }}
              detailFields={[
                { label: 'Department', value: taskPreview.task.department?.name || '—' },
                { label: 'Assignee', value: formatUserDisplayName(taskPreview.task.assigned_to as any, 'Unassigned') },
                { label: 'Created by', value: formatUserDisplayName(taskPreview.task.created_by as any, 'Unknown User') },
                { label: 'Linked ticket', value: taskPreview.task.linked_ticket?.ticket_id || 'Not attached' },
              ]}
            />
          </div>,
          document.body
        )}

      {selectedTask && (
        <ManageLabelsModal
          entityType="task"
          entityId={selectedTask.id}
          isOpen={showLabelsModal}
          onClose={() => setShowLabelsModal(false)}
          selectedLabels={selectedTask.labels || []}
          onSaved={handleLabelsSaved}
          title="Manage Labels"
        />
      )}

      <TaskSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
      </div>
    </>
  );
}
