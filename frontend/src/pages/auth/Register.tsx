import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Alert from '../../components/ui/Alert';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import z from 'zod';
import AuthLayout from '../../components/layouts/AuthLayout';
import { Building2, CheckCircle, ChevronLeft, Mail, Sparkles, User } from '../../components/icons/AppIcons';

const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  subdomain: z.string()
    .min(3, 'Subdomain must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Subdomain can only contain lowercase letters, numbers, and hyphens'),
  organization_size: z.enum(['< 100', '100-1000', '> 1000'], {
    required_error: 'Please select organization size',
  }),
});

type RegisterFormData = z.infer<typeof registerSchema>;

// API interface for reference
interface RegisterData {
  email: string;
  firstName: string;
  lastName: string;
  business_name: string;
  subdomain: string;
  organization_size: string;
}

const Register: React.FC = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [showAlert, setShowAlert] = useState(false);
    const totalSteps = 2;

    const { register: registerBusiness, isLoading, error, clearError, message } = useAuthStore();

    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
        setValue,
        trigger,
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
    });

    const businessName = watch('business_name');

    useEffect(() => {
        if (!businessName) return;

        const domain = businessName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 20);

        setValue('subdomain', domain);
    }, [businessName, setValue]);

    const nextStep = async () => {
        if (currentStep >= totalSteps) return;

        const isValid =
            currentStep === 1
                ? await trigger(['firstName', 'lastName', 'email'])
                : await trigger(['business_name', 'subdomain', 'organization_size']);

        if (isValid) {
            setCurrentStep((prev) => prev + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    const onSubmit = async (data: RegisterFormData) => {
        clearError();

        const registerData: RegisterData = {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            business_name: data.business_name,
            subdomain: data.subdomain,
            organization_size: data.organization_size,
        };

        const response = await registerBusiness(registerData) as any;
        if (response?.site_url) {
            setShowAlert(true);
            setTimeout(() => {
                window.location.replace(response.site_url);
            }, 1000);
        }
    };

    return (
        <AuthLayout>
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--shell-radius)] border border-[var(--status-success-border)] bg-[var(--status-success-bg)]">
                        <Sparkles size={16} stroke={1.8} className="text-primary-600" />
                    </div>
                    <h2 className="text-[28px] font-semibold leading-tight text-[var(--text-primary)]">Create workspace</h2>
                    <p className="max-w-[380px] text-[15px] font-medium text-[var(--text-secondary)]">
                        Set up your support workspace in two quick steps.
                    </p>
                </div>

                {showAlert && (
                    <Alert
                        message="Workspace created. Redirecting to your site..."
                        type="info"
                        onClose={() => setShowAlert(false)}
                    />
                )}

                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        {Array.from({ length: totalSteps }, (_, index) => {
                            const stepNumber = index + 1;
                            const isCompleted = stepNumber < currentStep;
                            const isCurrent = stepNumber === currentStep;

                            return (
                                <React.Fragment key={stepNumber}>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[13px] font-medium ${
                                                isCompleted
                                                    ? 'border-primary-600 bg-primary-600 text-white'
                                                    : isCurrent
                                                        ? 'border-primary-600 text-primary-700'
                                                        : 'border-[var(--border-color)] text-[var(--text-muted)]'
                                            }`}
                                        >
                                            {isCompleted ? <CheckCircle size={12} stroke={2} /> : stepNumber}
                                        </span>
                                        <span
                                            className={`text-[13px] font-semibold ${
                                                isCompleted || isCurrent ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                                            }`}
                                        >
                                            {stepNumber === 1 ? 'Personal' : 'Workspace'}
                                        </span>
                                    </div>

                                    {stepNumber < totalSteps && (
                                        <span
                                            className={`h-px flex-1 ${stepNumber < currentStep ? 'bg-primary-600' : 'bg-[var(--border-color)]'}`}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {error && (
                    <div className="rounded-[var(--shell-radius)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2.5">
                        <p className="text-[15px] text-[var(--status-danger-text)]">{error}</p>
                    </div>
                )}

                {message && (
                    <div className="rounded-[var(--shell-radius)] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2.5">
                        <p className="text-[15px] text-[var(--status-success-text)]">
                            Your business has been set up successfully. Check your email for next steps.
                        </p>
                    </div>
                )}

                <div className="space-y-4">
                    {currentStep === 1 && (
                        <>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Input
                                    label="First name"
                                    placeholder="Enter first name"
                                    icon={User}
                                    fullWidth
                                    className="h-[46px] text-[16px]"
                                    {...register('firstName')}
                                    error={errors.firstName?.message}
                                />

                                <Input
                                    label="Last name"
                                    placeholder="Enter last name"
                                    icon={User}
                                    fullWidth
                                    className="h-[46px] text-[16px]"
                                    {...register('lastName')}
                                    error={errors.lastName?.message}
                                />
                            </div>

                            <Input
                                label="Email address"
                                placeholder="you@company.com"
                                type="email"
                                icon={Mail}
                                fullWidth
                                className="h-[46px] text-[16px]"
                                {...register('email')}
                                error={errors.email?.message}
                            />
                        </>
                    )}

                    {currentStep === 2 && (
                        <>
                            <Input
                                label="Workspace name"
                                icon={Building2}
                                fullWidth
                                className="h-[46px] text-[16px]"
                                {...register('business_name')}
                                error={errors.business_name?.message}
                                placeholder="Enter workspace name"
                            />

                            <Input
                                label="Subdomain"
                                fullWidth
                                className="h-[46px] text-[16px]"
                                {...register('subdomain')}
                                error={errors.subdomain?.message}
                                placeholder="company-name"
                            />

                            <Select
                                label="Organization size"
                                value={watch('organization_size') || ''}
                                onChange={(value) => setValue('organization_size', value as '< 100' | '100-1000' | '> 1000')}
                                options={[
                                    { value: '< 100', label: 'Less than 100 agents' },
                                    { value: '100-1000', label: '100 to 1000 agents' },
                                    { value: '> 1000', label: 'More than 1000 agents' },
                                ]}
                                placeholder="Select organization size"
                                error={errors.organization_size?.message}
                                required
                                size="md"
                            />
                        </>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        disabled={currentStep === 1}
                        className="h-[46px] px-5 text-[15px]"
                    >
                        <ChevronLeft size={14} stroke={1.8} className="mr-1" />
                        Previous
                    </Button>

                    {currentStep < totalSteps ? (
                        <Button type="button" onClick={nextStep} className="h-[46px] px-5 text-[15px]">
                            Next
                        </Button>
                    ) : (
                        <Button
                            type="submit"
                            onClick={handleSubmit(onSubmit)}
                            loading={isLoading}
                            className="h-[46px] px-5 text-[15px]"
                        >
                            {isLoading ? 'Creating workspace...' : 'Create workspace'}
                        </Button>
                    )}
                </div>

                <div className="pt-1">
                    <button
                        type="button"
                        onClick={() => navigate('/auth')}
                        className="inline-flex items-center text-[15px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                    >
                        <ChevronLeft size={14} stroke={1.8} className="mr-1" />
                        Back to sign in
                    </button>
                </div>
            </div>
        </AuthLayout>
    );
};

export default Register;
