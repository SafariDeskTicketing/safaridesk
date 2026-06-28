import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Filter, Trash2, LayoutList, LayoutGrid } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../components/ui/Button';
import { TicketCard } from '../../components/tickets/TicketCard';
import { APIS } from '../../services/apis';
import http from '../../services/http';
import { errorNotification } from '../../components/ui/Toast';
import Drawer from '../../components/ui/Drawer';
import TicketInfo from './mini/ViewTicket';
import { useAuthStore } from '../../stores/authStore';
import TicketListSkeleton from '../../components/ui/TicketListSkeleton';
import type { Ticket, User } from '../../types';
import { GridTicketCard } from '../../components/tickets/GridCard';
import { FilterDialog } from '../../components/ui/FilterDialog';

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
  is_merged?: boolean;
  merged_into?: {
    id: number;
    ticket_id: string;
    title?: string;
  } | null;
  assigned_to: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    avatar_url: string;
    is_active?: boolean;
  } | null;
  breached: boolean;
  linked_tasks_count?: number;
  unread_activity_count?: number;
  attachments_count?: number;
  comments_count?: number;
  is_opened?: boolean;
  has_new_reply?: boolean;
}

interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiTicket[];
}

const mapApiStatusToTicketStatus = (apiStatus: string): 'open' | 'in_progress' | 'pending' | 'on_hold' | 'resolved' | 'closed' => {
  const statusMap: Record<string, 'open' | 'in_progress' | 'pending' | 'on_hold' | 'resolved' | 'closed'> = {
    'open': 'open',
    'created': 'open',
    'assigned': 'in_progress',
    'in_progress': 'in_progress',
    'pending': 'pending',
    'on_hold': 'on_hold',
    'hold': 'on_hold',
    'resolved': 'resolved',
    'closed': 'closed',
  };
  return statusMap[apiStatus.toLowerCase()] || 'open';
};

const transformApiTicketToDomainTicket = (apiTicket: ApiTicket): Ticket => {
  const requesterUser: User = {
    id: apiTicket.creator_email,
    email: apiTicket.creator_email,
    firstName: (apiTicket.creator_name || '').split(' ')[0] || '',
    lastName: (apiTicket.creator_name || '').split(' ').slice(1).join(' ') || '',
    role: 'staff',
    isActive: true,
    createdAt: apiTicket.created_at,
    updatedAt: apiTicket.created_at,
    workspaceId: 'default_workspace_id',
  };

  return {
    id: apiTicket.id.toString(),
    title: apiTicket.title || '',
    description: apiTicket.description || '',
    status: mapApiStatusToTicketStatus(apiTicket.status),
    priority: apiTicket.priority_display?.toLowerCase() as 'low' | 'medium' | 'high' | 'critical',
    category: apiTicket.category?.name || 'Uncategorized',
    ticket_id: apiTicket.ticket_id || '',
    assigneeId: apiTicket.assigned_to?.id.toString(),
    assignee: apiTicket.assigned_to ? {
      id: apiTicket.assigned_to.id.toString(),
      email: apiTicket.assigned_to.email || '',
      firstName: apiTicket.assigned_to.first_name || '',
      lastName: apiTicket.assigned_to.last_name || '',
      avatar_url: apiTicket.assigned_to.avatar_url || '',
      role: 'agent',
      isActive: apiTicket.assigned_to?.is_active ?? true,
      createdAt: apiTicket.created_at,
      updatedAt: apiTicket.created_at,
      workspaceId: 'default_workspace_id',
    } : undefined,
    requesterId: requesterUser.id,
    requester: requesterUser,
    workspaceId: 'default_workspace_id',
    tags: [],
    labels: [],
    attachments: [],
    comments: [],
    createdAt: apiTicket.created_at || new Date().toISOString(),
    updatedAt: apiTicket.created_at || new Date().toISOString(),
    breached: apiTicket.breached,
    is_merged: apiTicket.is_merged,
    merged_into: apiTicket.merged_into,
    linked_tasks_count: apiTicket.linked_tasks_count,
    unread_activity_count: apiTicket.unread_activity_count,
    attachments_count: apiTicket.attachments_count,
    comments_count: apiTicket.comments_count,
    is_opened: apiTicket.is_opened,
    has_new_reply: apiTicket.has_new_reply,
  };
};

// ---------------------------------------------------------------------------
// Query functions — defined outside component so they're stable references
// ---------------------------------------------------------------------------

