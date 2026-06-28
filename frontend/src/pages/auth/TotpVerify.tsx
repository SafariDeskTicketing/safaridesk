import React, { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layouts/AuthLayout';
import { ChevronLeft, ShieldCheck } from '../../components/icons/AppIcons';


const totpSchema = z.object({
    otp: z.string().min(6, 'Code must be 6 digits').max(6, 'Code must be 6 digits'),
});

type TOTPFormData = z.infer<typeof totpSchema>;

const TOTPVerification: React.FC = () => {
    const navigate = useNavigate();
    const { verifyOTP, isLoading, error, clearError, success, cleanFlow, isAuthenticated, sessionKey } = useAuthStore();

    const { register, handleSubmit, formState: { errors }, setValue } = useForm<TOTPFormData>({
        resolver: zodResolver(totpSchema),
        defaultValues: {
            otp: '',
        },
    });

    useEffect(() => {
        if (!sessionKey && !isAuthenticated) {
            navigate('/auth', { replace: true });
            return;
        }

        if (isAuthenticated) {
            cleanFlow();
            setTimeout(() => navigate('/dashboard'), 1000);
        }
    }, [sessionKey, isAuthenticated, cleanFlow, navigate]);

    const onSubmit = async (data: TOTPFormData) => {
        clearError();
        await verifyOTP(data.otp);
    };

    // Auto-focus and format OTP input
    const handleOTPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
        setValue('otp', value);
    };

    return (
        <AuthLayout>
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--shell-radius)] border border-[var(--status-info-border)] bg-[var(--status-info-bg)] leading-none">
                        <span className="flex items-center justify-center shrink-0 leading-none">
                            <ShieldCheck size={16} stroke={1.8} className="text-[var(--status-info-text)]" />
                        </span>
                    </div>
                    <h2 className="text-[28px] font-semibold leading-tight text-[var(--text-primary)]">Authenticator Code</h2>
                    <p className="text-[15px] font-medium text-[var(--text-secondary)]">
                        Enter the 6-digit code from your authenticator app
                    </p>
                </div>

                {error && (
                    <div className="rounded-[var(--shell-radius)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3">
                        <p className="text-[15px] text-[var(--status-danger-text)]">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="rounded-[var(--shell-radius)] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-3">
                        <p className="text-[15px] text-[var(--status-success-text)]">
                            Verified successfully! Redirecting to your workspace...
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="mb-2 block text-[15px] font-semibold text-[var(--text-secondary)]">
                            Authenticator Code
                        </label>
                        <Input
                            type="text"
                            placeholder="Enter 6-digit code"
                            maxLength={6}
                            fullWidth
                            {...register('otp')}
                            onChange={handleOTPChange}
                            error={errors.otp?.message}
                            className="h-[48px] text-center text-[20px] font-medium tracking-[0.35em]"
                        />
                    </div>

                    <Button
                        type="submit"
                        fullWidth
                        size="lg"
                        loading={isLoading}
                        className="mt-1 h-[48px] text-[15px]"
                    >
                        {isLoading ? 'Verifying...' : 'Verify Code'}
                    </Button>
                </form>

                <div>
                    <p className="text-[15px] text-[var(--text-secondary)]">
                        Open your authenticator app (Google Authenticator, Authy, etc.) and enter the current code for SafariDesk.
                    </p>
                </div>

                <div>
                    <button
                        type="button"
                        onClick={() => navigate("/auth")}
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

export default TOTPVerification;
