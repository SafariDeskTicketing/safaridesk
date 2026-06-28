import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  Tag, 
  Paperclip,
  CheckCircle,
  Edit3,
  UserCheck,
  Link,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';
import http from '../../../services/http';
import { APIS } from '../../../services/apis';
import { errorNotification, successNotification } from '../../../components/ui/Toast';
import Drawer from '../../../components/ui/Drawer';
import { Modal } from '../../../components/ui/Modal';
import LoadingSkeleton from '../../../components/ui/Skeleton';
import type { TaskData } from '../../../types';
import { formatDate, formatRelativeTime } from '../../../utils/helper';
import { formatDateWithTime, getPriorityColor, getStatusColor, formatUserDisplayName } from '../../../utils/displayHelpers';
import TaskStatusUpdate from './TaskStatusUpdate';
import AssignTask from './AssignTask';
import AttachToTikect from './AttachToTicket';
import { TaskActivityStream } from './TaskActivityStream';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import { useFetchAgents } from '../../../services/agents';
import { useAuthStore } from '../../../stores/authStore';
import { sanitizeHTML } from '../../../utils/sanitize';
import LabelGroup from '../../../components/ui/LabelGroup';
import ManageLabelsModal from '../../../components/labels/ManageLabelsModal';

type Props = {
  // taskId: string;
}

