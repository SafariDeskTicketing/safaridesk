import React, { useState } from 'react';
import { Plus, Filter } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import Button from '../../components/ui/Button';
import { CreateTicketModal } from '../../components/tickets/CreateTicketModal';
import { TicketCard } from '../../components/tickets/TicketCard';
import { APIS } from '../../services/apis';
import http from '../../services/http';
import { errorNotification } from '../../components/ui/Toast';
import Drawer from '../../components/ui/Drawer';
import TicketInfo from './mini/ViewTicket';
import { useAuthStore } from '../../stores/authStore';
import SkinLoader from '../../components/ui/SkinLoader';
import { Modal } from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
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
  breached: boolean; // Added breached property
  linked_tasks_count?: number; // Count of tasks linked to this ticket
  unread_activity_count?: number; // Count of unread activity stream messages
  attachments_count?: number;
  comments_count?: number;
  is_opened?: boolean; // True once any agent has viewed this ticket
  has_new_reply?: boolean; // True when customer reply received
}

interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiTicket[];
}

// Map API status values to Ticket interface status values
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

// Transform API ticket to match the Ticket interface from src/types/index.ts
const transformApiTicketToDomainTicket = (apiTicket: ApiTicket): Ticket => {
  // Create a dummy User object for requester, as ApiTicket doesn't provide full User data
  const requesterUser: User = {
    id: apiTicket.creator_email, // Using email as a unique ID for simplicity
    email: apiTicket.creator_email,
    firstName: apiTicket.creator_name.split(' ')[0] || '',
    lastName: apiTicket.creator_name.split(' ').slice(1).join(' ') || '',
    role: 'staff', // Default role, adjust if more info is available
    isActive: true,
    createdAt: apiTicket.created_at,
    updatedAt: apiTicket.created_at,
    workspaceId: 'default_workspace_id', // Placeholder, adjust if workspaceId is available
  };

  return {
    id: apiTicket.id.toString(), // Convert number to string
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
      role: 'agent', // Assuming assigned_to is always an agent
      isActive: apiTicket.assigned_to?.is_active ?? true,
      isActive: true,
      createdAt: apiTicket.created_at, // Placeholder
      updatedAt: apiTicket.created_at, // Placeholder
      workspaceId: 'default_workspace_id', // Placeholder
    } : undefined,
    requesterId: requesterUser.id,
    requester: requesterUser,
    workspaceId: 'default_workspace_id', // Placeholder, adjust if workspaceId is available
    tags: [], // ApiTicket doesn't have tags directly, initialize empty
    attachments: [], // ApiTicket doesn't have attachments directly, initialize empty
    comments: [], // ApiTicket doesn't have comments directly, initialize empty
    createdAt: apiTicket.created_at || new Date().toISOString(),
    updatedAt: apiTicket.created_at || new Date().toISOString(), // Placeholder
    breached: apiTicket.breached, // Map breached property
    is_merged: apiTicket.is_merged,
    merged_into: apiTicket.merged_into,
    linked_tasks_count: apiTicket.linked_tasks_count, // Map linked tasks count
    unread_activity_count: apiTicket.unread_activity_count, // Map unread activity count
    attachments_count: apiTicket.attachments_count,
    comments_count: apiTicket.comments_count,
    is_opened: apiTicket.is_opened,
    has_new_reply: apiTicket.has_new_reply,
  };
};

