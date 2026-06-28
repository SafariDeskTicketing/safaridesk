import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Mail, CheckCircle } from 'lucide-react';
import axios from 'axios';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { APIS } from '../../services/apis';
import { useAuthStore } from '../../stores/authStore';
import { useValidateDomain } from '../../hooks/useValidateDomain';

const CustomerLogin: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { businessId, businessName } = useValidateDomain();
  const { isAuthenticated, user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);

  const redirectError = useMemo(() => searchParams.get('error'), [searchParams]);

  useEffect(() => {
    if (isAuthenticated && user?.category === 'CUSTOMER') {
      navigate('/helpcenter/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (redirectError) {
      setError(redirectError);
    }
  }, [redirectError]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setLinkSent(false);

    try {
      await axios.post(APIS.CUSTOMER_LOGIN, {
        email,
        business_id: businessId,
      });

      setLinkSent(true);
    } catch (loginError) {
      const message = axios.isAxiosError(loginError)
        ? loginError.response?.data?.message || loginError.response?.data?.detail || loginError.message
        : 'An unexpected error occurred';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.12)] dark:border-subtle dark:bg-surface-elevated lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-slate-900 px-8 py-10 text-white sm:px-10 lg:px-12">
            <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_top_right,_white_0,_transparent_30%),radial-gradient(circle_at_bottom_left,_white_0,_transparent_26%)]" />
            <div className="relative max-w-xl space-y-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-100/90">{businessName || 'Customer portal'}</p>
              <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Request a secure login link for the help center.
              </h1>
              <p className="max-w-lg text-sm leading-6 text-primary-50/90 sm:text-[15px]">
                Enter the email address tied to your support account and we’ll send you a one-time link. No password is needed.
              </p>
              <div className="grid gap-3 pt-2 text-sm text-primary-50/90 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  Single-use link, valid for 15 minutes
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  Keeps customer access passwordless
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8 lg:px-10 lg:py-12">
            <div className="mx-auto flex max-w-md flex-col gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-300">Welcome back</p>
                <h2 className="mt-2 text-[32px] font-semibold tracking-[-0.03em] text-slate-900 dark:text-[var(--text-primary)]">
                  Email login link
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-[var(--text-muted)]">
                  We’ll send a secure sign-in link to the email address you enter.
                </p>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                  {error}
                </div>
              )}

              {linkSent && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>If an account exists, a login link has been sent. Check your inbox and open the link from this device.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Email"
                  icon={Mail}
                  type="email"
                  placeholder="you@example.com"
                  fullWidth
                  className="h-[48px] text-[16px]"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />

                <div className="flex items-center justify-between gap-4 text-sm">
                  <Link to="/helpcenter" className="font-medium text-primary-600 transition-colors hover:text-primary-700">
                    Back to help center
                  </Link>
                </div>

                <Button type="submit" fullWidth size="lg" loading={isLoading} className="h-[48px] text-[15px] font-semibold">
                  {isLoading ? 'Sending link...' : 'Send login link'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto fixed bottom-4 left-4 text-left text-[length:var(--font-meta)] text-[var(--text-muted)] sm:bottom-6 sm:left-6">
        Powered by{' '}
        <a
          href="https://safaridesk.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary-600 hover:text-primary-700"
        >
          SafariDesk
        </a>
      </div>
    </div>
  );
};

export default CustomerLogin;