import React from 'react';
import {
  List, Plus, User, Clock, FileText, Paperclip, Eye, Calendar, Mail, Phone, Tag,
  CheckCircle, Edit3, UserCheck, CheckSquare, RotateCcw, Link as LinkIcon, Building,
} from 'lucide-react';
import LabelGroup from '../../../components/ui/LabelGroup';
import Select from '../../../components/ui/Select';
import MultiSelectAgents from '../../../components/ui/MultiSelectAgents';
import { Tooltip } from '../../../components/ui/Tool';
import UpdateTicketStatus from '../mini/TicketUpdateStatus';
import { DynamicStepper } from '../../../components/ui/Stepper';
import { EmailHtmlViewer } from '../../../components/EmailHtmlViewer';
import { TicketActivityStream } from '../mini/TicketActivityStream';
import TicketAttachments from '../mini/TicketAttachments';
import TicketTasks from '../mini/TicketTasks';
import SlaInfo from '../mini/SlaInfo';
import { sanitizeHTML } from '../../../utils/sanitize';
import {
  getSourceLabel, getSourceIcon, getStatusColor, getPriorityColor,
  formatDate, formatDateWithTime, formatUserDisplayName,
} from '../../../utils/displayHelpers';
import { formatRelativeTime } from '../../../utils/helper';
import type { Agent, LabelItem, SessionUser, Ticket } from '../../../types';
import type { AgentType } from '../../../types/agents';

interface Watcher {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface Department {
  id: number;
  name: string;
}

const isRichHtmlDescription = (description?: string | null): boolean => {
  if (!description) return false;
  return (
    /<html/i.test(description) ||
    /<table/i.test(description) ||
    /<style/i.test(description) ||
    /<\/?[a-z][\s\S]*>/i.test(description)
  );
};

interface TicketDetailPanelProps {
  selectedTicket: Ticket;
  selectedTicketLabels: LabelItem[];
  user: SessionUser | null;

  selectedPriority: string;
  setSelectedPriority: (value: string) => void;
  handleUpdatePriority: () => void;
  isSubmitting: boolean;

  isTicketClosed: boolean;
  setIsReopenModalOpen: (open: boolean) => void;
  handleAssignToMe: () => void;
  isAssigning: boolean;
  isUserWatcher: boolean;

  selectedStatus: string;
  setSelectedStatus: (value: string) => void;
  statusDescription: string;
  setStatusDescription: (value: string) => void;
  handleStatusUpdate: () => void;

  selectedDepartmentId: string;
  setSelectedDepartmentId: (value: string) => void;
  departments: Department[];
  handleUpdateDepartment: () => void;

  selectedAgentId: string;
  setSelectedAgentId: (value: string) => void;
  agents: Agent[] | null;
  handleAssign: () => void;

  agentsData: AgentType[];
  selectedWatchers: number[];
  setSelectedWatchers: (value: number[]) => void;
  handleAddWatchers: () => void;

  setShowLabelsModal: (open: boolean) => void;
  setShowAssignModal: (open: boolean) => void;
  setShowDepartmentModal: (open: boolean) => void;
  setShowCategoryModal: (open: boolean) => void;

  activeTab: string;
  setActiveTab: (tab: string) => void;
  taskRefreshTrigger: number;
  setTaskRefreshTrigger: (updater: (prev: number) => number) => void;
  linkedTasksCount: number;
  setLinkedTasksCount: (count: number) => void;

  ticketWatchers: Watcher[];
  reloader: number;
  fetchTicketDetails: (ticketId: string) => void;
}

export const TicketDetailPanel = ({
  selectedTicket,
  selectedTicketLabels,
  user,
  selectedPriority,
  setSelectedPriority,
  handleUpdatePriority,
  isSubmitting,
  isTicketClosed,
  setIsReopenModalOpen,
  handleAssignToMe,
  isAssigning,
  isUserWatcher,
  selectedStatus,
  setSelectedStatus,
  statusDescription,
  setStatusDescription,
  handleStatusUpdate,
  selectedDepartmentId,
  setSelectedDepartmentId,
  departments,
  handleUpdateDepartment,
  selectedAgentId,
  setSelectedAgentId,
  agents,
  handleAssign,
  agentsData,
  selectedWatchers,
  setSelectedWatchers,
  handleAddWatchers,
  setShowLabelsModal,
  setShowAssignModal,
  setShowDepartmentModal,
  setShowCategoryModal,
  activeTab,
  setActiveTab,
  taskRefreshTrigger,
  setTaskRefreshTrigger,
  linkedTasksCount,
  setLinkedTasksCount,
  ticketWatchers,
  reloader,
  fetchTicketDetails,
}: TicketDetailPanelProps) => {
  return (
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
                      {getSourceLabel(selectedTicket.source)}
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
  );
};
