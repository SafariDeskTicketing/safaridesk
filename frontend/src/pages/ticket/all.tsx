import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search, Plus, User, Clock, MessageCircle, ChevronDown, ChevronRight, ChevronLeft, ChevronUp, Grid3x3, Tag, CheckCircle, UserCheck, AlertCircle, ShieldAlert, Trash2, Building, AlertTriangle, UserX, XCircle, Inbox, CreditCard, Settings, X, List, PauseCircle
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../stores/authStore';
import { APIS } from '../../services/apis';
import http from '../../services/http';
import { errorNotification, successNotification } from '../../components/ui/Toast';
import type { Agent, LabelItem, Ticket } from '../../types';
import Select from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import EmptyState from '../../components/ui/EmptyState';
import TicketDetailSkeleton from '../../components/ui/TicketDetailSkeleton';
import { TableSkeleton } from '../../components/ui/TableSkeleton';
import { GridTicketCard } from '../../components/tickets/GridCard';
import AssignTicketModal from '../../components/tickets/AssignTicketModal';
import UpdateCategoryModal from '../../components/tickets/UpdateCategoryModal';
import { Modal } from '../../components/ui/Modal';
import { CreateTicketModal } from '../../components/tickets/CreateTicketModal';
import { TicketCard } from '../../components/tickets/TicketCard';
import { ReopenTicketModal } from './mini/ReopenTicketModal';
import { ViewModeDropdown } from '../../components/tickets/ViewModeDropdown';
import UpdateStatusModal from '../../components/tickets/UpdateStatusModal';
import UpdatePriorityModal from '../../components/tickets/UpdatePriorityModal';
import { TaskListDialog } from '../../components/tickets/TaskListDialog';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { AGENT_TICKET_VIEW_ITEMS, TICKET_VIEW_ITEMS } from '../../components/layout/viewConfigs';
import TicketSettingsModal from '../../components/settings/TicketSettingsModal';
import LabelGroup from '../../components/ui/LabelGroup';
import ManageLabelsModal from '../../components/labels/ManageLabelsModal';
import { getLabelNamesByIds, resolveLabelTokenIds } from '../../utils/labels';
import { Loader } from '../../components/loader/loader';
import { BASE_URL } from '../../utils/base';
import {
  type ColumnFilterKey,
  SEARCH_FILTER_OPTIONS,
  SEARCH_FILTER_ICONS,
  parseSearchQuery,
  resolveCreatedDateToken,
} from './list/ticketSearch';
import { buildTicketQueryParams, isTicketQueryBlockedByPendingLookups } from './list/ticketListParams';
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
import { UpdateDepartmentModal } from './list/UpdateDepartmentModal';
import { DeleteTicketModal } from './list/DeleteTicketModal';
import { useTicketHoverPreview } from './list/useTicketHoverPreview';
import { TicketHoverPreview } from './list/TicketHoverPreview';
import { useCopilotActiveTicketSync } from './list/useCopilotActiveTicketSync';
import { useTicketFiltersFromUrl } from './list/useTicketFiltersFromUrl';

