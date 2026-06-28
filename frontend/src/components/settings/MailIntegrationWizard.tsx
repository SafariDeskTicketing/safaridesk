import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import Select from '../ui/Select';
import { Loader } from '../loader/loader';
import {
  MailCredentialValidationPayload,
  MailIntegrationDirection,
  MailIntegrationPayload,
  createMailIntegration,
  fetchAllDepartments,
  validateMailCredentials,
} from '../../services/settings';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void;
  presetDirection?: MailIntegrationDirection;
}

interface DepartmentOption {
  id: number;
  name: string;
}

const portSchema = z.preprocess(
  (val) => {
    if (val === '' || val === null || typeof val === 'undefined' || Number.isNaN(val)) {
      return undefined;
    }
    return typeof val === 'string' ? Number(val) : val;
  },
  z.number().min(1).max(65535).optional(),
);

const formSchema = z
  .object({
    email_address: z.string().email('Valid email is required'),
    display_name: z.string().optional(),
    direction: z.enum(['incoming', 'outgoing', 'both']).default('both'),
    department: z.string().optional(),
    imap_host: z.string().optional(),
    imap_port: portSchema,
    imap_username: z.string().optional(),
    imap_password: z.string().optional(),
    imap_use_ssl: z.boolean().optional(),
    smtp_host: z.string().optional(),
    smtp_port: portSchema,
    smtp_username: z.string().optional(),
    smtp_password: z.string().optional(),
    smtp_use_ssl: z.boolean().optional(),
    smtp_use_tls: z.boolean().optional(),
  })
  .superRefine((values, ctx) => {
    const needsIncoming = values.direction === 'incoming' || values.direction === 'both';
    const needsOutgoing = values.direction === 'outgoing' || values.direction === 'both';

    if (needsIncoming) {
      if (!values.imap_host) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['imap_host'], message: 'IMAP host is required' });
      if (!values.imap_port) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['imap_port'], message: 'IMAP port is required' });
      if (!values.imap_username) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['imap_username'], message: 'IMAP username is required' });
      if (!values.imap_password) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['imap_password'], message: 'IMAP password is required' });
    }

    if (needsOutgoing) {
      if (!values.smtp_host) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['smtp_host'], message: 'SMTP host is required' });
      if (!values.smtp_port) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['smtp_port'], message: 'SMTP port is required' });
      if (!values.smtp_username) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['smtp_username'], message: 'SMTP username is required' });
      if (!values.smtp_password) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['smtp_password'], message: 'SMTP password is required' });
    }
  });

type FormValues = z.infer<typeof formSchema>;