interface TicketQueryParams {
  role: string | undefined;
  statusFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  departmentFilter: string;
  categoryFilter: string;
  dateFromFilter: string;
  dateToFilter: string;
  viewFilter: 'active' | 'merged' | 'trash';
  page: number;
  limit: number;
}

const fetchTicketsFromApi = async (p: TicketQueryParams): Promise<ApiResponse> => {
  const url = p.role === 'admin' ? APIS.LIST_TICKETS : APIS.MY_TICKETS;
  const params: Record<string, string | number> = {
    limit: p.limit,
    offset: (p.page - 1) * p.limit,
  };
  if (p.statusFilter !== 'all')    params.status      = p.statusFilter;
  if (p.priorityFilter !== 'all')  params.priority    = p.priorityFilter;
  if (p.assigneeFilter !== 'all')  params.assigned_to = p.assigneeFilter;
  if (p.departmentFilter !== 'all') params.department = p.departmentFilter;
  if (p.categoryFilter !== 'all')  params.category    = p.categoryFilter;
  if (p.dateFromFilter)            params.date_from   = p.dateFromFilter;
  if (p.dateToFilter)              params.date_to     = p.dateToFilter;
  if (p.viewFilter === 'merged')   params.view        = 'merged_tickets';
  const response = await http.get<ApiResponse>(url, { params });
  return response.data;
};

const fetchFilterAgents = () =>
  http.get(APIS.LIST_AGENTS, { params: { pagination: 'no' } }).then(r => r.data as Array<{ id: number; first_name: string; last_name: string }>);

const fetchFilterDepartments = () =>
  http.get(APIS.LIST_DEPARTMENTS, { params: { pagination: 'no' } }).then(r => r.data as Array<{ id: number; name: string }>);

