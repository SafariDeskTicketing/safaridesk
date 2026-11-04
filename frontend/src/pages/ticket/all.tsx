import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search, Plus, User, Clock, MessageCircle, ChevronDown, ChevronRight, ChevronLeft, ChevronUp, Grid3x3, Tag, CheckCircle, UserCheck, AlertCircle, ShieldAlert, Trash2, Building, AlertTriangle, UserX, XCircle, Inbox, CreditCard, Settings, X, List, PauseCircle, Ticket as TicketIcon
} from 'lucide-react';
import { format } from 'date-fns';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../stores/authStore';
import { APIS } from '../../services/apis';
import http from '../../services/http';
import { errorNotification, successNotification } from '../../components/ui/Toast';
import type { Agent, LabelItem, Ticket } from '../../types';
import { SOURCE_OPTIONS, getSourceLabel, getStatusColor, getPriorityColor, formatUserDisplayName } from '../../utils/displayHelpers';
import Select from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { useFetchAgents } from '../../services/agents';
import type { AgentType, ApiResponse as AgentApiResponse } from '../../types/agents';
import EmptyState from '../../components/ui/EmptyState';
import TicketDetailSkeleton from '../../components/ui/TicketDetailSkeleton';
import { TableSkeleton } from '../../components/ui/TableSkeleton';
import { GridTicketCard } from '../../components/tickets/GridCard';
import { Modal } from '../../components/ui/Modal';
import { CreateTicketModal } from '../../components/tickets/CreateTicketModal';
import { TicketCard } from '../../components/tickets/TicketCard';
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
import LabelGroup from '../../components/ui/LabelGroup';
import ManageLabelsModal from '../../components/labels/ManageLabelsModal';
import { getLabelNamesByIds, resolveLabelTokenIds } from '../../utils/labels';
import { useHoverPreviewActivity } from '../../hooks/useHoverPreviewActivity';
import { useCopilotStore } from '../../stores/copilotStore';
import { Loader } from '../../components/loader/loader';
import { BASE_URL } from '../../utils/base';
import {
  type ColumnFilterKey,
  SEARCH_FILTER_OPTIONS,
  SEARCH_FILTER_ICONS,
  parseSearchQuery,
  resolveStatusToken,
  resolveCreatedDateToken,
} from './list/ticketSearch';
import { buildTicketQueryParams } from './list/ticketListParams';
import { useTicketFilterOptions } from './list/useTicketFilterOptions';
import { resolveViewFromUrlParams } from './list/ticketViewResolution';
import { TicketRow } from './list/TicketRow';
import { LIST_GRID_COLS, statusLabel } from './list/ticketRowHelpers';
import { useColumnFilterPopover } from './list/useColumnFilterPopover';
import { ColumnFilterPanel } from './list/ColumnFilterPanel';
import {
  useTicketsListQuery,
  transformApiTicket,
  type SortField,
} from './list/ticketListData';
import { useViewSortState } from './list/useViewSortState';
import { useTicketBulkActions, type BulkExportFormat } from './list/useTicketBulkActions';
import { TicketDetailPanel } from './list/TicketDetailPanel';

