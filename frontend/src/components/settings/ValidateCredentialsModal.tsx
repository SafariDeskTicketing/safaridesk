import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { validateMailCredentials, MailCredentialValidationPayload } from '../../services/settings';
import { toast } from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ValidateCredentialsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [result, setResult] = useState<{ imap: { status: string; message: string }; smtp: { status: string; message: string } } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<MailCredentialValidationPayload>({
    defaultValues: {
      imap_use_ssl: true,
      smtp_use_ssl: true,
      smtp_use_tls: false,
    },
  });

  const submitHandler = async (values: MailCredentialValidationPayload) => {
    try {
      const response = await validateMailCredentials({
        ...values,
        imap_port: values.imap_port ? Number(values.imap_port) : undefined,
        smtp_port: values.smtp_port ? Number(values.smtp_port) : undefined,
      });
      setResult(response);

      // Check if any validation failed
      const imapFailed = response.imap?.status === 'error';
      const smtpFailed = response.smtp?.status === 'error';

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

  const closeModal = () => {
    reset();
    setResult(null);
    onClose();
  };

  const renderStatus = (status?: string) => {
    if (!status) return '';
    if (status === 'success') return 'text-primary-600';
    if (status === 'error') return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <Modal isOpen={isOpen} onClose={closeModal} title="Validate IMAP / SMTP Credentials" size="xl">
      <form onSubmit={handleSubmit(submitHandler)} className="space-y-4">
        <div>
          <h4 className="font-semibold mb-2">IMAP Settings (Incoming)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Host</label>
              <Input {...register('imap_host')} placeholder="imap.mailprovider.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Port</label>
              <Input type="number" {...register('imap_port', { valueAsNumber: true })} placeholder="993" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Username</label>
              <Input {...register('imap_username')} placeholder="user@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Password</label>
              <Input type="password" {...register('imap_password')} />
            </div>
            <label className="flex items-center space-x-2">
              <input type="checkbox" {...register('imap_use_ssl')} />
              <span>Use SSL</span>
            </label>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">SMTP Settings (Outgoing)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Host</label>
              <Input {...register('smtp_host')} placeholder="smtp.mailprovider.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Port</label>
              <Input type="number" {...register('smtp_port', { valueAsNumber: true })} placeholder="465" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Username</label>
              <Input {...register('smtp_username')} placeholder="user@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">Password</label>
              <Input type="password" {...register('smtp_password')} />
            </div>
            <label className="flex items-center space-x-2">
              <input type="checkbox" {...register('smtp_use_ssl')} />
              <span>Use SSL</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" {...register('smtp_use_tls')} />
              <span>Use TLS (STARTTLS)</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Validating...' : 'Run Validation'}
          </Button>
        </div>
      </form>

      {result && (
        <div className="mt-6 bg-gray-50 dark:bg-surface p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Results</h4>
          <p className={renderStatus(result.imap?.status)}>
            IMAP: {result.imap?.status ?? 'skipped'} - {result.imap?.message}
          </p>
          <p className={`mt-2 ${renderStatus(result.smtp?.status)}`}>
            SMTP: {result.smtp?.status ?? 'skipped'} - {result.smtp?.message}
          </p>
        </div>
      )}
    </Modal>
  );
};