const fetchFilterCategories = () =>
  http.get(APIS.LIST_TICKET_CATEGORIES, { params: { pagination: 'no' } })
    .then(r => (r.data?.results || r.data) as Array<{ id: number; name: string; department?: number | null }>);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TicketsPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = React.useState<'list' | 'card'>('list');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [dateFromFilter, setDateFromFilter] = React.useState<string>('');
  const [dateToFilter, setDateToFilter] = React.useState<string>('');
  const [viewFilter, setViewFilter] = React.useState<'active' | 'merged' | 'trash'>('active');
  const [showFilters, setShowFilters] = React.useState(false);
  const [showDrawer, setShowDrawer] = React.useState<boolean>(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [openDropdownId, setOpenDropdownId] = React.useState<string | null>(null);
  const limit = 10;

  // Reset to page 1 when any filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, priorityFilter, assigneeFilter, departmentFilter, categoryFilter, dateFromFilter, dateToFilter, viewFilter]);

  // Main ticket list — cache key includes all filters + page
  const ticketQueryParams: TicketQueryParams = {
    role: user?.role,
    statusFilter, priorityFilter, assigneeFilter, departmentFilter,
    categoryFilter, dateFromFilter, dateToFilter, viewFilter,
    page: currentPage, limit,
  };

  const ticketsQuery = useQuery<ApiResponse>({
    queryKey: ['tickets', ticketQueryParams],
    queryFn: () => fetchTicketsFromApi(ticketQueryParams),
    staleTime: Infinity, // WebSocket ticket_event handles invalidation — never auto-refetch
    placeholderData: (prev) => prev, // show stale data while fetching new page/filter
  });

  React.useEffect(() => {
    if (ticketsQuery.error) errorNotification((ticketsQuery.error as Error).message);
  }, [ticketsQuery.error]);

  // Real-time: refresh list on WebSocket ticket events
  React.useEffect(() => {
    const handler = () => queryClient.invalidateQueries({ queryKey: ['tickets'] });
    window.addEventListener('ticket_event', handler);
    return () => window.removeEventListener('ticket_event', handler);
  }, [queryClient]);

  const tickets = useMemo(
    () => ticketsQuery.data?.results.map(transformApiTicketToDomainTicket) ?? [],
    [ticketsQuery.data],
  );
  const totalCount = ticketsQuery.data?.count ?? 0;
  const isLoading = ticketsQuery.isLoading;
  const isFetching = ticketsQuery.isFetching;
  const error = ticketsQuery.isError ? (ticketsQuery.error as Error).message : null;
  const totalPages = Math.ceil(totalCount / limit);

  // Filter options — cached for 5 min, shared across app
  const agentsQuery = useQuery({
    queryKey: ['filter-agents'],
    queryFn: fetchFilterAgents,
    staleTime: 5 * 60 * 1000,
  });
  const departmentsQuery = useQuery({
    queryKey: ['filter-departments'],
    queryFn: fetchFilterDepartments,
    staleTime: 5 * 60 * 1000,
  });
  const categoriesQuery = useQuery({
    queryKey: ['filter-categories'],
    queryFn: fetchFilterCategories,
    staleTime: 5 * 60 * 1000,
  });

  const agents = agentsQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const filteredCategories = useMemo(() => {
    if (!departmentFilter || departmentFilter === 'all') return categories;
    const deptId = Number(departmentFilter);
    return categories.filter(cat => cat.department == null || cat.department === deptId);
  }, [categories, departmentFilter]);

  // Reset category filter when it no longer exists after department changes
  React.useEffect(() => {
    if (!categoryFilter || categoryFilter === 'all') return;
    const isValid = filteredCategories.some(cat => cat.id.toString() === categoryFilter);
    if (!isValid) setCategoryFilter('all');
  }, [categoryFilter, filteredCategories]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
  };

  const handleAction = (action: string, _ticket: Ticket) => {
    setOpenDropdownId(null);
    if (action === 'view') setShowDrawer(true);
  };

  return (
    <div className="h-full w-full overflow-y-auto p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--font-page-title)] font-bold text-[var(--text-primary)]">Tickets</h1>
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
            Manage and track support tickets
          </p>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button
            icon={Plus}
            onClick={() => navigate('/tickets/create')}
          >
            New Ticket
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--status-danger-bg)', borderColor: 'var(--status-danger-border)' }}>
          <p className="text-[length:var(--font-body)]" style={{ color: 'var(--status-danger-text)' }}>{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">Advanced Filters</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[length:var(--font-label)] text-[var(--text-secondary)]">
              <span className="font-medium">View:</span>
              <Button size="sm" variant={viewFilter === 'active' ? 'primary' : 'outline'} onClick={() => setViewFilter('active')}>Active</Button>
              <Button size="sm" variant={viewFilter === 'merged' ? 'primary' : 'outline'} onClick={() => setViewFilter('merged')}>Merged</Button>
              <Button size="sm" variant={viewFilter === 'trash' ? 'primary' : 'outline'} onClick={() => setViewFilter('trash')} icon={Trash2}>Trash</Button>
            </div>
            <Button variant="outline" icon={Filter} onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? 'Close' : 'Filter'}
            </Button>
          </div>
        </div>

        <FilterDialog
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          filters={[
            {
              id: 'status',
              title: 'Status',
              type: 'dropdown',
              value: statusFilter,
              options: [
                { value: 'all', label: 'All' },
                { value: 'unassigned', label: 'Unassigned' },
                { value: 'assigned', label: 'Assigned' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'closed', label: 'Closed' },
              ],
              onChange: (v: string | (string | number)[] | { from: string; to: string }) => setStatusFilter(String(v)),
            },
            {
              id: 'priority',
              title: 'Priority',
              type: 'dropdown',
              value: priorityFilter,
              options: [
                { value: 'all', label: 'All' },
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'critical', label: 'Critical' },
              ],
              onChange: (v: string | (string | number)[] | { from: string; to: string }) => setPriorityFilter(String(v)),
            },
            {
              id: 'assignee',
              title: 'Assignee',
              type: 'dropdown',
              value: assigneeFilter,
              options: [
                { value: 'all', label: 'All Assignees' },
                { value: 'unassigned', label: 'Unassigned' },
                ...agents.map(agent => ({
                  value: agent.id.toString(),
                  label: `${agent.first_name} ${agent.last_name}`,
                })),
              ],
              onChange: (v: string | (string | number)[] | { from: string; to: string }) => setAssigneeFilter(String(v)),
            },
            {
              id: 'department',
              title: 'Department',
              type: 'dropdown',
              value: departmentFilter,
              options: [
                { value: 'all', label: 'All Departments' },
                ...departments.map(dept => ({ value: dept.id.toString(), label: dept.name })),
              ],
              onChange: (v: string | (string | number)[] | { from: string; to: string }) => setDepartmentFilter(String(v)),
            },
            {
              id: 'category',
              title: 'Category',
              type: 'dropdown',
              value: categoryFilter,
              options: [
                { value: 'all', label: 'All Categories' },
                ...filteredCategories.map(cat => ({ value: cat.id.toString(), label: cat.name })),
              ],
              onChange: (v: string | (string | number)[] | { from: string; to: string }) => setCategoryFilter(String(v)),
            },
            {
              id: 'date',
              title: 'Date Range',
              type: 'date-range',
              value: { from: dateFromFilter, to: dateToFilter },
              onChange: (value: string | (string | number)[] | { from: string; to: string }) => {
                if (typeof value === 'object' && 'from' in value && 'to' in value) {
                  setDateFromFilter(value.from);
                  setDateToFilter(value.to);
                }
              },
            },
          ]}
          onApply={() => setShowFilters(false)}
          onReset={() => {
            setStatusFilter('all');
            setPriorityFilter('all');
            setAssigneeFilter('all');
            setDepartmentFilter('all');
            setCategoryFilter('all');
            setDateFromFilter('');
            setDateToFilter('');
          }}
          title="Filter Tickets"
        />
      </div>

      {/* View Mode Toggle */}
      <div className="flex justify-end mb-2">
        <div className="inline-flex rounded-[var(--shell-radius)] border border-[var(--border-color)] overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[length:var(--font-label)] transition-colors ${
              viewMode === 'list'
                ? 'bg-primary-600 text-white'
                : 'bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            <LayoutList size={14} /> List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('card')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[length:var(--font-label)] border-l border-[var(--border-color)] transition-colors ${
              viewMode === 'card'
                ? 'bg-primary-600 text-white'
                : 'bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
            }`}
          >
            <LayoutGrid size={14} /> Card
          </button>
        </div>
      </div>

      {/* Tickets List */}
      <div>
        {isLoading ? (
          <div className="divide-y divide-[var(--border-color)] rounded-[var(--shell-radius)] overflow-hidden border border-[var(--border-color)] bg-[var(--card-bg)]">
            {[...Array(5)].map((_, i) => <TicketListSkeleton key={i} />)}
          </div>
        ) : tickets.length > 0 ? (
          viewMode === 'list' ? (
            <div className="divide-y divide-[var(--border-color)] rounded-[var(--shell-radius)] overflow-hidden border border-[var(--border-color)]">
              {tickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  openDropdownId={openDropdownId}
                  onDropdownToggle={(ticketid: string) =>
                    setOpenDropdownId(openDropdownId === ticketid ? null : ticketid)
                  }
                  onDropdownClose={() => setOpenDropdownId(null)}
                  onAction={(action: string, ticket: Ticket) => handleAction(action, ticket)}
                  onTicketUpdate={() => queryClient.invalidateQueries({ queryKey: ['tickets'] })}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tickets.map((ticket) => (
                <GridTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  openDropdownId={openDropdownId}
                  onDropdownToggle={(ticketid) => setOpenDropdownId(openDropdownId === ticketid ? null : ticketid)}
                  onDropdownClose={() => setOpenDropdownId(null)}
                  onAction={(action, ticket) => handleAction(action, ticket)}
                  isActive
                />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <div className="mb-4 text-[var(--text-muted)]">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="mt-2 text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">No tickets found</h3>
            <p className="mt-1 text-[length:var(--font-body)] text-[var(--text-secondary)]">
              {statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all' ||
                departmentFilter !== 'all' || categoryFilter !== 'all' || dateFromFilter || dateToFilter
                ? 'Try adjusting your filter criteria.'
                : 'Get started by creating a new ticket.'}
            </p>
            {statusFilter === 'all' && priorityFilter === 'all' && assigneeFilter === 'all' &&
              departmentFilter === 'all' && categoryFilter === 'all' && !dateFromFilter && !dateToFilter && (
                <div className="mt-6">
                  <Button icon={Plus} onClick={() => navigate('/tickets/create')}>New Ticket</Button>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] px-4 py-3">
        <div className="flex items-center text-[length:var(--font-body)] text-[var(--text-secondary)]">
          <span>
            Showing {Math.min((currentPage - 1) * limit + 1, totalCount)} to{' '}
            {Math.min(currentPage * limit, totalCount)} of {totalCount} results
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
            Previous
          </Button>
          <span className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
            Page {currentPage} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
            Next
          </Button>
        </div>
      </div>

      {/* Drawer */}
      <Drawer title='Ticket Info' close={() => setShowDrawer(false)} isOpen={showDrawer} size='lg' content={
        <TicketInfo />
      } />
    </div>
  );
};

export default TicketsPage;