const BULK_EXPORT_FORMAT_OPTIONS = [
  { value: 'xlsx', label: 'Excel' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];

type TicketViewMode = 'card' | 'list';

const getStoredTicketViewMode = (): 'card' | 'list' => (
  localStorage.getItem('ticketViewMode') === 'card' ? 'card' : 'list'
);

export default function TicketManagementSystem() {

  const { user } = useAuthStore()
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
  const { agents, departments, categories, labels, refetchLabels, lookupsLoading } = useTicketFilterOptions();

  // Refs to avoid triggering fetchTickets recreation when lookup data changes —
  // the token-search resolvers need synchronous, non-reactive access to the
  // latest values. Assigned directly during render (not in a useEffect): an
  // effect only updates the ref *after* this render has committed, so the one
  // render where agents/departments/categories/labels first populate would
  // otherwise resolve tokens against stale (empty) data.
  const agentsRef = useRef<Agent[] | null>(null);
  agentsRef.current = agents;
  const departmentsRef = useRef<Array<{ id: number; name: string }>>([]);
  departmentsRef.current = departments;
  const categoriesRef = useRef<Array<{ id: number; name: string; department?: number | null }>>([]);
  categoriesRef.current = categories;
  const labelsRef = useRef<LabelItem[]>([]);
  labelsRef.current = labels;
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [showLabelsModal, setShowLabelsModal] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const selectedTicketLabels = selectedTicket?.labels || [];

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
  const {
    ticketPreview,
    ticketPreviewPosition,
    ticketLatestComment,
    ticketLatestCommentLoading,
    showTicketPreview,
    scheduleHideTicketPreview,
    clearHideTimeout: clearTicketPreviewHideTimeout,
    closeTicketPreview,
  } = useTicketHoverPreview();

  useCopilotActiveTicketSync(selectedTicket);

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
    localStorage.setItem('ticketViewMode', viewMode);
  }, [viewMode]);
  const [isCreateTicketModalDirty, setIsCreateTicketModalDirty] = useState(false);
  const [showCreateTicketCloseConfirm, setShowCreateTicketCloseConfirm] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
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
    lookupsLoading,
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
  // `isPending` (not `isLoading`) so the skeleton still shows instead of a
  // flash of "no tickets found" while the query is held `enabled: false`
  // waiting on a lookup a search token needs — `isLoading` requires
  // `isFetching`, which is false for a disabled query.
  const isLoading = ticketsQuery.isPending;
  const isFetchingTickets = ticketsQuery.isFetching;

  const listGridCols = LIST_GRID_COLS;
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

  // Sync activeView with URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetView = resolveViewFromUrlParams(params, defaultView);
    if (targetView !== null && targetView !== activeView) {
      setActiveView(targetView);
    }
  }, [location.search, activeView, defaultView]);

  useTicketFiltersFromUrl(location.search, {
    setStatusFilter,
    setPriorityFilter,
    setAssigneeFilter,
    setDepartmentFilter,
    setCategoryFilter,
    setDateFromFilter,
    setDateToFilter,
    setLabelFilterIds,
  });

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
    // Same race as the list query (see ticketListData.ts): skip the fetch
    // rather than compute counts against a token whose lookup hasn't loaded
    // yet. Unlike the list query this isn't cached, so it isn't "wrong
    // forever" on its own, but the effect below only reruns on a fixed set
    // of filter deps (not every render), so without this it could still
    // compute once, wrongly, and sit there until some other filter changes.
    if (isTicketQueryBlockedByPendingLookups(debouncedSearchQuery, lookupsLoading)) return;
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
    // lookupsLoading.* re-runs this once a pending lookup a token needs
    // finishes loading, instead of leaving counts computed-without-that-
    // filter sitting there until some unrelated filter change.
  }, [currentPage, activeView, limit, statusFilter, priorityFilter, assigneeFilter, departmentFilter, categoryFilter, labelFilterIds, dateFromFilter, dateToFilter, lookupsLoading.agents, lookupsLoading.departments, lookupsLoading.categories, lookupsLoading.labels]);

  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      fetchTicketCounts();
    };
    window.addEventListener('ticket_event', handler);
    return () => window.removeEventListener('ticket_event', handler);
  }, [currentPage, activeView]);

  const allVisibleSelected = filteredTickets.length > 0 && filteredTickets.every(t => selectedTickets.has(t.id));
  const someVisibleSelected = filteredTickets.some(t => selectedTickets.has(t.id));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  useEffect(() => {
    setSelectedTicket(null);
  }, [tickets, viewMode]);

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

  // Agents/departments/categories/labels are now fetched declaratively by
  // useTicketFilterOptions() above — no manual trigger-on-mount needed.

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
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 min-w-0 overflow-hidden flex">
            {isFetchingTickets && <Loader />}
            {/* Tickets List */}
            <div className="w-full min-w-0 bg-white dark:bg-surface-elevated border-r border-gray-200 dark:border-subtle flex flex-col">
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
                                  setShowStatusModal(true);
                                }}
                                onPriorityClick={(t) => {
                                  setSelectedTicket(t);
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
                ) : viewMode === 'card' ? (
                  <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredTickets.map(ticket => (
                      <GridTicketCard
                        key={ticket.id}
                        ticket={ticket}
                        openDropdownId={openDropdownId}
                        onDropdownToggle={(ticketid) => setOpenDropdownId(openDropdownId === ticketid ? null : ticketid)}
                        onDropdownClose={() => setOpenDropdownId(null)}
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

      {selectedTicket && (
        <AssignTicketModal
          ticketId={selectedTicket.id}
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          onTicketAssigned={() => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            fetchTicketDetails(selectedTicket.id);
          }}
          assignedAgentId={selectedTicket.assignee ? Number(selectedTicket.assignee.id) : null}
          departmentId={selectedTicket.department?.id ?? null}
        />
      )}

      <UpdateDepartmentModal
        isOpen={showDepartmentModal}
        onClose={() => setShowDepartmentModal(false)}
        departments={departments}
        selectedDepartmentId={selectedDepartmentId}
        setSelectedDepartmentId={setSelectedDepartmentId}
        onUpdate={handleUpdateDepartment}
        isSubmitting={isSubmitting}
      />

      {selectedTicket && (
        <UpdateCategoryModal
          ticketId={selectedTicket.id}
          currentCategory={selectedTicket.category}
          departmentId={selectedTicket.department?.id ?? null}
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          onCategoryUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            fetchTicketDetails(selectedTicket.id);
          }}
        />
      )}

      <DeleteTicketModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleSingleTicketDelete}
        ticketDisplayId={selectedTicket?.ticket_id}
        isTrash={getViewContext() === 'trash'}
      />

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

      <TicketHoverPreview
        ticketPreview={ticketPreview}
        position={ticketPreviewPosition}
        latestComment={ticketLatestComment}
        latestCommentLoading={ticketLatestCommentLoading}
        onClose={closeTicketPreview}
        onMouseEnter={clearTicketPreviewHideTimeout}
        onMouseLeave={scheduleHideTicketPreview}
      />

      <TicketSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      </div>

    </>
  );
}
