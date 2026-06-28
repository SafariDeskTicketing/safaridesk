import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EyeOff, Eye } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorNotification } from '../../components/ui/Toast';
import { Loader } from '../../components/loader/loader';
import AuthLayout from '../../components/layouts/AuthLayout';
import { CheckCircle, ChevronLeft, Lock } from '../../components/icons/AppIcons';


const newPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  repeatPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((data) => data.newPassword === data.repeatPassword, {
  message: "Passwords don't match",
  path: ["repeatPassword"],
});

type NewPasswordFormData = z.infer<typeof newPasswordSchema>;

const NewPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const uid = searchParams.get('uid');

  
  
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);

  const { 
    resetPassword, 
    isLoading, 
    error, 
    clearError, 
    hasPasswordReset, 
    clearSuccess 
  } = useAuthStore();

  const { register, handleSubmit, formState: { errors }, watch } = useForm<NewPasswordFormData>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: {
      newPassword: '',
      repeatPassword: '',
    },
  });

  const watchNewPassword = watch('newPassword');
  const watchRepeatPassword = watch('repeatPassword');

  // Validate token and uid on component mount
  useEffect(() => {
    clearSuccess();
    clearError();
    if (!token || !uid) {
      errorNotification('An error has occurred!');
    }
  }, [token, uid, clearError, clearSuccess]);

  const onSubmit = async (data: NewPasswordFormData) => {
    clearError();
    if (token && uid) {
      await resetPassword(token,  data.newPassword, uid);
    }
  };

  useEffect(() => {
    if (hasPasswordReset) {
      setPasswordReset(true);
      setTimeout(() => navigate('/auth'), 2000);
    }
  }, [hasPasswordReset, navigate]);

  // Show loading or redirect if no token/uid
  if (!token || !uid) {
    return <Loader />;
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--shell-radius)] border border-[var(--status-info-border)] bg-[var(--status-info-bg)]">
            {passwordReset ? (
              <CheckCircle size={16} stroke={1.8} className="text-[var(--status-success-text)]" />
            ) : (
              <Lock size={16} stroke={1.8} className="text-[var(--status-info-text)]" />
            )}
          </div>
          <h2 className="text-[28px] font-semibold leading-tight text-[var(--text-primary)]">
            {passwordReset ? 'Password Reset Successful' : 'New Password'}
          </h2>
          <p className="max-w-[360px] text-[15px] font-medium text-[var(--text-secondary)]">
            {passwordReset
              ? 'Your password has been successfully reset. Redirecting to login...'
              : 'Create a new password for your account'
            }
          </p>
        </div>

        {error && (
          <div className="rounded-[var(--shell-radius)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2.5">
            <p className="text-[15px] text-[var(--status-danger-text)]">{error}</p>
          </div>
        )}

        {passwordReset ? (
          <div className="rounded-[var(--shell-radius)] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2.5">
            <p className="text-[15px] text-[var(--status-success-text)]">
              Password reset successful! You will be redirected to the login page in a few seconds.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="relative">
              <Input
                label="New Password"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                fullWidth
                className="h-[46px] pr-10 text-[16px]"
                {...register('newPassword')}
                error={errors.newPassword?.message}
              />
              <button
                type="button"
                className="absolute right-3 top-[32px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <div className="relative">
              <Input
                label="Repeat Password"
                type={showRepeatPassword ? 'text' : 'password'}
                placeholder="Repeat new password"
                fullWidth
                className="h-[46px] pr-10 text-[16px]"
                {...register('repeatPassword')}
                error={errors.repeatPassword?.message}
              />
              <button
                type="button"
                className="absolute right-3 top-[32px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                aria-label={showRepeatPassword ? 'Hide password' : 'Show password'}
              >
                {showRepeatPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {watchNewPassword && (
              <div className="space-y-2">
                <div className="text-[15px] font-medium text-[var(--text-secondary)]">
                  Password strength:
                </div>
                <div className="flex space-x-1">
                  <div className={`h-1.5 w-1/4 rounded ${watchNewPassword.length >= 6 ? 'bg-primary-600' : 'bg-[var(--border-color)]'}`} />
                  <div className={`h-1.5 w-1/4 rounded ${watchNewPassword.length >= 8 ? 'bg-primary-600' : 'bg-[var(--border-color)]'}`} />
                  <div className={`h-1.5 w-1/4 rounded ${/(?=.*[a-z])(?=.*[A-Z])/.test(watchNewPassword) ? 'bg-primary-600' : 'bg-[var(--border-color)]'}`} />
                  <div className={`h-1.5 w-1/4 rounded ${/(?=.*\d)/.test(watchNewPassword) ? 'bg-primary-600' : 'bg-[var(--border-color)]'}`} />
                </div>
              </div>
            )}

            {watchRepeatPassword && (
              <div className="flex items-center space-x-2">
                <div className={`h-2 w-2 rounded-full ${watchNewPassword === watchRepeatPassword ? 'bg-primary-600' : 'bg-[var(--status-danger-text)]'}`} />
                <span className={`text-[15px] ${watchNewPassword === watchRepeatPassword ? 'text-primary-700' : 'text-[var(--status-danger-text)]'}`}>
                  {watchNewPassword === watchRepeatPassword ? 'Passwords match' : 'Passwords do not match'}
                </span>
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isLoading}
              className="mt-1 h-[46px] text-[15px]"
              disabled={!watchNewPassword || !watchRepeatPassword || watchNewPassword !== watchRepeatPassword}
            >
              {isLoading ? 'Updating password...' : 'Update password'}
            </Button>
          </form>
        )}

        <div>
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="inline-flex items-center text-[15px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <ChevronLeft size={14} stroke={1.8} className="mr-1" />
            Back to login
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};

export default NewPassword;
