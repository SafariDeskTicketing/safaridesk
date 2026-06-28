import React, { useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EyeOff, Eye } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layouts/AuthLayout';
import { Lock, Mail } from '../../components/icons/AppIcons';

const loginSchema = z.object({
  email: z.string().min(1, 'Email or username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = React.useState(false);
  const [logged, setLogged] = React.useState(false);
  const { login, isLoading, error, clearError, success, clearSuccess, url, mfaMethod } = useAuthStore();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    clearError();
    await login(data.email, data.password);
  };


  useEffect(() => {
    if (!success) return;
    if (url !== 'dashboard') {
      setLogged(true);
    }
    const redirect = setTimeout(() => {
      navigate(`/${url}`);
      clearSuccess();
    }, 1000);
    return () => clearTimeout(redirect);
  }, [success, url, navigate, clearSuccess]);



  return (
    <AuthLayout>
      <div className="space-y-8">
        <div className="space-y-2.5">
          <h2 className="text-[36px] font-semibold leading-[1.08] tracking-[-0.02em] text-[var(--text-primary)]">
            Sign in
          </h2>
          <p className="max-w-[430px] text-[15px] font-medium leading-[1.6] text-[var(--text-secondary)]">
            Access your workspace to continue triaging tickets and resolving customer issues.
          </p>
        </div>

        {error && (
          <div className="rounded-[var(--shell-radius)] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2.5">
            <p className="text-[15px] text-[var(--status-danger-text)]">{error}</p>
          </div>
        )}

        {logged && (
          <div className="rounded-[var(--shell-radius)] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2.5">
            <p className="text-[15px] text-[var(--status-success-text)]">
              {mfaMethod === 'totp'
                ? 'Please enter the code from your authenticator app.'
                : 'An OTP has been sent to your email. Please check your inbox.'}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Email or username"
            icon={Mail}
            placeholder="you@company.com"
            className="h-[48px] text-[17px]"
            fullWidth
            {...register('email')}
            error={errors.email?.message}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            icon={Lock}
            fullWidth
            className="h-[48px] text-[17px]"
            type={showPassword ? 'text' : 'password'}
            {...register('password')}
            error={errors.password?.message}
            rightElement={
              <button
                type="button"
                className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="text-[14px] font-medium text-primary-600 underline-offset-2 transition-colors hover:text-primary-700 hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={isLoading}
            className="mt-2 h-[48px] text-[15px] font-semibold"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        {import.meta.env.DEV && (
          <div className="pt-1">
            <p className="text-[15px] text-[var(--text-secondary)]">
              Dev only:
              {' '}
              <Link to="/join" className="font-medium text-primary-600 hover:text-primary-700">
                create a workspace
              </Link>
            </p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};


export default Login