export const MailIntegrationWizard: React.FC<Props> = ({ isOpen, onClose, onCompleted, presetDirection }) => {
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ imap?: { status: string; message: string }; smtp?: { status: string; message: string } } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      direction: presetDirection || 'both',
      imap_use_ssl: true,
      smtp_use_ssl: true,
      smtp_use_tls: false,
    },
  });

  const direction = form.watch('direction');

  const syncImapSecurityForPort = (port?: number) => {
    if (port === 993) {
      form.setValue('imap_use_ssl', true, { shouldDirty: true });
    }
  };

  const syncSmtpSecurityForPort = (port?: number) => {
    if (port === 465) {
      form.setValue('smtp_use_ssl', true, { shouldDirty: true });
      form.setValue('smtp_use_tls', false, { shouldDirty: true });
      return;
    }
    if (port === 587) {
      form.setValue('smtp_use_ssl', false, { shouldDirty: true });
      form.setValue('smtp_use_tls', true, { shouldDirty: true });
    }
  };

  useEffect(() => {
    if (!isOpen) {
      form.reset({
        direction: presetDirection || 'both',
        imap_use_ssl: true,
        smtp_use_ssl: true,
        smtp_use_tls: false,
      });
      setTestResult(null);
      return;
    }

    setLoadingDepartments(true);
    fetchAllDepartments()
      .then((response) => {
        if (Array.isArray(response?.results)) {
          setDepartments(response.results);
        } else if (Array.isArray(response)) {
          setDepartments(response);
        }
      })
      .catch((error) => {
        console.error('Failed to load departments', error);
        toast.error('Unable to load departments');
      })
      .finally(() => setLoadingDepartments(false));
  }, [form, isOpen, presetDirection]);

  const needsIncoming = useMemo(() => direction !== 'outgoing', [direction]);
  const needsOutgoing = useMemo(() => direction !== 'incoming', [direction]);
  const hasSuccessfulTest = useMemo(() => {
    if (!testResult) return false;
    const imapOk = !needsIncoming || testResult.imap?.status === 'success';
    const smtpOk = !needsOutgoing || testResult.smtp?.status === 'success';
    return imapOk && smtpOk;
  }, [needsIncoming, needsOutgoing, testResult]);

  useEffect(() => {
    const subscription = form.watch(() => {
      setTestResult(null);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleSave = form.handleSubmit(async (values) => {
    try {
      const payload: MailIntegrationPayload = {
        provider: 'custom',
        direction: values.direction,
        email_address: values.email_address,
        display_name: values.display_name || undefined,
        department: values.department ? Number(values.department) : null,
        imap_host: needsIncoming ? values.imap_host : undefined,
        imap_port: needsIncoming ? values.imap_port : undefined,
        imap_username: needsIncoming ? values.imap_username : undefined,
        imap_password: needsIncoming ? values.imap_password : undefined,
        imap_use_ssl: needsIncoming ? values.imap_use_ssl : undefined,
        smtp_host: needsOutgoing ? values.smtp_host : undefined,
        smtp_port: needsOutgoing ? values.smtp_port : undefined,
        smtp_username: needsOutgoing ? values.smtp_username : undefined,
        smtp_password: needsOutgoing ? values.smtp_password : undefined,
        smtp_use_ssl: needsOutgoing ? values.smtp_use_ssl : undefined,
        smtp_use_tls: needsOutgoing ? values.smtp_use_tls : undefined,
      };

      await createMailIntegration(payload);
      toast.success('Mailbox created');
      onCompleted();
      onClose();
      form.reset({
        direction: presetDirection || 'both',
        imap_use_ssl: true,
        smtp_use_ssl: true,
        smtp_use_tls: false,
      });
      setTestResult(null);
    } catch (error) {
      console.error(error);
      toast.error('Unable to create mailbox');
    }
  });

  const handleTestConnection = async () => {
    const valid = await form.trigger();
    if (!valid) {
      toast.error('Please fix the highlighted fields before testing');
      return;
    }

    const values = form.getValues();
    const payload: MailCredentialValidationPayload = {};
    if (needsIncoming) {
      payload.imap_host = values.imap_host;
      payload.imap_port = values.imap_port;
      payload.imap_username = values.imap_username;
      payload.imap_password = values.imap_password;
      payload.imap_use_ssl = values.imap_use_ssl;
    }
    if (needsOutgoing) {
      payload.smtp_host = values.smtp_host;
      payload.smtp_port = values.smtp_port;
      payload.smtp_username = values.smtp_username;
      payload.smtp_password = values.smtp_password;
      payload.smtp_use_ssl = values.smtp_use_ssl;
      payload.smtp_use_tls = values.smtp_use_tls;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await validateMailCredentials(payload);
      setTestResult(result);

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
    } finally {
      setIsTesting(false);
    }
  };

  const renderDepartmentSelect = () => {
    if (loadingDepartments) {
      return <Loader />;
    }

    return (
      <Select
        value={form.watch('department') || ''}
        onChange={(value) => form.setValue('department', value, { shouldDirty: true, shouldValidate: true })}
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
    );
  };

  const fieldError = (name: keyof FormValues) => {
    const error = form.formState.errors[name];
    return error ? <p className="text-xs text-red-600 mt-1">{error.message as string}</p> : null;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        form.reset({
          direction: presetDirection || 'both',
          imap_use_ssl: true,
          smtp_use_ssl: true,
          smtp_use_tls: false,
        });
        setTestResult(null);
      }}
      title="Custom mail server"
      size="xl"
    >
      <form className="space-y-6" onSubmit={handleSave}>
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)] uppercase tracking-wide">Support email</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">Email address</label>
              <Input placeholder="support@example.com" {...form.register('email_address')} />
              {fieldError('email_address')}
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">Display name</label>
              <Input placeholder="Support Team" {...form.register('display_name')} />
              {fieldError('display_name')}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Select
                label="Direction"
                value={direction || 'both'}
                onChange={(value) => form.setValue('direction', value as MailIntegrationDirection, { shouldDirty: true, shouldValidate: true })}
                options={[
                  { value: 'incoming', label: 'Incoming only' },
                  { value: 'outgoing', label: 'Outgoing only' },
                  { value: 'both', label: 'Incoming & Outgoing' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">Assign to department</label>
              {renderDepartmentSelect()}
            </div>
          </div>
        </section>

        {needsIncoming && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)] uppercase tracking-wide">Incoming (IMAP)</h3>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-[var(--text-primary)]">
                <input type="checkbox" {...form.register('imap_use_ssl')} />
                Use SSL
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">Host</label>
                <Input placeholder="imap.mailprovider.com" {...form.register('imap_host')} />
                {fieldError('imap_host')}
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">Port</label>
                <Input
                  type="number"
                  placeholder="993"
                  {...form.register('imap_port', {
                    valueAsNumber: true,
                    onBlur: (event) => syncImapSecurityForPort(Number(event.target.value) || undefined),
                  })}
                />
                {fieldError('imap_port')}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Port 993 uses SSL.</p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">Username</label>
                <Input placeholder="user@example.com" {...form.register('imap_username')} />
                {fieldError('imap_username')}
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">Password</label>
                <Input type="password" {...form.register('imap_password')} />
                {fieldError('imap_password')}
              </div>
            </div>
          </section>
        )}

        {needsOutgoing && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-[var(--text-primary)] uppercase tracking-wide">Outgoing (SMTP)</h3>
              <div className="flex items-center gap-4 text-sm text-gray-700 dark:text-[var(--text-primary)]">
                <label className="flex items-center gap-2">
                  <input type="checkbox" {...form.register('smtp_use_ssl')} />
                  Use SSL
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" {...form.register('smtp_use_tls')} />
                  Use TLS (STARTTLS)
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">Host</label>
                <Input placeholder="smtp.mailprovider.com" {...form.register('smtp_host')} />
                {fieldError('smtp_host')}
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">Port</label>
                <Input
                  type="number"
                  placeholder="465"
                  {...form.register('smtp_port', {
                    valueAsNumber: true,
                    onBlur: (event) => syncSmtpSecurityForPort(Number(event.target.value) || undefined),
                  })}
                />
                {fieldError('smtp_port')}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Port 465 uses SSL. Port 587 uses STARTTLS.</p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">Username</label>
                <Input placeholder="user@example.com" {...form.register('smtp_username')} />
                {fieldError('smtp_username')}
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-[var(--text-primary)] mb-1">Password</label>
                <Input type="password" {...form.register('smtp_password')} />
                {fieldError('smtp_password')}
              </div>
            </div>
          </section>
        )}

        <div className="space-y-3">
          {testResult && (
            <div className="bg-gray-50 dark:bg-surface rounded-lg p-4 text-sm space-y-2">
              {testResult.imap && (
                <p className={testResult.imap.status === 'success' ? 'text-primary-600' : testResult.imap.status === 'error' ? 'text-red-600' : 'text-gray-500 dark:text-[var(--text-primary)]'}>
                  <strong>IMAP:</strong> {testResult.imap.status} - {testResult.imap.message}
                </p>
              )}
              {testResult.smtp && (
                <p className={`mt-1 ${testResult.smtp.status === 'success' ? 'text-primary-600' : testResult.smtp.status === 'error' ? 'text-red-600' : 'text-gray-500 dark:text-[var(--text-primary)]'}`}>
                  <strong>SMTP:</strong> {testResult.smtp.status} - {testResult.smtp.message}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3 justify-between">
            <Button type="button" variant="secondary" onClick={handleTestConnection} disabled={isTesting}>
              {isTesting ? 'Testing...' : 'Test connection'}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting || !hasSuccessfulTest}>
                {form.formState.isSubmitting ? 'Saving...' : 'Save mailbox'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
