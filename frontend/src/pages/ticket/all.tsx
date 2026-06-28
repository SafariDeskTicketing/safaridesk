import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useBlocker } from 'react-router-dom';
import {
  Search, Plus, User, Clock, MessageCircle, FileText, ChevronDown, ChevronRight, ChevronLeft, ChevronUp, Paperclip, Grid3x3, Eye, Calendar, Mail, Phone, Tag, CheckCircle, Edit3, UserCheck, CheckSquare, AlertCircle, ShieldAlert, Archive, Trash2, Download, RotateCcw, Link as LinkIcon, Building, AlertTriangle, UserX, XCircle, Inbox, CreditCard, Settings, X, List, PauseCircle, Ticket as TicketIcon
} from 'lucide-react';
import { format, isToday } from 'date-fns';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { APIS } from '../../services/apis';
import http from '../../services/http';
import { exportSelectedTickets } from '../../services/exports';
import type { ExportFormat } from '../../services/exports';
import { errorNotification, successNotification } from '../../components/ui/Toast';
import type { Agent, LabelItem, Ticket } from '../../types';
import TicketAttachments from './mini/TicketAttachments';
import TicketTasks from './mini/TicketTasks';
import { formatRelativeTime } from '../../utils/helper';
import { SOURCE_OPTIONS, getSourceLabel, getSourceIcon as getSourceIconHelper, getStatusColor, getPriorityColor, formatDate, formatDateWithTime, formatUserDisplayName } from '../../utils/displayHelpers';
import Select from '../../components/ui/Select';
import MultiSelectAgents from '../../components/ui/MultiSelectAgents';
import { TicketActivityStream } from './mini/TicketActivityStream';
import SlaInfo from './mini/SlaInfo';
import { Tooltip } from '../../components/ui/Tool';
import { Input } from '../../components/ui/Input';
import { getActiveAgents, useFetchAgents } from '../../services/agents';
import type { AgentType, ApiResponse as AgentApiResponse } from '../../types/agents';
import UpdateTicketStatus from './mini/TicketUpdateStatus';
import EmptyState from '../../components/ui/EmptyState';
import TicketDetailSkeleton from '../../components/ui/TicketDetailSkeleton';
import { TableSkeleton } from '../../components/ui/TableSkeleton';
import { GridTicketCard } from '../../components/tickets/GridCard';
import { Modal } from '../../components/ui/Modal';
import { CreateTicketModal } from '../../components/tickets/CreateTicketModal';
import { TicketCard } from '../../components/tickets/TicketCard';
import { DynamicStepper } from '../../components/ui/Stepper';
import { ReopenTicketModal } from './mini/ReopenTicketModal';
import { ViewModeDropdown } from '../../components/tickets/ViewModeDropdown';
import UpdateStatusModal from '../../components/tickets/UpdateStatusModal';
import UpdatePriorityModal from '../../components/tickets/UpdatePriorityModal';
import { TaskListDialog } from '../../components/tickets/TaskListDialog';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { NewBadge } from '../../components/ui/NewBadge';
import { AGENT_TICKET_VIEW_ITEMS, TICKET_VIEW_ITEMS } from '../../components/layout/viewConfigs';
import TicketSettingsModal from '../../components/settings/TicketSettingsModal';
import { HoverPreviewCard } from '../../components/previews/HoverPreviewCard';
import { sanitizeHTML } from '../../utils/sanitize';
import { EmailHtmlViewer } from '../../components/EmailHtmlViewer';
import LabelGroup from '../../components/ui/LabelGroup';
import ManageLabelsModal from '../../components/labels/ManageLabelsModal';
import { getLabelNamesByIds, resolveLabelTokenIds } from '../../utils/labels';
import { useHoverPreviewActivity } from '../../hooks/useHoverPreviewActivity';
import { useCopilotStore } from '../../stores/copilotStore';
import { Loader } from '../../components/loader/loader';

type BulkExportFormat = Exclude<ExportFormat, 'pdf'>;

const BULK_EXPORT_FORMAT_OPTIONS = [
  { value: 'xlsx', label: 'Excel' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];

// Type definitions based on your API response
interface ApiTicket {
  id: number;
  title: string;
  creator_name: string;
  creator_phone: string;
  creator_email: string;
  ticket_id: string;
  description: string;
  category: {
    id: number;
    name: string;
  };
  department: {
    id: number;
    name: string;
  };
  priority: string;
  priority_display: string;
  is_public: boolean;
  status: string;
  status_display: string;
  created_at: string;
  updated_at?: string;
  assigned_to: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    avatar_url?: string;
    is_active?: boolean;
  } | null;
  breached: boolean;
  due_date?: string;
  source?: 'email' | 'web' | 'phone' | 'chat' | 'chatbot' | 'api' | 'internal' | 'customer_portal'; // Ticket source field
  linked_tasks_count?: number;
  is_opened?: boolean;
  has_new_reply?: boolean;
  labels?: LabelItem[];
}

interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiTicket[];
}

interface Watcher {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface AssignTicketPayload {
  ticket_id: string;
  agent_id: number;
}

interface AddWatchersPayload {
  watchers: number[];
}

interface TicketPreviewState {
  ticket: Ticket;
  anchorRect: DOMRect;
  placement: 'left' | 'right';
}

const PREVIEW_OPEN_DELAY_MS = 350;
const PREVIEW_CLOSE_DELAY_MS = 160;
const PREVIEW_CARD_WIDTH = 544;
const PREVIEW_CARD_SAFE_HEIGHT = 560;
const PREVIEW_VIEWPORT_PADDING = 20;
type TicketViewMode = 'detailed' | 'card' | 'list';

const getStoredTicketViewMode = (): 'card' | 'list' => (
  localStorage.getItem('ticketViewMode') === 'card' ? 'card' : 'list'
);

const formatCreatedDateForList = (dateString: string | null | undefined): string => {
  if (!dateString) {
    return '—';
  }

  const createdAt = new Date(dateString);
  if (Number.isNaN(createdAt.getTime())) {
    return '—';
  }

  return isToday(createdAt)
    ? format(createdAt, 'h:mm a')
    : format(createdAt, 'MMM d, yy h:mm a');
};

const isRichHtmlDescription = (description?: string | null): boolean => {
  if (!description) return false;
  return (
    /<html/i.test(description) ||
    /<table/i.test(description) ||
    /<style/i.test(description) ||
    /<\/?[a-z][\s\S]*>/i.test(description)
  );
};

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


export default function TicketManagementSystem() {

  const { user } = useAuthStore()
  const setCopilotActiveTicket = useCopilotStore((state) => state.setActiveTicket);
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const shouldOpenCreateTicket = Boolean((location.state as { openCreate?: boolean } | null)?.openCreate);
  const role = user?.role?.toLowerCase();
  const isAdmin =
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'superuser' ||
    role === 'administrator';
  const canExport = role === 'admin';
  const defaultView = role ? (isAdmin ? 'all_unresolved' : 'all_unassigned') : 'all_unresolved';
  const viewItems = role ? (isAdmin ? TICKET_VIEW_ITEMS : AGENT_TICKET_VIEW_ITEMS) : TICKET_VIEW_ITEMS;

  // API state management
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = React.useState<Ticket | null>(null);
  const [totalCount, setTotalCount] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [limit, setLimit] = React.useState(() => {
    const saved = localStorage.getItem('ticketPageSize');
    return saved ? Number(saved) : 10;
  });
  const [createTicket, setCreateTicket] = useState(false)
  const [ticketCounts, setTicketCounts] = useState<Record<string, number>>({});
  const [activeView, setActiveView] = useState('all_unresolved');

  useEffect(() => {
    if (!shouldOpenCreateTicket) return;
    setCreateTicket(true);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
  }, [shouldOpenCreateTicket, navigate, location.pathname, location.search]);


  // State from ViewTicket
  const [reloader, setReloader] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  
  // Refs to avoid triggering fetchTickets recreation when lookup data changes
  const agentsRef = useRef<Agent[] | null>(null);
  const departmentsRef = useRef<Array<{ id: number; name: string }>>([]);
  const categoriesRef = useRef<Array<{ id: number; name: string; department?: number | null }>>([]);
  const labelsRef = useRef<LabelItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [statusDescription, setStatusDescription] = useState("");
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [selectedWatchers, setSelectedWatchers] = useState<number[]>([]);
  const [ticketWatchers, setTicketWatchers] = useState<Watcher[]>([]);
  const [showLabelsModal, setShowLabelsModal] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [categories, setCategories] = useState<Array<{ id: number; name: string; department?: number | null }>>([]);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const { data: agentResponse = [] } = useFetchAgents();
  const agentsData: AgentType[] = (agentResponse as AgentApiResponse)?.results || [];
  const isUserWatcher = ticketWatchers.some(watcher => watcher.id === user?.user_id);
  const isTicketClosed = selectedTicket?.status === 'closed';
  const selectedTicketDepartmentId = useMemo(() => {
    const dept = selectedTicket?.department;
    if (!dept) return null;
    return typeof dept === 'number' ? dept : dept.id;
  }, [selectedTicket]);
  const filteredCategoriesForTicket = useMemo(() => {
    if (!selectedTicketDepartmentId) return categories;
    return categories.filter(
      (cat) => cat.department == null || cat.department === selectedTicketDepartmentId
    );
  }, [categories, selectedTicketDepartmentId]);
  const selectedTicketLabels = selectedTicket?.labels || [];


  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('activity');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [labelFilterIds, setLabelFilterIds] = useState<number[]>([]);
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [viewMode, setViewMode] = useState<TicketViewMode>(getStoredTicketViewMode());
  const [detailPanelOpen, setDetailPanelOpen] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSearchFilterDropdown, setShowSearchFilterDropdown] = useState(false);
  const [showSearchValueDropdown, setShowSearchValueDropdown] = useState(false);
  const [activeSearchFilterKey, setActiveSearchFilterKey] = useState<ColumnFilterKey | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  type ColumnFilterKey = 'status' | 'priority' | 'assignee' | 'department' | 'category' | 'labels' | 'created_at';
  const [activeColumnFilter, setActiveColumnFilter] = useState<ColumnFilterKey | null>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<HTMLElement | null>(null);
  const [filterPosition, setFilterPosition] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const [columnFilterSearch, setColumnFilterSearch] = useState('');
  const [ticketPreview, setTicketPreview] = useState<TicketPreviewState | null>(null);
  const ticketPreviewOpenTimeoutRef = useRef<number | null>(null);
  const ticketPreviewHideTimeoutRef = useRef<number | null>(null);
  const { ensureLatestComment, getLatestCommentPreview, isLoading: isLatestCommentLoading } = useHoverPreviewActivity();

  const clearTicketPreviewOpenTimeout = () => {
    if (ticketPreviewOpenTimeoutRef.current) {
      window.clearTimeout(ticketPreviewOpenTimeoutRef.current);
      ticketPreviewOpenTimeoutRef.current = null;
    }
  };

  const clearTicketPreviewHideTimeout = () => {
    if (ticketPreviewHideTimeoutRef.current) {
      window.clearTimeout(ticketPreviewHideTimeoutRef.current);
      ticketPreviewHideTimeoutRef.current = null;
    }
  };

  const showTicketPreview = (ticket: Ticket, element: HTMLElement) => {
    clearTicketPreviewOpenTimeout();
    clearTicketPreviewHideTimeout();
    const anchorRect = element.getBoundingClientRect();
    const placement = anchorRect.right + PREVIEW_CARD_WIDTH + 14 <= window.innerWidth - 16 ? 'right' : 'left';

    ticketPreviewOpenTimeoutRef.current = window.setTimeout(() => {
      setTicketPreview({ ticket, anchorRect, placement });
      void ensureLatestComment('ticket', ticket.id);
    }, PREVIEW_OPEN_DELAY_MS);
  };

