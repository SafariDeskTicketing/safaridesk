import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../../components/layouts/AuthLayout';
import { useValidateDomain } from '../../hooks/useValidateDomain';
import { ChevronLeft, Lock, Mail } from '../../components/icons/AppIcons';


const resetRequestSchema = z.object({
  identifier: z.string().nonempty("This field is required"),
});


type ResetRequestFormData = z.infer<typeof resetRequestSchema>;

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const token = searchParams.get('token');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { businessId, isLoadingDomain, domainError } = useValidateDomain();

  const { 
    requestPasswordReset, 
    isLoading, 
    error, 
    clearError, 
    linkSent, 
    clearSuccess 
} = useAuthStore();

  const resetRequestForm = useForm<ResetRequestFormData>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: {
      identifier: '',
    },
  });



  const onSubmitResetRequest = async (data: ResetRequestFormData) => {
    clearError();
    if (!businessId) {
      return;
    }
    await requestPasswordReset(data.identifier, businessId);
  };



  useEffect(() => {
    if (linkSent) {
      if (!token) {
        setResetEmailSent(true);
      } else {
        setTimeout(() => navigate('/auth'), 2000);
      }
    }
  }, [linkSent, token, navigate]);

  useEffect(() => {
    return () => {
      clearSuccess();
      clearError();
    };
  }, [clearSuccess, clearError]);

  if (token) {
    return (
      <AuthLayout>
        <div className="space-y-6">
          <div className="space-y-1.5">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--shell-radius)] border border-[var(--status-info-border)] bg-[var(--status-info-bg)]">
              <Lock size={16} stroke={1.8} className="text-[var(--status-info-text)]" />
            </div>
            <h2 className="text-[28px] font-semibold leading-tight text-[var(--text-primary)]">Reset password</h2>
            <p className="text-[15px] font-medium text-[var(--text-secondary)]">
              Password reset request received. You can return to sign in and continue.
            </p>
          </div>

          {error && (
            <div className="rounded-[var(--shell-radius)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2.5">
              <p className="text-[15px] text-[var(--status-danger-text)]">{error}</p>
            </div>
          )}

          {linkSent && (
            <div className="rounded-[var(--shell-radius)] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2.5">
              <p className="text-[15px] text-[var(--status-success-text)]">
                Password reset successful! Redirecting to login...
              </p>
            </div>
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
  }

  // Reset request form (initial form to request password reset)
  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--shell-radius)] border border-[var(--status-info-border)] bg-[var(--status-info-bg)]">
            <Lock size={16} stroke={1.8} className="text-[var(--status-info-text)]" />
          </div>
          <h2 className="text-[28px] font-semibold leading-tight text-[var(--text-primary)]">
            {resetEmailSent ? 'Check your email' : 'Forgot Password'}
          </h2>
          <p className="max-w-[360px] text-[15px] font-medium text-[var(--text-secondary)]">
            {resetEmailSent
              ? 'A reset link has been sent to your registered email address.'
              : 'Enter your email address or username and we will send a reset link.'
            }
          </p>
        </div>

        {error && (
          <div className="rounded-[var(--shell-radius)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2.5">
            <p className="text-[15px] text-[var(--status-danger-text)]">{error}</p>
          </div>
        )}

        {resetEmailSent ? (
          <div className="rounded-[var(--shell-radius)] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2.5">
            <p className="text-[15px] text-[var(--status-success-text)]">
              Password reset link has been sent to your email.
            </p>
          </div>
        ) : (
          <form onSubmit={resetRequestForm.handleSubmit(onSubmitResetRequest)} className="space-y-4">
            <Input
              label="Email address or username"
              placeholder="Enter your email or username"
              type="text"
              icon={Mail}
              fullWidth
              className="h-[46px] text-[16px]"
              {...resetRequestForm.register('identifier')}
              error={resetRequestForm.formState.errors.identifier?.message}
            />

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isLoading || isLoadingDomain}
              disabled={isLoadingDomain || domainError || !businessId}
              className="mt-1 h-[46px] text-[15px]"
            >
              {isLoading ? 'Sending reset link...' : 'Send reset link'}
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

        {resetEmailSent && (
          <div>
            <p className="text-[15px] text-[var(--text-secondary)]">
              Didn't receive the email?{' '}
              <button
                type="button"
                onClick={() => {
                  setResetEmailSent(false);
                  clearSuccess();
                }}
                className="font-medium text-primary-600 transition-colors hover:text-primary-700"
              >
                Try again
              </button>
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;
