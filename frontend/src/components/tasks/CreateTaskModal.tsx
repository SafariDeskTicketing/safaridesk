import React, { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { Upload, X } from 'lucide-react';
import SafariDeskEditor from '../editor/SafariDeskEditor';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { errorNotification, successNotification } from '../ui/Toast';
import { formatFileSize } from '../../utils/helper';
import { emitLocalNotificationCreated, playNotificationSound } from '../../utils/notificationSound';
import LabelPicker from '../ui/LabelPicker';
import { AttachmentTrigger } from '../ui/AttachmentTrigger';
import type { LabelItem } from '../../types';
import { cacheGet, cacheSet } from '../../utils/fetchCache';
import { isRichTextEmpty } from '../../utils/richText';
import { TITLE_MAX_LENGTH, getTitleLengthMessage } from '../../utils/validationLimits';
import { getActiveAgents } from '../../services/agents';

interface Agent {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
}

interface NewTask {
  title: string;
  assigned_to: string;
  description: string;
  due_date: string;
  department?: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface CreateTaskModalProps {
  reload?: () => void;
  onclose?: () => void;
  onSuccess?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  ticketId?: number;
}

interface Ticket {
  id: number;
  ticket_id: string;
  title: string;
}

type TaskFieldErrors = {
  title?: string;
  description?: string;
  due_date?: string;
  department?: string;
  assigned_to?: string;
};

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  reload,
  onclose,
  onSuccess,
  onDirtyChange,
  ticketId,
}) => {
  // Form state
  const [newTask, setNewTask] = useState<NewTask>({
    title: '',
    assigned_to: '',
    description: '',
    due_date: '',
    department: undefined,
    priority: 'medium',
  });

  const [agents, setAgents] = useState<Agent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [selectedOption, setSelectedOption] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Field-specific error state for highlighting
  const [fieldErrors, setFieldErrors] = useState<TaskFieldErrors>({});

  // Track dirty state
  useEffect(() => {
    const isDirty = Boolean(
      newTask.title.trim() ||
      newTask.description.trim() ||
      newTask.due_date ||
      newTask.department ||
      selectedOption ||
      selectedTicketId ||
      selectedLabelIds.length > 0 ||
      newTask.priority !== 'medium' ||
      attachments.length > 0
    );
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [newTask, selectedOption, selectedTicketId, selectedLabelIds, attachments, onDirtyChange]);

  const fetchAgents = async () => {
    // Fetch fresh agents first; fallback to cache on network error.
    setLoadingAgents(true);
    try {
      const r = await http.get(`${APIS.LIST_AGENTS}?pagination=no`);
      const activeAgents = getActiveAgents(r.data);
      cacheSet('modal:agents', activeAgents);
      setAgents(activeAgents);
    } catch {
      const cached = cacheGet<Agent[]>('modal:agents');
      if (cached) {
        setAgents(getActiveAgents(cached));
      } else {
        setAgents([]);
      }
    } finally {
      setLoadingAgents(false);
    }
  };

  const fetchDepartments = async () => {
    const cached = cacheGet<Department[]>('modal:departments');
    if (cached) {
      setDepartments(cached);
      void http.get(`${APIS.LIST_DEPARTMENTS}?pagination=no`).then(r => { cacheSet('modal:departments', r.data); setDepartments(r.data); }).catch(() => {});
      return;
    }
    setLoadingDepartments(true);
    try {
      const r = await http.get(`${APIS.LIST_DEPARTMENTS}?pagination=no`);
      cacheSet('modal:departments', r.data);
      setDepartments(r.data);
    } catch { /* silent */ } finally { setLoadingDepartments(false); }
  };

  const fetchTickets = async () => {
    if (ticketId) return;
    const cached = cacheGet<Ticket[]>('modal:tickets');
    if (cached) {
      setTickets(cached);
      void http.get(`${APIS.LIST_TICKETS}?pagination=no`).then(r => { const d = r.data.results || r.data; cacheSet('modal:tickets', d); setTickets(d); }).catch(() => {});
      return;
    }
    setLoadingTickets(true);
    try {
      const r = await http.get(`${APIS.LIST_TICKETS}?pagination=no`);
      const d = r.data.results || r.data;
      cacheSet('modal:tickets', d);
      setTickets(d);
    } catch { /* silent */ } finally { setLoadingTickets(false); }
  };

  const fetchLabels = async () => {
    const cached = cacheGet<LabelItem[]>('modal:labels');
    if (cached) {
      setLabels(cached);
      void http.get(APIS.LABELS_BASE, { params: { pagination: 'no', active_only: true } }).then(r => { const d = r.data?.results || r.data || []; cacheSet('modal:labels', d); setLabels(d); }).catch(() => {});
      return;
    }
    setLoadingLabels(true);
    try {
      const r = await http.get(APIS.LABELS_BASE, { params: { pagination: 'no', active_only: true } });
      const d = r.data?.results || r.data || [];
      cacheSet('modal:labels', d);
      setLabels(d);
    } catch { /* silent */ } finally { setLoadingLabels(false); }
  };

  useEffect(() => {
    fetchAgents();
    fetchDepartments();
    fetchLabels();
    fetchTickets();
  }, []);

  const handleInputChange = (field: keyof NewTask, value: string | number | undefined) => {
    setNewTask(prev => ({
      ...prev,
      [field]: value,
    } as NewTask));
    if (fieldErrors[field as keyof TaskFieldErrors]) {
      setFieldErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateTask = async () => {
    // Reset errors
    setFieldErrors({});
    setError(null);

    // Validate required fields with specific messages
    const errors: TaskFieldErrors = {};

    if (!newTask.title.trim()) {
      errors.title = 'Task title is required';
    } else if (newTask.title.trim().length > TITLE_MAX_LENGTH) {
      errors.title = getTitleLengthMessage('Task');
    }
    if (isRichTextEmpty(newTask.description)) {
      errors.description = 'Description is required';
    }
    if (!newTask.due_date) {
      errors.due_date = 'Due date is required';
    }
    if (!newTask.department) {
      errors.department = 'Please select a department';
    }
    if (!selectedOption) {
      errors.assigned_to = 'Please assign the task to an agent';
    }

    // If any validation errors, set them and show summary
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const errorMessages = Object.values(errors);
      setError(errorMessages.length === 1
        ? errorMessages[0]
        : `Please fix the following: ${errorMessages.join(', ')}`
      );
      return;
    }

    setCreating(true);

    try {
      // Defensive check: if an assignee is selected, verify they're still active
      if (selectedOption) {
        const selectedAgent = agents.find(a => a.id.toString() === selectedOption);
        if (!selectedAgent) {
          setError('The selected agent is no longer available. This agent may have been deactivated or deleted. Please select a different agent.');
          setCreating(false);
          return;
        }
      }

      const formData = new FormData();
      formData.append('title', newTask.title.trim());
      formData.append('description', newTask.description);
      formData.append('due_date', newTask.due_date);
      formData.append('department_id', String(newTask.department));
      formData.append('priority', newTask.priority);

      if (selectedOption) {
        formData.append('assigned_to', selectedOption);
      }

      selectedLabelIds.forEach((labelId) => {
        formData.append('label_ids[]', String(labelId));
      });

      attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      const response = await http.post(APIS.CREATE_TASK, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const createdTaskId = response?.data?.task?.id;

      // Handle ticket linking if ticketId prop exists OR user selected a ticket
      const ticketToLink = ticketId || (selectedTicketId ? parseInt(selectedTicketId) : null);

      if (ticketToLink) {
        if (!createdTaskId) {
          setError('Task was created but could not be linked to the ticket (missing task id).');
          return;
        }

        try {
          await http.post(`${APIS.ATTACH_TASK_TO_TICKET}${createdTaskId}/`, {
            ticket_id: ticketToLink,
          });
        } catch (attachError) {
          const attachMessage = (attachError as ApiError)?.response?.data?.message || 'Task created but failed to attach to ticket';
          errorNotification(attachMessage);
          setError(attachMessage);
          return;
        }
      }

      successNotification(ticketToLink ? 'Task created and attached to ticket' : (response.data.message || 'Task created successfully'));
      void playNotificationSound(newTask.priority, 'local-create');
      emitLocalNotificationCreated();

      // Call reload to refresh the task list
      if (reload) {
        await reload();
      }

      // Close modal - call onSuccess (bypasses dirty check) or fall back to onclose
      if (onSuccess) {
        onSuccess();
      } else if (onclose) {
        onclose();
      }

    } catch (error) {
      console.error('Create task error:', error);
      const errorMessage = (error as ApiError)?.response?.data?.message || 'Failed to create task';
      errorNotification(errorMessage);
      setError(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl space-y-3">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,2.2fr)_300px] lg:items-start lg:divide-x lg:divide-[var(--border-color)]">
          {/* Left column */}
          <div className="flex flex-col space-y-3 py-3 pr-3 lg:pr-4">
            <h3 className="text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">Task Details</h3>
            <div>
              <Input
                label="Title"
                placeholder="Task title"
                fullWidth
                value={newTask.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={fieldErrors.title ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
              />
              {fieldErrors.title && (
                <p className="mt-1 text-[14px] text-red-500">{fieldErrors.title}</p>
              )}
              {newTask.title.trim().length > TITLE_MAX_LENGTH && (
                <p className="mt-1 text-[14px] text-red-500">
                  {newTask.title.trim().length}/{TITLE_MAX_LENGTH} characters
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 ">
              <div>
                <Input
                  label="Due Date"
                  type="datetime-local"
                  value={newTask.due_date}
                  onChange={(e) => handleInputChange('due_date', e.target.value)}
                  className={`[&::-webkit-calendar-picker-indicator]:dark:invert ${fieldErrors.due_date ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                />
                {fieldErrors.due_date && (
                  <p className="mt-1 text-[14px] text-red-500">{fieldErrors.due_date}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
                Description
              </label>
              <SafariDeskEditor
                content={newTask.description}
                onChange={(content) => handleInputChange('description', content)}
                className={`min-h-[200px] ${fieldErrors.description ? 'ring-2 ring-[var(--status-danger-text)]' : ''}`}
              />
              {fieldErrors.description && (
                <p className="mt-1 text-[14px] text-red-500">{fieldErrors.description}</p>
              )}
            </div>

            {/* Minimal attachments row */}
            <div className="flex flex-wrap items-center justify-between rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-subtle dark:bg-surface-elevated dark:text-[var(--text-primary)]">
              <div className="flex flex-wrap items-center gap-2">
                <AttachmentTrigger>
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={handleFileUpload}
                    accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
                  />
                </AttachmentTrigger>
                <span className="text-[14px] text-gray-500 dark:text-[var(--text-primary)]">
                  {attachments.length} file{attachments.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-[14px] text-gray-500 dark:text-[var(--text-primary)]">
                  <span>Files</span>
                </div>
                <div className="space-y-2">
                  {attachments.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded-lg bg-gray-50 p-2 dark:bg-surface-elevated"
                    >
                      <div className="flex items-center space-x-2">
                        <Upload className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">{file.name}</p>
                          <p className="text-[14px] text-gray-500 dark:text-[var(--text-primary)]">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors duration-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right rail */}
          <div className="w-full flex flex-col">
            <div className="w-full space-y-3 py-3 pl-3 lg:pl-4">
              <div className="border-b border-[var(--border-color)] pb-2">
                <h4 className="text-[length:var(--font-label)] font-semibold text-[var(--text-primary)]">Task Settings</h4>
              </div>
              <div className="space-y-2">
                <Select
                  label="Priority"
                  value={newTask.priority}
                  onChange={(value) => handleInputChange('priority', value as NewTask['priority'])}
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'urgent', label: 'Urgent' },
                  ]}
                  size="md"
                />
              </div>

              <div className="space-y-2">
                <Select
                  label="Department"
                  disabled={loadingDepartments}
                  value={newTask.department ? String(newTask.department) : ''}
                  onChange={(value) => handleInputChange('department', value ? Number(value) : undefined)}
                  options={departments.map((department) => ({
                    value: String(department.id),
                    label: department.name,
                  }))}
                  placeholder={loadingDepartments ? 'Loading departments...' : 'Select a department'}
                  allowSearch
                  size="md"
                  error={fieldErrors.department}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Labels</label>
                  {loadingLabels && <span className="text-[14px] text-gray-500">Loading...</span>}
                </div>
                <LabelPicker
                  availableLabels={labels}
                  selectedLabelIds={selectedLabelIds}
                  selectedLabels={labels.filter((labelItem) => selectedLabelIds.includes(labelItem.id))}
                  onChange={setSelectedLabelIds}
                  helperText="Shared with tickets."
                  emptyText="No labels found."
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Assignee</label>
                  {loadingAgents && <span className="text-[14px] text-gray-500">Loading...</span>}
                </div>
                <Select
                  value={selectedOption}
                  onChange={setSelectedOption}
                  options={agents.map((agent) => ({
                    value: String(agent.id),
                    label: agent.name,
                  }))}
                  placeholder={loadingAgents ? 'Loading agents...' : 'Select an assignee'}
                  allowSearch
                  disabled={loadingAgents}
                  size="md"
                  error={fieldErrors.assigned_to}
                />
              </div>

              {/* Link to Ticket - Only show if not already linked via ticketId prop */}
              {!ticketId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">
                      Link to Ticket <span className="text-[14px] font-normal text-gray-500">(Optional)</span>
                    </label>
                    {loadingTickets && <span className="text-[14px] text-gray-500">Loading...</span>}
                  </div>
                  <Select
                    value={selectedTicketId}
                    onChange={setSelectedTicketId}
                    options={[
                      { value: '', label: 'None (skip linking)' },
                      ...tickets.map((ticket) => ({
                        value: String(ticket.id),
                        label: `${ticket.ticket_id} - ${ticket.title}`,
                      })),
                    ]}
                    placeholder={loadingTickets ? 'Loading tickets...' : 'None (skip linking)'}
                    allowSearch
                    disabled={loadingTickets}
                    size="md"
                  />
                  <p className="text-[14px] text-gray-500 dark:text-[var(--text-primary)]">
                    Optionally link this task to an existing ticket
                  </p>
                </div>
              )}
            </div>
            
            <div className="mt-auto mx-4 pt-4 flex items-center justify-between gap-2.5 border-t border-gray-200 dark:border-subtle">
              <Button onClick={onclose} variant="outline" disabled={creating}>
                Cancel
              </Button>
              <Button onClick={handleCreateTask} disabled={creating}>
                {creating ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateTaskModal;