  const scheduleHideTicketPreview = () => {
    clearTicketPreviewOpenTimeout();
    clearTicketPreviewHideTimeout();
    ticketPreviewHideTimeoutRef.current = window.setTimeout(() => {
      setTicketPreview(null);
    }, PREVIEW_CLOSE_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      clearTicketPreviewOpenTimeout();
      clearTicketPreviewHideTimeout();
    };
  }, []);

  useEffect(() => {
    if (!selectedTicket) {
      setCopilotActiveTicket(null);
      return;
    }

    setCopilotActiveTicket({
      id: Number(selectedTicket.id),
      ticketId: selectedTicket.ticket_id,
      title: selectedTicket.title,
      status: selectedTicket.status,
      priority: selectedTicket.priority,
      creatorName: selectedTicket.requester?.name,
      creatorEmail: selectedTicket.requester?.email,
      categoryName: typeof selectedTicket.category === 'string' ? selectedTicket.category : undefined,
      hasNewReply: selectedTicket.has_new_reply,
      breached: selectedTicket.breached,
      linkedTasksCount: selectedTicket.linked_tasks_count,
      commentsCount: selectedTicket.comments_count,
    });
  }, [selectedTicket, setCopilotActiveTicket]);

  useEffect(() => {
    const handleTicketEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (selectedTicket && Number(detail?.ticket_id) === Number(selectedTicket.id)) {
        fetchTicketDetails(selectedTicket.id);
      }
    };

    window.addEventListener('ticket_event', handleTicketEvent);
    return () => window.removeEventListener('ticket_event', handleTicketEvent);
  }, [selectedTicket, reloader]);

  useEffect(() => {
    if (viewMode === 'detailed') {
      setViewMode('list');
      localStorage.setItem('ticketViewMode', 'list');
      return;
    }
    localStorage.setItem('ticketViewMode', viewMode);
  }, [viewMode]);
  const searchFilterOptions: { key: 'all' | ColumnFilterKey; label: string; description: string }[] = [
    { key: 'all', label: 'Search all', description: 'Search tickets' },
    { key: 'status', label: 'Status', description: 'Filter by status' },
    { key: 'priority', label: 'Priority', description: 'Filter by priority' },
    { key: 'assignee', label: 'Assignee', description: 'Filter by assignee' },
    { key: 'department', label: 'Department', description: 'Filter by department' },
    { key: 'category', label: 'Category', description: 'Filter by category' },
    { key: 'labels', label: 'Labels', description: 'Filter by labels' },
    { key: 'created_at', label: 'Created date', description: 'Filter by created date' },
  ];
  const searchFilterIcons: Record<'all' | ColumnFilterKey, React.ComponentType<{ size?: number; className?: string }>> = {
    all: Search,
    status: CheckCircle,
    priority: AlertTriangle,
    assignee: User,
    department: Building,
    category: Tag,
    labels: Tag,
    created_at: Calendar,
  };
  const searchTokenKeyMap: Record<string, ColumnFilterKey> = {
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

  const formatSearchTokenValue = (value: string) => {
    if (!value) return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    return /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
  };

  const resolveStatusToken = (value?: string) => {
    if (!value) return null;
    let normalized = value.toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
    if (normalized === 'hold') normalized = 'on_hold';
    if (normalized === 'assigned' || normalized === 'todo') normalized = 'open';
    if (normalized === 'solved' || normalized === 'resolved') normalized = 'closed';
    const allowed = new Set(['open', 'in_progress', 'pending', 'on_hold', 'closed']);
    return allowed.has(normalized) ? normalized : null;
  };

  const resolvePriorityToken = (value?: string) => {
    if (!value) return null;
    const normalized = value.toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_');
    const allowed = new Set(['low', 'medium', 'high', 'urgent', 'normal']);
    return allowed.has(normalized) ? normalized : null;
  };

  const resolveAssigneeToken = (value?: string) => {
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (['unassigned', 'none', 'noone', 'no-one'].includes(normalized)) {
      return 'unassigned';
    }
    const match = agentsRef.current?.find(agent => {
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

  const resolveCategoryToken = (value?: string) => {
    if (!value) return null;
    const normalized = value.toLowerCase();
    const match = categoriesRef.current.find(cat => cat.name?.toLowerCase().includes(normalized));
    return match ? match.id.toString() : null;
  };

  const resolveCreatedDateToken = (value?: string) => {
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
  const [isCreateTicketModalDirty, setIsCreateTicketModalDirty] = useState(false);
  const [showCreateTicketCloseConfirm, setShowCreateTicketCloseConfirm] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [linkedTasksCount, setLinkedTasksCount] = useState(0);
  const [taskRefreshTrigger, setTaskRefreshTrigger] = useState(0);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogTicketId, setTaskDialogTicketId] = useState<string>('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const columnFilterRef = useRef<HTMLDivElement>(null);

  type SortField = 'ticket_id' | 'title' | 'status' | 'priority' | 'department' | 'author' | 'assignee' | 'created_at' | 'tasks';
  type SortState = { field: SortField; direction: 'asc' | 'desc'; explicit: boolean };
  const defaultSortState: SortState = { field: 'created_at', direction: 'desc', explicit: false };
  const [sortStateByView, setSortStateByView] = useState<Record<string, SortState>>({});
  const currentSortState = sortStateByView[activeView] ?? defaultSortState;
  const sortField = currentSortState.field;
  const sortDirection = currentSortState.direction;

  const statusPillClass = (status: string) =>
    `inline-flex items-center justify-center px-3 py-1 rounded-full text-[14px] font-semibold whitespace-nowrap border ${getStatusColor(status)}`;

  const priorityPillClass = (priority: string) =>
    `inline-flex items-center justify-center px-3 py-1 rounded-full text-[14px] font-semibold whitespace-nowrap border ${getPriorityColor(priority)}`;

  const statusLabel = (status: string) =>
    status
      .replace(/_/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  const listGridCols = 'grid w-full min-w-full grid-cols-[50px_minmax(90px,110px)_minmax(200px,3fr)_minmax(110px,1fr)_minmax(100px,1fr)_minmax(120px,1.5fr)_minmax(110px,1.5fr)_minmax(120px,1.5fr)_minmax(130px,1.5fr)_minmax(80px,100px)]';
  const showDetailPanel = viewMode === 'detailed' && detailPanelOpen;
  const splitLayoutClass =
    viewMode === 'detailed' && showDetailPanel
      ? 'grid grid-cols-[clamp(300px,30vw,420px)_minmax(0,1fr)]'
      : 'flex';
  const ticketPreviewGap = 14;
  const ticketPreviewPosition = useMemo(() => {
    if (!ticketPreview) return null;

    let left = ticketPreview.placement === 'right'
      ? ticketPreview.anchorRect.right + ticketPreviewGap
      : ticketPreview.anchorRect.left - PREVIEW_CARD_WIDTH - ticketPreviewGap;

    if (left + PREVIEW_CARD_WIDTH > window.innerWidth - PREVIEW_VIEWPORT_PADDING) {
      left = window.innerWidth - PREVIEW_CARD_WIDTH - PREVIEW_VIEWPORT_PADDING;
    }
    left = Math.max(PREVIEW_VIEWPORT_PADDING, left);

    const anchorCenterY = ticketPreview.anchorRect.top + (ticketPreview.anchorRect.height / 2);
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
  }, [ticketPreview]);

  const ticketLatestComment = ticketPreview ? getLatestCommentPreview('ticket', ticketPreview.ticket.id) : null;
  const ticketLatestCommentLoading = ticketPreview ? isLatestCommentLoading('ticket', ticketPreview.ticket.id) : false;

  const formatUserName = (user?: { firstName?: string; lastName?: string; email?: string; isActive?: boolean }) => {
    return formatUserDisplayName(user, 'Unassigned');
  };

  const filteredTickets = useMemo(() => {
    const { cleanedQuery } = parseSearchQuery(searchQuery);
    if (!cleanedQuery) return tickets;
    const query = cleanedQuery.toLowerCase();
    return tickets.filter(ticket => {
      const assigneeName = ticket.assignee ? `${ticket.assignee.firstName || ''} ${ticket.assignee.lastName || ''}`.trim() : '';
      const requesterName = ticket.requester ? `${ticket.requester.firstName || ''} ${ticket.requester.lastName || ''}`.trim() : '';
      return (
        ticket.ticket_id.toLowerCase().includes(query) ||
        ticket.title.toLowerCase().includes(query) ||
        ticket.description?.toLowerCase().includes(query) ||
        assigneeName.toLowerCase().includes(query) ||
        requesterName.toLowerCase().includes(query)
      );
    });
  }, [tickets, searchQuery]);
  const listTickets = useMemo(() => filteredTickets, [filteredTickets]);

  const handleSortToggle = useCallback((field: SortField) => {
    setSortStateByView((prev) => {
      const current = prev[activeView] ?? defaultSortState;
      if (current.field === field) {
        return {
          ...prev,
          [activeView]: {
            field,
            direction: current.direction === 'asc' ? 'desc' : 'asc',
            explicit: true,
          },
        };
      }
      return {
        ...prev,
        [activeView]: {
          field,
          direction: field === 'created_at' ? 'desc' : 'asc',
          explicit: true,
        },
      };
    });
    setCurrentPage(prev => (prev === 1 ? prev : 1));
  }, [activeView]);

  const sortIcon = (field: SortField) => {
    const isActive = sortField === field;
    const upClass = isActive && sortDirection === 'asc'
      ? 'text-primary-500 dark:text-primary-400'
      : 'text-gray-300 dark:text-gray-600';
    const downClass = isActive && sortDirection === 'desc'
      ? 'text-primary-500 dark:text-primary-400'
      : 'text-gray-300 dark:text-gray-600';

    return (
      <span className="inline-flex flex-col leading-none">
        <ChevronUp size={13} className={upClass} />
        <ChevronDown size={13} className={downClass} />
      </span>
    );
  };

  const renderSortableHeader = (
    label: string,
    field: SortField,
    options?: {
      align?: 'left' | 'center';
      filterKey?: ColumnFilterKey;
      active?: boolean;
      filterColorClass?: string;
    }
  ) => {
    const alignClass = options?.align === 'center' ? 'justify-center text-center' : 'justify-start text-left';
    const filterKey = options?.filterKey;
    const filterActive = Boolean(options?.active);
    const filterColorClass = options?.filterColorClass ?? 'text-primary-400 dark:text-primary-400';
    const labelClass = `truncate whitespace-nowrap font-medium transition-colors ${filterActive ? filterColorClass : 'hover:text-primary-600 dark:hover:text-primary-300'}`;

    return (
      <div className={`py-3 px-3 flex items-center gap-2 whitespace-nowrap ${alignClass}`}>
        {filterKey ? (
          <button
            type="button"
            aria-label={`Open ${label} filter`}
            onClick={openColumnFilter(filterKey)}
            className={labelClass}
          >
            <span>{label}</span>
          </button>
        ) : (
          <span className="truncate whitespace-nowrap font-medium">{label}</span>
        )}
        <button
          type="button"
          aria-label={`Sort ${label}`}
          onClick={() => handleSortToggle(field)}
          className="inline-flex items-center text-gray-500 hover:text-primary-500 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
        >
          {sortIcon(field)}
        </button>
      </div>
    );
  };

  useEffect(() => {
    if (viewMode === 'detailed') {
      setViewMode('list');
      localStorage.setItem('ticketViewMode', 'list');
      return;
    }
    localStorage.setItem('ticketViewMode', viewMode);
  }, [viewMode]);

  // Sync activeView with URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    const viewParam = params.get('view');

    // Check for status param first (most common)
    if (statusParam) {
      // Map old status params (if any) to new view keys
      const viewMap: Record<string, string> = {
        'all_tickets': 'all_tickets',
        'all_unassigned': 'all_unassigned',
        'all_unresolved': 'all_unresolved',
        'all_resolved': 'all_resolved',
        'slow_queues': 'slow_queues',
        'reopened': 'reopened',
        'my_due_today': 'my_due_today',
        'my_overdue': 'my_overdue',
        'my_unresolved': 'my_unresolved',
        'my_resolved': 'my_resolved',
        'requested_by_me': 'requested_by_me',
        'sla_breached': 'sla_breached',
        'archived': 'archived',
        'trash': 'trash',
        // Legacy names for backwards compatibility
        'all_unassigned_tickets': 'all_unassigned',
        'all_unsolved_tickets': 'all_unresolved',
        'all_resolved_tickets': 'all_resolved',
        'reopened_tickets': 'reopened',
        'my_resolution_overdue': 'my_overdue',
        'my_unsolved_tickets': 'my_unresolved',
        'my_resolved_tickets': 'my_resolved',
        'sla_breached_tickets': 'sla_breached',
        'archived_tickets': 'archived',
        'trash_tickets': 'trash',
        'closed': 'all_resolved' // Map 'closed' to all_resolved view
      };

      const mappedView = viewMap[statusParam] || statusParam;
      const allowedViews = new Set([
        'all_tickets',
        'all_unassigned',
        'all_unresolved',
        'all_resolved',
        'slow_queues',
        'reopened',
        'my_due_today',
        'my_overdue',
        'my_unresolved',
        'my_resolved',
        'requested_by_me',
        'sla_breached',
        'archived',
        'trash',
      ]);
      const targetView = allowedViews.has(mappedView) ? mappedView : defaultView;
      if (targetView !== activeView) {
        setActiveView(targetView);
      }
    }
    // Otherwise check for view param (for dashboard assigned card)
    else if (viewParam) {
      const viewMap: Record<string, string> = {
        'my_tickets': 'my_unresolved'
      };
      const allowedViews = new Set([
        'all_tickets',
        'all_unassigned',
        'all_unresolved',
        'all_resolved',
        'slow_queues',
        'reopened',
        'my_due_today',
        'my_overdue',
        'my_unresolved',
        'my_resolved',
        'requested_by_me',
        'sla_breached',
        'archived',
        'trash',
      ]);
      const mappedView = viewMap[viewParam] || viewParam;
      const targetView = allowedViews.has(mappedView) ? mappedView : defaultView;
      if (targetView !== activeView) {
        setActiveView(targetView);
      }
    }
  }, [location.search, activeView, defaultView]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlStatus = params.get('status');
    const allowedStatusFilters = new Set(['open', 'pending', 'in_progress', 'on_hold', 'closed', 'resolved']);

    setStatusFilter(urlStatus && allowedStatusFilters.has(urlStatus) ? urlStatus : 'all');
    setPriorityFilter(params.get('priority') || 'all');
    setAssigneeFilter(params.get('assigned_to') || 'all');
    setDepartmentFilter(params.get('department') || 'all');
    setCategoryFilter(params.get('category') || 'all');
    setDateFromFilter(params.get('date_from') || '');
    setDateToFilter(params.get('date_to') || '');

    const rawLabelIds = params.get('label_ids');
    if (!rawLabelIds) {
      setLabelFilterIds([]);
      return;
    }

    const parsedLabelIds = rawLabelIds
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    setLabelFilterIds(parsedLabelIds);
  }, [location.search]);

  // Selection state for bulk actions
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [bulkExportFormat, setBulkExportFormat] = useState<BulkExportFormat>('xlsx');

  // Warn before browser close/refresh when tickets are selected
  useEffect(() => {
    if (selectedTickets.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [selectedTickets.size]);

  // Block all in-app navigation (NavLink, navigate(), back/forward) when items are selected
  const blocker = useBlocker(selectedTickets.size > 0);

  // Sync selection count to global store so Sidebar can still show the count in its dialog
  const { setSelectionCount } = useUIStore();
  useEffect(() => {
    setSelectionCount(selectedTickets.size);
    return () => setSelectionCount(0);
  }, [selectedTickets.size]);

  // Selection handlers
  const handleTicketSelection = (ticketId: string, selected: boolean) => {
    setSelectedTickets(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(ticketId);
      } else {
        newSet.delete(ticketId);
      }
      return newSet;
    });
  };

  const handleSelectAllVisible = (checked: boolean) => {
    setSelectedTickets(prev => {
      const next = new Set(prev);
      filteredTickets.forEach(ticket => {
        if (checked) {
          next.add(ticket.id);
        } else {
          next.delete(ticket.id);
        }
      });
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTickets.size === filteredTickets.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(filteredTickets.map(ticket => ticket.id)));
    }
  };

  // Bulk action handlers
  const handleBulkArchive = async () => {
    if (selectedTickets.size === 0) return;
    try {
      const response = await http.post('/ticket/bulk/archive/', {
        ticket_ids: Array.from(selectedTickets).map(id => Number(id))
      });
      console.log('Archive response:', response.data);
      setSelectedTickets(new Set());
      // Refresh tickets list
      fetchTickets(currentPage, activeView);
    } catch (error) {
      console.error('Error archiving tickets:', error);
      errorNotification('Failed to archive selected tickets');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTickets.size === 0) return;
    setShowBulkDeleteConfirm(false);
    try {
      const isTrash = getViewContext() === 'trash';
      const endpoint = isTrash ? '/ticket/bulk/permanent-delete/' : '/ticket/bulk/delete/';
      console.log('[DEBUG] activeView:', activeView, 'isTrash:', isTrash, 'endpoint:', endpoint);
      const response = await http.post(endpoint, {
        ticket_ids: Array.from(selectedTickets).map(id => Number(id))
      });
      console.log('Delete response:', response.data);
      successNotification(
        isTrash
          ? `${selectedTickets.size} ticket(s) permanently deleted`
          : `${selectedTickets.size} ticket(s) moved to trash`
      );
      setSelectedTickets(new Set());
      // Refresh tickets list
      fetchTickets(currentPage, activeView);
    } catch (error) {
      console.error('Error deleting tickets:', error);
      errorNotification('Failed to delete selected tickets');
    }
  };

  const showBulkDeleteConfirmation = () => {
    setShowBulkDeleteConfirm(true);
  };

  const handleSingleTicketDelete = async () => {
    if (!selectedTicket) return;
    try {
      const isTrash = getViewContext() === 'trash';
      const endpoint = isTrash ? '/ticket/bulk/permanent-delete/' : '/ticket/bulk/delete/';
      await http.post(endpoint, {
        ticket_ids: [Number(selectedTicket.id)],
      });
      successNotification(isTrash ? 'Ticket permanently deleted' : 'Ticket moved to trash');
      setShowDeleteModal(false);
      setSelectedTicket(null);
      fetchTickets(currentPage, activeView);
    } catch (error: any) {
      console.error('Error deleting ticket:', error);
      errorNotification(error?.response?.data?.message || 'Failed to delete ticket');
    }
  };

  const handleBulkExport = async () => {
    if (selectedTickets.size === 0) return;
    try {
      await exportSelectedTickets(Array.from(selectedTickets).map(id => Number(id)), bulkExportFormat);
      setSelectedTickets(new Set());
    } catch (error) {
      console.error('Error exporting tickets:', error);
      errorNotification('Failed to export selected tickets');
    }
  };

  // Get current view context
  const getViewContext = () => {
    if (activeView === 'archived') return 'archived';
    if (activeView === 'trash') return 'trash';
    return 'normal';
  };

  // Additional bulk action handlers
  const handleBulkUnarchive = async () => {
    if (selectedTickets.size === 0) return;
    try {
      const response = await http.post('/ticket/bulk/unarchive/', {
        ticket_ids: Array.from(selectedTickets).map(id => Number(id))
      });
      console.log('Unarchive response:', response.data);
      setSelectedTickets(new Set());
      fetchTickets(currentPage, activeView);
    } catch (error) {
      console.error('Error unarchiving tickets:', error);
      errorNotification('Failed to unarchive selected tickets');
    }
  };

  const handleBulkRestore = async () => {
    if (selectedTickets.size === 0) return;
    try {
      const response = await http.post('/ticket/bulk/restore/', {
        ticket_ids: Array.from(selectedTickets).map(id => Number(id))
      });
      console.log('Restore response:', response.data);
      setSelectedTickets(new Set());
      fetchTickets(currentPage, activeView);
    } catch (error) {
      console.error('Error restoring tickets:', error);
      errorNotification('Failed to restore selected tickets');
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
          { key: 'delete', label: 'Delete', icon: Trash2, action: showBulkDeleteConfirmation, className: 'bg-red-600 hover:bg-red-700' },
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

  // Helper to select ticket and set linked tasks count from API response
  const selectTicket = (ticket: Ticket | null) => {
    setSelectedTicket(ticket);
    // Use linked_tasks_count from ticket data if available
    setLinkedTasksCount(ticket?.linked_tasks_count ?? 0);
  };

  const handleListRowClick = (ticket: Ticket) => {
    navigate(`/ticket/${ticket.ticket_id}`);
  };

  const handleAction = (action: string, ticket: Ticket) => {
    if (action === 'delete') {
      setSelectedTicket(ticket);
      setShowDeleteModal(true);
    } else {
      navigate(`/ticket/${ticket.ticket_id}`);
    }
    setOpenDropdownId(null);
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
    (activeView === 'slow_queues' ? 'Slow Queues' : null) ||
    sidebarItems.find(item => item.key === activeView)?.name ||
    sidebarItems[0]?.name ||
    'Pending';
  const isTrashView = activeView === 'trash';
  const openViewKey = isAdmin ? 'all_unresolved' : 'my_unresolved';
  const closedViewKey = isAdmin ? 'all_resolved' : 'my_resolved';
  const openCount = ticketCounts[openViewKey] ?? 0;
  const closedCount = ticketCounts[closedViewKey] ?? 0;

  // Check if any filters are active
  const hasActiveFilters =
    (statusFilter && statusFilter !== 'all') ||
    (priorityFilter && priorityFilter !== 'all') ||
    (assigneeFilter && assigneeFilter !== 'all') ||
    (departmentFilter && departmentFilter !== 'all') ||
    (categoryFilter && categoryFilter !== 'all') ||
    labelFilterIds.length > 0 ||
    (dateFromFilter !== '') ||
    (dateToFilter !== '');
  const hasActiveSearch = searchQuery.trim() !== '';
  const showClearFilters = hasActiveFilters || hasActiveSearch;

  // Get active filter labels for display
  const getActiveFilterLabels = () => {
    const labels: string[] = [];
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
    if (dateFromFilter || dateToFilter) labels.push(`Created Date Range`);
    return labels;
  };

  // Clear all filters
  const clearAllFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssigneeFilter('all');
    setDepartmentFilter('all');
    setCategoryFilter('all');
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
    category: categoryFilter !== 'all',
    labels: labelFilterIds.length > 0,
    created_at: Boolean(dateFromFilter || dateToFilter),
  };

  const handleViewSelect = (viewKey: string) => {
    const params = new URLSearchParams(location.search);
    params.delete('status');
    params.set('view', viewKey);
    navigate({ pathname: location.pathname, search: params.toString() });
    setActiveView(viewKey);
    setCurrentPage(1);
    setSelectedTicket(null);
    setSelectedTickets(new Set());
  };

  useEffect(() => {
    // Avoid stale selections when switching between normal/trash/archived views.
    setSelectedTickets(new Set());
  }, [activeView]);

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

  const transformApiTicket = (apiTicket: ApiTicket): Ticket => {
    const normalizedStatus = (resolveStatusToken(apiTicket.status) ?? 'open') as Ticket['status'];

    return ({
    id: apiTicket.id.toString(),
    title: apiTicket.title || '',
    description: apiTicket.description || '',
    status: normalizedStatus,
    priority: apiTicket.priority_display?.toLowerCase() as Ticket['priority'] || 'normal',
    category: apiTicket.category?.name || 'Uncategorized',
    department: apiTicket.department ? {
      id: apiTicket.department.id,
      name: apiTicket.department.name,
    } : undefined,
    ticket_id: apiTicket.ticket_id || '',
    assigneeId: apiTicket.assigned_to?.id.toString(),
    assignee: apiTicket.assigned_to ? {
      id: apiTicket.assigned_to.id.toString(),
      email: apiTicket.assigned_to.email || '',
      firstName: apiTicket.assigned_to.first_name || '',
      lastName: apiTicket.assigned_to.last_name || '',
      role: 'agent',
      workspaceId: 'default-workspace-id',
      isActive: apiTicket.assigned_to?.is_active ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      avatar_url: apiTicket.assigned_to.avatar_url,
    } : undefined,
    requesterId: 'unknown-requester-id',
    requester: {
      id: 'unknown-requester-id',
      email: apiTicket.creator_email || '',
      firstName: (apiTicket.creator_name || '').split(' ')[0] || '',
      lastName: (apiTicket.creator_name || '').split(' ').slice(1).join(' ') || '',
      role: 'staff',
      workspaceId: 'default-workspace-id',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      phone: apiTicket.creator_phone || '',
    },
    workspaceId: 'default-workspace-id',
    tags: (apiTicket.labels || []).map((label) => label.name),
    labels: apiTicket.labels || [],
    attachments: [],
    comments: [],
    createdAt: apiTicket.created_at || new Date().toISOString(),
    updatedAt: apiTicket.updated_at || apiTicket.created_at || new Date().toISOString(),
    dueDate: apiTicket.due_date,
    resolvedAt: undefined,
    breached: apiTicket.breached,
    source: apiTicket.source || 'web', // Added source field mapping
    linked_tasks_count: apiTicket.linked_tasks_count ?? 0,
    is_opened: apiTicket.is_opened ?? false,
    has_new_reply: apiTicket.has_new_reply ?? false,
  });
  };

  // Handlers for create ticket modal close confirmation
  const handleCloseCreateTicketModal = () => {
    if (isCreateTicketModalDirty) {
      setShowCreateTicketCloseConfirm(true);
      return;
    }
    setCreateTicket(false);
    setIsCreateTicketModalDirty(false);
  };

  const confirmCloseCreateTicketModal = () => {
    setShowCreateTicketCloseConfirm(false);
    setCreateTicket(false);
    setIsCreateTicketModalDirty(false);
  };


  const fetchTickets = React.useCallback(async (page: number = 1, view: string = 'all_unresolved', limitOverride?: number) => {
    setIsLoading(true);
    const effectiveLimit = limitOverride ?? limit;

    try {
      const offset = (page - 1) * effectiveLimit;
      const params: Record<string, string | number> = {
        page_size: effectiveLimit,
        offset,
        view: view,
      };
      const viewSortState = sortStateByView[view] ?? defaultSortState;
      const shouldSendSort =
        view !== 'slow_queues' || viewSortState.explicit;
      if (shouldSendSort) {
        params.sort_by = viewSortState.field;
        params.sort_direction = viewSortState.direction;
      }

      const parsedSearch = parseSearchQuery(searchQuery);
      if (parsedSearch.cleanedQuery) {
        params.search = parsedSearch.cleanedQuery;
      }

      const tokenStatus = resolveStatusToken(parsedSearch.tokens.status);
      const tokenPriority = resolvePriorityToken(parsedSearch.tokens.priority);
      const tokenAssignee = resolveAssigneeToken(parsedSearch.tokens.assignee);
      const tokenDepartment = resolveDepartmentToken(parsedSearch.tokens.department);
      const tokenCategory = resolveCategoryToken(parsedSearch.tokens.category);
      const tokenLabels = resolveLabelTokenIds(parsedSearch.tokens.labels, labelsRef.current);
      const tokenCreatedDate = resolveCreatedDateToken(parsedSearch.tokens.created_at);

      const effectiveStatus = tokenStatus ?? (statusFilter !== 'all' ? statusFilter : null);
      const effectivePriority = tokenPriority ?? (priorityFilter !== 'all' ? priorityFilter : null);
      const effectiveAssignee = tokenAssignee ?? (assigneeFilter !== 'all' ? assigneeFilter : null);
      const effectiveDepartment = tokenDepartment ?? (departmentFilter !== 'all' ? departmentFilter : null);
      const effectiveCategory = tokenCategory ?? (categoryFilter !== 'all' ? categoryFilter : null);
      const effectiveLabelIds = tokenLabels.length > 0 ? tokenLabels : labelFilterIds;
      const effectiveDateFrom = tokenCreatedDate?.from ?? dateFromFilter;
      const effectiveDateTo = tokenCreatedDate?.to ?? dateToFilter;

      if (effectiveStatus) params.status = effectiveStatus;
      if (effectivePriority) params.priority = effectivePriority;
      if (effectiveAssignee) params.assigned_to = effectiveAssignee;
      if (effectiveDepartment) params.department = effectiveDepartment;
      if (effectiveCategory) params.category = effectiveCategory;
      if (effectiveLabelIds.length > 0) params.label_ids = effectiveLabelIds.join(',');
      if (effectiveDateFrom) params.date_from = effectiveDateFrom;
      if (effectiveDateTo) params.date_to = effectiveDateTo;

      const cacheKey = ['tickets', params];
      const cached = queryClient.getQueryData<ApiResponse>(cacheKey);
      if (cached?.results) {
        setTickets(cached.results.map(transformApiTicket));
        setTotalCount(cached.count || 0);
        setCurrentPage(page);
        setTimeout(() => setIsLoading(false), 100);
      }

      const response = await http.get<ApiResponse>(APIS.LIST_TICKETS, { params });
      queryClient.setQueryData(cacheKey, response.data);
      const transformedTickets = response.data.results.map(transformApiTicket);
      setTickets(transformedTickets);
      setTotalCount(response.data.count || 0);
      setCurrentPage(page);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while fetching tickets';
      errorNotification(errorMsg);
    } finally {
      setTimeout(() => setIsLoading(false), 100);
    }
  }, [limit, searchQuery, statusFilter, priorityFilter, assigneeFilter, departmentFilter, categoryFilter, labelFilterIds, dateFromFilter, dateToFilter, sortStateByView]);

  const fetchTicketCounts = async () => {
    try {
      const params: Record<string, string> = {};

      const parsedSearch = parseSearchQuery(searchQuery);
      if (parsedSearch.cleanedQuery) {
        params.search = parsedSearch.cleanedQuery;
      }

      const tokenStatus = resolveStatusToken(parsedSearch.tokens.status);
      const tokenPriority = resolvePriorityToken(parsedSearch.tokens.priority);
      const tokenAssignee = resolveAssigneeToken(parsedSearch.tokens.assignee);
      const tokenDepartment = resolveDepartmentToken(parsedSearch.tokens.department);
      const tokenCategory = resolveCategoryToken(parsedSearch.tokens.category);
      const tokenLabels = resolveLabelTokenIds(parsedSearch.tokens.labels, labelsRef.current);
      const tokenCreatedDate = resolveCreatedDateToken(parsedSearch.tokens.created_at);

      const effectiveStatus = tokenStatus ?? (statusFilter !== 'all' ? statusFilter : null);
      const effectivePriority = tokenPriority ?? (priorityFilter !== 'all' ? priorityFilter : null);
      const effectiveAssignee = tokenAssignee ?? (assigneeFilter !== 'all' ? assigneeFilter : null);
      const effectiveDepartment = tokenDepartment ?? (departmentFilter !== 'all' ? departmentFilter : null);
      const effectiveCategory = tokenCategory ?? (categoryFilter !== 'all' ? categoryFilter : null);
      const effectiveLabelIds = tokenLabels.length > 0 ? tokenLabels : labelFilterIds;
      const effectiveDateFrom = tokenCreatedDate?.from ?? dateFromFilter;
      const effectiveDateTo = tokenCreatedDate?.to ?? dateToFilter;

      if (effectiveStatus) params.status = effectiveStatus;
      if (effectivePriority) params.priority = effectivePriority;
      if (effectiveAssignee) params.assigned_to = effectiveAssignee;
      if (effectiveDepartment) params.department = effectiveDepartment;
      if (effectiveCategory) params.category = effectiveCategory;
      if (effectiveLabelIds.length > 0) params.label_ids = effectiveLabelIds.join(',');
      if (effectiveDateFrom) params.date_from = effectiveDateFrom;
      if (effectiveDateTo) params.date_to = effectiveDateTo;

      const response = await http.get(APIS.TICKET_COUNTS, { params });
      setTicketCounts(response.data);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to fetch ticket counts";
      console.error(errorMsg);
    }
  };

  // Search on current page like Ctrl+F
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (showSearchValueDropdown) {
      setShowSearchValueDropdown(false);
      setActiveSearchFilterKey(null);
    }

    if (!query.trim()) {
      setShowSearchFilterDropdown(true);
      return;
    }

    const { cleanedQuery } = parseSearchQuery(query);
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
    if (key === 'category') setCategoryFilter(value || 'all');
    if (key === 'labels') setLabelFilterIds(resolveLabelTokenIds(value, labelsRef.current));
    if (key === 'created_at') {
      if (value) {
        const { from, to } = resolveCreatedDateToken(value) || {};
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
    if (key === 'category') setCategoryFilter('all');
    if (key === 'labels') setLabelFilterIds([]);
    if (key === 'created_at') {
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
    if (categoryFilter && categoryFilter !== 'all') {
      const cat = categories.find(c => c.id.toString() === categoryFilter);
      chips.push({ key: 'category', label: `Category: ${cat?.name || 'Selected'}` });
    }
    if (labelFilterIds.length > 0) {
      const labelNames = getLabelNamesByIds(labelFilterIds, labels);
      chips.push({ key: 'labels', label: `Labels: ${labelNames || 'Selected'}` });
    }
    if (dateFromFilter || dateToFilter) {
      const rangeLabel = dateFromFilter && dateToFilter
        ? `${dateFromFilter}..${dateToFilter}`
        : dateFromFilter || dateToFilter;
      chips.push({ key: 'created_at', label: `Created: ${rangeLabel}` });
    }
    return chips;
  }, [statusFilter, priorityFilter, assigneeFilter, departmentFilter, categoryFilter, labelFilterIds, dateFromFilter, dateToFilter, agents, departments, categories, labels]);

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

  React.useEffect(() => {
    fetchTickets(currentPage, activeView);
    fetchTicketCounts();
  }, [fetchTickets, currentPage, activeView, limit, statusFilter, priorityFilter, assigneeFilter, departmentFilter, categoryFilter, labelFilterIds, dateFromFilter, dateToFilter]);

  useEffect(() => {
    const handler = () => {
      fetchTickets(currentPage, activeView);
      fetchTicketCounts();
    };
    window.addEventListener('ticket_event', handler);
    return () => window.removeEventListener('ticket_event', handler);
  }, [fetchTickets, currentPage, activeView]);

  // Detailed view shows inline - no navigation needed

  const allVisibleSelected = filteredTickets.length > 0 && filteredTickets.every(t => selectedTickets.has(t.id));
  const someVisibleSelected = filteredTickets.some(t => selectedTickets.has(t.id));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  useEffect(() => {
    if (viewMode === 'detailed') {
      if (tickets.length > 0) {
        setSelectedTicket((currentSelected) => {
          const isSelectedInList = tickets.some((ticket) => ticket.id === currentSelected?.id);
          return isSelectedInList ? currentSelected : tickets[0];
        });
      } else {
        setSelectedTicket(null);
      }
    } else {
      setSelectedTicket(null);
    }
  }, [tickets, viewMode]);

  const handleNextTicket = () => {
    if (!selectedTicket || filteredTickets.length <= 1) return;
    const currentIndex = filteredTickets.findIndex(t => t.id === selectedTicket.id);
    const nextIndex = (currentIndex + 1) % filteredTickets.length;
    selectTicket(filteredTickets[nextIndex]);
  };

  const handlePreviousTicket = () => {
    if (!selectedTicket || filteredTickets.length <= 1) return;
    const currentIndex = filteredTickets.findIndex(t => t.id === selectedTicket.id);
    const prevIndex = (currentIndex - 1 + filteredTickets.length) % filteredTickets.length;
    selectTicket(filteredTickets[prevIndex]);
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

  const getSourceDisplay = (source?: string) => {
    return getSourceLabel(source);
  };

  const getSourceIcon = (source?: string) => {
    return getSourceIconHelper(source);
  };

  const fetchTicketDetails = async (ticketId: string) => {
    try {
      const response = await http.get(`${APIS.TICKET_DETAILS}${ticketId}/read-by-ticket-id`);
      if (response.data.ticket) {
        const updatedTicket = transformApiTicket(response.data.ticket);
        setSelectedTicket(updatedTicket);

        // Also update the ticket in the list if it's there
        setTickets(prev => prev.map(ticket =>
          ticket.id === ticketId ? { ...updatedTicket } : ticket
        ));
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to refresh ticket details";
      errorNotification(errorMsg);
    }
  };

  const fetchAgents = async () => {
    try {
      const activeAgents = await queryClient.fetchQuery({
        queryKey: ['filter-agents'],
        queryFn: async () => {
          const response = await http.get(`${APIS.LIST_AGENTS}?pagination=no`);
          return getActiveAgents(response.data);
        },
        staleTime: 30 * 60 * 1000,
      });
      setAgents(activeAgents);
      agentsRef.current = activeAgents;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "An error occurred";
      errorNotification(errorMsg);
    }
  };

  const fetchDepartments = async () => {
    try {
      const depts = await queryClient.fetchQuery({
        queryKey: ['filter-departments'],
        queryFn: async () => {
          const response = await http.get(APIS.LIST_DEPARTMENTS);
          return response.data.results || response.data || [];
        },
        staleTime: 30 * 60 * 1000,
      });
      setDepartments(depts);
      departmentsRef.current = depts;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to load departments";
      console.error(errorMsg);
    }
  };

  const fetchCategories = async () => {
    try {
      const cats = await queryClient.fetchQuery({
        queryKey: ['filter-categories'],
        queryFn: async () => {
          const response = await http.get(APIS.LIST_TICKET_CATEGORIES + '?pagination=no');
          return response.data || response.data.results || [];
        },
        staleTime: 30 * 60 * 1000,
      });
      setCategories(cats);
      categoriesRef.current = cats;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to load categories";
      console.error(errorMsg);
    }
  };

  const fetchLabels = async () => {
    try {
      const labelItems = await queryClient.fetchQuery({
        queryKey: ['filter-labels'],
        queryFn: async () => {
          const response = await http.get(APIS.LABELS_BASE, {
            params: { pagination: 'no', active_only: true },
          });
          return response.data?.results || response.data || [];
        },
        staleTime: 30 * 60 * 1000,
      });
      setLabels(labelItems);
      labelsRef.current = labelItems;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load labels';
      console.error(errorMsg);
    }
  };

  const assignAgentOptions = React.useMemo(() => {
    const base = [{ value: "", label: "Choose agent...", disabled: true }];
    if (!agents || agents.length === 0 || !selectedTicket) return base;
    return [
      ...base,
      ...agents
        .filter(agent => {
          if (!agent.is_active || agent.status !== 'A') return false;
          if (selectedTicket.assignee && agent.id.toString() === selectedTicket.assignee.id) return false;
          if (selectedTicket.department && agent.department && agent.department.length > 0) {
            const deptId = typeof selectedTicket.department === 'number' ? selectedTicket.department : selectedTicket.department.id;
            return agent.department.some(dept => dept.id === deptId);
          }
          return true;
        })
        .map(agent => ({ value: agent.id.toString(), label: agent.name || "Unknown Agent" })),
    ];
  }, [agents, selectedTicket]);

  const fetchWatchers = async (currentTicketId: string) => {
    try {
      const response = await http.get(`${APIS.LIST_WATCHERS}/${currentTicketId}`);
      setTicketWatchers(response.data);
      setSelectedWatchers(response.data.map((watcher: Watcher) => watcher.id));
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to load watchers";
      errorNotification(errorMsg);
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchDepartments();
    fetchCategories();
    fetchLabels();
  }, []);

  useEffect(() => {
    if (selectedTicket) {
      setSelectedStatus(selectedTicket.status);
      fetchWatchers(selectedTicket.id);
    }
  }, [selectedTicket]);

  async function handleStatusUpdate() {
    if (!selectedTicket) return;
    try {
      const normalizedStatus = (resolveStatusToken(selectedStatus) ?? selectedStatus) as Ticket['status'];
      setIsSubmitting(true)
      const response = await http.put(`${APIS.TICKET_UPDATE_STATUS}/${selectedTicket.id}`, {
        status: normalizedStatus,
        notes: statusDescription
      });

      // Immediately update the selected ticket
      const updatedTicket: Ticket = {
        ...selectedTicket,
        status: normalizedStatus
      };
      setSelectedTicket(updatedTicket);

      // Update the ticket in the list
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));

      // If ticket is moved to terminal state from unresolved views, switch table to closed view.
      if (normalizedStatus === 'closed' && (activeView === openViewKey || activeView === 'all_unresolved' || activeView === 'my_unresolved')) {
        handleViewSelect(closedViewKey);
        fetchTickets(1, closedViewKey);
      }

      successNotification(response.data.message)
    } catch (error: unknown) {
      const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (apiMessage?.toLowerCase().includes('assign this ticket')) {
        setShowAssignModal(true);
        errorNotification(apiMessage);
        return;
      }
      const errorMsg = apiMessage || (error instanceof Error ? error.message : "An error occurred");
      errorNotification(errorMsg);
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAssignToMe = async () => {
    if (!selectedTicket) return;
    setIsAssigning(true);
    try {
      const response = await http.get(`${APIS.TICKET_ASSIGN_TO_ME}${selectedTicket.id}`);
      successNotification(response.data.message);
      fetchTickets(currentPage, activeView);
      fetchTicketDetails(selectedTicket.id);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to assign ticket';
      errorNotification(errorMsg);
    } finally {
      setIsAssigning(false);
    }
  };

  async function handleAssign() {
    if (!selectedTicket) return;
    try {
      setIsSubmitting(true)
      const payload: AssignTicketPayload = {
        ticket_id: selectedTicket.id.toString(),
        agent_id: Number(selectedAgentId)
      };
      const response = await http.post(`${APIS.TICKET_ASSIGN}`, payload);
      successNotification(response.data.message)
      // Refresh list and selected ticket
      fetchTickets(currentPage, activeView);
      fetchTicketDetails(selectedTicket.id);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "An error occurred";
      errorNotification(errorMsg);
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleComment(files?: FileList) {
    if (!selectedTicket) return;
    try {
      setIsSubmitting(true)
      const formData = new FormData();
      formData.append('comment', comment);
      formData.append('is_internal', isInternal.toString());
      if (files && files.length > 0) {
        for (const file of files) {
          formData.append('files', file);
        }
      }
      const response = await http.post(`${APIS.TICKET_COMMENT}${selectedTicket.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setComment("")
      setIsInternal(false)
      setReloader(prev => prev + 1);
      successNotification(response.data.message)
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to add comment";
      errorNotification(errorMsg);
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAddWatchers() {
    if (!selectedTicket) return;
    try {
      setIsSubmitting(true);
      const payload: AddWatchersPayload = { watchers: selectedWatchers };
      const response = await http.put(`${APIS.ADD_WATCHERS}/${selectedTicket.id}`, payload);
      fetchWatchers(selectedTicket.id);
      fetchTicketDetails(selectedTicket.id); // Refresh ticket details
      successNotification(response.data.message);
      fetchTickets(currentPage, activeView);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to add watchers";
      errorNotification(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleLabelsSaved = (updatedLabels: LabelItem[]) => {
    if (!selectedTicket) return;
    const nextTicket: Ticket = {
      ...selectedTicket,
      labels: updatedLabels,
      tags: updatedLabels.map((label) => label.name),
    };
    setSelectedTicket(nextTicket);
    setTickets((current) => current.map((ticket) => (
      ticket.id === selectedTicket.id ? nextTicket : ticket
    )));
    fetchLabels();
  };

  async function handleReopen(reason: string) {
    if (!selectedTicket) return;
    try {
      setIsSubmitting(true);
      const response = await http.post(`${APIS.TICKET_BASE}/${selectedTicket.id}/reopen/`, { reason });

      // Refresh ticket details and list from server
      fetchTickets(currentPage, activeView);
      fetchTicketDetails(selectedTicket.id); // Refresh ticket details

      successNotification(response.data.message);
      setIsReopenModalOpen(false);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to reopen ticket";
      errorNotification(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateDepartment() {
    if (!selectedTicket || !selectedDepartmentId) return;
    try {
      setIsSubmitting(true);
      const payload = {
        department_id: Number(selectedDepartmentId)
      };
      const response = await http.put(`${APIS.TICKET_UPDATE_DEPARTMENT}/${selectedTicket.id}`, payload);

      // Find the selected department object
      const selectedDept = departments.find(d => d.id === Number(selectedDepartmentId));

      // Immediately update the selected ticket
      const updatedTicket: Ticket = {
        ...selectedTicket,
        department: selectedDept || selectedTicket.department
      };
      setSelectedTicket(updatedTicket);

      // Update the ticket in the list
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));

      successNotification(response.data.message || 'Department updated successfully');
      setSelectedDepartmentId("");
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to update department";
      errorNotification(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateCategory() {
    if (!selectedTicket || !selectedCategoryId) return;
    try {
      setIsSubmitting(true);
      const payload = {
        category_id: Number(selectedCategoryId),
        category: Number.isNaN(Number(selectedCategoryId)) ? selectedCategoryId : undefined,
      };
      const response = await http.put(`${APIS.TICKET_UPDATE_CATEGORY}/${selectedTicket.id}`, payload);

      // Find the selected category and update the UI
      const selectedCat = categories.find(c => c.id === Number(selectedCategoryId) || c.name === selectedCategoryId);
      const updatedTicket: Ticket = { ...selectedTicket, category: selectedCat?.name || selectedTicket.category } as Ticket;
      setSelectedTicket(updatedTicket);
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));

      successNotification(response.data.message || 'Category updated successfully');
      setSelectedCategoryId("");
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to update category";
      errorNotification(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdatePriority() {
    if (!selectedTicket || !selectedPriority) return;
    try {
      setIsSubmitting(true);
      const payload = { priority: selectedPriority };
      const response = await http.put(`${APIS.TICKET_UPDATE_PRIORITY}/${selectedTicket.id}`, payload);

      const updatedTicket: Ticket = { ...selectedTicket, priority: selectedPriority } as Ticket;
      setSelectedTicket(updatedTicket);
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));

      successNotification(response.data.message || 'Priority updated successfully');
      setSelectedPriority("");
      fetchTickets(currentPage, activeView);
      fetchTicketDetails(selectedTicket.id);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to update priority";
      errorNotification(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const renderColumnFilterContent = () => {
    if (!activeColumnFilter) return null;
    if (activeColumnFilter === 'status') {
      const options = [
        { value: 'all', label: 'All statuses', icon: List },
        { value: 'open', label: 'Open', icon: UserCheck },
        { value: 'in_progress', label: 'In progress', icon: Clock },
        { value: 'pending', label: 'Pending', icon: AlertCircle },
        { value: 'on_hold', label: 'On hold', icon: PauseCircle },
        { value: 'closed', label: 'Closed', icon: CheckCircle },
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
        { value: 'urgent', label: 'Urgent', icon: ShieldAlert },
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
              className="w-full pl-9 pr-3 py-2 text-[length:var(--font-body)] rounded-md border border-[var(--border-color)] bg-[var(--surface-muted)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-primary-500"
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

    if (activeColumnFilter === 'category') {
      return (
        <div className="flex flex-col gap-2">
          <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
            <Tag size={12} className="opacity-70" />
            Filter by category
          </span>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            <button
              onClick={() => {
                setCategoryFilter('all');
                closeColumnFilter();
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-[length:var(--font-body)] transition-colors ${categoryFilter === 'all'
                ? 'bg-primary-600 text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                }`}
            >
              <span className="flex items-center gap-2">
                <List size={14} className="opacity-70" />
                All categories
              </span>
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setCategoryFilter(cat.id.toString());
                  closeColumnFilter();
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[length:var(--font-body)] transition-colors ${categoryFilter === cat.id.toString()
                  ? 'bg-primary-600 text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <Tag size={14} className="opacity-70" />
                  {cat.name}
                </span>
              </button>
            ))}
            {categories.length === 0 && (
              <div className="px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-muted)]">No categories found.</div>
            )}
          </div>
        </div>
      );
    }

    if (activeColumnFilter === 'labels') {
      const filteredLabels = labels.filter((labelItem) =>
        `${labelItem.name} ${labelItem.description || ''}`.toLowerCase().includes(columnFilterSearch.trim().toLowerCase())
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
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-[length:var(--font-body)] transition-colors ${labelFilterIds.length === 0
                ? 'bg-primary-600 text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                }`}
            >
              <span className="flex items-center gap-2">
                <List size={14} className="opacity-70" />
                All labels
              </span>
            </button>
            {filteredLabels.map((labelItem) => (
              <button
                key={labelItem.id}
                onClick={() =>
                  setLabelFilterIds((current) =>
                    current.includes(labelItem.id)
                      ? current.filter((labelId) => labelId !== labelItem.id)
                      : [...current, labelItem.id],
                  )
                }
                className={`w-full rounded-md border px-2.5 py-1.5 text-left text-[length:var(--font-body)] transition-colors ${
                  labelFilterIds.includes(labelItem.id)
                    ? 'border-primary-300 bg-[var(--surface-subtle)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                }`}
              >
                <LabelGroup labels={[labelItem]} size="sm" />
              </button>
            ))}
            {filteredLabels.length === 0 && (
              <div className="px-2.5 py-1.5 text-[length:var(--font-body)] text-[var(--text-muted)]">No labels found.</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLabelFilterIds([])}
              className="px-2.5 py-1.5 text-[length:var(--font-body)] rounded-[var(--shell-radius)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            >
              Clear
            </button>
            <button
              onClick={closeColumnFilter}
              className="px-2.5 py-1.5 text-[length:var(--font-body)] rounded-md bg-primary-600 text-white hover:bg-primary-700"
            >
              Apply
            </button>
          </div>
        </div>
      );
    }

    if (activeColumnFilter === 'created_at') {
      return (
        <div className="flex flex-col gap-3">
          <span className="text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
            <Calendar size={12} className="opacity-70" />
            Filter by created date
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
        message={`You have ${selectedTickets.size} ticket${selectedTickets.size !== 1 ? 's' : ''} selected. Navigating away will clear your selection.`}
        confirmText="Leave"
        cancelText="Stay"
        variant="warning"
        cancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
      <div className="flex min-w-0 flex-col h-full bg-transparent text-[var(--text-primary)]">
        {/* Main Content */}
        <div className="flex-1 flex min-w-0 flex-col overflow-hidden">

          {/* Top Header */}
          <header className="bg-[var(--card-bg)] border-b border-[var(--border-color)] px-5 py-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">{activeViewName}</h1>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCreateTicket(true)}
                  className="bg-primary-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-primary-700 flex items-center space-x-2 text-[length:var(--font-body)] font-medium"
                  >
                    <Plus size={14} />
                    <span>Create</span>
                  </button>
                  <div className="lg:hidden">
                    <ViewModeDropdown viewMode={viewMode === 'card' ? 'card' : 'list'} onViewChange={(mode) => setViewMode(mode)} />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[240px] max-w-[520px]">
                  <div ref={searchContainerRef} className="w-full">
                    <div className="relative w-full">
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search tickets"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onFocus={() => {
                          const { cleanedQuery } = parseSearchQuery(searchQuery);
                          if (activeSearchFilterKey) {
                            setShowSearchValueDropdown(true);
                            setShowSearchFilterDropdown(false);
                          } else if (!searchQuery.trim() || !cleanedQuery) {
                            setShowSearchFilterDropdown(true);
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
                                  { value: 'open', label: 'Open', icon: UserCheck },
                                  { value: 'in_progress', label: 'In progress', icon: Clock },
                                  { value: 'pending', label: 'Pending', icon: AlertCircle },
                                  { value: 'on_hold', label: 'On hold', icon: PauseCircle },
                                  { value: 'closed', label: 'Closed', icon: CheckCircle },
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
                                  { value: 'urgent', label: 'Urgent', icon: ShieldAlert },
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
                          {activeSearchFilterKey === 'category' && (
                            <>
                              <div className="px-2 py-1 text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Select category</div>
                              <div className="mt-1 space-y-1 max-h-60 overflow-y-auto">
                                <button
                                  onClick={() => applySearchFilterValue('category', 'all')}
                                  className="w-full text-left px-2.5 py-2 rounded-md text-[length:var(--font-body)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                                >
                                  <span className="flex items-center gap-2">
                                    <List size={14} className="opacity-70" />
                                    All categories
                                  </span>
                                </button>
                                {categories.map(cat => (
                                  <button
                                    key={cat.id}
                                    onClick={() => applySearchFilterValue('category', cat.id.toString())}
                                    className="w-full text-left px-2.5 py-2 rounded-md text-[length:var(--font-body)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                                  >
                                    <span className="flex items-center gap-2">
                                      <Tag size={14} className="opacity-70" />
                                      {cat.name}
                                    </span>
                                  </button>
                                ))}
                                {categories.length === 0 && (
                                  <div className="px-2.5 py-2 text-[length:var(--font-body)] text-[var(--text-muted)]">No categories found.</div>
                                )}
                              </div>
                            </>
                          )}
                          {activeSearchFilterKey === 'labels' && (
                            <>
                              <div className="px-2 py-1 text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Select labels</div>
                              <div className="mt-1 space-y-1 max-h-60 overflow-y-auto">
                                <button
                                  onClick={() => setLabelFilterIds([])}
                                  className="w-full text-left px-2.5 py-2 rounded-md text-[length:var(--font-body)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
                                >
                                  <span className="flex items-center gap-2">
                                    <List size={14} className="opacity-70" />
                                    Clear labels
                                  </span>
                                </button>
                                {labels.map((labelItem) => (
                                  <button
                                    key={labelItem.id}
                                    onClick={() =>
                                      setLabelFilterIds((current) =>
                                        current.includes(labelItem.id)
                                          ? current.filter((labelId) => labelId !== labelItem.id)
                                          : [...current, labelItem.id],
                                      )
                                    }
                                    className={`w-full rounded-md border px-2.5 py-2 text-left text-[length:var(--font-body)] ${
                                      labelFilterIds.includes(labelItem.id)
                                        ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                                        : 'border-transparent text-gray-700 hover:bg-gray-100 dark:text-[var(--text-primary)] dark:hover:bg-surface-hover'
                                    }`}
                                  >
                                    <LabelGroup labels={[labelItem]} size="sm" />
                                  </button>
                                ))}
                                {labels.length === 0 && (
                                  <div className="px-2.5 py-2 text-[length:var(--font-body)] text-[var(--text-muted)]">No labels found.</div>
                                )}
                              </div>
                            </>
                          )}
                          {activeSearchFilterKey === 'created_at' && (
                            <>
                              <div className="px-2 py-1 text-[length:var(--font-meta)] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Select created date</div>
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
                                  onClick={() => applySearchFilterValue('created_at', '')}
                                  className="px-2.5 py-1.5 text-[length:var(--font-body)] rounded-md border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
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
                                    applySearchFilterValue('created_at', tokenValue);
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

                    {searchFilterChips.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {searchFilterChips.map(chip => (
                          <button
                            key={`${chip.key}-${chip.label}`}
                            type="button"
                            onClick={() => clearSearchFilterKey(chip.key)}
                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-gray-200 dark:border-subtle bg-white dark:bg-surface-elevated text-[length:var(--font-body)] text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover"
                          >
                            <span>{chip.label}</span>
                            <X size={12} className="opacity-70" />
                          </button>
                        ))}
                      </div>
                    )}

                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  <button
                    onClick={() => {
                      const nextView = isTrashView ? defaultView : 'trash';
                      handleViewSelect(nextView);
                    }}
                  className={`px-3 py-2 text-[length:var(--font-body)] font-medium rounded-lg border border-gray-200 dark:border-subtle flex items-center gap-2 transition-colors ${isTrashView
                      ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40'
                      : 'bg-white dark:bg-surface-elevated text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover'
                      }`}
                  >
                    <Trash2 size={14} />
                    <span>Trash</span>
                  </button>
                  <button
                    onClick={() => setShowSettingsModal(true)}
                    className="px-3 py-2 text-[length:var(--font-body)] font-medium rounded-lg border border-gray-200 dark:border-subtle bg-white dark:bg-surface-elevated text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover flex items-center gap-2"
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
                      className="px-3 py-2 text-[length:var(--font-body)] font-medium rounded-lg border border-gray-200 dark:border-subtle bg-white dark:bg-surface-elevated text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
                    >
                      {detailPanelOpen ? 'Hide Details' : 'Show Details'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className={`flex-1 min-w-0 overflow-hidden ${splitLayoutClass}`}>
            {isLoading && <Loader />}
            {/* Tickets List */}
            <div className={`${viewMode === 'detailed' && showDetailPanel ? 'min-w-0' : 'w-full'} min-w-0 bg-white dark:bg-surface-elevated border-r border-gray-200 dark:border-subtle flex flex-col`}>
              {/* Bulk Actions - Show when tickets are selected */}
              {selectedTickets.size > 0 && (
                <div className="m-4 flex items-center gap-2 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                  <span className="text-[length:var(--font-body)] font-medium text-primary-700 dark:text-primary-300">
                    {selectedTickets.size} ticket{selectedTickets.size !== 1 ? 's' : ''} selected
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

              {/* Tickets */}
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <TableSkeleton rows={7} columns={10} minWidth={1140} />
                ) : viewMode === 'list' ? (
                  <div className="p-4">
                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-subtle bg-white dark:bg-surface-elevated shadow-sm">
                      <div className="min-w-[1140px] w-full">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-subtle bg-white dark:bg-surface-hover">
                        {!isTrashView && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleViewSelect(openViewKey)}
                              disabled={activeView === openViewKey}
                              className={`px-3 py-1.5 text-[14px] rounded-lg transition-colors ${activeView === openViewKey
                                ? 'bg-transparent text-gray-900 dark:text-white font-semibold cursor-default'
                                : 'bg-white dark:bg-surface-elevated text-gray-500 dark:text-gray-400 opacity-80 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-hover cursor-pointer'
                                }`}
                            >
                              <span>Open</span>
                              <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[14px] text-gray-700 dark:bg-surface-hover dark:text-[var(--text-primary)]">
                                {openCount}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleViewSelect(closedViewKey)}
                              disabled={activeView === closedViewKey}
                              className={`px-3 py-1.5 text-[14px] rounded-lg transition-colors ${activeView === closedViewKey
                                ? 'bg-transparent text-gray-900 dark:text-white font-semibold cursor-default'
                                : 'bg-white dark:bg-surface-elevated text-gray-500 dark:text-gray-400 opacity-80 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-hover cursor-pointer'
                                }`}
                            >
                              <span>Closed</span>
                              <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[14px] text-gray-700 dark:bg-surface-hover dark:text-[var(--text-primary)]">
                                {closedCount}
                              </span>
                            </button>
                          </>
                        )}
                        {isTrashView && (
                          <div className="text-[14px] text-gray-500 dark:text-gray-400 italic">
                            Showing all deleted tickets
                          </div>
                        )}
                        </div>
                        <div className={`${listGridCols} text-[14px] tracking-wide bg-white dark:bg-surface-hover text-gray-800 dark:text-[var(--text-primary)] rounded-t-lg border-b border-gray-200 dark:border-subtle`}>
                          <div className="flex items-center justify-center py-3 px-3">
                            <input
                              ref={headerCheckboxRef}
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={(e) => handleSelectAllVisible(e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-primary-400 focus:ring-primary-500"
                            />
                          </div>
                          {renderSortableHeader('Ticket ID', 'ticket_id')}
                          {renderSortableHeader('Subject', 'title')}
                          {renderSortableHeader('Status', 'status', {
                            align: 'center',
                            filterKey: 'status',
                            active: columnFilterActive.status,
                          })}
                          {renderSortableHeader('Priority', 'priority', {
                            align: 'center',
                            filterKey: 'priority',
                            active: columnFilterActive.priority,
                          })}
                          {renderSortableHeader('Department', 'department', {
                            filterKey: 'department',
                            active: columnFilterActive.department,
                          })}
                          {renderSortableHeader('Author', 'author')}
                          {renderSortableHeader('Assignee', 'assignee', {
                            filterKey: 'assignee',
                            active: columnFilterActive.assignee,
                          })}
                          {renderSortableHeader('Created Date', 'created_at', {
                            align: 'center',
                            filterKey: 'created_at',
                            active: columnFilterActive.created_at,
                            filterColorClass: 'text-primary-600 dark:text-primary-400',
                          })}
                          {renderSortableHeader('Tasks', 'tasks', { align: 'center' })}
                        </div>
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                          {listTickets.length === 0 ? (
                            <div className="px-6 py-10 text-center text-[length:var(--font-body)] text-[var(--text-muted)]">
                              <p>No tickets found.</p>
                              {hasActiveFilters ? (
                                <p className="mt-1">Try adjusting your filters.</p>
                              ) : (
                                <p className="mt-1">Tickets will appear here once created.</p>
                              )}
                            </div>
                          ) : (
                            listTickets.map(ticket => {
                              const isSelected = selectedTickets.has(ticket.id);
                              const createdDate = formatCreatedDateForList(ticket.createdAt);
                              const tasks = ticket.linked_tasks_count ?? 0;
                              return (
                                <div
                                  key={ticket.id}
                                  onClick={() => handleListRowClick(ticket)}
                                  className={`${listGridCols} items-center text-[14px] bg-gray-50 dark:bg-surface-elevated hover:bg-gray-100 dark:hover:bg-surface-hover cursor-pointer transition-colors ${isSelected ? 'ring-1 ring-primary-400 bg-primary-50/70 dark:bg-primary-900/20' : ''
                                    }`}
                                >
                                  <div className="flex items-center justify-center py-3 px-3">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => handleTicketSelection(ticket.id, e.target.checked)}
                                      className="h-4 w-4 rounded border-gray-300 text-primary-400 focus:ring-primary-500"
                                    />
                                  </div>
                                  <div className="py-3 px-3 text-left whitespace-nowrap text-[length:var(--font-meta)] font-semibold tracking-wide text-primary-700 dark:text-primary-300">
                                    #{ticket.ticket_id}
                                  </div>
                                  <div className={`py-3 px-3 text-left text-gray-900 dark:text-[var(--text-primary)] ${(!ticket.is_opened || ticket.has_new_reply) ? 'font-bold' : 'font-normal'}`}>
                                    <div className="flex items-center gap-2">
                                      <div className="relative group min-w-0">
                                        <span
                                          className="block truncate text-[14px] leading-5"
                                          onMouseEnter={(e) => showTicketPreview(ticket, e.currentTarget)}
                                          onMouseLeave={scheduleHideTicketPreview}
                                        >
                                          {ticket.title}
                                        </span>
                                      </div>
                                      {(!ticket.is_opened || ticket.has_new_reply) && <NewBadge />}
                                    </div>
                                    <LabelGroup labels={ticket.labels || []} size="table" maxVisible={3} className="mt-1" />
                                  </div>
                                  <div className="py-3 px-3 flex justify-center">
                                    <button
                                      className="focus:outline-none"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTicket(ticket);
                                        setSelectedStatus(ticket.status);
                                        setShowStatusModal(true);
                                      }}
                                    >
                                      <span className={statusPillClass(ticket.status)}>
                                        {statusLabel(ticket.status)}
                                      </span>
                                    </button>
                                  </div>
                                  <div className="py-3 px-3 flex justify-center">
                                    <button
                                      className="focus:outline-none"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTicket(ticket);
                                        setSelectedPriority(ticket.priority);
                                        setShowPriorityModal(true);
                                      }}
                                    >
                                      <span className={priorityPillClass(ticket.priority)}>
                                        {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                                      </span>
                                    </button>
                                  </div>
                                  <div className="py-3 px-3 text-left text-[14px] text-gray-700 dark:text-[var(--text-primary)]">
                                    <button
                                      className="w-full truncate text-left font-medium"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setSelectedTicket(ticket);
                                        setSelectedDepartmentId(ticket.department?.id?.toString() || '');
                                        setShowDepartmentModal(true);
                                      }}
                                    >
                                      {ticket.department?.name || '—'}
                                    </button>
                                  </div>
                                  <div className="py-3 px-3 text-left text-[14px] text-gray-700 dark:text-[var(--text-primary)]">
                                    <span className="block truncate font-medium">{formatUserName(ticket.requester)}</span>
                                  </div>
                                  <div className="py-3 px-3 text-left text-[14px] text-gray-700 dark:text-[var(--text-primary)]">
                                    <button
                                      className="w-full truncate text-left font-medium"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setSelectedTicket(ticket);
                                        setShowAssignModal(true);
                                      }}
                                    >
                                      {formatUserName(ticket.assignee)}
                                    </button>
                                  </div>
                                  <div className="py-3 px-3 text-center whitespace-nowrap text-[14px] text-gray-700 dark:text-[var(--text-primary)]">
                                    <button
                                      className="w-full text-center font-medium"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTicket(ticket);
                                        setTaskDialogTicketId(ticket.id.toString());
                                        setTaskDialogOpen(true);
                                      }}
                                    >
                                      {createdDate}
                                    </button>
                                  </div>
                                  <div className="py-3 px-3 text-center whitespace-nowrap text-[14px] text-gray-900 dark:text-[var(--text-primary)]">
                                    <button
                                      className="w-full text-center font-semibold"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTicket(ticket);
                                        setTaskDialogTicketId(ticket.id.toString());
                                        setTaskDialogOpen(true);
                                      }}
                                    >
                                      {tasks}
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <EmptyState />
                ) : viewMode === 'detailed' ? (
                  filteredTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`mx-3 my-1.5 cursor-pointer rounded-[12px] border p-3 transition-colors ${selectedTicket?.id === ticket.id
                        ? 'border-primary-300 bg-primary-50/70 dark:border-primary-700 dark:bg-primary-900/20'
                        : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-subtle dark:bg-surface-elevated dark:hover:bg-surface-hover'
                        } ${ticket.breached ? 'border-red-300 dark:border-red-700' : ''}`}
                    >
                      <div className="flex items-start space-x-2.5">
                        <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white font-medium text-[length:var(--font-meta)] overflow-hidden flex-shrink-0">
                          {ticket.requester && ticket.requester.avatar ? (
                            <img src={ticket.requester.avatar} alt={`${ticket.requester.firstName} ${ticket.requester.lastName}`} className="w-full h-full object-cover" />
                          ) : (
                            <span>{`${ticket.requester.firstName[0]?.toUpperCase() || ''}${ticket.requester.lastName[0]?.toUpperCase() || ''}`}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <div className={`flex items-center gap-2 ${!ticket.is_opened ? 'font-semibold' : 'font-medium'}`}>
                              <h3 className="truncate text-[length:var(--font-body)] font-semibold text-gray-900 dark:text-[var(--text-primary)]">{ticket.title}</h3>
                              {(!ticket.is_opened || ticket.has_new_reply) && <NewBadge />}
                            </div>
                            <span className="text-[length:var(--font-meta)] font-medium text-[var(--text-muted)]">{format(new Date(ticket.createdAt), 'dd MMM')}</span>
                          </div>
                          <LabelGroup labels={ticket.labels || []} maxVisible={3} className="mb-2" />
                          <p className="mb-2 line-clamp-1 text-[length:var(--font-meta)] font-semibold tracking-wide text-primary-700 dark:text-primary-300">#{ticket.ticket_id}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 rounded-full text-[length:var(--font-meta)] font-medium border ${getStatusColor(ticket.status)}`}>
                                {ticket.status.replace('_', ' ')}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-[length:var(--font-meta)] font-medium ${getPriorityColor(ticket.priority)}`}>
                                {ticket.priority}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : viewMode === 'card' ? (
                  <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredTickets.map(ticket => (
                      <GridTicketCard
                        key={ticket.id}
                        ticket={ticket}
                        openDropdownId={selectedTicket?.id || null}
                        onDropdownToggle={(ticketid) => setSelectedTicket(filteredTickets.find(t => t.id === ticketid) || null)}
                        onDropdownClose={() => setSelectedTicket(null)}
                        onAction={(action, ticket) => handleAction(action, ticket)}
                        isActive={selectedTicket?.id === ticket.id}
                        isSelected={selectedTickets.has(ticket.id)}
                        onSelectionChange={(ticketId, selected) => handleTicketSelection(ticketId, selected)}
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
                    <span>{(currentPage - 1) * limit + 1}–{Math.min(currentPage * limit, totalCount)}</span>
                    <span>of {totalCount}</span>
                    {hasActiveFilters && (
                      <span className="text-primary-500 font-medium">(filtered)</span>
                    )}
                    <span className="text-[var(--text-muted)]">|</span>
                    <Select
                      value={String(limit)}
                      onChange={(val) => {
                        const newLimit = Number(val);
                        setLimit(newLimit);
                        localStorage.setItem('ticketPageSize', String(newLimit));
                        setCurrentPage(1);
                        fetchTickets(1, activeView, newLimit);
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

            {/* Ticket Details */}
            {isLoading ? (
              <TicketDetailSkeleton />
            ) : selectedTicket && showDetailPanel ? (
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-gray-50 dark:bg-surface">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Header and Summary Section */}
                  <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle overflow-hidden">
                    {/* Header Section */}
                    <div className="px-5 py-3 border-b border-gray-200 dark:border-subtle">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h1 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-1 truncate">
                            {selectedTicket.title}
                          </h1>
                          <LabelGroup labels={selectedTicketLabels} className="mb-3" emptyText="" />
                          <div className="flex items-center space-x-4 mb-3">
                            <span className="text-[length:var(--font-body)] font-medium text-gray-600 dark:text-[var(--text-muted)]">
                              {selectedTicket.ticket_id}
                            </span>
                            <span className="text-[length:var(--font-body)] text-[var(--text-muted)]">
                              Created {formatRelativeTime(selectedTicket.createdAt)}
                            </span>
                          </div>
                          <div className="flex items-center flex-wrap gap-2">
                            <span className={`px-3 py-1 rounded-full text-[length:var(--font-meta)] font-semibold border ${getStatusColor(selectedTicket.status)}`}>
                              {selectedTicket.status.replace("_", " ").toUpperCase()}
                            </span>
                            <div className="inline-flex items-center">
                              <span className={`px-3 py-1 rounded-full text-[length:var(--font-meta)] font-semibold border ${getPriorityColor(selectedTicket.priority)}`}>
                                {selectedTicket.priority.toUpperCase()}
                              </span>
                              {(user?.role.toUpperCase() === "ADMIN" || user?.role.toUpperCase() === "AGENT") && (
                                <Tooltip
                                  content={
                                    <div className="p-4">
                                      <label htmlFor="priority-select-card" className="block text-[length:var(--font-body)] font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">Select Priority</label>
                                      <select
                                        id="priority-select-card"
                                        value={selectedPriority}
                                        onChange={(e) => setSelectedPriority(e.target.value)}
                                        className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-subtle rounded-lg bg-gray-50 dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
                                      >
                                        <option value="">Select a Priority</option>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                      </select>
                                      <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200 dark:border-subtle">
                                        <button
                                          onClick={() => setSelectedPriority("")}
                                          className="px-3 py-1 text-[length:var(--font-body)] rounded-md border border-gray-300 dark:border-subtle text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={handleUpdatePriority}
                                          disabled={isSubmitting || !selectedPriority}
                                          className="px-3 py-1 text-[length:var(--font-body)] rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                          {isSubmitting ? 'Updating...' : 'Update'}
                                        </button>
                                      </div>
                                    </div>
                                  }
                                >
                                  <button className="ml-2 inline-flex items-center justify-center w-7 h-7 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-all duration-200 group" title="Change Priority">
                                    <List size={14} className="group-hover:scale-110 transition-transform" />
                                  </button>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                      <div className="ml-4 flex shrink-0 flex-wrap items-center justify-end gap-2">
                          {isTicketClosed ? (
                            <button
                              onClick={() => setIsReopenModalOpen(true)}
                              disabled={isSubmitting}
                              className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-[length:var(--font-body)] font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              {isSubmitting ? 'Reopening...' : 'Reopen Ticket'}
                            </button>
                          ) : (
                            <>
                              {!selectedTicket.assignee && (
                                <button
                                  onClick={handleAssignToMe}
                                  disabled={isAssigning}
                                  className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-[length:var(--font-body)] font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  {isAssigning ? 'Assigning...' : 'Assign to me'}
                                </button>
                              )}

                              <div className="flex items-center bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-subtle p-1 shadow-sm">
                                <div className="flex items-center space-x-1">
                                  <a
                                    href={`/helpcenter/tk/${selectedTicket.ticket_id}`}
                                    target='_blank'
                                    className="inline-flex items-center justify-center w-10 h-10 text-primary-400 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all duration-200 group"
                                    title="Customer Portal"
                                  >
                                    <LinkIcon size={18} className="group-hover:scale-110 transition-transform" />
                                  </a>

                                  {!isUserWatcher && (
                                    <Tooltip
                                      key={`status-tooltip-${selectedTicket.status}`}
                                      content={
                                        <UpdateTicketStatus
                                          handleStatusUpdate={handleStatusUpdate}
                                          isSubmitting={isSubmitting}
                                          selectedOption={selectedStatus}
                                          setSelectedOption={setSelectedStatus}
                                          statusDescription={statusDescription}
                                          setStatusDescription={setStatusDescription}
                                          currentStatus={selectedTicket.status}
                                        />
                                      }
                                    >
                                      <button
                                        className="inline-flex items-center justify-center w-10 h-10 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all duration-200 group"
                                        title="Update Status"
                                      >
                                        <Edit3 size={18} className="group-hover:scale-110 transition-transform" />
                                      </button>
                                    </Tooltip>
                                  )}

                                  {/* Department Action - Change Department (Tooltip Pattern) */}
                                  <Tooltip
                                    content={
                                      <div className="p-4">
                                        <label htmlFor="dept-select" className="block text-[length:var(--font-body)] font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                                          Select Department
                                        </label>
                                        <select
                                          id="dept-select"
                                          value={selectedDepartmentId}
                                          onChange={(e) => setSelectedDepartmentId(e.target.value)}
                                          className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-subtle rounded-lg bg-gray-50 dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
                                        >
                                          <option value="">Select a Department</option>
                                          {departments.map((dept) => (
                                            <option key={dept.id} value={dept.id}>
                                              {dept.name}
                                            </option>
                                          ))}
                                        </select>
                                        <div className="flex justify-end space-x-2 pt-3 border-t border-gray-200 dark:border-subtle">
                                          <button
                                            onClick={() => {
                                              setSelectedDepartmentId("");
                                            }}
                                            className="px-3 py-1 text-[length:var(--font-body)] rounded-md border border-gray-300 dark:border-subtle text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            onClick={handleUpdateDepartment}
                                            disabled={isSubmitting || !selectedDepartmentId}
                                            className="px-3 py-1 text-[length:var(--font-body)] rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                          >
                                            {isSubmitting ? 'Updating...' : 'Update'}
                                          </button>
                                        </div>
                                      </div>
                                    }
                                  >
                                    <button
                                      className="inline-flex items-center justify-center w-10 h-10 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all duration-200 group"
                                      title="Change Department"
                                    >
                                      <Building size={18} className="group-hover:scale-110 transition-transform" />
                                    </button>
                                  </Tooltip>

                                  {(user?.role.toUpperCase() === "ADMIN" || user?.role.toUpperCase() === "AGENT") && (
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
                                                  .filter(agent => {
                                                    // Exclude currently assigned agent
                                                    if (selectedTicket.assignee && agent.id.toString() === selectedTicket.assignee.id) return false;
                                                    // Only show agents from the ticket's department
                                                    if (selectedTicket.department && agent.department && agent.department.length > 0) {
                                                      const deptId = typeof selectedTicket.department === 'number' ? selectedTicket.department : selectedTicket.department.id;
                                                      return agent.department.some(dept => dept.id === deptId);
                                                    }
                                                    return true;
                                                  })
                                                  .map(agent => ({
                                                    value: agent.id.toString(),
                                                    label: agent.name || "Unknown Agent"
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
                                              disabled={isSubmitting}
                                              className="px-2.5 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors text-[length:var(--font-body)] font-medium"
                                            >
                                              {isSubmitting ? "Please wait.. " : "Reassign"}
                                            </button>
                                          </div>
                                        </div>
                                      }
                                    >
                                      <button
                                        className="inline-flex items-center justify-center w-10 h-10 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-all duration-200 group"
                                        title={selectedTicket.assignee ? "Reassign Ticket" : "Assign Ticket"}
                                      >
                                        <UserCheck size={18} className="group-hover:scale-110 transition-transform" />
                                      </button>
                                    </Tooltip>
                                  )}
                                </div>

                                <div className="w-px h-8 bg-gray-300 dark:bg-surface-hover mx-1"></div>

                                <div className="flex items-center space-x-1">
                                  {!isUserWatcher && (
                                    <Tooltip
                                      content={
                                        <div className="p-4 bg-white dark:bg-surface-elevated">
                                          <MultiSelectAgents
                                            label="Select Watchers"
                                            agents={agentsData.filter(agent => agent.id.toString() !== selectedTicket.assignee?.id)}
                                            selectedAgents={selectedWatchers}
                                            onChange={setSelectedWatchers}
                                            placeholder="Choose watchers..."
                                          />
                                          <div className="flex justify-end space-x-2 mt-4 pt-3 border-t border-gray-200 dark:border-subtle">
                                            <button
                                              onClick={handleAddWatchers}
                                              disabled={isSubmitting}
                                              className="px-2.5 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors text-[length:var(--font-body)] font-medium"
                                            >
                                              {isSubmitting ? "Please wait.. " : "Add Watcher"}
                                            </button>
                                          </div>
                                        </div>
                                      }
                                    >
                                      <button
                                        className="inline-flex items-center justify-center w-10 h-10 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all duration-200 group"
                                        title="Add Watchers"
                                      >
                                        <Eye size={18} className="group-hover:scale-110 transition-transform" />
                                      </button>
                                    </Tooltip>
                                  )}

                                  {!isUserWatcher && (
                                    <button
                                      onClick={() => setShowLabelsModal(true)}
                                      className="inline-flex items-center justify-center w-10 h-10 text-pink-600 hover:text-pink-700 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-all duration-200 group"
                                      title="Manage Labels"
                                    >
                                      <Tag size={18} className="group-hover:scale-110 transition-transform" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ticket Status Stepper */}
                    <div className="px-5 py-3 bg-gray-50 dark:bg-surface-elevated border-b border-gray-200 dark:border-subtle">
                      <DynamicStepper status={selectedTicket.status} assignedTo={selectedTicket.assignee} />
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                          <div className="flex items-center mb-3">
                            <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mr-3">
                              <User className="w-4 h-4 text-primary-400 dark:text-primary-400" />
                            </div>
                            <h3 className="text-[length:var(--font-body)] font-semibold text-gray-900 dark:text-[var(--text-primary)]">Creator Information</h3>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center text-[length:var(--font-body)] text-gray-700 dark:text-[var(--text-primary)]">
                              <User className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                              <span className="font-medium">{selectedTicket.requester.firstName} {selectedTicket.requester.lastName}</span>
                            </div>
                            <div className="flex items-center text-[length:var(--font-body)] text-gray-600 dark:text-[var(--text-muted)]">
                              <Mail className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                              {selectedTicket.requester.email}
                            </div>
                            <div className="flex items-center text-[length:var(--font-body)] text-gray-600 dark:text-[var(--text-muted)]">
                              <Phone className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                              {selectedTicket.requester.phone || 'No phone provided'}
                            </div>
                            <div className="flex items-center text-[length:var(--font-body)] text-gray-600 dark:text-[var(--text-muted)]">
                              {React.createElement(getSourceIcon(selectedTicket.source), { className: 'w-4 h-4 mr-2 text-[var(--text-muted)]' })}
                              <span className="font-medium">
                                {getSourceDisplay(selectedTicket.source)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                          <div className="flex items-center mb-3">
                            <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mr-3">
                              <UserCheck className="w-4 h-4 text-primary-400 dark:text-primary-400" />
                            </div>
                            <h3 className="text-[length:var(--font-body)] font-semibold text-gray-900 dark:text-[var(--text-primary)]">Assignment Details</h3>
                          </div>
                          <div className="space-y-2">
                            {/* Assignee - clickable text */}
                            <div className="flex items-center text-[length:var(--font-body)] text-gray-700 dark:text-[var(--text-primary)]">
                              <UserCheck className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                              {(user?.role.toUpperCase() === "ADMIN" || user?.role.toUpperCase() === "AGENT") ? (
                                <span
                                  className="font-medium cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                  title="Click to change assignee"
                                  onClick={() => setShowAssignModal(true)}
                                >
                                  {formatUserDisplayName(selectedTicket.assignee, 'Unassigned')}
                                  <Edit3 size={12} className="inline ml-1 opacity-50" />
                                </span>
                              ) : (
                                <span className="font-medium">{formatUserDisplayName(selectedTicket.assignee, 'Unassigned')}</span>
                              )}
                            </div>

                            {/* Department - clickable text */}
                            <div className="flex items-center text-[length:var(--font-body)] text-gray-600 dark:text-[var(--text-muted)]">
                              <Building className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                              {(user?.role.toUpperCase() === "ADMIN" || user?.role.toUpperCase() === "AGENT") ? (
                                <span
                                  className="cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                  title="Click to change department"
                                  onClick={() => setShowDepartmentModal(true)}
                                >
                                  {selectedTicket.department?.name || 'No Department'}
                                  <Edit3 size={12} className="inline ml-1 opacity-50" />
                                </span>
                              ) : (
                                <span>{selectedTicket.department?.name || 'No Department'}</span>
                              )}
                            </div>

                            {/* Category - clickable text */}
                            <div className="flex items-center text-[length:var(--font-body)] text-gray-600 dark:text-[var(--text-muted)]">
                              <Tag className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                              {(user?.role.toUpperCase() === "ADMIN" || user?.role.toUpperCase() === "AGENT") ? (
                                <span
                                  className="cursor-pointer hover:text-primary-400 dark:hover:text-primary-400 transition-colors"
                                  title="Click to change category"
                                  onClick={() => setShowCategoryModal(true)}
                                >
                                  {selectedTicket.category}
                                  <Edit3 size={12} className="inline ml-1 opacity-50" />
                                </span>
                              ) : (
                                <span>{selectedTicket.category}</span>
                              )}
                            </div>
                            {/* Linked Tasks */}
                            <div className="flex items-center text-[length:var(--font-body)] text-gray-600 dark:text-[var(--text-muted)]">
                              <LinkIcon className="w-4 h-4 mr-2 text-[var(--text-muted)]" />
                              <button
                                onClick={() => { setActiveTab('tasks'); setTaskRefreshTrigger(prev => prev + 1); }}
                                className="flex items-center gap-2 hover:text-primary-400 dark:hover:text-primary-400 transition-colors"
                              >
                                <span>Linked Tasks</span>
                                {linkedTasksCount > 0 && (
                                  <span className="px-1.5 py-0.5 text-[length:var(--font-meta)] font-medium bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full">
                                    {linkedTasksCount}
                                  </span>
                                )}
                              </button>
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
                              Created: {formatDateWithTime(selectedTicket.createdAt)}
                            </div>
                            {selectedTicket.resolvedAt && (
                              <div className="flex items-center text-[length:var(--font-body)] text-primary-400 dark:text-primary-400">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Resolved: {formatDate(selectedTicket.resolvedAt)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-gray-50 dark:bg-surface-elevated rounded-lg p-4">
                          <div className="flex items-center mb-3">
                            <Tag className="w-4 h-4 text-gray-600 dark:text-[var(--text-muted)] mr-2" />
                            <h3 className="text-[length:var(--font-body)] font-semibold text-gray-900 dark:text-[var(--text-primary)]">Labels</h3>
                          </div>
                          <LabelGroup labels={selectedTicketLabels} size="md" emptyText="No labels assigned" />
                        </div>

                        <div className="bg-gray-50 dark:bg-surface-elevated rounded-lg p-4">
                          <div className="flex items-center mb-3">
                            <Eye className="w-4 h-4 text-gray-600 dark:text-[var(--text-muted)] mr-2" />
                            <h3 className="text-[length:var(--font-body)] font-semibold text-gray-900 dark:text-[var(--text-primary)]">Watchers</h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {ticketWatchers && ticketWatchers.length > 0 ? (
                              ticketWatchers.map((watcher) => (
                                <div key={watcher.id} className="inline-flex items-center px-3 py-1 rounded-full text-[length:var(--font-meta)] font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200 border border-primary-200 dark:border-primary-700">
                                  {watcher.avatar_url ? (
                                    <img src={watcher.avatar_url} alt={watcher.name} className="w-4 h-4 rounded-full mr-2" />
                                  ) : (
                                    <User className="w-3 h-3 mr-2" />
                                  )}
                                  {watcher.name}
                                </div>
                              ))
                            ) : (
                              <span className="text-[length:var(--font-body)] text-[var(--text-muted)] italic">No watchers assigned</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-surface-elevated rounded-lg p-4">
                        <div className="flex items-center mb-3">
                          <FileText className="w-4 h-4 text-gray-600 dark:text-[var(--text-muted)] mr-2" />
                          <h3 className="text-[length:var(--font-body)] font-semibold text-gray-900 dark:text-[var(--text-primary)]">Description</h3>
                        </div>
                        <div className="text-[length:var(--font-body)] text-gray-700 dark:text-[var(--text-primary)] leading-relaxed overflow-y-auto max-h-[600px]">
                          {selectedTicket.description ? (
                            isRichHtmlDescription(selectedTicket.description) ? (
                              <EmailHtmlViewer
                                html={selectedTicket.description}
                                minHeight={200}
                                className="rounded-md bg-transparent"
                              />
                            ) : (
                              <div
                                className="sd-rich-content overflow-y-auto"
                                dangerouslySetInnerHTML={{ __html: sanitizeHTML(selectedTicket.description) }}
                              />
                            )
                          ) : (
                            <span className="text-[var(--text-muted)] italic">No description provided</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle">
                    <div className="border-b border-gray-200 dark:border-subtle">
                      <nav className="flex space-x-8 overflow-x-auto whitespace-nowrap px-6" aria-label="Tabs">
                        <button onClick={() => setActiveTab('activity')} className={`py-4 px-1 border-b-2 font-medium text-[length:var(--font-body)] flex items-center space-x-2 ${activeTab === 'activity' ? 'border-primary-500 text-primary-400 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-[var(--text-primary)] dark:hover:text-gray-300'}`}>
                          <List className="w-4 h-4" />
                          <span>Activity Stream</span>
                        </button>
                        <button onClick={() => setActiveTab('attachments')} className={`py-4 px-1 border-b-2 font-medium text-[length:var(--font-body)] flex items-center space-x-2 ${activeTab === 'attachments' ? 'border-primary-500 text-primary-400 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-[var(--text-primary)] dark:hover:text-gray-300'}`}>
                          <Paperclip className="w-4 h-4" />
                          <span>Attachments</span>
                        </button>
                        <button onClick={() => { setActiveTab('tasks'); setTaskRefreshTrigger(prev => prev + 1); }} className={`py-4 px-1 border-b-2 font-medium text-[length:var(--font-body)] flex items-center space-x-2 ${activeTab === 'tasks' ? 'border-primary-500 text-primary-400 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-[var(--text-primary)] dark:hover:text-gray-300'}`}>
                          <CheckSquare className="w-4 h-4" />
                          <span>Tasks</span>
                          {linkedTasksCount > 0 && (
                            <span className="px-2 py-0.5 text-[length:var(--font-meta)] font-medium bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full">
                              {linkedTasksCount}
                            </span>
                          )}
                        </button>
                        <button onClick={() => setActiveTab('sla')} className={`py-4 px-1 border-b-2 font-medium text-[length:var(--font-body)] flex items-center space-x-2 ${activeTab === 'sla' ? 'border-primary-500 text-primary-400 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-[var(--text-primary)] dark:hover:text-gray-300'}`}>
                          <List className="w-4 h-4" />
                          <span>SLAs</span>
                        </button>
                      </nav>
                    </div>

                    <div className="p-6">
                      {activeTab === 'activity' && (
                        <TicketActivityStream
                          ticketId={Number.parseInt(selectedTicket.id)}
                          ticket={{
                            id: Number(selectedTicket.id),
                            title: selectedTicket.title,
                            creator_email: selectedTicket.requester?.email || '',
                            creator_name: selectedTicket.requester?.name || '',
                            source: (selectedTicket.source as 'email' | 'portal' | 'customer_portal' | 'api' | 'phone' | 'chat' | 'web') || 'web',
                          }}
                          reloader={reloader}
                          isCustomerView={false}
                          onStatusChange={() => fetchTicketDetails(selectedTicket.id)}
                        />
                      )}
                      {activeTab === 'attachments' && (
                        <TicketAttachments ticketId={Number.parseInt(selectedTicket.id)} />
                      )}
                      {activeTab === 'tasks' && (
                        <TicketTasks ticketId={Number.parseInt(selectedTicket.id)} onTaskCountChange={setLinkedTasksCount} refreshTrigger={taskRefreshTrigger} />
                      )}
                      {activeTab === 'sla' && (
                        <SlaInfo ticketId={Number.parseInt(selectedTicket.id)} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : viewMode === 'detailed' && showDetailPanel ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState title="No ticket selected" message="Please select a ticket to view its details." />
              </div>
            ) : null}
          </div>
      </div>

      {/* Create ticket */}
      <Modal
        size='4xl'
        isOpen={createTicket}
        onClose={handleCloseCreateTicketModal}
        title="New Ticket"
        closeOnBackdropClick={false}
      >
        {
          createTicket && <CreateTicketModal
            reload={() => fetchTickets(currentPage, activeView)}
            onclose={handleCloseCreateTicketModal}
            onSuccess={confirmCloseCreateTicketModal}
            onDirtyChange={setIsCreateTicketModalDirty}
          />
        }

      </Modal>

      {/* Unsaved Changes Confirmation Dialog */}
      <ConfirmDialog
        show={showCreateTicketCloseConfirm}
        cancel={() => setShowCreateTicketCloseConfirm(false)}
        onConfirm={confirmCloseCreateTicketModal}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to close without saving?"
        variant="warning"
        confirmText="Close Anyway"
        cancelText="Keep Editing"
      />


      <ReopenTicketModal
        isOpen={isReopenModalOpen}
        onClose={() => setIsReopenModalOpen(false)}
        onSubmit={handleReopen}
        isSubmitting={isSubmitting}
      />

      {selectedTicket && (
        <UpdateStatusModal
          ticketId={selectedTicket.id}
          currentStatus={selectedTicket.status}
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          onStatusUpdated={() => {
            fetchTickets(currentPage, activeView);
            fetchTicketDetails(selectedTicket.id);
          }}
        />
      )}

      {selectedTicket && (
        <UpdatePriorityModal
          ticketId={selectedTicket.id}
          currentPriority={selectedTicket.priority}
          isOpen={showPriorityModal}
          onClose={() => setShowPriorityModal(false)}
          onPriorityUpdated={() => fetchTickets(currentPage, activeView)}
        />
      )}

      {selectedTicket && (
        <ManageLabelsModal
          entityType="ticket"
          entityId={selectedTicket.id}
          isOpen={showLabelsModal}
          onClose={() => setShowLabelsModal(false)}
          selectedLabels={selectedTicketLabels}
          onSaved={handleLabelsSaved}
          title="Manage Ticket Labels"
        />
      )}

      <TaskListDialog
        ticketId={taskDialogTicketId}
        isOpen={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
      />

      {/* Assign Agent Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Agent"
        size="sm"
      >
        <div className="space-y-4">
          <Select
            id="assign-agent-modal"
            label="Select Agent"
            value={selectedAgentId}
            onChange={setSelectedAgentId}
            options={[
              { value: "", label: "Choose agent...", disabled: true },
              ...(agents && agents.length > 0
                ? agents
                  .filter(agent => {
                    if (selectedTicket?.assignee && agent.id.toString() === selectedTicket.assignee.id) return false;
                    if (selectedTicket?.department && agent.department && agent.department.length > 0) {
                      const deptId = typeof selectedTicket.department === 'number' ? selectedTicket.department : selectedTicket.department.id;
                      return agent.department.some(dept => dept.id === deptId);
                    }
                    return true;
                  })
                  .map(agent => ({ value: agent.id.toString(), label: agent.name || "Unknown Agent" }))
                : [{ value: "", label: "No agents found", disabled: true }]
              )
            ]}
            placeholder="Choose agent..."
            size="md"
            required
            allowSearch
          />
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowAssignModal(false)}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-subtle rounded-lg text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { handleAssign(); setShowAssignModal(false); }}
              disabled={isSubmitting || !selectedAgentId}
              className="px-2.5 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Update Department Modal */}
      <Modal
        isOpen={showDepartmentModal}
        onClose={() => setShowDepartmentModal(false)}
        title="Update Department"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="dept-select-modal" className="block text-[length:var(--font-body)] font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
              Select Department
            </label>
            <select
              id="dept-select-modal"
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-subtle rounded-lg bg-gray-50 dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">Select a Department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowDepartmentModal(false)}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-subtle rounded-lg text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { handleUpdateDepartment(); setShowDepartmentModal(false); }}
              disabled={isSubmitting || !selectedDepartmentId}
              className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Updating...' : 'Update'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Update Category Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Update Category"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="category-select-modal" className="block text-[length:var(--font-body)] font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
              Select Category
            </label>
            <select
              id="category-select-modal"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 dark:border-subtle rounded-lg bg-gray-50 dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">Select a Category</option>
              {filteredCategoriesForTicket.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowCategoryModal(false)}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-subtle rounded-lg text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { handleUpdateCategory(); setShowCategoryModal(false); }}
              disabled={isSubmitting || !selectedCategoryId}
              className="px-2.5 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Updating...' : 'Update'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Ticket Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={getViewContext() === 'trash' ? 'Delete Forever' : 'Delete Ticket'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-[var(--text-primary)]">
            Are you sure you want to delete ticket <strong>#{selectedTicket?.ticket_id}</strong>?
          </p>
          <p className="text-[length:var(--font-body)] text-[var(--text-muted)]">
            {getViewContext() === 'trash'
              ? 'This action cannot be undone. The ticket will be permanently removed.'
              : 'This action cannot be undone. The ticket will be moved to trash.'}
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-subtle rounded-lg text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSingleTicketDelete}
              className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              {getViewContext() === 'trash' ? 'Delete Forever' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        title={getViewContext() === 'trash' ? 'Delete Forever' : 'Delete Tickets'}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] mb-1">
                {getViewContext() === 'trash' ? (
                  <>Permanently delete {selectedTickets.size} ticket{selectedTickets.size > 1 ? 's' : ''}?</>
                ) : (
                  <>Delete {selectedTickets.size} ticket{selectedTickets.size > 1 ? 's' : ''}?</>
                )}
              </p>
              <p className="text-sm text-gray-600 dark:text-secondary">
                {getViewContext() === 'trash' ? (
                  <>This action cannot be undone. The selected ticket{selectedTickets.size > 1 ? 's' : ''} will be permanently removed.</>
                ) : (
                  <>The selected ticket{selectedTickets.size > 1 ? 's' : ''} will be moved to trash and can be restored later.</>
                )}
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

      {typeof document !== 'undefined' && ticketPreview && ticketPreviewPosition &&
        createPortal(
          <div
            className="fixed z-[10000]"
            style={{ left: ticketPreviewPosition.left, top: ticketPreviewPosition.top }}
            onMouseEnter={clearTicketPreviewHideTimeout}
            onMouseLeave={scheduleHideTicketPreview}
          >
            <HoverPreviewCard
              icon={TicketIcon}
              title={ticketPreview.ticket.title}
              subtitle={`Ticket #${ticketPreview.ticket.ticket_id}`}
              placement={ticketPreview.placement}
              arrowOffset={ticketPreviewPosition.arrowOffset}
              onClose={() => setTicketPreview(null)}
              summaryFields={[
                { label: 'Priority', value: formatPriorityLabel(ticketPreview.ticket.priority) },
                { label: 'Status', value: statusLabel(ticketPreview.ticket.status) },
                { label: 'Source', value: getSourceDisplay(ticketPreview.ticket.source) },
              ]}
              description={getDescriptionPreview(ticketPreview.ticket.description, 280)}
              latestActivity={{
                label: 'Latest update',
                loading: ticketLatestCommentLoading,
                empty: !ticketLatestComment && !ticketLatestCommentLoading,
                emptyTitle: 'No recent activity',
                emptyDescription: 'The latest comment will appear here when activity exists.',
                authorName: ticketLatestComment?.authorName,
                authorAvatar: ticketLatestComment?.authorAvatar,
                createdAt: ticketLatestComment?.createdAt,
                content: ticketLatestComment?.content,
              }}
              detailFields={[
                { label: 'Requester', value: formatUserName(ticketPreview.ticket.requester) },
                { label: 'Assignee', value: ticketPreview.ticket.assignee ? formatUserName(ticketPreview.ticket.assignee) : 'Unassigned' },
                { label: 'Department', value: ticketPreview.ticket.department?.name || '—' },
                { label: 'Linked tasks', value: String(ticketPreview.ticket.linked_tasks_count ?? 0) },
              ]}
            />
          </div>,
          document.body
        )}

      <TicketSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      </div>

    </>
  );
}
