import React from 'react';
import {
  Calendar,
  User,
  Mail,
  Phone,
  Tag,
  FileText,
  AlertTriangle,
  CheckCircle,
  Edit3,
  UserCheck,
  Eye,
  Share2,
  ChevronRight,
  ChevronLeft,
  LinkIcon,
  Copy
} from 'lucide-react';
import { Tooltip } from '../ui/Tool';
import { Input } from '../ui/Input';
import Select from '../ui/Select';
import UpdateTicketStatus from '../../pages/ticket/mini/TicketUpdateStatus';
import type { TicketData, Agent } from '../../types';
import { formatRelativeTime } from '../../utils/helper';
import type { AgentType } from '../../types/agents';
import { formatUserDisplayName } from '../../utils/displayHelpers';

type TicketHeaderSummaryProps = {
  ticket: TicketData['ticket'];
  getPriorityColor: (priority: string) => string;
  getStatusColor: (status: string) => string;
  formatDate: (dateString: string) => string;
  handleStatusUpdate: () => Promise<void>;
  isSubmitting: boolean;
  selectedPriority: string;
  setSelectedPriority: (priority: string) => void;
  statusDescription: string;
  setStatusDescription: (description: string) => void;
  selectedAgentId: string;
  setSelectedAgentId: (agentId: string) => void;
  agents: Agent[] | null;
  agentsData: AgentType[];
  handleAssign: () => Promise<void>;
  ticketTags: string;
  setTicketTags: (tags: string) => void;
  shareLink: string;
};

