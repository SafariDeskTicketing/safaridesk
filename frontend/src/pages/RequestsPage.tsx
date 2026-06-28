import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sanitizeHTML } from '../utils/sanitize';
import {
  Search, Plus, User, Clock, Filter, ChevronDown, ChevronRight, ChevronLeft, MoreHorizontal, Eye, Calendar, Mail, Phone, Tag, CheckCircle, AlertTriangle, X, MoreVertical, Eye as EyeIcon, ExternalLink,
  LayoutList, LayoutGrid, Grid3X3, Table, BarChart3, ArrowRight, FileText, Settings, Lightbulb
} from 'lucide-react';

import http from '../services/http';
import { APIS } from '../services/apis';
import { errorNotification, successNotification } from '../components/ui/Toast';
import { RequestCard } from '../components/tickets/RequestCard';
import NoItems from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { Dropdown } from '../components/ui/Dropdown';
import TicketListSkeleton from '../components/ui/TicketListSkeleton';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface Request {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  creator_name: string;
  creator_email: string;
  creator_phone: string;
  ref_number: string;
  created_at: string;
  updated_at: string;
  converted_to_ticket: boolean;
  converted_to_task: boolean;
  attached_to?: string;
}

interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Request[];
}

const RequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State management
  const [requests, setRequests] = useState<Request[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeView, setActiveView] = useState('all_requests');
  const [viewMode, setViewMode] = useState<'list' | 'cards' | 'table'>(
    (localStorage.getItem('requestViewMode') as 'list' | 'cards' | 'table') || 'cards'
  );

  useEffect(() => {
    localStorage.setItem('requestViewMode', viewMode);
  }, [viewMode]);

  // Filters and search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [requestCounts, setRequestCounts] = useState<Record<string, number>>({});

  const limit = 20;

  const sidebarItems = [
    { name: 'All Requests', key: 'all_requests', icon: MoreVertical },
    { name: 'Pending Requests', key: 'pending_requests', icon: Clock },
    { name: 'Approved Requests', key: 'approved_requests', icon: CheckCircle },
    // { name: 'Converted Requests', key: 'converted_requests', icon: ArrowRight },
    { name: 'Technical Requests', key: 'technical_requests', icon: AlertTriangle },
    { name: 'Service Requests', key: 'service_requests', icon: Settings },
    { name: 'Issue Reports', key: 'issue_reports', icon: AlertTriangle },
    { name: 'Suggestions', key: 'suggestions', icon: Lightbulb },
    { name: 'Billing Requests', key: 'billing_requests', icon: FileText },
    { name: 'Feature Requests', key: 'feature_requests', icon: Plus },
  ];

  const activeViewName = sidebarItems.find(item => item.key === activeView)?.name || 'All Requests';
  const ActiveIcon = sidebarItems.find(item => item.key === activeView)?.icon || MoreVertical;

  const fetchRequests = useCallback(async (page: number = 1, view: string = 'all_requests') => {
    setIsLoading(true);

    try {
      const offset = (page - 1) * limit;
      const params: any = {
        limit,
        offset,
      };

      // Add filters if they are not 'all'
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      // Add view-specific filters (override individual filters when using views)
      if (view !== 'all_requests') {
        switch (view) {
          case 'pending_requests':
            params.status = 'pending';
            break;
          case 'approved_requests':
            params.status = 'approved';
            break;
          case 'converted_requests':
            params.converted = 'true';
            break;
          case 'technical_requests':
            params.type = 'technical';
            break;
          case 'service_requests':
            params.service_requests = 'true';
            break;
          case 'issue_reports':
            params.issue_reports = 'true';
            break;
          case 'suggestions':
            params.genera_requests = 'true';
            break;
          case 'billing_requests':
            params.billing_requests = 'true';
            break;
          case 'feature_requests':
            params.feature_requests = 'true';
            break;
        }
      }

      const cacheKey = ['requests', params];
      const cached = queryClient.getQueryData<ApiResponse>(cacheKey);
      if (cached?.results) {
        setRequests(cached.results);
        setTotalCount(cached.count);
        setCurrentPage(page);
        setIsLoading(false);
      }

      const response = await http.get<ApiResponse>(APIS.LIST_REQUESTS, {
        params,
      });
      queryClient.setQueryData(cacheKey, response.data);

      setRequests(response.data.results);
      setTotalCount(response.data.count);
      setCurrentPage(page);

      // Auto-select first request in detailed view
      if (viewMode === 'list' && response.data.results.length > 0) {
        setSelectedRequest(response.data.results[0]);
      } else if (response.data.results.length === 0) {
        setSelectedRequest(null);
      }

    } catch (error: any) {
      errorNotification(error?.response?.data?.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [limit, statusFilter, typeFilter, searchQuery, viewMode]);

  const fetchRequestCounts = async () => {
    try {
      const response = await http.get(APIS.LIST_REQUESTS + '?pagination=no');
      const allRequests = response.data.results || response.data;

      // Calculate counts for each view
      setRequestCounts({
        all_requests: allRequests.length,
        pending_requests: allRequests.filter((r: Request) => r.status === 'pending').length,
        approved_requests: allRequests.filter((r: Request) => r.status === 'approved').length,
        converted_requests: allRequests.filter((r: Request) => r.converted_to_ticket || r.converted_to_task).length,
        technical_requests: allRequests.filter((r: Request) => r.type === 'technical').length,
        service_requests: allRequests.filter((r: Request) => r.type === 'general').length,
        issue_reports: allRequests.filter((r: Request) => r.type === 'technical').length,
        suggestions: allRequests.filter((r: Request) => r.type === 'feature').length,
        billing_requests: allRequests.filter((r: Request) => r.type === 'billing').length,
        feature_requests: allRequests.filter((r: Request) => r.type === 'feature').length,
      });
    } catch (error) {
      console.error("Failed to fetch request counts:", error);
    }
  };

  useEffect(() => {
    fetchRequests(currentPage, activeView);
    fetchRequestCounts();
  }, [fetchRequests, currentPage, activeView]);

  useEffect(() => {
    const handler = () => {
      fetchRequests(currentPage, activeView);
      fetchRequestCounts();
    };
    window.addEventListener('request_event', handler);
    return () => window.removeEventListener('request_event', handler);
  }, [fetchRequests, currentPage, activeView]);

  const handleAction = async (action: string, request: Request) => {
    try {
      let response;
      switch (action) {
        case 'make_ticket':
          response = await http.post(`requests/${request.id}/make-ticket/`);
          break;
        case 'make_task':
          response = await http.post(`requests/${request.id}/make-task/`);
          break;
        case 'approve':
          response = await http.post(`requests/${request.id}/approve/`);
          break;
        default:
          return;
      }
      successNotification(response.data.message);
      fetchRequests(currentPage, activeView);
      fetchRequestCounts();
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || `Failed to ${action.replace('_', ' ')}`);
    }
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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700';
      case 'approved': return 'bg-primary-100 text-primary-800 border-primary-200 dark:bg-primary-900 dark:text-primary-200 dark:border-primary-700';
      case 'converted': return 'bg-primary-100 text-primary-800 border-primary-200 dark:bg-primary-900 dark:text-primary-200 dark:border-primary-700';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-surface dark:text-[var(--text-primary)] dark:border-subtle';
    }
  };

  const renderRequestsTable = () => {
    if (viewMode !== 'table') return null;

    return (
      <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle overflow-hidden mb-6">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-surface">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[var(--text-primary)] uppercase tracking-wider">
                Request
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[var(--text-primary)] uppercase tracking-wider">
                Creator
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[var(--text-primary)] uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[var(--text-primary)] uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[var(--text-primary)] uppercase tracking-wider">
                Created
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[var(--text-primary)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-surface-elevated divide-y divide-gray-200 dark:divide-gray-700">
            {requests.map((request) => (
              <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-surface-hover">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">{request.title}</div>
                    <div className="text-sm text-gray-500 dark:text-[var(--text-primary)]">{request.ref_number}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <User size={16} className="text-gray-400 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">{request.creator_name}</div>
                      <div className="text-sm text-gray-500 dark:text-[var(--text-primary)]">{request.creator_email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${request.type === 'technical' ? 'bg-blue-100 text-primary-800 border-blue-200' : 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                    {request.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                    {(request.converted_to_ticket || request.converted_to_task) && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                        request.converted_to_ticket ? 'bg-blue-100 text-primary-800 border-blue-200' : 'bg-purple-100 text-purple-800 border-purple-200'
                      }`}>
                        {request.converted_to_ticket ? 'Converted to Ticket' : 'Converted to Task'} ({request.attached_to})
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Clock size={16} className="text-gray-400 mr-2" />
                    <div className="text-sm text-gray-700 dark:text-[var(--text-primary)]">
                      {format(new Date(request.created_at), 'MMM dd, yyyy')}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    {!request.converted_to_ticket && (
                      <button
                        onClick={() => handleAction('make_ticket', request)}
                        className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                      >
                        Convert to Ticket
                      </button>
                    )}
                    {!request.converted_to_task && (
                      <button
                        onClick={() => handleAction('make_task', request)}
                        className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                      >
                        Convert to Task
                      </button>
                    )}
                    {request.status === 'pending' && (
                      <button
                        onClick={() => handleAction('approve', request)}
                        className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-surface">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white dark:bg-surface-elevated border-r border-gray-200 dark:border-subtle flex flex-col transition-all duration-300`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-subtle">
          <div className="flex items-center justify-between">
            <h2 className={`font-semibold text-gray-800 dark:text-[var(--text-primary)] ${sidebarCollapsed ? 'hidden' : 'block'}`}>Request Views</h2>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-surface-hover rounded text-gray-600 dark:text-[var(--text-primary)]"
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </div>

        {/* Search */}
        {!sidebarCollapsed && (
          <div className="p-4 border-b border-gray-200 dark:border-subtle">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-[var(--text-primary)]" size={16} />
              <input
                type="text"
                placeholder="Search requests"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-subtle bg-gray-50 dark:bg-surface-hover rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        )}

        {/* Sidebar Items */}
        <div className="flex-1 overflow-y-auto">
          {sidebarItems.map((item) => (
            <div
              key={item.key}
              onClick={() => setActiveView(item.key)}
              className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-hover ${
                activeView === item.key ? 'bg-primary-50 dark:bg-primary-900/20 border-r-2 border-r-primary-500' : ''
              }`}
            >
              <div className="flex items-center">
                <item.icon size={16} className={`mr-3 ${activeView === item.key ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500'}`} />
                <span className={`text-sm ${activeView === item.key ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-[var(--text-primary)]'} ${sidebarCollapsed ? 'hidden' : 'block'}`}>
                  {item.name}
                </span>
              </div>
              <span className={`text-xs px-2 py-1 bg-gray-100 dark:bg-surface-hover dark:text-[var(--text-primary)] rounded-full ${sidebarCollapsed ? 'hidden' : 'block'}`}>
                {requestCounts[item.key] || 0}
              </span>
            </div>
          ))}
        </div>

        {/* Analytics/Summary */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-subtle space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-[var(--text-primary)] flex items-center">
              <BarChart3 size={16} className="mr-2" />
              Quick Stats
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-[var(--text-primary)]">Pending</span>
                <span className="text-yellow-600 font-medium">{requestCounts.pending_requests || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-[var(--text-primary)]">Approved</span>
                <span className="text-primary-600 font-medium">{requestCounts.approved_requests || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-[var(--text-primary)]">Converted</span>
                <span className="text-primary-600 font-medium">{requestCounts.converted_requests || 0}</span>
              </div>
              <div className="flex justify-between text-sm font-medium border-t border-gray-200 dark:border-subtle pt-2">
                <span className="text-gray-800 dark:text-[var(--text-primary)]">Total</span>
                <span className="text-gray-900 dark:text-[var(--text-primary)]">{requestCounts.all_requests || 0}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top Header */}
        <header className="bg-white dark:bg-surface-elevated border-b border-gray-200 dark:border-subtle px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <ActiveIcon className="w-6 h-6 text-primary-600" />
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-[var(--text-primary)]">{activeViewName}</h1>
                  <p className="text-sm text-gray-500 dark:text-[var(--text-primary)]">{totalCount} requests</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-[var(--text-primary)]" size={16} />
                <input
                  type="text"
                  placeholder="Search by title or creator..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-10 pr-4 py-2 border border-gray-300 dark:border-subtle bg-gray-50 dark:bg-surface-hover rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Filters */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 dark:border-subtle bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] rounded px-3 py-2 text-sm"
              >
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="converted">Converted</option>
                <option value="pending">Pending</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-gray-300 dark:border-subtle bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] rounded px-3 py-2 text-sm"
              >
                <option value="all">All Types</option>
                <option value="technical">Technical</option>
                <option value="billing">Billing</option>
                <option value="feature">Feature Request</option>
                <option value="bug">Bug Report</option>
              </select>

              {/* View Mode Toggle */}
              <Dropdown
                trigger={
                  <Button variant="ghost" className="flex items-center space-x-2">
                    {viewMode === 'list' ? <LayoutList size={16} /> : viewMode === 'cards' ? <LayoutGrid size={16} /> : <Table size={16} />}
                    <span className="hidden sm:inline">
                      {viewMode === 'list' ? 'List View' : viewMode === 'cards' ? 'Card View' : 'Table View'}
                    </span>
                    <ChevronDown size={16} />
                  </Button>
                }
                options={[
                  { label: 'List View', onClick: () => setViewMode('list') },
                  { label: 'Card View', onClick: () => setViewMode('cards') },
                  { label: 'Table View', onClick: () => setViewMode('table') },
                ]}
              />
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Requests List */}
          <div className={`${viewMode === 'list' ? 'w-1/3' : 'w-full'} bg-white dark:bg-surface-elevated border-r border-gray-200 dark:border-subtle flex flex-col`}>
            {/* Filters Bar */}
            <div className="p-4 border-b border-gray-200 dark:border-subtle">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 dark:text-[var(--text-primary)]">
                  Showing {requests.length} of {totalCount} requests
                </span>
              </div>
            </div>

            {/* Requests Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                  <>
                    <TicketListSkeleton />
                    <TicketListSkeleton />
                    <TicketListSkeleton />
                  </>
                ) : requests.length === 0 ? (
                  <NoItems
                    title="No requests found"
                    message={`No requests match the current ${activeViewName.toLowerCase() ||
                      `search criteria${searchQuery ? ': "' + searchQuery + '"' : ''}`}.`}
                  />
                ) : viewMode === 'list' ? (
                  requests.map((request) => (
                    <div
                      key={request.id}
                      onClick={() => setSelectedRequest(request)}
                      className={`p-4 border-b border-gray-200 dark:border-subtle cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-hover ${
                        selectedRequest?.id === request.id ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-l-primary-500' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
                          {request.creator_name.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium text-gray-900 dark:text-[var(--text-primary)] truncate">{request.title}</h3>
                            <span className="text-xs text-gray-500 dark:text-[var(--text-primary)]">{format(new Date(request.created_at), 'MMM dd')}</span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-[var(--text-primary)] mb-2 line-clamp-2">{request.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                                {request.status}
                              </span>
                              {(request.converted_to_ticket || request.converted_to_task) && (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                  request.converted_to_ticket ? 'bg-primary-100 text-primary-800 border-primary-200' : 'bg-purple-100 text-purple-800 border-purple-200'
                                }`}>
                                  {request.attached_to}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-[var(--text-primary)]">
                              <span>{request.creator_name}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : viewMode === 'cards' ? (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {requests.map((request) => (
                      <RequestCard key={request.id} request={request} onAction={handleAction} />
                    ))}
                  </div>
                ) : null
              }

              {/* Table View */}
              {viewMode === 'table' && (
                requests.length === 0 ? (
                  <div className="p-8">
                    <NoItems
                      title="No requests found"
                      message={`No requests match the current ${activeViewName.toLowerCase() ||
                        `search criteria${searchQuery ? ': "' + searchQuery + '"' : ''}`}.`}
                    />
                  </div>
                ) : (
                  renderRequestsTable()
                )
              )}
            </div>

            {/* Pagination */}
            {viewMode !== 'table' && (
              <div className="p-4 border-t border-gray-200 dark:border-subtle">
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-[var(--text-primary)]">
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border rounded-lg hover:bg-gray-100 dark:hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span>
                    Page {currentPage} of {Math.ceil(totalCount / limit)}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage * limit >= totalCount}
                    className="px-3 py-1 border rounded-lg hover:bg-gray-100 dark:hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Request Details (for list view) */}
          {viewMode === 'list' && selectedRequest && (
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-surface">
              <div className="overflow-y-auto p-6">
                <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle p-6 mb-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-2">
                        {selectedRequest.title}
                      </h2>
                      <div className="flex items-center space-x-4 mb-4">
                        <span className="text-sm text-gray-500 dark:text-[var(--text-primary)]">
                          {selectedRequest.ref_number}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-[var(--text-primary)]">
                          {format(new Date(selectedRequest.created_at), 'MMM dd, yyyy h:mm a')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(selectedRequest.status)}`}>
                          {selectedRequest.status.toUpperCase()}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                          selectedRequest.type === 'technical' ? 'bg-blue-100 text-primary-800 border-blue-200' : 'bg-gray-100 text-gray-800 border-gray-200'
                        }`}>
                          {selectedRequest.type}
                        </span>
                        {(selectedRequest.converted_to_ticket || selectedRequest.converted_to_task) && (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                            selectedRequest.converted_to_ticket ? 'bg-blue-100 text-primary-800 border-blue-200' : 'bg-purple-100 text-purple-800 border-purple-200'
                          }`}>
                            {selectedRequest.attached_to}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3 ml-6 flex-shrink-0">
                      {!selectedRequest.converted_to_ticket && (
                        <Button onClick={() => handleAction('make_ticket', selectedRequest)}>
                          Convert to Ticket
                        </Button>
                      )}
                      {!selectedRequest.converted_to_task && (
                        <Button onClick={() => handleAction('make_task', selectedRequest)} variant="outline">
                          Convert to Task
                        </Button>
                      )}
                      {selectedRequest.status === 'pending' && (
                        <Button onClick={() => handleAction('approve', selectedRequest)} variant="outline" color="success">
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center mb-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mr-3">
                          <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)]">Creator</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-700 dark:text-[var(--text-primary)]">
                          <User className="w-4 h-4 mr-2 text-gray-500" />
                          <span className="font-medium">{selectedRequest.creator_name}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-primary)]">
                          <Mail className="w-4 h-4 mr-2 text-gray-500" />
                          {selectedRequest.creator_email}
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-primary)]">
                          <Phone className="w-4 h-4 mr-2 text-gray-500" />
                          {selectedRequest.creator_phone || 'Not provided'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                      <div className="flex items-center mb-3">
                        <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mr-3">
                          <Tag className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)]">Type & Status</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-700 dark:text-[var(--text-primary)]">
                          <Tag className="w-4 h-4 mr-2 text-gray-500" />
                          <span className="font-medium capitalize">{selectedRequest.type}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-primary)]">
                          <CheckCircle className="w-4 h-4 mr-2 text-gray-500" />
                          <span className={`px-2 py-1 rounded-full font-medium ${getStatusColor(selectedRequest.status)}`}>
                            {selectedRequest.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center mb-3">
                        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mr-3">
                          <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)]">Timeline</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-primary)]">
                          <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                          Created: {format(new Date(selectedRequest.created_at), 'MMM dd, yyyy')}
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-primary)]">
                          <Clock className="w-4 h-4 mr-2 text-gray-500" />
                          Updated: {format(new Date(selectedRequest.updated_at), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-surface-50 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <FileText className="w-4 h-4 text-gray-600 dark:text-[var(--text-primary)] mr-2" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)]">Request Description</h3>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-[var(--text-primary)] leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: sanitizeHTML(selectedRequest.description || '<span class="italic">No description provided</span>') }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestsPage;
