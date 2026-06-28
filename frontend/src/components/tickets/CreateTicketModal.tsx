import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, File as FileIcon } from 'lucide-react';
import SafariDeskEditor from '../editor/SafariDeskEditor';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { errorNotification, successNotification } from '../ui/Toast';
import { useAuthStore } from '../../stores/authStore';
import { useValidateDomain } from '../../hooks/useValidateDomain';
import { formatFileSize } from '../../utils/helper';
import { emitLocalNotificationCreated, playNotificationSound } from '../../utils/notificationSound';
import { Input } from '../ui/Input';
import Button from '../ui/Button';
import Select from '../ui/Select';
import LabelPicker from '../ui/LabelPicker';
import { AttachmentTrigger } from '../ui/AttachmentTrigger';
import type { LabelItem } from '../../types';
import { cacheGet, cacheSet } from '../../utils/fetchCache';
import { TITLE_MAX_LENGTH, getTitleLengthMessage } from '../../utils/validationLimits';
import { getApiErrorMessage } from '../../utils/apiError';
import { getActiveAgents } from '../../services/agents';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILE_COUNT = 5;
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf', 'doc', 'docx'];

const createTicketSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(TITLE_MAX_LENGTH, getTitleLengthMessage('Ticket')),
  creator_name: z.string().min(1, 'Creator name is required'),
  creator_phone: z.string().min(1, 'Phone number is required'),
  creator_email: z.string().email('Invalid email format'),
  description: z.string().min(1, 'Description is required'),
  category: z.preprocess(
    (val) => (val === '' || val === undefined || Number.isNaN(Number(val)) ? undefined : Number(val)),
    z.number({ required_error: 'Category is required' }).min(1, 'Category is required')
  ),
  department: z.preprocess(
    (val) => (val === '' || val === undefined || Number.isNaN(Number(val)) ? undefined : Number(val)),
    z.number({ required_error: 'Department is required' }).min(1, 'Department is required')
  ),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  is_public: z.boolean(),
  assignee_id: z.number().positive().optional(),
  label_ids: z.array(z.number()).optional().default([]),
});

type CreateTicketFormData = z.infer<typeof createTicketSchema>;

interface Category {
  id: number;
  name: string;
  description: string;
  department?: number | null;
  created_at: string;
  updated_at: string;
}

interface Department {
  id: number;
  name: string;
  slag: string;
  created_at: string;
}

interface Agent {
  id: number;
  name: string;
}

type TicketFormVariant = 'internal' | 'customer';

interface CreateTicketModalProps {
  reload?: () => void;
  onclose?: () => void;
  onSuccess?: () => void;
  loadFromApi?: boolean;
  categories?: Category[];
  departments?: Department[];
  onDirtyChange?: (isDirty: boolean) => void;
  variant?: TicketFormVariant;
}

const getExtension = (fileName: string) => {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
};

