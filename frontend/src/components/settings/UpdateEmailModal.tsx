import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Modal } from '../ui/Modal';
import Select from '../ui/Select';

const emailSchema = z.object({
  email: z.string().email('Valid email is required'),
  department: z.string().min(1, 'Department is required'),
  host: z.string().min(1, 'SMTP host is required'),
  port: z.number().int().positive('SMTP port must be a positive number'),
  username: z.string().min(1, 'SMTP username is required'),
  password: z.string().optional(),
  use_tls: z.boolean(),
  use_ssl: z.boolean(),
  imap_host: z.string().min(1, 'IMAP host is required'),
  imap_port: z.number().int().positive('IMAP port must be a positive number'),
  imap_username: z.string().min(1, 'IMAP username is required'),
  imap_password: z.string().optional(),
  imap_use_ssl: z.boolean(),
  is_active: z.boolean(),
});

type EmailFormData = z.infer<typeof emailSchema>;

interface DepartmentOption {
  id: number;
  name: string;
}

interface UpdateEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: any;
  mode: 'create' | 'edit';
  departments: DepartmentOption[];
  onSubmit: (data: any) => void;
}

export const UpdateEmailModal: React.FC<UpdateEmailModalProps> = ({
  isOpen,
  onClose,
  email,
  mode,
  departments,
  onSubmit,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: email?.email || '',
      department: email?.department_id ? String(email.department_id) : '',
      host: email?.host || '',
      port: email?.port || 587,
      username: email?.username || '',
      password: '',
      use_tls: email?.use_tls ?? false,
      use_ssl: email?.use_ssl ?? false,
      imap_host: email?.imap_host || '',
      imap_port: email?.imap_port || 993,
      imap_username: email?.imap_username || '',
      imap_password: '',
      imap_use_ssl: email?.imap_use_ssl ?? true,
      is_active: email?.is_active ?? true,
    },
  });

  React.useEffect(() => {
    reset({
      email: email?.email || '',
      department: email?.department_id ? String(email.department_id) : '',
      host: email?.host || '',
      port: email?.port || 587,
      username: email?.username || '',
      password: '',
      use_tls: email?.use_tls ?? false,
      use_ssl: email?.use_ssl ?? false,
      imap_host: email?.imap_host || '',
      imap_port: email?.imap_port || 993,
      imap_username: email?.imap_username || '',
      imap_password: '',
      imap_use_ssl: email?.imap_use_ssl ?? true,
      is_active: email?.is_active ?? true,
    });
  }, [email, reset]);

  const useTls = watch('use_tls');
  const useSsl = watch('use_ssl');
  const selectedDepartment = watch('department') || '';

  React.useEffect(() => {
    if (useTls) {
      setValue('use_ssl', false);
    }
  }, [useTls, setValue]);

  React.useEffect(() => {
    if (useSsl) {
      setValue('use_tls', false);
    }
  }, [useSsl, setValue]);

  const submitHandler = (data: EmailFormData) => {
    if (mode === 'create') {
      if (!data.password) {
        setError('password', { type: 'manual', message: 'SMTP password is required' });
        return;
      }
      if (!data.imap_password) {
        setError('imap_password', { type: 'manual', message: 'IMAP password is required' });
        return;
      }
    }

    const payload: any = {
      email: data.email,
      department: Number(data.department),
      host: data.host,
      port: data.port,
      username: data.username,
      use_tls: data.use_tls,
      use_ssl: data.use_ssl,
      imap_host: data.imap_host,
      imap_port: data.imap_port,
      imap_username: data.imap_username,
      imap_use_ssl: data.imap_use_ssl,
      is_active: data.is_active,
    };

    if (data.password) {
      payload.password = data.password;
    }
    if (data.imap_password) {
      payload.imap_password = data.imap_password;
    }

    onSubmit(payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
      }}
      title={mode === 'create' ? 'Add Department Email' : `Update Email (${email?.email})`}
      size="xl"
    >
      <form onSubmit={handleSubmit(submitHandler)} className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
            />
            {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
          </div>
          <div>
            <Select
              id="department"
              label="Department"
              value={selectedDepartment}
              onChange={(value) => setValue('department', value, { shouldDirty: true, shouldValidate: true })}
              options={departments.map((dept) => ({
                value: String(dept.id),
                label: dept.name,
              }))}
              placeholder="Select department"
              allowSearch
              error={errors.department?.message}
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-2">SMTP Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="host">Host</Label>
              <Input id="host" {...register('host')} />
              {errors.host && <p className="text-red-500 text-sm">{errors.host.message}</p>}
            </div>
            <div>
              <Label htmlFor="port">Port</Label>
              <Input id="port" type="number" {...register('port', { valueAsNumber: true })} />
              {errors.port && <p className="text-red-500 text-sm">{errors.port.message}</p>}
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input id="username" {...register('username')} />
              {errors.username && <p className="text-red-500 text-sm">{errors.username.message}</p>}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder={mode === 'edit' ? 'Leave blank to keep current password' : ''} {...register('password')} />
              {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register('use_tls')} />
              <span>Use TLS</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register('use_ssl')} />
              <span>Use SSL</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-2">IMAP Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="imap_host">Host</Label>
              <Input id="imap_host" {...register('imap_host')} />
              {errors.imap_host && <p className="text-red-500 text-sm">{errors.imap_host.message}</p>}
            </div>
            <div>
              <Label htmlFor="imap_port">Port</Label>
              <Input id="imap_port" type="number" {...register('imap_port', { valueAsNumber: true })} />
              {errors.imap_port && <p className="text-red-500 text-sm">{errors.imap_port.message}</p>}
            </div>
            <div>
              <Label htmlFor="imap_username">Username</Label>
              <Input id="imap_username" {...register('imap_username')} />
              {errors.imap_username && <p className="text-red-500 text-sm">{errors.imap_username.message}</p>}
            </div>
            <div>
              <Label htmlFor="imap_password">Password</Label>
              <Input id="imap_password" type="password" placeholder={mode === 'edit' ? 'Leave blank to keep current password' : ''} {...register('imap_password')} />
              {errors.imap_password && <p className="text-red-500 text-sm">{errors.imap_password.message}</p>}
            </div>
          </div>
          <label className="flex items-center gap-2 mt-2">
            <input type="checkbox" {...register('imap_use_ssl')} />
            <span>Use SSL</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" {...register('is_active')} />
          <span>Active</span>
        </div>

        <div className="flex justify-end">
          <Button type="submit">
            {mode === 'create' ? 'Add Email' : 'Update'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