const TicketsPage: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [isCreateTicketModalDirty, setIsCreateTicketModalDirty] = React.useState(false);
  const [showCreateTicketCloseConfirm, setShowCreateTicketCloseConfirm] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'card' | 'grid'>('card');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [dateFromFilter, setDateFromFilter] = React.useState<string>('');
  const [dateToFilter, setDateToFilter] = React.useState<string>('');
  const [viewFilter, setViewFilter] = React.useState<'active' | 'merged'>('active');
  const [showFilters, setShowFilters] = React.useState(false);
  const [showDrawer, setShowDrawer] = React.useState<boolean>(false);
  // const [selectedTicket, setSelectedTicket] = React.useState<Ticket | null>(null); // Currently unused

  // Filter options
  const [agents, setAgents] = React.useState<Array<{ id: number; first_name: string; last_name: string }>>([]);
  const [departments, setDepartments] = React.useState<Array<{ id: number; name: string }>>([]);
  const [categories, setCategories] = React.useState<Array<{ id: number; name: string }>>([]);

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // API state management
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [totalCount, setTotalCount] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [limit] = React.useState(10);

  // Fetch tickets from API
  const fetchTickets = React.useCallback(async (page: number = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const offset = (page - 1) * limit;
      const url = user?.role === 'admin' ? APIS.LIST_TICKETS : APIS.MY_TICKETS;

      // Build query params
      const params: Record<string, string | number> = {
        limit,
        offset,
      };

      // Add filters
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (priorityFilter && priorityFilter !== 'all') {
        params.priority = priorityFilter;
      }

      if (assigneeFilter && assigneeFilter !== 'all') {
        params.assigned_to = assigneeFilter;
      }

      if (departmentFilter && departmentFilter !== 'all') {
        params.department = departmentFilter;
      }

      if (categoryFilter && categoryFilter !== 'all') {
        params.category = categoryFilter;
      }

      if (dateFromFilter) {
        params.date_from = dateFromFilter;
      }

      if (dateToFilter) {
        params.date_to = dateToFilter;
      }

      if (viewFilter === 'merged') {
        params.view = 'merged_tickets';
      }

      // Show cached data instantly while background fetch runs
      const cacheKey = ['tickets-archive', params];
      const cached = queryClient.getQueryData<ApiResponse>(cacheKey);
      if (cached?.results) {
        setTickets(cached.results.map(transformApiTicketToDomainTicket));
        setTotalCount(cached.count);
        setCurrentPage(page);
        setIsLoading(false);
      }

      const response = await http.get<ApiResponse>(url, { params });
      queryClient.setQueryData(cacheKey, response.data);

      const transformedTickets = response.data.results.map(transformApiTicketToDomainTicket);

      setTickets(transformedTickets);
      setTotalCount(response.data.count);
      setCurrentPage(page);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'An error occurred';
      errorNotification(errorMsg)
      setError(errorMsg)

    } finally {
      setTimeout(() => setIsLoading(false), 100);
    }
  }, [limit, user?.role, statusFilter, priorityFilter, assigneeFilter, departmentFilter, categoryFilter, dateFromFilter, dateToFilter, viewFilter]);

  // When filters change, fetch tickets and reset to page 1
  React.useEffect(() => {
    if (currentPage === 1) {
      fetchTickets(1);
    } else {
      setCurrentPage(1); // This will trigger the other useEffect
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter, assigneeFilter, departmentFilter, categoryFilter, dateFromFilter, dateToFilter, viewFilter]);

  React.useEffect(() => {
    fetchTickets(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Real-time: refresh archive on WebSocket ticket events
  React.useEffect(() => {
    const handler = () => fetchTickets(currentPage);
    window.addEventListener('ticket_event', handler);
    return () => window.removeEventListener('ticket_event', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Load filter options via React Query shared cache
  React.useEffect(() => {
    const load = async () => {
      try {
        const [agentsData, deptsData, catsData] = await Promise.all([
          queryClient.fetchQuery({
            queryKey: ['filter-agents'],
            queryFn: () => http.get(APIS.LIST_AGENTS, { params: { pagination: 'no' } }).then(r => r.data),
            staleTime: 15 * 60 * 1000,
          }),
          queryClient.fetchQuery({
            queryKey: ['filter-departments'],
            queryFn: () => http.get(APIS.LIST_DEPARTMENTS, { params: { pagination: 'no' } }).then(r => r.data),
            staleTime: 15 * 60 * 1000,
          }),
          queryClient.fetchQuery({
            queryKey: ['filter-categories'],
            queryFn: () => http.get(APIS.LIST_TICKET_CATEGORIES, { params: { pagination: 'no' } }).then(r => r.data),
            staleTime: 15 * 60 * 1000,
          }),
        ]);
        setAgents(agentsData || []);
        setDepartments(deptsData || []);
        setCategories(catsData || []);
      } catch (error) {
        console.error('Error loading filter options:', error);
      }
    };
    load();
  }, [queryClient]);


  const handleRefresh = () => {
    fetchTickets(currentPage);
  };



  const totalPages = Math.ceil(totalCount / limit);



  const handleAction = (action: string, _ticket: Ticket) => {
    // const selectedTicket could be used here in the future
    setOpenDropdownId(null);
    if (action === 'view') {
      setShowDrawer(true);
    }
  };

  // Handlers for create ticket modal close confirmation
  const handleCloseCreateTicketModal = () => {
    if (isCreateTicketModalDirty) {
      setShowCreateTicketCloseConfirm(true);
      return;
    }
    setShowCreateModal(false);
    setIsCreateTicketModalDirty(false);
  };

  const confirmCloseCreateTicketModal = () => {
    setShowCreateTicketCloseConfirm(false);
    setShowCreateModal(false);
    setIsCreateTicketModalDirty(false);
  };




  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Tickets</h1>
          <p className="text-gray-600 dark:text-[var(--text-primary)]">
            Manage and track support tickets
          </p>
        </div>

        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            icon={Plus}
            onClick={() => setShowCreateModal(true)}
          >
            New Ticket
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Advanced Filters</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-[var(--text-primary)]">
              <span className="font-medium">View:</span>
              <Button
                size="sm"
                variant={viewFilter === 'active' ? 'primary' : 'outline'}
                onClick={() => setViewFilter('active')}
              >
                Active
              </Button>
              <Button
                size="sm"
                variant={viewFilter === 'merged' ? 'primary' : 'outline'}
                onClick={() => setViewFilter('merged')}
              >
                Merged
              </Button>
            </div>
            <Button
              variant="outline"
              icon={Filter}
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? 'Close' : 'Filter'}
            </Button>
          </div>
        </div>

        {/* Filter Dialog */}
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
                ...(agents && agents.length > 0
                  ? agents.map(agent => ({
                    value: agent.id.toString(),
                    label: `${agent.first_name} ${agent.last_name}`
                  }))
                  : []),
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
                ...(departments && departments.length > 0
                  ? departments.map(dept => ({
                    value: dept.id.toString(),
                    label: dept.name
                  }))
                  : []),
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
                ...(categories && categories.length > 0
                  ? categories.map(cat => ({
                    value: cat.id.toString(),
                    label: cat.name
                  }))
                  : []),
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
        <fieldset className="inline-flex rounded-md shadow-sm border border-gray-300 dark:border-subtle">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border border-gray-300 dark:border-subtle rounded-l-lg focus:z-10 focus:ring-2 focus:ring-primary-500 ${viewMode === 'card'
              ? 'bg-primary-600 text-white'
              : 'bg-white dark:bg-surface-elevated text-gray-900 dark:text-[var(--text-primary)]'
              }`}
            onClick={() => setViewMode('card')}
          >
            Card View
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border-t border-b border-r border-gray-300 dark:border-subtle rounded-r-lg focus:z-10 focus:ring-2 focus:ring-primary-500 ${viewMode === 'grid'
              ? 'bg-primary-600 text-white'
              : 'bg-white dark:bg-surface-elevated text-gray-900 dark:text-[var(--text-primary)]'
              }`}
            onClick={() => setViewMode('grid')}
          >
            Grid View
          </button>
        </fieldset>
      </div>

      {/* Tickets List */}
      <div className="">
        {isLoading ? (
          <SkinLoader />
        ) : tickets.length > 0 ? (
          viewMode === 'card' ? (
            <div className="p-4 space-y-4">
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
                  onTicketUpdate={(updatedTicket: Ticket) => {
                    // Update the tickets array with the updated ticket
                    setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t));
                  }}
                />
              ))}
            </div>
          ) : (

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div className="text-gray-400 dark:text-[var(--text-primary)] mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">No tickets found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-[var(--text-primary)]">
              {statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all' ||
                departmentFilter !== 'all' || categoryFilter !== 'all' || dateFromFilter || dateToFilter
                ? 'Try adjusting your filter criteria.'
                : 'Get started by creating a new ticket.'}
            </p>
            {statusFilter === 'all' && priorityFilter === 'all' && assigneeFilter === 'all' &&
              departmentFilter === 'all' && categoryFilter === 'all' && !dateFromFilter && !dateToFilter && (
                <div className="mt-6">
                  <Button
                    icon={Plus}
                    onClick={() => setShowCreateModal(true)}
                  >
                    New Ticket
                  </Button>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between bg-white dark:bg-surface-elevated px-4 py-3 border border-gray-200 dark:border-subtle rounded-lg">
        <div className="flex items-center text-sm text-gray-700 dark:text-[var(--text-primary)]">
          <span>
            Showing {Math.min((currentPage - 1) * limit + 1, totalCount)} to{' '}
            {Math.min(currentPage * limit, totalCount)} of {totalCount} results
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-700 dark:text-[var(--text-primary)]">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>


      <Modal
        size='xl'
        isOpen={showCreateModal}
        onClose={handleCloseCreateTicketModal}
        title="New Ticket"
        closeOnBackdropClick={false}
      >
        {
          showCreateModal && <CreateTicketModal
            reload={() => fetchTickets(currentPage)}
            onclose={handleCloseCreateTicketModal}
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





      {/* Drawer */}
      <Drawer title='Ticket Info' close={() => setShowDrawer(false)} isOpen={showDrawer} size='lg' content={
        <TicketInfo />
      } />
    </div>
  );
};

export default TicketsPage;
