import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertCircle, PauseCircle, Timer, Calendar, Activity, Shield, TrendingUp, AlertTriangle } from 'lucide-react';
import { AxiosError } from 'axios';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import { errorNotification } from '../../../components/ui/Toast';

// Types for SLA data
type SlaAnalysis = {
  has_sla: boolean;
  sla_name: string;
  sla_description: string;
  is_active: boolean;
  evaluation_method: string;
  current_ticket_status: string;
  is_overdue: boolean;
  time_since_created: number;
  time_since_created_formatted: string;
  is_sla_paused: boolean;
  business_hours_elapsed: number;
  system_hours_elapsed: number;
  total_business_hours_for_resolution: number;
  total_system_hours_for_resolution: number;
  business_hours_elapsed_percentage: number;
  system_hours_elapsed_percentage: number;
};

type SlaStatusDetail = {
  status: string;
  due_time: string | null;
  completed_time: string | null;
};

type SlaStatus = {
  has_sla: boolean;
  sla_name: string;
  priority: string;
  first_response: SlaStatusDetail;
  resolution: SlaStatusDetail;
  next_response: SlaStatusDetail | null;
};

type SlaData = {
  ticket_id: string;
  sla_analysis: SlaAnalysis;
  sla_status: SlaStatus;
  is_sla_breached: boolean;
  is_sla_paused: boolean;
};

type SlaInfoProps = {
  ticketId: number | string;
};

// Mock data for demonstration
const mockSlaData: SlaData = {
  ticket_id: "12345",
  sla_analysis: {
    has_sla: true,
    sla_name: "Premium Support SLA",
    sla_description: "High priority customer support with 2-hour response time",
    is_active: true,
    evaluation_method: "Business Hours",
    current_ticket_status: "In Progress",
    is_overdue: false,
    time_since_created: 45,
    time_since_created_formatted: "45 minutes ago",
    is_sla_paused: false,
    business_hours_elapsed: 0.75,
    system_hours_elapsed: 0.80,
    total_business_hours_for_resolution: 24,
    total_system_hours_for_resolution: 24,
    business_hours_elapsed_percentage: 3.125,
    system_hours_elapsed_percentage: 3.33
  },
  sla_status: {
    has_sla: true,
    sla_name: "Premium Support SLA",
    priority: "High",
    first_response: {
      status: "Completed",
      due_time: "2025-07-31T10:00:00Z",
      completed_time: "2025-07-31T09:45:00Z"
    },
    resolution: {
      status: "In Progress",
      due_time: "2025-07-31T16:00:00Z",
      completed_time: null
    },
    next_response: {
      status: "Pending",
      due_time: "2025-07-31T12:00:00Z",
      completed_time: null
    }
  },
  is_sla_breached: false,
  is_sla_paused: false
};

// Enhanced Loading skeleton component
const SlaInfoSkeleton = () => (
  <div className="bg-gradient-to-br from-white to-gray-50 dark:from-surface-elevated dark:to-surface rounded-2xl border border-gray-200 dark:border-subtle p-8 shadow-lg animate-pulse">
    <div className="flex items-center space-x-3 mb-8">
      <div className="h-8 w-8 bg-gray-200 dark:bg-surface-hover rounded-lg"></div>
      <div className="h-8 bg-gray-200 dark:bg-surface-hover rounded-lg w-1/3"></div>
    </div>
    
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-surface-elevated rounded-xl p-6 border border-gray-100 dark:border-subtle">
          <div className="flex items-center space-x-3 mb-4">
            <div className="h-6 w-6 bg-gray-200 dark:bg-surface-hover rounded-lg"></div>
            <div className="h-5 bg-gray-200 dark:bg-surface-hover rounded w-2/3"></div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-5/6"></div>
          </div>
        </div>
      ))}
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[1, 2].map((i) => (
        <div key={i} className="bg-white dark:bg-surface-elevated rounded-xl p-6 border border-gray-100 dark:border-subtle">
          <div className="h-6 bg-gray-200 dark:bg-surface-hover rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-4/5"></div>
            <div className="h-4 bg-gray-200 dark:bg-surface-hover rounded w-3/4"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800';
    case 'in progress':
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800';
    case 'pending':
      return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800';
    case 'overdue':
      return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';
    default:
      return 'text-gray-600 dark:text-[var(--text-muted)] bg-gray-50 dark:bg-surface-30 border-gray-200 dark:border-subtle';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'high':
      return 'text-red-700 dark:text-red-300 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-red-200 dark:border-red-700';
    case 'medium':
      return 'text-amber-700 dark:text-amber-300 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border-amber-200 dark:border-amber-700';
    case 'low':
      return 'text-primary-700 dark:text-primary-300 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 border-primary-200 dark:border-primary-700';
    default:
      return 'text-gray-700 dark:text-[var(--text-primary)] bg-gradient-to-r from-gray-50 to-gray-100 dark:from-surface-30 dark:to-surface-elevated-30 border-gray-200 dark:border-subtle';
  }
};