const isAllowedFile = (file: File) => {
  const ext = getExtension(file.name);
  return ALLOWED_EXTENSIONS.includes(ext);
};

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  reload,
  onclose,
  onSuccess,
  loadFromApi = true,
  categories: propCategories,
  departments: propDepartments,
  onDirtyChange,
  variant = 'internal',
}) => {
  const { user } = useAuthStore();
  const { businessId } = useValidateDomain();

  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>(propCategories || []);
  const [departments, setDepartments] = useState<Department[]>(propDepartments || []);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentErrors, setAttachmentErrors] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingLabels, setLoadingLabels] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    resetField,
    setValue,
    control,
    watch,
  } = useForm<CreateTicketFormData>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      title: '',
      creator_name: '',
      creator_phone: '',
      creator_email: '',
      description: '',
      category: undefined,
      department: undefined,
      priority: 'medium',
      is_public: false,
      assignee_id: undefined,
      label_ids: [],
    },
  });

  const watchedLabelIds = watch('label_ids', []);
  const watchedAssignee = watch('assignee_id');
  const watchedDepartment = watch('department');
  const watchedCategory = watch('category');
  const watchedPriority = watch('priority', 'medium');
  const watchedTitle = watch('title', '');

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (user) {
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      if (fullName) {
        setValue('creator_name', fullName);
      }
      if (user.email) {
        setValue('creator_email', user.email);
      }
      if (user.phone_number) {
        setValue('creator_phone', user.phone_number);
      }
    }
  }, [user, setValue]);

  const fetchCategories = async () => {
    const cached = cacheGet<Category[]>('modal:categories');
    if (cached) {
      setCategories(cached);
      void http.get(`${APIS.LIST_TICKET_CATEGORIES}?pagination=no`).then(r => { cacheSet('modal:categories', r.data); setCategories(r.data); }).catch(() => {});
      return;
    }
    setLoadingCategories(true);
    try {
      const r = await http.get(`${APIS.LIST_TICKET_CATEGORIES}?pagination=no`);
      cacheSet('modal:categories', r.data);
      setCategories(r.data);
    } catch { /* silent */ } finally { setLoadingCategories(false); }
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

  const fetchAgents = async () => {
    // Try to fetch a fresh list first. If the network request fails,
    // fall back to any cached agents to avoid showing stale deleted/deactivated users.
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
    if (variant !== 'customer' && loadFromApi && user) {
      fetchCategories();
      fetchDepartments();
      fetchAgents();
      fetchLabels();
    } else if (propCategories && propDepartments) {
      setCategories(propCategories);
      setDepartments(propDepartments);
    }
  }, [user, loadFromApi, propCategories, propDepartments, variant]);

  const filteredCategories = useMemo(() => {
    if (!watchedDepartment) return categories;
    const deptId = Number(watchedDepartment);
    return categories.filter(
      (cat) => cat.department == null || cat.department === deptId
    );
  }, [categories, watchedDepartment]);

  useEffect(() => {
    if (!watchedDepartment || !watchedCategory) return;
    const deptId = Number(watchedDepartment);
    const selectedCategory = categories.find((cat) => cat.id === Number(watchedCategory));
    if (selectedCategory && selectedCategory.department != null && selectedCategory.department !== deptId) {
      resetField('category');
    }
  }, [categories, resetField, watchedCategory, watchedDepartment]);

  const resetFormState = () => {
    reset({
      title: '',
      creator_name: '',
      creator_phone: '',
      creator_email: '',
      description: '',
      category: undefined,
      department: undefined,
      priority: 'medium',
      is_public: false,
      assignee_id: undefined,
      label_ids: [],
    });
    if (user) {
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      if (fullName) {
        setValue('creator_name', fullName);
      }
      if (user.email) {
        setValue('creator_email', user.email);
      }
      if (user.phone_number) {
        setValue('creator_phone', user.phone_number);
      }
    }
    setAttachments([]);
    setAttachmentErrors([]);
    // Call onSuccess (bypasses dirty check) or fall back to onclose
    if (onSuccess) {
      onSuccess();
    } else if (onclose) {
      onclose();
    }
  };

  const validateFile = (file: File): string | null => {
    if (!isAllowedFile(file)) {
      return `${file.name} is not an allowed file type`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} exceeds ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB limit`;
    }
    return null;
  };

  const addFiles = (files: File[]) => {
    const newErrors: string[] = [];
    const validFiles: File[] = [];
    const totalCount = attachments.length + files.length;

    if (totalCount > MAX_FILE_COUNT) {
      newErrors.push(`You can only upload up to ${MAX_FILE_COUNT} files.`);
    }

    files.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        newErrors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    if (validFiles.length > 0 && attachments.length + validFiles.length <= MAX_FILE_COUNT) {
      setAttachments((prev) => [...prev, ...validFiles]);
    }

    setAttachmentErrors(newErrors);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    addFiles(files);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: CreateTicketFormData) => {
    if (attachments.length > MAX_FILE_COUNT) {
      setAttachmentErrors([`You can only upload up to ${MAX_FILE_COUNT} files.`]);
      return;
    }

    setIsLoading(true);
    setAttachmentErrors([]);
    try {
      // Defensive check: if an assignee is selected, verify they're still active
      if (data.assignee_id) {
        const selectedAgent = agents.find(a => a.id === data.assignee_id);
        if (!selectedAgent) {
          errorNotification('The selected agent is no longer available. This agent may have been deactivated or deleted. Please select a different agent.');
          setIsLoading(false);
          return;
        }
      }

      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'assignee_id') {
          if (typeof value === 'number' && !Number.isNaN(value)) {
            formData.append('assignee_id', value.toString());
          }
          return;
        }
        if (key === 'label_ids') {
          return;
        }

        // Map fields for customer/public API expectations
        if (variant === 'customer') {
          if (key === 'category') {
            formData.append('category_id', value.toString());
            return;
          }
          if (key === 'department') {
            formData.append('department_id', value.toString());
            return;
          }
        }

        formData.append(key, value.toString());
      });

      if (watchedLabelIds && watchedLabelIds.length > 0) {
        watchedLabelIds.forEach((labelId) => formData.append('label_ids[]', String(labelId)));
      }

      const defaultSource = user ? 'web' : 'customer_portal';
      formData.append('source', defaultSource);
      if (!user && businessId) {
        formData.append('business_id', businessId.toString());
      }

      attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      const url = user ? APIS.CREATE_TICKET : APIS.CUSTOMER_CREATE_TICKET;
      const response = await http.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const ticketId = response?.data?.ticket_id;
      const duplicateDetection = response?.data?.duplicate_detection;

      const emailAddress = data.creator_email?.trim();
      const customerSubmissionMsg = `A confirmation email has been sent to ${emailAddress || 'your email address'}.`;
      const customerEmailMsg = ticketId
        ? duplicateDetection?.status === 'auto_merged'
          ? `${response.data.message}. Active ticket reference number ${ticketId}.`
          : `Ticket has been successfully submitted! Ticket #${ticketId} has been created.`
        : 'Ticket has been successfully submitted!';

      const defaultSuccessMsg = ticketId
        ? duplicateDetection?.status === 'auto_merged'
          ? `${response.data.message}. Active ticket reference number ${ticketId}`
          : `${response.data.message} with ticket reference number ${ticketId}`
        : response.data.message;

      if (variant === 'customer') {
        successNotification(customerSubmissionMsg, { duration: 5000 });
        setTimeout(() => {
          successNotification(customerEmailMsg, { duration: 5000 });
        }, 250);
      } else {
        successNotification(defaultSuccessMsg);
        void playNotificationSound(data.priority, 'local-create');
        emitLocalNotificationCreated();
      }

      window.dispatchEvent(
        new CustomEvent('ticket_event', {
          detail: {
            ticket_id: ticketId ? String(ticketId) : undefined,
            action: 'created',
          },
        })
      );

      if (reload) {
        await reload();
      }
      resetFormState();
    } catch (error: unknown) {
      errorNotification(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const renderAttachmentErrors = () => {
    if (attachmentErrors.length === 0) return null;
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
        {attachmentErrors.map((err, idx) => (
          <p key={idx}>{err}</p>
        ))}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-sm">
      <div className="mx-auto w-full max-w-6xl space-y-3">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,2.2fr)_300px] lg:items-start lg:divide-x lg:divide-[var(--border-color)]">
          {/* Left column */}
          <div className="flex flex-col space-y-3 py-3 pr-3 lg:pr-4">
            <h3 className="text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">Basic Information</h3>
            <Input
              label="Title"
              fullWidth
              {...register('title')}
              error={errors.title?.message}
              placeholder="Add a clear, concise title"
            />
            {watchedTitle.trim().length > TITLE_MAX_LENGTH && (
              <p className="-mt-2 text-[14px] text-[var(--status-danger-text)]">
                {watchedTitle.trim().length}/{TITLE_MAX_LENGTH} characters
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Your Name"
                fullWidth
                {...register('creator_name')}
                error={errors.creator_name?.message}
                placeholder="Enter your full name"
              />
              <Input
                label="Phone Number"
                fullWidth
                {...register('creator_phone')}
                error={errors.creator_phone?.message}
                placeholder="Enter your phone number"
              />
            </div>

            <Input
              label="Email Address"
              type="email"
              fullWidth
              {...register('creator_email')}
              error={errors.creator_email?.message}
              placeholder="Enter your email address"
            />

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)]">Description</label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-subtle">
                    <SafariDeskEditor
                      content={field.value}
                      onChange={(content) => field.onChange(content)}
                      className="min-h-[200px]"
                    />
                  </div>
                )}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description.message}</p>
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
                <span className="text-[14px] text-gray-500 dark:text-[var(--text-muted)]">
                  {attachments.length}/{MAX_FILE_COUNT} · {(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB each
                </span>
              </div>
              {attachmentErrors.length > 0 && (
                <span className="text-[14px] text-red-600 dark:text-red-400">{attachmentErrors[0]}</span>
              )}
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-[14px] text-gray-500 dark:text-[var(--text-muted)]">
                  <span>Files</span>
                </div>
                <div className="space-y-2">
                  {attachments.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded-lg bg-gray-50 p-2 dark:bg-surface-elevated"
                    >
                      <div className="flex items-center space-x-2">
                        <FileIcon className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)]">{file.name}</p>
                          <p className="text-[14px] text-gray-500 dark:text-[var(--text-muted)]">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="p-1 text-gray-400 transition-colors duration-150 hover:text-red-500"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {renderAttachmentErrors()}
          </div>

          {/* Right rail */}
          <div className="w-full flex flex-col">
            <div className="w-full flex flex-col space-y-3 py-3 pl-3 lg:pl-4">
              <div className="border-b border-[var(--border-color)] pb-2">
                <h4 className="text-[length:var(--font-label)] font-semibold text-[var(--text-primary)]">Ticket Settings</h4>
              </div>
              <div className="space-y-2">
                <Select
                  label="Priority"
                  value={watchedPriority}
                  onChange={(value) => setValue('priority', value as CreateTicketFormData['priority'], { shouldDirty: true, shouldValidate: true })}
                  options={[
                    { value: 'critical', label: 'Critical' },
                    { value: 'high', label: 'High' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'low', label: 'Low' },
                  ]}
                  size="md"
                />
              </div>

              <div className="space-y-2">
                <div className="space-y-3">
                  <Select
                    label="Department"
                    value={watchedDepartment ? String(watchedDepartment) : ''}
                    onChange={(value) => {
                      setValue('department', value ? Number(value) : undefined, { shouldDirty: true, shouldValidate: true });
                      resetField('category');
                    }}
                    options={departments.map((department) => ({
                      value: String(department.id),
                      label: department.name,
                    }))}
                    placeholder={loadFromApi && loadingDepartments ? 'Loading departments...' : 'Select a department'}
                    allowSearch
                    disabled={loadFromApi ? loadingDepartments : false}
                    size="md"
                    error={errors.department?.message}
                  />

                  {watchedDepartment && (
                    <Select
                      label="Category"
                      value={watchedCategory ? String(watchedCategory) : ''}
                      onChange={(value) => setValue('category', value ? Number(value) : undefined, { shouldDirty: true, shouldValidate: true })}
                      options={filteredCategories.map((category) => ({
                        value: String(category.id),
                        label: category.name,
                      }))}
                      placeholder={loadFromApi && loadingCategories ? 'Loading categories...' : 'Select a category'}
                      allowSearch
                      disabled={loadFromApi ? loadingCategories : false}
                      size="md"
                      error={errors.category?.message}
                    />
                  )}
                </div>
              </div>

              {/* Visibility - only show for internal agents, not on helpcenter */}
              {!window.location.pathname.startsWith('/helpcenter') && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Visibility</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="is_public"
                      {...register('is_public')}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="is_public" className="text-sm text-gray-700 dark:text-[var(--text-primary)]">
                      Make this ticket public
                    </label>
                  </div>
                </div>
              )}

              {variant !== 'customer' && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Assignee</label>
                      {loadingAgents && <span className="text-[14px] text-gray-500 dark:text-[var(--text-muted)]">Loading...</span>}
                    </div>
                    <Select
                      value={watchedAssignee ? String(watchedAssignee) : ''}
                      onChange={(val) => {
                        if (!val) {
                          setValue('assignee_id', undefined, { shouldDirty: true, shouldValidate: true });
                        } else {
                          const num = Number(val);
                          setValue('assignee_id', Number.isNaN(num) ? undefined : num, { shouldDirty: true, shouldValidate: true });
                        }
                      }}
                      options={[
                        { value: '', label: 'Unassigned' },
                        ...agents.map((agent) => ({
                          value: agent.id.toString(),
                          label: agent.name,
                        })),
                      ]}
                      placeholder="Select an assignee"
                      allowSearch
                      size="md"
                      className="w-full text-sm placeholder:text-gray-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Labels</label>
                      {loadingLabels && <span className="text-[14px] text-gray-500 dark:text-[var(--text-muted)]">Loading...</span>}
                    </div>
                    <LabelPicker
                      availableLabels={labels}
                      selectedLabelIds={watchedLabelIds}
                      selectedLabels={labels.filter((labelItem) => watchedLabelIds.includes(labelItem.id))}
                      onChange={(nextLabelIds) => setValue('label_ids', nextLabelIds, { shouldDirty: true, shouldValidate: true })}
                      helperText="Choose shared labels for this ticket."
                      emptyText="No labels found."
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="mt-auto mx-4 pt-4 flex items-center justify-between gap-2.5 border-t border-gray-200 dark:border-subtle">
              <Button type="button" variant="outline" onClick={resetFormState}>
                Cancel
              </Button>
              <Button type="submit" loading={isLoading} disabled={isLoading || attachmentErrors.length > 0}>
                Create Ticket
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