const TaskInfo: React.FC<Props> = () => {
  const { taskId } = useParams();
  const { user } = useAuthStore();
  
  const [taskData, setTaskData] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState<boolean>(false);
  const [action, setAction] = useState<string>("");
  const [reloadKey, setReloadKey] = useState(0);
  
  // Inline edit states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [statusDescription, setStatusDescription] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  
  // Modal states for editing
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showLabelsModal, setShowLabelsModal] = useState(false);
  
  // Fetch agents for assignment
  const { data: agentsResponse } = useFetchAgents();
  const agents = agentsResponse?.results || [];


  const fetchTask = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await http.get(`${APIS.LOAD_TASK_INFO}${taskId}`);
      setTaskData({ task: response.data });
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || "Failed to load task information";
      setError(errorMessage);
      errorNotification(errorMessage);
    } finally {
      setTimeout(() => setLoading(false), 200);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchTask();
    }
  }, [taskId, reloadKey]);

  // Using shared utility functions from displayHelpers

  const getHeader = ( action: string) => {
    if (action === 'complete-task'){
      return 'Complete Task';
    }else if (action === 'update-status'){
      return 'Update Status';
    }else if (action === 'assign-task'){
      return 'Assign Task';

    }else if(action === 'attach-ticket'){
      return 'Attach Ticket';
    }else {
      return ''
    }
  }

  // Inline status update handler
  const handleStatusUpdate = async () => {
    if (!taskData || !selectedStatus) return;
    try {
      setIsSubmitting(true);
      await http.post(`${APIS.UPDATE_TASK_STATUS}${taskData.task.id}/`, {
        status: selectedStatus,
        description: statusDescription
      });
      successNotification('Task status updated successfully');
      setSelectedStatus("");
      setStatusDescription("");
      setReloadKey(prev => prev + 1);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to update status";
      errorNotification(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inline assign handler
  const handleAssign = async () => {
    if (!taskData || !selectedAgentId) return;
    try {
      setIsSubmitting(true);
      await http.post(`${APIS.ASSIGN_TASK}${taskData.task.id}/`, {
        user_id: Number(selectedAgentId)
      });
      successNotification('Task assigned successfully');
      setSelectedAgentId("");
      setReloadKey(prev => prev + 1);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to assign task";
      errorNotification(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inline priority update handler
  const handlePriorityUpdate = async () => {
    if (!taskData || !selectedPriority) return;
    try {
      setIsSubmitting(true);
      await http.patch(`${APIS.TASK_BASE}/${taskData.task.id}/`, {
        priority: selectedPriority
      });
      successNotification('Task priority updated successfully');
      setSelectedPriority("");
      setReloadKey(prev => prev + 1);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : "Failed to update priority";
      errorNotification(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  



  if (loading) {
    return (<LoadingSkeleton/>);
  }

  if (error || !taskData) {
    return (
      <LoadingSkeleton/>
    );
  }

  const { task } = taskData;

  return (
    <div className="w-full overflow-y-auto space-y-[var(--dashboard-section-gap)] p-[var(--dashboard-card-padding)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 dark:border-subtle bg-white dark:bg-surface-elevated hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-[var(--text-muted)]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
              {task.task_trackid || 'Unknown Task ID'}
            </h1>
            <p className="text-gray-600 dark:text-[var(--text-muted)]">
              Task details and management
            </p>
          </div>
        </div>
      </div>

      {/* Header Section */}
      <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-600 dark:text-[var(--text-muted)] mb-2">
              {task.title || 'Untitled Task'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-[var(--text-muted)] mb-3">
              {task.task_trackid || 'No ID'} • Created {formatRelativeTime(task.created_at)}
            </p>
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(task.task_status)}`}>
                {(task.task_status || 'unknown').replace('_', ' ').toUpperCase()}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                {(task.priority || 'unknown').toUpperCase()}
              </span>
              {task.is_overdue && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700">
                  OVERDUE
                </span>
              )}
              {task.is_completed && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 border border-primary-200 dark:bg-primary-900 dark:text-primary-200 dark:border-primary-700">
                  COMPLETED
                </span>
              )}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-3 flex-wrap gap-2">
            <button 
              onClick={() =>{ 
                  setAction("update-status")
                  setShowDrawer(true)}} 
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-subtle text-sm font-medium rounded-md text-gray-700 dark:text-[var(--text-primary)] bg-white dark:bg-surface-elevated hover:bg-gray-50 dark:hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Update Status
            </button>
            <button 
              onClick={() =>{ 
                  setAction("assign-task")
                  setShowDrawer(true)}} 
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-subtle text-sm font-medium rounded-md text-gray-700 dark:text-[var(--text-primary)] bg-white dark:bg-surface-elevated hover:bg-gray-50 dark:hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              {task.assigned_to ? "Reassign" : "Assign"} Task
            </button>
            <button 
              onClick={() =>{ 
                  setAction("attach-ticket")
                  setShowDrawer(true)}} 
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-subtle text-sm font-medium rounded-md text-gray-700 dark:text-[var(--text-primary)] bg-white dark:bg-surface-elevated hover:bg-gray-50 dark:hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Link className="w-4 h-4 mr-2" />
              {task.linked_ticket ? "Change Ticket" : "Attach to Ticket"}
            </button>
            <button
              onClick={() => setShowLabelsModal(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-subtle text-sm font-medium rounded-md text-gray-700 dark:text-[var(--text-primary)] bg-white dark:bg-surface-elevated hover:bg-gray-50 dark:hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Tag className="w-4 h-4 mr-2" />
              Manage Labels
            </button>
          </div>
        </div>

        {/* Task Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Creator Info */}
          <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:border-blue-800 dark:from-blue-900/20 dark:to-indigo-900/20">
            <div className="mb-3 flex items-center">
              <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)]">Created By</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                <User className="w-4 h-4 mr-2" />
                {task.created_by ? task.created_by.name: 'Unknown User'}
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                <Mail className="w-4 h-4 mr-2" />
                {task.created_by?.email || 'No email'}
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                <Phone className="w-4 h-4 mr-2" />
                {task.created_by?.phone_number || 'No phone'}
              </div>
            </div>
          </div>

          {/* Assignment Info */}
          <div className="rounded-lg border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50 p-4 dark:border-sky-800 dark:from-sky-900/20 dark:to-cyan-900/20">
            <div className="mb-3 flex items-center">
              <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900">
                <UserCheck className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)]">Assignment</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                <User className="w-4 h-4 mr-2" />
                {user?.role?.toUpperCase() === "ADMIN" ? (
                  <span 
                    onClick={() => setShowAssignModal(true)} 
                    className="cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                    title={task.assigned_to ? 'Click to reassign' : 'Click to assign'}
                  >
                    {formatUserDisplayName(task.assigned_to, 'Unassigned')}
                    <Edit3 size={12} className="inline ml-1 opacity-50" />
                  </span>
                ) : (
                  <span>{formatUserDisplayName(task.assigned_to, 'Unassigned')}</span>
                )}
              </div>
              <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                <Tag className="w-4 h-4 mr-2" />
                {task.department?.name || 'No department'}
              </div>
              {/* Priority with inline edit */}
              <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                <AlertTriangle className="w-4 h-4 mr-2" />
                {user?.role?.toUpperCase() === "ADMIN" ? (
                  <span 
                    onClick={() => setShowPriorityModal(true)}
                    className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${getPriorityColor(task.priority)}`}
                    title="Click to change priority"
                  >
                    {(task.priority || 'unknown').toUpperCase()}
                    <Edit3 size={10} className="inline ml-1 opacity-50" />
                  </span>
                ) : (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                    {(task.priority || 'unknown').toUpperCase()}
                  </span>
                )}
              </div>
              {/* Status with inline edit */}
              <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span 
                  onClick={() => setShowStatusModal(true)}
                  className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(task.task_status)}`}
                  title="Click to change status"
                >
                  {(task.task_status || 'unknown').replace('_', ' ').toUpperCase()}
                  <Edit3 size={10} className="inline ml-1 opacity-50" />
                </span>
              </div>
              {task.linked_ticket && (
                <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                  <Link className="w-4 h-4 mr-2" />
                  <span className="text-primary-600 dark:text-primary-400">
                    {task.linked_ticket.ticket_id || 'Unknown Ticket'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Info */}
          <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 p-4 dark:border-purple-800 dark:from-purple-900/20 dark:to-violet-900/20">
            <div className="mb-3 flex items-center">
              <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)]">Timeline</h3>
            </div>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                  <Calendar className="w-4 h-4 mr-2" />
                Created: {formatDateWithTime(task.created_at)}
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                  <Clock className="w-4 h-4 mr-2" />
                Due: {formatDate(task.due_date)}
              </div>
              {task.completed_at && (
                <div className="flex items-center text-sm text-gray-600 dark:text-[var(--text-muted)]">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Completed: {formatDate(task.completed_at)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mt-6">
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-subtle dark:bg-surface">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">
              <Tag className="h-4 w-4" />
              Labels
            </div>
            <LabelGroup labels={task.labels || []} size="md" emptyText="No labels assigned" />
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] mb-3">Description</h3>
          <div className="bg-gray-50 dark:bg-surface rounded-lg p-4">
            <div
              className="sd-rich-content max-w-none overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(task.description || '<span>No description provided</span>') }}
            />
          </div>
        </div>

        {/* Linked Ticket */}
        {task.linked_ticket && (
          <RouterLink 
            to={`/ticket/${encodeURIComponent(task.linked_ticket.ticket_id || String(task.linked_ticket.id))}`}
            className="block mt-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors cursor-pointer"
          >
            <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] mb-2 flex items-center">
              <Link className="w-4 h-4 mr-2" />
              Linked Ticket
            </h3>
            <div className="text-sm text-gray-600 dark:text-[var(--text-muted)]">
              <span className="font-medium text-primary-600 dark:text-primary-400">
                {task.linked_ticket.ticket_id || 'Unknown ID'}
              </span>
              {' - '}
              {task.linked_ticket.title || 'No title'}
              <div className="mt-1 flex items-center space-x-2">
                <span className={`px-2 py-1 rounded text-xs ${getStatusColor(task.linked_ticket.status)}`}>
                  {(task.linked_ticket.status || 'unknown').toUpperCase()}
                </span>
                <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(task.linked_ticket.priority)}`}>
                  {(task.linked_ticket.priority || 'unknown').toUpperCase()}
                </span>
              </div>
            </div>
          </RouterLink>
        )}
      </div>

      {/* Activity Stream */}
      <div className="bg-[var(--card-bg)] rounded-[var(--shell-radius)] border border-[var(--border-color)] p-6">
        <TaskActivityStream
          taskId={task.id}
          reloader={reloadKey}
          isCustomerView={false}
        />
      </div>

      {/* Attachments Section */}
      <div className="bg-[var(--card-bg)] rounded-[var(--shell-radius)] border border-[var(--border-color)] p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center">
            <Paperclip className="w-5 h-5 mr-2" />
            Attachments ({task.attachments?.length || 0})
          </h2>
        </div>

        {task.attachments.length === 0 ? (
          <p className="text-[var(--text-muted)] text-center py-8">No attachments</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {task.attachments.map((attachment) => (
              <div key={attachment.id} className="border border-[var(--border-color)] rounded-[var(--shell-radius)] p-4 hover:bg-[var(--surface-hover)]">
                <div className="flex items-center space-x-3">
                  <Paperclip className="w-5 h-5 text-[var(--text-muted)]" />
                  <div className="flex-1 min-w-0">
                    <a
                      href={attachment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[length:var(--font-meta)] text-primary-600 hover:text-primary-800 truncate block"
                    >
                      {attachment.description || `Attachment ${attachment.id}`}
                    </a>
                    <p className="text-[length:var(--font-meta)] text-[var(--text-muted)] mt-1">
                      {formatDate(attachment.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drawer */}
      <Drawer  showBackdrop={true} title={getHeader(action)} close={() => setShowDrawer(false)} isOpen={showDrawer} size='sm' content={
        action === 'update-status' ? (
          <TaskStatusUpdate
            taskId={taskData.task.id}
            close={() => setShowDrawer(false)}
            reload={() => setReloadKey(prev => prev + 1)}
          />
        ) : action === 'assign-task' ? (
          <AssignTask
            taskId={taskData.task.id}
            close={() => setShowDrawer(false)}
            reload={() => setReloadKey(prev => prev + 1)}
          />
        ) : action === 'attach-ticket' ? (
          <AttachToTikect
            taskId={taskData.task.id}
            close={() => setShowDrawer(false)}
            reload={() => setReloadKey(prev => prev + 1)}
          />
        ):null
      }
      />

      {/* Assign Modal */}
      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title={task.assigned_to ? 'Reassign Task' : 'Assign Task'}>
        <div className="p-4 min-w-[300px]">
          <Select
            id="assign-agent-modal"
            label="Select Agent"
            value={selectedAgentId}
            onChange={setSelectedAgentId}
            options={[
              { value: "", label: "Choose agent...", disabled: true },
              ...(agents && agents.length > 0
                ? agents
                    .filter((agent: { id: number }) => agent.id !== task.assigned_to?.id)
                    .map((agent: { id: number; name: string }) => ({
                      value: agent.id.toString(),
                      label: agent.name
                    }))
                : [{ value: "", label: "No agents found", disabled: true }]
              )
            ]}
            placeholder="Choose agent..."
            size="sm"
            required
            allowSearch
          />
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--border-color)]">
            <Button size="sm" variant="outline" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => { handleAssign(); setShowAssignModal(false); }}
              disabled={isSubmitting || !selectedAgentId}
            >
              {isSubmitting ? 'Assigning…' : 'Assign'}
            </Button>
          </div>
        </div>
      </Modal>

      <ManageLabelsModal
        entityType="task"
        entityId={task.id}
        isOpen={showLabelsModal}
        onClose={() => setShowLabelsModal(false)}
        selectedLabels={task.labels || []}
        onSaved={(labels) => {
          setTaskData((current) => {
            if (!current) return current;
            return {
              ...current,
              task: {
                ...current.task,
                labels,
              },
            };
          });
          setReloadKey((prev) => prev + 1);
        }}
        title="Manage Labels"
      />

      {/* Priority Modal */}
      <Modal isOpen={showPriorityModal} onClose={() => setShowPriorityModal(false)} title="Change Priority">
        <div className="p-4 min-w-[300px]">
          <Select
            id="priority-select"
            label="Select Priority"
            value={selectedPriority}
            onChange={setSelectedPriority}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
            placeholder="Select Priority"
          />
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--border-color)]">
            <Button size="sm" variant="outline" onClick={() => setShowPriorityModal(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => { handlePriorityUpdate(); setShowPriorityModal(false); }}
              disabled={isSubmitting || !selectedPriority}
            >
              {isSubmitting ? 'Updating…' : 'Update'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Status Modal */}
      <Modal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)} title="Change Status">
        <div className="p-4 min-w-[300px]">
          <Select
            id="status-select"
            label="Select Status"
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={[
              { value: 'todo', label: 'To Do' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'hold', label: 'On Hold' },
              { value: 'completed', label: 'Completed' },
            ]}
            placeholder="Select Status"
          />
          <textarea
            value={statusDescription}
            onChange={(e) => setStatusDescription(e.target.value)}
            placeholder="Add a note (optional)..."
            rows={2}
            className="mt-3 w-full px-3 py-2 rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] text-[length:var(--font-body)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] resize-none"
          />
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--border-color)]">
            <Button size="sm" variant="outline" onClick={() => setShowStatusModal(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => { handleStatusUpdate(); setShowStatusModal(false); }}
              disabled={isSubmitting || !selectedStatus}
            >
              {isSubmitting ? 'Updating…' : 'Update'}
            </Button>
          </div>
        </div>
      </Modal>

      </div>



  )
}
  export default TaskInfo