type StatusCardProps = {
  title: string;
  status: string;
  dueTime: string | null;
  completedTime: string | null;
  icon: React.ElementType;
  isNextResponse?: boolean;
};

const StatusCard: React.FC<StatusCardProps> = ({ title, status, dueTime, completedTime, icon: Icon, isNextResponse = false }) => {
  const isCompleted = status.toLowerCase() === 'completed';
  const isOverdue = status.toLowerCase() === 'overdue';
  
  return (
    <div className={`bg-white dark:bg-surface-elevated rounded-xl p-6 border transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${
      isNextResponse ? 'border-blue-200 dark:border-blue-700 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-900/20 dark:to-surface-elevated' : 'border-gray-200 dark:border-subtle'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isCompleted ? 'bg-primary-100 dark:bg-primary-900/30' : isOverdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
            <Icon className={`h-5 w-5 ${isCompleted ? 'text-primary-600' : isOverdue ? 'text-red-600' : 'text-blue-600'}`} />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">{title}</h3>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
          {status}
        </span>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-[var(--text-muted)]">Due:</span>
          <span className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">{formatDate(dueTime)}</span>
        </div>
        {completedTime && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-[var(--text-muted)]">Completed:</span>
            <span className="text-sm font-medium text-primary-600 dark:text-primary-400">{formatDate(completedTime)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const SlaInfo: React.FC<SlaInfoProps> = ({ ticketId }) => {
    const [slaData, setSlaData] = useState<SlaData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSlaData = async () => {
      try {
        setLoading(true);
        const response = await http.get(`${APIS.LOAD_TICKET_SLA}/${ticketId}`);
        console.log(response.data)
        setSlaData(response.data);
      } catch (err) {
        const error = err as AxiosError;
        if (error.response && error.response.data) {
          const errorMessage =
            (error.response.data as { message?: string }).message || "An error occurred while fetching SLA data";
          errorNotification(errorMessage);
          setError(errorMessage);
        } else {
          errorNotification("Network or unexpected error occurred while fetching SLA data");
          setError("Network or unexpected error occurred");
        }
      } finally {
        setTimeout(() => setLoading(false), 200); // Simulate a slight delay
      }
    };

    if (ticketId) {
      fetchSlaData();
    }
  }, [ticketId]);

  if (loading) {
    return <SlaInfoSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-2xl border border-red-200 dark:border-red-700 p-12 text-center">
        <AlertCircle className="mx-auto h-16 w-16 text-red-500 dark:text-red-400 mb-4" />
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">Unable to Load SLA Data</h3>
        <p className="text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!slaData || !slaData.sla_analysis.has_sla) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-surface-elevated dark:to-surface rounded-2xl border border-gray-200 dark:border-subtle p-12 text-center">
        <Clock className="mx-auto h-16 w-16 text-gray-400 dark:text-[var(--text-muted)] mb-6" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-3">No SLA Configuration</h3>
        <p className="text-gray-600 dark:text-[var(--text-muted)] max-w-md mx-auto">This ticket doesn't have an associated Service Level Agreement. Contact your administrator to set up SLA policies.</p>
      </div>
    );
  }

  const { sla_analysis, sla_status, is_sla_breached, is_sla_paused } = slaData;

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 dark:from-surface-elevated dark:to-surface rounded-2xl border border-gray-200 dark:border-subtle p-8 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">SLA</h2>
            <p className="text-gray-600 dark:text-[var(--text-muted)]">Service Level Agreement Status</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {is_sla_breached ? (
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg">
              <AlertTriangle className="w-4 h-4 mr-2" /> Breached
            </span>
          ) : (
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg">
              <CheckCircle className="w-4 h-4 mr-2" /> Active
            </span>
          )}
          {is_sla_paused && (
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg">
              <PauseCircle className="w-4 h-4 mr-2" /> Paused
            </span>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-surface-elevated rounded-xl p-6 border border-gray-200 dark:border-subtle hover:shadow-lg transition-all duration-300">
          <div className="flex items-center space-x-3 mb-2">
            <Activity className="h-6 w-6 text-blue-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-[var(--text-muted)]">Status</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-[var(--text-primary)]">{sla_analysis.current_ticket_status}</p>
        </div>

        <div className="bg-white dark:bg-surface-elevated rounded-xl p-6 border border-gray-200 dark:border-subtle hover:shadow-lg transition-all duration-300">
          <div className="flex items-center space-x-3 mb-2">
            <TrendingUp className="h-6 w-6 text-purple-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-[var(--text-muted)]">Priority</span>
          </div>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${getPriorityColor(sla_status.priority)}`}>
            {sla_status.priority}
          </span>
        </div>

        <div className="bg-white dark:bg-surface-elevated rounded-xl p-6 border border-gray-200 dark:border-subtle hover:shadow-lg transition-all duration-300">
          <div className="flex items-center space-x-3 mb-2">
            <Timer className="h-6 w-6 text-primary-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-[var(--text-muted)]">Time Elapsed</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-[var(--text-primary)]">{sla_analysis.time_since_created_formatted}</p>
        </div>

        <div className="bg-white dark:bg-surface-elevated rounded-xl p-6 border border-gray-200 dark:border-subtle hover:shadow-lg transition-all duration-300">
          <div className="flex items-center space-x-3 mb-2">
            <Calendar className="h-6 w-6 text-amber-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-[var(--text-muted)]">Method</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-[var(--text-primary)]">{sla_analysis.evaluation_method}</p>
        </div>
      </div>

      {/* SLA Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* SLA Information */}
        <div className="bg-white dark:bg-surface-elevated rounded-xl p-6 border border-gray-200 dark:border-subtle">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-6 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-blue-500" />
            SLA Information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-[var(--text-muted)]">Name</label>
              <p className="text-gray-900 dark:text-[var(--text-primary)] font-medium">{sla_analysis.sla_name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-[var(--text-muted)]">Description</label>
              <p className="text-gray-700 dark:text-[var(--text-primary)]">{sla_analysis.sla_description}</p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-subtle">
              <span className="text-sm font-medium text-gray-600 dark:text-[var(--text-muted)]">Active Status</span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                sla_analysis.is_active 
                  ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-200' 
                  : 'bg-gray-100 text-gray-800 dark:bg-surface-30 dark:text-[var(--text-primary)]'
              }`}>
                {sla_analysis.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Additional Details */}
        <div className="bg-white dark:bg-surface-elevated rounded-xl p-6 border border-gray-200 dark:border-subtle">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-6 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-purple-500" />
            Additional Details
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-[var(--text-muted)]">Overdue Status</span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                sla_analysis.is_overdue 
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' 
                  : 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-200'
              }`}>
                {sla_analysis.is_overdue ? 'Overdue' : 'On Time'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-[var(--text-muted)]">Paused Status</span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                sla_analysis.is_sla_paused 
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' 
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
              }`}>
                {sla_analysis.is_sla_paused ? 'Paused' : 'Running'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-[var(--text-muted)]">Business Hours Elapsed %</span>
              <span className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">
                {sla_analysis.business_hours_elapsed_percentage.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-[var(--text-muted)]">System Hours Elapsed %</span>
              <span className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">
                {sla_analysis.system_hours_elapsed_percentage.toFixed(2)}%
              </span>
            </div>
            <div className="pt-4 border-t border-gray-100 dark:border-subtle">
              <label className="text-sm font-medium text-gray-600 dark:text-[var(--text-muted)]">Ticket ID</label>
              <p className="text-gray-900 dark:text-[var(--text-primary)] font-mono text-sm">{slaData.ticket_id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Timeline */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-6 flex items-center">
          <Clock className="h-5 w-5 mr-2 text-primary-500" />
          SLA Timeline
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <StatusCard
            title="First Response"
            status={sla_status.first_response.status}
            dueTime={sla_status.first_response.due_time}
            completedTime={sla_status.first_response.completed_time}
            icon={CheckCircle}
          />
          
          <StatusCard
            title="Resolution"
            status={sla_status.resolution.status}
            dueTime={sla_status.resolution.due_time}
            completedTime={sla_status.resolution.completed_time}
            icon={Timer}
          />
          
          {sla_status.next_response && (
            <StatusCard
              title="Next Response"
              status={sla_status.next_response.status}
              dueTime={sla_status.next_response.due_time}
              completedTime={sla_status.next_response.completed_time}
              icon={Clock}
              isNextResponse={true}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SlaInfo;