const BULK_EXPORT_FORMAT_OPTIONS = [
  { value: 'xlsx', label: 'Excel' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];

// Type definitions based on your API response
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
  const [selectedTicket, setSelectedTicket] = React.useState<Ticket | null>(null);
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
  const { agents, departments, categories, labels, refetchLabels } = useTicketFilterOptions();

  // Refs to avoid triggering fetchTickets recreation when lookup data changes —
  // the token-search resolvers need synchronous, non-reactive access to the
  // latest values, so these stay in sync with the query results via effects
  // below rather than being read directly in render.
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
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
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


  const [activeTab, setActiveTab] = useState('activity');
  const [searchQuery, setSearchQuery] = useState('');
  // Debounced so fast typing doesn't fire a server request per keystroke; the
  // local `filteredTickets` memo below still updates instantly off `searchQuery`.
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);
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

  const {
    activeColumnFilter,
    filterPosition,
    columnFilterSearch,
    setColumnFilterSearch,
    columnFilterRef,
    openColumnFilter,
    closeColumnFilter,
  } = useColumnFilterPopover(() => setShowSearchFilterDropdown(false));
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
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const { currentSortState, toggleSort } = useViewSortState(activeView);
  const sortField = currentSortState.field;
  const sortDirection = currentSortState.direction;

  const ticketsQuery = useTicketsListQuery(
    {
      page: currentPage,
      view: activeView,
      limit,
      sortState: currentSortState,
      searchQuery: debouncedSearchQuery,
      statusFilter,
      priorityFilter,
      assigneeFilter,
      departmentFilter,
      categoryFilter,
      labelFilterIds,
      dateFromFilter,
      dateToFilter,
    },
    {
      agents: agentsRef.current,
      departments: departmentsRef.current,
      categories: categoriesRef.current,
      labels: labelsRef.current,
    },
  );

  useEffect(() => {
    if (ticketsQuery.error) {
      const errorMsg = ticketsQuery.error instanceof Error ? ticketsQuery.error.message : 'An error occurred while fetching tickets';
      errorNotification(errorMsg);
    }
  }, [ticketsQuery.error]);

  const tickets = useMemo(
    () => ticketsQuery.data?.results.map(transformApiTicket) ?? [],
    [ticketsQuery.data],
  );
  const totalCount = ticketsQuery.data?.count ?? 0;
  const isLoading = ticketsQuery.isLoading;
  const isFetchingTickets = ticketsQuery.isFetching;

  const listGridCols = LIST_GRID_COLS;
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
    toggleSort(field);
    setCurrentPage(prev => (prev === 1 ? prev : 1));
  }, [toggleSort]);

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
    const targetView = resolveViewFromUrlParams(params, defaultView);
    if (targetView !== null && targetView !== activeView) {
      setActiveView(targetView);
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

  const {
    selectedTickets,
    setSelectedTickets,
    bulkExportFormat,
    setBulkExportFormat,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    blocker,
    handleTicketSelection,
    handleSelectAllVisible,
    handleSelectAll,
    getViewContext,
    getBulkActions,
    handleBulkDelete,
  } = useTicketBulkActions(activeView, filteredTickets, canExport);

  const handleSingleTicketDelete = async () => {
    if (!selectedTicket) return;
    try {
      const isTrash = getViewContext() === 'trash';
      const endpoint = isTrash ? `${BASE_URL}/ticket/bulk/permanent-delete/` : `${BASE_URL}/ticket/bulk/delete/`;
      await http.post(endpoint, {
        ticket_ids: [Number(selectedTicket.id)],
      });
      successNotification(isTrash ? 'Ticket permanently deleted' : 'Ticket moved to trash');
      setShowDeleteModal(false);
      setSelectedTicket(null);
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    } catch (error: any) {
      console.error('Error deleting ticket:', error);
      errorNotification(error?.response?.data?.message || 'Failed to delete ticket');
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



  const fetchTicketCounts = async () => {
    try {
      const params = buildTicketQueryParams(
        {
          searchQuery: debouncedSearchQuery,
          statusFilter,
          priorityFilter,
          assigneeFilter,
          departmentFilter,
          categoryFilter,
          labelFilterIds,
          dateFromFilter,
          dateToFilter,
        },
        {
          agents: agentsRef.current,
          departments: departmentsRef.current,
          categories: categoriesRef.current,
          labels: labelsRef.current,
        },
      );
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

  // The ticket list itself is fetched reactively by useTicketsListQuery above —
  // its queryKey already embeds page/view/limit/filters/sort, so it refetches
  // on its own whenever any of those change. Counts don't go through React
  // Query yet, so they still need an explicit fetch on the same dependencies.
  React.useEffect(() => {
    fetchTicketCounts();
  }, [currentPage, activeView, limit, statusFilter, priorityFilter, assigneeFilter, departmentFilter, categoryFilter, labelFilterIds, dateFromFilter, dateToFilter]);

  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      fetchTicketCounts();
    };
    window.addEventListener('ticket_event', handler);
    return () => window.removeEventListener('ticket_event', handler);
  }, [currentPage, activeView]);

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

  const fetchTicketDetails = async (ticketId: string) => {
    try {
      const response = await http.get(`${APIS.TICKET_DETAILS}${ticketId}/read-by-ticket-id`);
      if (response.data.ticket) {
        const updatedTicket = transformApiTicket(response.data.ticket);
        setSelectedTicket(updatedTicket);
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to refresh ticket details";
      errorNotification(errorMsg);
    }
  };

  // Keep the refs in sync with the query-backed values above — the token-search
  // resolvers (ticketSearch.ts) need synchronous access outside React's render
  // cycle, so they read these refs rather than the reactive values directly.
  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { departmentsRef.current = departments; }, [departments]);
  useEffect(() => { categoriesRef.current = categories; }, [categories]);
  useEffect(() => { labelsRef.current = labels; }, [labels]);

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

  // Agents/departments/categories/labels are now fetched declaratively by
  // useTicketFilterOptions() above — no manual trigger-on-mount needed.

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

      queryClient.invalidateQueries({ queryKey: ['tickets'] });

      // If ticket is moved to terminal state from unresolved views, switch table to closed view.
      // handleViewSelect already resets currentPage, which changes the query key and
      // triggers its own refetch — no separate fetch call needed here.
      if (normalizedStatus === 'closed' && (activeView === openViewKey || activeView === 'all_unresolved' || activeView === 'my_unresolved')) {
        handleViewSelect(closedViewKey);
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
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
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
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
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
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
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
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
    refetchLabels();
  };

  async function handleReopen(reason: string) {
    if (!selectedTicket) return;
    try {
      setIsSubmitting(true);
      const response = await http.post(`${APIS.TICKET_BASE}/${selectedTicket.id}/reopen/`, { reason });

      // Refresh ticket details and list from server
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
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
      queryClient.invalidateQueries({ queryKey: ['tickets'] });

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
      queryClient.invalidateQueries({ queryKey: ['tickets'] });

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

      successNotification(response.data.message || 'Priority updated successfully');
      setSelectedPriority("");
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      fetchTicketDetails(selectedTicket.id);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to update priority";
      errorNotification(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  }

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
                            {SEARCH_FILTER_OPTIONS.map(option => {
                              const Icon = SEARCH_FILTER_ICONS[option.key];
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
            {isFetchingTickets && <Loader />}
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
                            listTickets.map(ticket => (
                              <TicketRow
                                key={ticket.id}
                                ticket={ticket}
                                isSelected={selectedTickets.has(ticket.id)}
                                onRowClick={handleListRowClick}
                                onSelectionChange={handleTicketSelection}
                                onStatusClick={(t) => {
                                  setSelectedTicket(t);
                                  setSelectedStatus(t.status);
                                  setShowStatusModal(true);
                                }}
                                onPriorityClick={(t) => {
                                  setSelectedTicket(t);
                                  setSelectedPriority(t.priority);
                                  setShowPriorityModal(true);
                                }}
                                onDepartmentClick={(t) => {
                                  setSelectedTicket(t);
                                  setSelectedDepartmentId(t.department?.id?.toString() || '');
                                  setShowDepartmentModal(true);
                                }}
                                onAssigneeClick={(t) => {
                                  setSelectedTicket(t);
                                  setShowAssignModal(true);
                                }}
                                onTaskDialogOpen={(t) => {
                                  setSelectedTicket(t);
                                  setTaskDialogTicketId(t.id.toString());
                                  setTaskDialogOpen(true);
                                }}
                                onPreviewEnter={showTicketPreview}
                                onPreviewLeave={scheduleHideTicketPreview}
                              />
                            ))
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
              <TicketDetailPanel
                selectedTicket={selectedTicket}
                selectedTicketLabels={selectedTicketLabels}
                user={user}
                selectedPriority={selectedPriority}
                setSelectedPriority={setSelectedPriority}
                handleUpdatePriority={handleUpdatePriority}
                isSubmitting={isSubmitting}
                isTicketClosed={isTicketClosed}
                setIsReopenModalOpen={setIsReopenModalOpen}
                handleAssignToMe={handleAssignToMe}
                isAssigning={isAssigning}
                isUserWatcher={isUserWatcher}
                selectedStatus={selectedStatus}
                setSelectedStatus={setSelectedStatus}
                statusDescription={statusDescription}
                setStatusDescription={setStatusDescription}
                handleStatusUpdate={handleStatusUpdate}
                selectedDepartmentId={selectedDepartmentId}
                setSelectedDepartmentId={setSelectedDepartmentId}
                departments={departments}
                handleUpdateDepartment={handleUpdateDepartment}
                selectedAgentId={selectedAgentId}
                setSelectedAgentId={setSelectedAgentId}
                agents={agents}
                handleAssign={handleAssign}
                agentsData={agentsData}
                selectedWatchers={selectedWatchers}
                setSelectedWatchers={setSelectedWatchers}
                handleAddWatchers={handleAddWatchers}
                setShowLabelsModal={setShowLabelsModal}
                setShowAssignModal={setShowAssignModal}
                setShowDepartmentModal={setShowDepartmentModal}
                setShowCategoryModal={setShowCategoryModal}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                taskRefreshTrigger={taskRefreshTrigger}
                setTaskRefreshTrigger={setTaskRefreshTrigger}
                linkedTasksCount={linkedTasksCount}
                setLinkedTasksCount={setLinkedTasksCount}
                ticketWatchers={ticketWatchers}
                reloader={reloader}
                fetchTicketDetails={fetchTicketDetails}
              />
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
            reload={() => queryClient.invalidateQueries({ queryKey: ['tickets'] })}
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
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
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
          onPriorityUpdated={() => queryClient.invalidateQueries({ queryKey: ['tickets'] })}
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
            <ColumnFilterPanel
              activeColumnFilter={activeColumnFilter}
              onClose={closeColumnFilter}
              columnFilterSearch={columnFilterSearch}
              setColumnFilterSearch={setColumnFilterSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriorityFilter}
              agents={agents}
              assigneeFilter={assigneeFilter}
              setAssigneeFilter={setAssigneeFilter}
              departments={departments}
              departmentFilter={departmentFilter}
              setDepartmentFilter={setDepartmentFilter}
              categories={categories}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              labels={labels}
              labelFilterIds={labelFilterIds}
              setLabelFilterIds={setLabelFilterIds}
              dateFromFilter={dateFromFilter}
              setDateFromFilter={setDateFromFilter}
              dateToFilter={dateToFilter}
              setDateToFilter={setDateToFilter}
            />
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