const TicketHeaderSummary: React.FC<TicketHeaderSummaryProps> = ({
  ticket,
  getPriorityColor,
  getStatusColor,
  formatDate,
  handleStatusUpdate,
  isSubmitting,
  selectedPriority,
  setSelectedPriority,
  statusDescription,
  setStatusDescription,
  selectedAgentId,
  setSelectedAgentId,
  agents,
  agentsData,
  handleAssign,
  ticketTags,
  setTicketTags,
  shareLink,
}) => {
  return (
    <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle p-6">
      {ticket.is_merged && ticket.merged_into && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LinkIcon size={16} />
            <span>
              Merged into{' '}
              <a
                href={`/ticket/${ticket.merged_into.ticket_id}`}
                className="underline font-semibold"
              >
                #{ticket.merged_into.ticket_id}
              </a>
            </span>
          </div>
          <a
            href={`/ticket/${ticket.merged_into.ticket_id}`}
            className="text-[14px] text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
          >
            View primary
          </a>
        </div>
      )}

      {ticket.merged_children && ticket.merged_children.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-blue-100 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-100">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2">
            <LinkIcon size={16} />
            <span>Merged tickets</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {ticket.merged_children.map((child) => (
              <a
                key={child.id}
                href={`/ticket/${child.ticket_id}`}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white text-blue-700 border border-blue-200 shadow-sm hover:bg-blue-50 dark:bg-blue-800 dark:text-blue-100 dark:border-blue-600"
              >
                #{child.ticket_id}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Header Section - 70% width */}
        <div className="flex-1" style={{ flexBasis: '70%' }}>
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-1xl font-bold text-gray-600 dark:text-[var(--text-muted)] mb-2">
                {`${ticket.title}`}
              </h1>
              <p className="text-sm text-gray-500 dark:text-[var(--text-muted)] mb-3">
                {ticket.ticket_id} • Created {formatRelativeTime(ticket.created_at)}
              </p>
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 rounded-full text-[14px] font-medium border ${getStatusColor(ticket.status)}`}>
                  {ticket.status.toUpperCase()}
                </span>
                <span className={`px-3 py-1 rounded-full text-[14px] font-medium border ${getPriorityColor(ticket.priority)}`}>
                  {ticket.priority.toUpperCase()}
                </span>
                {ticket.is_overdue && (
                  <span className="px-3 py-1 rounded-full text-[14px] font-medium bg-red-100 text-red-800 border border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700">
                    OVERDUE
                  </span>
                )}
              </div>
            </div>


            {/* Actions */}
            <div className="flex items-center space-x-2 ml-4">
                <a
                  href="/customer/index"
                  className="inline-flex items-center justify-center w-9 h-9 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                  title="Customer Portal"
                >
                  <LinkIcon size={16} />
                </a>

                <Tooltip
                  content={
                    <UpdateTicketStatus
                      handleStatusUpdate={handleStatusUpdate}
                      isSubmitting={isSubmitting}
                      selectedOption={selectedPriority}
                      setSelectedOption={setSelectedPriority}
                      statusDescription={statusDescription}
                      setStatusDescription={setStatusDescription}
                    />
                  }
                >
                  <button
                    className="inline-flex items-center justify-center w-9 h-9 text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover rounded-md transition-colors"
                    title="Update Status"
                  >
                    <Edit3 size={16} />
                  </button>
                </Tooltip>

                <Tooltip
                  content={
                    <div className="p-6">
                      <Select
                        id="assign-agent"
                        label="Select Agent"
                        value={selectedAgentId}
                        onChange={setSelectedAgentId}
                        options={[
                          { value: "", label: "Choose agent...", disabled: true },
                          ...(agents && agents.length > 0
                            ? agents.map(agent => ({
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
                      <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                        <button
                            onClick={handleAssign}
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                        >
                           {isSubmitting ? "Please wait.. ": "Reassign"}
                        </button>
                      </div>
                    </div>
                  }
                >
                  <button
                    className="inline-flex items-center justify-center w-9 h-9 text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover rounded-md transition-colors"
                    title={ticket.assigned_to ? "Reassign Ticket" : "Assign Ticket"}
                  >
                    <UserCheck size={16} />
                  </button>
                </Tooltip>

                <Tooltip
                  content={
                    <div className="p-6">
                      <Select
                        id="watchers"
                        label="Select Watcher"
                        value={selectedAgentId}
                        onChange={setSelectedAgentId}
                        options={[
                          { value: "", label: "Choose watcher...", disabled: true },
                          ...(agents && agents.length > 0
                            ? agents.map(agent => ({
                                value: agent.id.toString(),
                                label: agent.name || "Unknown Agent"
                              }))
                            : [{ value: "", label: "No agents found", disabled: true }]
                          )
                        ]}
                        placeholder="Choose watcher..."
                        size="md"
                        required={true}
                        allowSearch={true}
                      />
                      <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                        <button
                            onClick={() => { /* Add watcher logic here */ }}
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                        >
                           {isSubmitting ? "Please wait.. ": "Add Watcher"}
                        </button>
                      </div>
                    </div>
                  }
                >
                  <button
                    className="inline-flex items-center justify-center w-9 h-9 text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover rounded-md transition-colors"
                    title="Add Watchers"
                  >
                    <Eye size={16} />
                  </button>
                </Tooltip>

                <Tooltip
                  content={
                    <div className="p-6">
                      <Select
                        id="priority"
                        label="Select Priority"
                        value={selectedPriority}
                        onChange={setSelectedPriority}
                        options={[
                          { value: "critical", label: "Critical" },
                          { value: "high", label: "High" },
                          { value: "medium", label: "Medium" },
                          { value: "low", label: "Low" },
                        ]}
                        placeholder="Choose priority..."
                        size="md"
                        required={true}
                      />
                      <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                        <button
                            onClick={() => { /* Change priority logic here */ }}
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                        >
                           {isSubmitting ? "Please wait.. ": "Change Priority"}
                        </button>
                      </div>
                    </div>
                  }
                >
                  <button
                    className="inline-flex items-center justify-center w-9 h-9 text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover rounded-md transition-colors"
                    title="Change Priority"
                  >
                    <AlertTriangle size={16} />
                  </button>
                </Tooltip>

                <Tooltip
                  content={
                    <div className="p-6">
                      <Input
                        id="tags"
                        label="Enter Tags (comma separated)"
                        value={ticketTags}
                        onChange={(e) => setTicketTags(e.target.value)}
                        placeholder="tag1, tag2, tag3"
                        size="md"
                      />
                      <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                        <button
                            onClick={() => { /* Manage tags logic here */ }}
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                        >
                           {isSubmitting ? "Please wait.. ": "Save Tags"}
                        </button>
                      </div>
                    </div>
                  }
                >
                  <button
                    className="inline-flex items-center justify-center w-9 h-9 text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover rounded-md transition-colors"
                    title="Manage Tags"
                  >
                    <Tag size={16} />
                  </button>
                </Tooltip>


                <div className="w-px h-6 bg-gray-300 dark:bg-surface-hover mx-1"></div>

                <button
                  // onClick={() => setShowHistory(true)}
                  className="inline-flex items-center justify-center w-9 h-9 text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover rounded-md transition-colors"
                  title="View History"
                >
                  <ChevronLeft size={16} />
                </button>

                <Tooltip
                  content={
                    <div className="p-6">
                      <div className="flex items-center space-x-2">
                        <Input
                          id="share-link"
                          label="Shareable Link"
                          value={shareLink}
                          readOnly
                          size="md"
                          className="flex-1"
                        />
                        <button
                          onClick={() => { navigator.clipboard.writeText(shareLink); /* successNotification("Link copied!"); */ }}
                          className="p-2 bg-gray-200 dark:bg-surface-hover rounded-md hover:bg-gray-300 dark:hover:bg-surface-hover transition-colors"
                          title="Copy Link"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>
                  }
                >
                  <button
                    className="inline-flex items-center justify-center w-9 h-9 text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover rounded-md transition-colors"
                    title="Share Ticket"
                  >
                    <Share2 size={16} />
                  </button>
                </Tooltip>

                <div className="relative">
                  <button
                    // onClick={() => setShowMoreActions(!showMoreActions)}
                    className="inline-flex items-center justify-center w-9 h-9 text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover rounded-md transition-colors"
                    title="More Actions"
                  >
                    <ChevronRight size={16} />
                  </button>


                </div>
              </div>


          </div>

          {/* Ticket Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Creator Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">Creator</h3>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                  <User className="w-4 h-4 mr-2" />
                  {ticket.creator_name}
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                  <Mail className="w-4 h-4 mr-2" />
                  {ticket.creator_email}
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                  <Phone className="w-4 h-4 mr-2" />
                  {ticket.creator_phone}
                </div>
              </div>
            </div>

            {/* Assignment Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">Assignment</h3>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                  <User className="w-4 h-4 mr-2" />
                  {formatUserDisplayName(ticket.assigned_to, 'Unassigned')}
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                  <Tag className="w-4 h-4 mr-2" />
                  {ticket.department?.name || 'Unassigned'}
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                  <FileText className="w-4 h-4 mr-2" />
                  {ticket.category?.name || 'Uncategorized'}
                </div>
              </div>
            </div>

            {/* Timeline Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">Timeline</h3>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                  <Calendar className="w-4 h-4 mr-2" />
                  Created: {formatDate(ticket.created_at)}
                </div>
                {ticket.resolved_at && (
                  <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
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
              <p className="text-sm text-gray-700 dark:text-[var(--text-primary)] whitespace-pre-wrap">
                {ticket.description}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TicketHeaderSummary;
