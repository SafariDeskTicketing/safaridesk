import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { successNotification, errorNotification } from '../ui/Toast';
import { useAuthStore } from '../../stores/authStore';

const passwordSchema = z.object({
  old_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters long')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export const PasswordUpdateModal: React.FC = () => {
  const { setTokens } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const onSubmit = async (data: PasswordFormData) => {
    setIsSubmitting(true);
    try {
      const response = await http.post(APIS.UPDATE_PASSWORD, {
        old_password: data.old_password,
        new_password: data.new_password,
      });
      successNotification(response.data.message);
      setTokens(response.data.access, response.data.refresh);
      // The user object in the store will be updated automatically by the authStore's subscription to token changes.
      reset();
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Failed to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={() => {}} title="Update Your Password" closeOnBackdropClick={false} closeOnEscape={false} showCloseButton={false}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">
          For your security, you must update your password before proceeding.
        </p>
        <Input
          label="Current Password"
          type="password"
          fullWidth
          {...register('old_password')}
          error={errors.old_password?.message}
        />
        <Input
          label="New Password"
          type="password"
          fullWidth
          {...register('new_password')}
          error={errors.new_password?.message}
        />
        <ul className="text-xs text-gray-500 dark:text-[var(--text-primary)] space-y-1">
          <li>- At least 8 characters</li>
          <li>- At least one uppercase letter</li>
          <li>- At least one lowercase letter</li>
          <li>- At least one number</li>
        </ul>
        <Input
          label="Confirm New Password"
          type="password"
          fullWidth
          {...register('confirm_password')}
          error={errors.confirm_password?.message}
        />
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
