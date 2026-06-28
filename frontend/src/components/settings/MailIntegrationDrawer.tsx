import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import Drawer from '../ui/Drawer';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import Select from '../ui/Select';
import { toast } from 'react-hot-toast';
import {
  MailIntegration,
  MailIntegrationDirection,
  MailIntegrationProvider,
  MailCredentialValidationPayload,
  fetchAllDepartments,
  updateMailIntegrationRouting,
  updateMailIntegration,
  validateMailCredentials,
} from '../../services/settings';
import { formatDate } from '../../utils/date';
import http from '../../services/http';
import { APIS } from '../../services/apis';

interface Props {
  integration: MailIntegration | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onStartOAuth: (integration: MailIntegration) => Promise<void>;
}

interface RoutingFormValues extends MailCredentialValidationPayload {
  display_name: string;
  department: string;
  direction: MailIntegrationDirection;
  default_assignee: string;
}

interface Agent {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

const providerLabels: Record<MailIntegrationProvider, string> = {
  gmail: 'Gmail (OAuth)',
  office365: 'Microsoft 365 (OAuth)',
  custom: 'Custom IMAP/SMTP',
  safaridesk: 'SafariDesk forwarding alias',
};

export const MailIntegrationDrawer: React.FC<Props> = ({ integration, isOpen, onClose, onUpdated, onStartOAuth }) => {
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [providerState, setProviderState] = useState<MailIntegrationProvider>('gmail');
  const [showProviderSelect, setShowProviderSelect] = useState(false);
  const [customResult, setCustomResult] = useState<{ imap?: { status: string; message: string }; smtp?: { status: string; message: string } } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<RoutingFormValues>({
    defaultValues: {
      display_name: '',
      department: '',
      direction: 'both',
      default_assignee: '',
      imap_host: '',
      imap_port: undefined,
      imap_username: '',
      imap_password: '',
      imap_use_ssl: true,
      smtp_host: '',
      smtp_port: undefined,
      smtp_username: '',
      smtp_password: '',
      smtp_use_ssl: true,
      smtp_use_tls: false,
    },
  });

  const currentProvider = useMemo(() => providerState, [providerState]);
  const watchedDirection = watch('direction') as MailIntegrationDirection | undefined;
  const watchedDepartment = watch('department') || '';
  const watchedDefaultAssignee = watch('default_assignee') || '';

  useEffect(() => {
    if (!isOpen) return;
    fetchAllDepartments()
      .then((response) => {
        if (Array.isArray(response?.results)) {
          setDepartments(response.results);
        } else if (Array.isArray(response)) {
          setDepartments(response);
        }
      })
      .catch((error) => console.error('Failed to load departments', error));

    http.get(`${APIS.LIST_AGENTS}?pagination=no`)
      .then((response) => {
        const data = response.data;
        setAgents(Array.isArray(data) ? data : (data?.results ?? []));
      })
      .catch((error) => console.error('Failed to load agents', error));
  }, [isOpen]);

  useEffect(() => {
    if (integration) {
      reset({
        display_name: integration.display_name ?? '',
        department: integration.department ? String(integration.department) : '',
        direction: integration.direction ?? 'both',
        default_assignee: integration.default_assignee ? String(integration.default_assignee) : '',
        imap_host: integration.imap_host ?? '',
        imap_port: integration.imap_port ?? undefined,
        imap_use_ssl: typeof integration.imap_use_ssl === 'boolean' ? integration.imap_use_ssl : true,
        smtp_host: integration.smtp_host ?? '',
        smtp_port: integration.smtp_port ?? undefined,
        smtp_use_ssl: typeof integration.smtp_use_ssl === 'boolean' ? integration.smtp_use_ssl : true,
        smtp_use_tls: typeof integration.smtp_use_tls === 'boolean' ? integration.smtp_use_tls : false,
        imap_username: '',
        imap_password: '',
        smtp_username: '',
        smtp_password: '',
      });
      setCustomResult(null);
      setProviderState(integration.provider);
      setShowProviderSelect(false);
    }
  }, [integration, reset]);

  if (!integration) {
    return null;
  }

  const isCustom = currentProvider === 'custom';

  const syncImapSecurityForPort = (port?: number) => {
    if (port === 993) {
      setValue('imap_use_ssl', true, { shouldDirty: true });
    }
  };

  const syncSmtpSecurityForPort = (port?: number) => {
    if (port === 465) {
      setValue('smtp_use_ssl', true, { shouldDirty: true });
      setValue('smtp_use_tls', false, { shouldDirty: true });
      return;
    }
    if (port === 587) {
      setValue('smtp_use_ssl', false, { shouldDirty: true });
      setValue('smtp_use_tls', true, { shouldDirty: true });
    }
  };

  const handleRoutingSave = async (values: RoutingFormValues) => {
    setLoading(true);
    try {
      if (isCustom) {
        const serverPayload: Partial<MailIntegration> & MailCredentialValidationPayload = {
          direction: values.direction,
          imap_host: values.imap_host,
          imap_port: values.imap_port,
          imap_use_ssl: values.imap_use_ssl,
          smtp_host: values.smtp_host,
          smtp_port: values.smtp_port,
          smtp_use_ssl: values.smtp_use_ssl,
          smtp_use_tls: values.smtp_use_tls,
        };
        if (values.imap_username) {
          serverPayload.imap_username = values.imap_username;
        }
        if (values.imap_password) {
          serverPayload.imap_password = values.imap_password;
        }
        if (values.smtp_username) {
          serverPayload.smtp_username = values.smtp_username;
        }
        if (values.smtp_password) {
          serverPayload.smtp_password = values.smtp_password;
        }

        await updateMailIntegration({
          id: integration.id,
          data: serverPayload,
        });
        await updateMailIntegrationRouting(integration.id, {
          display_name: values.display_name,
          department: values.department ? Number(values.department) : null,
          default_assignee: values.default_assignee ? Number(values.default_assignee) : null,
        });
      } else {
        await updateMailIntegrationRouting(integration.id, {
          display_name: values.display_name,
          direction: values.direction,
          department: values.department ? Number(values.department) : null,
          default_assignee: values.default_assignee ? Number(values.default_assignee) : null,
        });
      }

      toast.success('Mailbox settings updated');
      onUpdated();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update mailbox');
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = async (provider: MailIntegrationProvider) => {
    if (provider === currentProvider) {
      setShowProviderSelect(false);
      return;
    }
    toast.error('Create a new mailbox for a different provider.');
    setShowProviderSelect(false);
  };

  const runCustomValidation = async (values: MailCredentialValidationPayload) => {
    try {
      const result = await validateMailCredentials(values);
      setCustomResult(result);

      // Check if any validation failed
      const imapFailed = result.imap?.status === 'error';
      const smtpFailed = result.smtp?.status === 'error';

      if (imapFailed || smtpFailed) {
        const failedServices = [imapFailed && 'IMAP', smtpFailed && 'SMTP'].filter(Boolean).join(' and ');
        toast.error(`${failedServices} connection failed. Check credentials and try again.`);
      } else {
        toast.success('Connection test successful');
      }
    } catch (error) {
      console.error(error);
      toast.error('Unable to validate credentials');
    }
  };

  return (
    <Drawer
      title={`Mailbox settings - ${integration.email_address || integration.provider}`}
      isOpen={isOpen}
      close={() => {
        onClose();
        setShowProviderSelect(false);
        setCustomResult(null);
      }}
      size="lg"
    >
      <form onSubmit={handleSubmit(handleRoutingSave)} className="space-y-8 max-w-2xl mx-auto">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)] uppercase tracking-wide">
            Support email
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">Support email name</label>
              <Input {...register('display_name')} placeholder="Support Team" />
            </div>
            <div>
              <Select
                label="Assign to department"
                value={watchedDepartment}
                onChange={(value) => setValue('department', value, { shouldDirty: true })}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...departments.map((dept) => ({
                    value: String(dept.id),
                    label: dept.name,
                  })),
                ]}
                placeholder="Unassigned"
                allowSearch
              />
            </div>
            <div>
              <Select
                label="Default assignee"
                value={watchedDefaultAssignee}
                onChange={(value) => setValue('default_assignee', value, { shouldDirty: true })}
                options={[
                  { value: '', label: 'No default - assign manually' },
                  ...agents.map((agent) => ({
                    value: String(agent.id),
                    label: `${agent.first_name} ${agent.last_name} (${agent.email})`,
                  })),
                ]}
                placeholder="No default - assign manually"
                allowSearch
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Tickets from this mailbox will be automatically assigned to this technician.
              </p>
            </div>
          </div>
          <div>
            <Select
              label="Direction"
              value={watchedDirection || 'both'}
              onChange={(value) => setValue('direction', value as MailIntegrationDirection, { shouldDirty: true })}
              options={[
                { value: 'incoming', label: 'Incoming only' },
                { value: 'outgoing', label: 'Outgoing only' },
                { value: 'both', label: 'Incoming & Outgoing' },
              ]}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)] uppercase tracking-wide">
                Email server
              </h3>
              <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">{providerLabels[currentProvider]}</p>
            </div>
            <div className="flex items-center gap-2">
              {(currentProvider === 'gmail' || currentProvider === 'office365') && (
                <Button size="sm" type="button" variant="secondary" onClick={() => onStartOAuth(integration)}>
                  Reconnect
                </Button>
              )}
              <Button size="sm" type="button" variant="secondary" onClick={() => setShowProviderSelect((prev) => !prev)}>
                {showProviderSelect ? 'Cancel' : 'Change server'}
              </Button>
            </div>
          </div>

          {showProviderSelect && (
            <div className="flex flex-wrap gap-2">
              {(['gmail', 'office365', 'custom', 'safaridesk'] as MailIntegrationProvider[]).map((provider) => (
                <Button
                  key={provider}
                  size="sm"
                  variant={provider === currentProvider ? 'primary' : 'secondary'}
                  type="button"
                  onClick={() => handleProviderChange(provider)}
                >
                  {providerLabels[provider]}
                </Button>
              ))}
            </div>
          )}

          {currentProvider === 'safaridesk' && (
            <div className="bg-gray-50 dark:bg-surface rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Alias</p>
                  <p className="text-sm text-gray-700 dark:text-[var(--text-primary)] font-mono">
                    {integration.forwarding_address || integration.email_address || 'No alias generated yet'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      const alias = integration.forwarding_address || integration.email_address;
                      if (!alias) return;
                      await navigator.clipboard.writeText(alias);
                      toast.success('Alias copied');
                    }}
                  >
                    Copy
                  </Button>
               
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${integration.connection_status === 'connected'
                      ? 'bg-primary-100 text-primary-800'
                      : integration.connection_status === 'connecting'
                        ? 'bg-yellow-100 text-yellow-800'
                        : integration.connection_status === 'error'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                >
                  {integration.connection_status || 'unknown'}
                </span>
                {integration.last_success_at && (
                  <span className="text-gray-600 dark:text-[var(--text-primary)]">
                    Last seen {formatDate(integration.last_success_at)}
                  </span>
                )}
                {integration.last_error_message && (
                  <span className="text-red-600 text-xs truncate max-w-xs" title={integration.last_error_message}>
                    {integration.last_error_message}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Forward your existing mailbox to this alias so SafariDesk can ingest messages. IMAP/SMTP settings are
                not needed for SafariDesk-hosted aliases.
              </p>
            </div>
          )}

          {isCustom && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">IMAP host</label>
                  <Input {...register('imap_host')} placeholder="imap.mailprovider.com" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">IMAP port</label>
                  <Input
                    type="number"
                    {...register('imap_port', {
                      valueAsNumber: true,
                      onBlur: (event) => syncImapSecurityForPort(Number(event.target.value) || undefined),
                    })}
                    placeholder="993"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Port 993 uses SSL.</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">IMAP username</label>
                  <Input {...register('imap_username')} placeholder="user@example.com" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">IMAP password</label>
                  <Input type="password" {...register('imap_password')} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">SMTP host</label>
                  <Input {...register('smtp_host')} placeholder="smtp.mailprovider.com" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">SMTP port</label>
                  <Input
                    type="number"
                    {...register('smtp_port', {
                      valueAsNumber: true,
                      onBlur: (event) => syncSmtpSecurityForPort(Number(event.target.value) || undefined),
                    })}
                    placeholder="465"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Port 465 uses SSL. Port 587 uses STARTTLS.</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">SMTP username</label>
                  <Input {...register('smtp_username')} placeholder="user@example.com" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">SMTP password</label>
                  <Input type="password" {...register('smtp_password')} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[var(--text-primary)]">
                  <input type="checkbox" {...register('imap_use_ssl')} />
                  Use SSL for IMAP
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[var(--text-primary)]">
                  <input type="checkbox" {...register('smtp_use_ssl')} />
                  Use SSL for SMTP
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[var(--text-primary)]">
                  <input type="checkbox" {...register('smtp_use_tls')} />
                  Use TLS (STARTTLS)
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => runCustomValidation(watch())}
                >
                  Test connection
                </Button>
              </div>
              {customResult && (
                <div className="bg-gray-50 dark:bg-surface rounded-lg p-4 text-sm">
                  {customResult.imap && (
                    <p className={customResult.imap.status === 'success' ? 'text-primary-600' : 'text-red-600'}>
                      IMAP: {customResult.imap.status} - {customResult.imap.message}
                    </p>
                  )}
                  {customResult.smtp && (
                    <p className={`mt-2 ${customResult.smtp.status === 'success' ? 'text-primary-600' : 'text-red-600'}`}>
                      SMTP: {customResult.smtp.status} - {customResult.smtp.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || isSubmitting}>
            {loading ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
};
