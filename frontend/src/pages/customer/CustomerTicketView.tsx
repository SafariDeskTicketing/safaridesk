import React, { useState, useEffect } from 'react';
import { sanitizeHTML } from '../../utils/sanitize';
import {
  Calendar,
  User,
  Mail,
  Phone,
  Home,
  FileText,
  CheckCircle,
  MessageSquare,
  Paperclip,
  AlertTriangle,
  X,
  RotateCcw,
  List,
} from 'lucide-react';
import { APIS } from '../../services/apis';
import { successNotification, errorNotification } from '../../components/ui/Toast';
import type { TicketData } from '../../types';
import { formatRelativeTime } from '../../utils/helper';
import TicketViewSkeleton from '../../components/loader/TicketViewSkeleton';
import TicketAttachments from '../../pages/ticket/mini/TicketAttachments';
import { TicketActivityStream } from '../../pages/ticket/mini/TicketActivityStream';
import http from '../../services/http'; // Import the http instance
import { Modal } from '../../components/ui/Modal'; // Import Modal component

interface CustomerTicketViewProps {
  ticketData: TicketData;
  onClose: () => void;
}

const CustomerTicketView: React.FC<CustomerTicketViewProps> = ({ ticketData }) => {
  const [reloader, setReloader] = useState<number>(0)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('activity');
  const [ticketStatus, setTicketStatus] = useState(ticketData.ticket.status);
  const [statusChangedAt, setStatusChangedAt] = useState<string | null>(
    ticketData.ticket.resolved_at ||
    ((ticketData.ticket.status === 'closed' || ticketData.ticket.status === 'resolved')
      ? ticketData.ticket.updated_at
      : null)
  );
  const [closingReason, setClosingReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700';
      case 'low': return 'bg-primary-100 text-primary-800 border-primary-200 dark:bg-primary-900 dark:text-primary-200 dark:border-primary-700';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-surface dark:text-[var(--text-primary)] dark:border-subtle';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-primary-100 text-primary-800 border-primary-200 dark:bg-primary-900 dark:text-primary-200 dark:border-primary-700';
      case 'assigned': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700';
      case 'resolved': return 'bg-primary-100 text-primary-800 border-primary-200 dark:bg-primary-900 dark:text-primary-200 dark:border-primary-700';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-surface dark:text-[var(--text-primary)] dark:border-subtle';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-surface dark:text-[var(--text-primary)] dark:border-subtle';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const ticketStatusLower = ticketStatus.toLowerCase();
  const canCloseTicket = ['open', 'pending', 'in_progress'].includes(ticketStatusLower);
  const hasReopenWindow = (() => {
    if (!['closed', 'resolved'].includes(ticketStatusLower)) {
      return false;
    }

    if (!statusChangedAt) {
      return true;
    }

    const lastClosedAt = new Date(statusChangedAt);
    if (Number.isNaN(lastClosedAt.getTime())) {
      return true;
    }

    return lastClosedAt.getTime() + (7 * 24 * 60 * 60 * 1000) > Date.now();
  })();

  const { ticket } = ticketData;

  const handleCloseTicket = async () => {
    try {
      await http.put(`${APIS.TICKET_UPDATE_STATUS}/${ticket.id}`, {
        status: 'resolved',
        notes: closingReason || 'Customer marked the ticket as resolved'
      });
      successNotification('Ticket marked as resolved');
      setTicketStatus('resolved');
      setStatusChangedAt(new Date().toISOString());
      setShowCloseModal(false);
      setClosingReason('');
      setReloader(prev => prev + 1);
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to update ticket status');
    }
  };

  const handleReopenTicket = async () => {
    try {
      const response = await http.post(`${APIS.TICKET_BASE}/${ticket.id}/reopen/`, {
        reason: reopenReason || 'Customer reopened the ticket'
      });
      successNotification('Ticket reopened successfully');
      setTicketStatus('open');
      setStatusChangedAt(null);
      setShowReopenModal(false);
      setReopenReason('');
      setReloader(prev => prev + 1);
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to reopen ticket');
    }
  };

  if (loading) {
    return <TicketViewSkeleton />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
          <div className="flex">
            <div className="py-1"><AlertTriangle className="h-6 w-6 text-red-500 mr-4" /></div>
            <div>
              <p className="font-bold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Removed back button as modal has its own close */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
              {ticket.ticket_id}
            </h1>
            <p className="text-gray-600 dark:text-[var(--text-primary)]">
              More info about ticket
            </p>
          </div>
        </div>
      </div>


      {/* Header and Summary Section */}
      <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle p-4 sm:p-6 overflow-hidden">
        <div className="flex flex-col gap-6">
          {/* Header Section */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
              <div className="flex-1">
                <h1 className="text-xl sm:text-1xl font-bold text-gray-600 dark:text-[var(--text-primary)] mb-2 break-words">
                  {`${ticket.title}`}
                </h1>
                <p className="text-sm text-gray-500 dark:text-[var(--text-primary)] mb-3 break-words">
                  {ticket.ticket_id} • Created {formatRelativeTime(ticket.created_at)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(ticketStatus)}`}>
                    {ticketStatus.toUpperCase()}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority.toUpperCase()}
                  </span>
                  {ticket.is_overdue && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700">
                      OVERDUE
                    </span>
                  )}
                  {/* Close/Reopen Buttons */}
                  {canCloseTicket ? (
                    <button
                      onClick={() => setShowCloseModal(true)}
                      className="inline-flex items-center justify-center space-x-2 min-h-11 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-900/40 transition-colors text-sm font-medium w-full sm:w-auto"
                    >
                      <X size={16} />
                      <span>Mark as Resolved</span>
                    </button>
                  ) : hasReopenWindow ? (
                    <button
                      onClick={() => setShowReopenModal(true)}
                      className="inline-flex items-center justify-center space-x-2 min-h-11 px-4 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-900 dark:hover:bg-primary-900/40 transition-colors text-sm font-medium w-full sm:w-auto"
                    >
                      <RotateCcw size={16} />
                      <span>Reopen Ticket</span>
                    </button>
                  ) : (
                    <span className="inline-flex min-h-11 items-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 dark:border-subtle dark:bg-surface dark:text-[var(--text-muted)] w-full sm:w-auto">
                      Reopen window expired
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Ticket Info Grid */}
            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
              {/* Creator Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">Creator</h3>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-primary)]">
                    <User className="w-4 h-4 mr-2" />
                    {ticket.creator_name}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-primary)]">
                    <Mail className="w-4 h-4 mr-2" />
                    {ticket.creator_email}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-primary)]">
                    <Phone className="w-4 h-4 mr-2" />
                    {ticket.creator_phone}
                  </div>
                </div>
              </div>

              {/* Assignment Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">Assignment</h3>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-primary)]">
                    <User className="w-4 h-4 mr-2" />
                    {ticket.assigned_to ? ticket.assigned_to.name : 'Unassigned'}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-primary)]">
                    <Home className="w-4 h-4 mr-2" />
                    {ticket.department?.name || 'Not assigned'}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-primary)]">
                    <FileText className="w-4 h-4 mr-2" />
                    {ticket.category?.name || 'Uncategorized'}
                  </div>
                </div>
              </div>

              {/* Timeline Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">Timeline</h3>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-primary)]">
                    <Calendar className="w-4 h-4 mr-2" />
                    Created: {formatDate(ticket.created_at)}
                  </div>
                  {ticket.resolved_at && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-primary)]">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Resolved: {formatDate(ticket.resolved_at)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] mb-3">Description</h3>
              <div className="bg-gray-50 dark:bg-surface rounded-lg p-4">
                <div
                  className="text-sm text-gray-700 dark:text-[var(--text-primary)] whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(ticket.description || '') }}
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Tabs Section */}
      <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle overflow-hidden">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-subtle">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 px-4 sm:px-6" aria-label="Tabs">
            {(() => {
              const tabBase = 'py-3 sm:py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2';
              const tabActive = 'border-primary-500 text-primary-600 dark:text-primary-400';
              const tabInactive = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-[var(--text-primary)] dark:hover:text-gray-300';
              return (
                <>
                  <button
                    onClick={() => setActiveTab('activity')}
                    className={`${tabBase} ${activeTab === 'activity' ? tabActive : tabInactive}`}
                  >
                    <List className="w-4 h-4" />
                    <span>Activity Stream</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('attachments')}
                    className={`${tabBase} ${activeTab === 'attachments' ? tabActive : tabInactive}`}
                  >
                    <Paperclip className="w-4 h-4" />
                    <span>Attachments</span>
                  </button>
                </>
              );
            })()}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {activeTab === 'activity' && (
            <TicketActivityStream
              ticketId={ticket.id}
              reloader={reloader}
              isCustomerView={true}
            />
          )}

          {activeTab === 'attachments' && (
            <TicketAttachments ticketId={ticket.id} />
          )}
        </div>
      </div>

      {/* Close Ticket Modal - Using reusable Modal component */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => {
          setShowCloseModal(false);
          setClosingReason('');
        }}
        title="Mark as Resolved"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">
            Are you sure you want to mark this ticket as resolved? You can reopen it within 7 days if needed.
          </p>
          <textarea
            value={closingReason}
            onChange={(e) => setClosingReason(e.target.value)}
            placeholder="Enter a note for resolution (optional)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            rows={3}
          />
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => {
                setShowCloseModal(false);
                setClosingReason('');
              }}
              className="px-4 py-2 text-gray-700 dark:text-[var(--text-primary)] border border-gray-300 dark:border-subtle rounded-lg hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCloseTicket}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
            >
              Mark as Resolved
            </button>
          </div>
        </div>
      </Modal>

      {/* Reopen Ticket Modal - Using reusable Modal component */}
      <Modal
        isOpen={showReopenModal}
        onClose={() => {
          setShowReopenModal(false);
          setReopenReason('');
        }}
        title="Reopen Ticket"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">
            Are you sure you want to reopen this ticket? Reopen actions are only available within 7 days of resolution.
          </p>
          <textarea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="Enter reason for reopening"
            className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-lg bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)] placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            rows={3}
          />
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => {
                setShowReopenModal(false);
                setReopenReason('');
              }}
              className="px-4 py-2 text-gray-700 dark:text-[var(--text-primary)] border border-gray-300 dark:border-subtle rounded-lg hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReopenTicket}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium"
            >
              Reopen Ticket
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );

};

export default CustomerTicketView;
