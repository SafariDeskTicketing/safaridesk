import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { AlertCircle, Loader2 } from 'lucide-react';
import { APIS } from '../../services/apis';
import { useAuthStore } from '../../stores/authStore';

const CustomerMagicLogin: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setTokens, isAuthenticated, user } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your login link...');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      if (isAuthenticated && user?.category === 'CUSTOMER') {
        navigate('/helpcenter/dashboard', { replace: true });
        return;
      }
      navigate('/helpcenter/login?error=Missing%20login%20token', { replace: true });
      return;
    }

    const verify = async () => {
      try {
        const response = await axios.get(APIS.CUSTOMER_MAGIC_LOGIN_VERIFY, {
          params: { token },
        });

        setTokens(response.data.access, response.data.refresh);
        navigate(response.data.redirect_to || '/helpcenter/dashboard', { replace: true });
      } catch (error) {
        const backendMessage = axios.isAxiosError(error)
          ? error.response?.data?.message || 'Invalid or expired login link.'
          : 'Invalid or expired login link.';
        setStatus('error');
        setMessage(backendMessage);
        navigate(`/helpcenter/login?error=${encodeURIComponent(backendMessage)}`, { replace: true });
      }
    };

    void verify();
  }, [isAuthenticated, navigate, searchParams, setTokens, user?.category]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-12 sm:px-6 lg:py-16">
        <div className="w-full rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_25px_80px_rgba(15,23,42,0.12)] dark:border-subtle dark:bg-surface-elevated">
          {status === 'loading' ? (
            <div className="space-y-5">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/25 dark:text-primary-300">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-[var(--text-primary)]">
                Signing you in
              </h1>
              <p className="text-sm leading-6 text-slate-600 dark:text-[var(--text-muted)]">{message}</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-300">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-[var(--text-primary)]">
                Login link could not be used
              </h1>
              <p className="text-sm leading-6 text-slate-600 dark:text-[var(--text-muted)]">{message}</p>
              <Link
                to="/helpcenter/login"
                className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
              >
                Request a new link
              </Link>
            </div>
          )}
          <p className="mt-8 text-left text-[length:var(--font-meta)] text-[var(--text-muted)]">
            Powered by <a href="https://safaridesk.io/" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-600 hover:text-primary-700">SafariDesk</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomerMagicLogin;
