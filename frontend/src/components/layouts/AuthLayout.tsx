import React, { useEffect, useMemo, useState } from 'react';
import { useValidateDomain } from '../../hooks/useValidateDomain';
import authBackdrop from '../../assets/backdrop.jpg';
import { CheckCircle, ChevronLeft } from '../icons/AppIcons';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const { businessName, businessLogoUrl, businessAuthBackdropUrl } = useValidateDomain();
  const brandName = businessName || 'SafariDesk';
  const previewImage = businessAuthBackdropUrl || authBackdrop;
  const [heroImageSrc, setHeroImageSrc] = useState(previewImage);

  const brandInitials = brandName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    setHeroImageSrc(previewImage);
  }, [previewImage]);

  const highlights = useMemo(
    () => [
      'Enterprise-grade security and compliance',
      'Centralized business intelligence',
      '24/7 dedicated operational support',
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-primary)]">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative flex min-h-screen flex-col bg-[linear-gradient(180deg,var(--card-bg)_0%,var(--surface-subtle)_100%)]">
          <div className="flex items-center gap-3 px-[var(--shell-panel-padding)] py-[calc(var(--shell-page-padding)+6px)]">
            <a
              href="https://safaridesk.io/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 no-underline"
            >
              {businessLogoUrl ? (
                <img
                  src={businessLogoUrl}
                  alt={`${brandName} logo`}
                  className="h-9 w-9 rounded-full object-contain"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-[13px] font-semibold uppercase text-white">
                  {brandInitials || 'SD'}
                </div>
              )}
              <div className="text-[26px] font-semibold tracking-[-0.02em] text-primary-600">
                {brandName}
              </div>
            </a>
          </div>

          <div className="flex flex-1 items-center justify-center px-[var(--shell-panel-padding)] py-[calc(var(--shell-page-padding)+6px)]">
            <div className="w-full max-w-[600px] rounded-[22px] bg-white/55 p-[var(--shell-panel-padding)] shadow-[var(--shell-shadow-md)] backdrop-blur-sm dark:bg-[rgba(32,39,35,0.55)] [&_h2]:text-[clamp(32px,2.6vw,44px)] [&_p]:text-[16px] [&_label]:text-[15px]">
              {children}
            </div>
          </div>

          <div className="px-[var(--shell-panel-padding)] pb-[calc(var(--shell-page-padding)+6px)] text-left text-[var(--font-meta)] text-[var(--text-muted)]">
            Powered by{' '}
            <a
              href="https://safaridesk.io/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary-600 hover:text-primary-700"
            >
              SafariDesk
            </a>
          </div>

          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-14 bg-gradient-to-r from-transparent to-white/45 dark:to-black/20 lg:block" />
        </section>

        <aside className="relative hidden min-h-screen overflow-hidden lg:flex lg:flex-col">
          <img
            src={heroImageSrc}
            alt=""
            onError={() => setHeroImageSrc(authBackdrop)}
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(155deg, hsl(var(--primary-950-hsl) / 0.82) 0%, hsl(var(--primary-900-hsl) / 0.68) 45%, hsl(var(--primary-800-hsl) / 0.78) 100%)',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 82% 10%, hsl(var(--primary-300-hsl) / 0.20) 0%, hsl(var(--primary-300-hsl) / 0) 38%), radial-gradient(circle at 15% 88%, hsl(var(--primary-500-hsl) / 0.20) 0%, hsl(var(--primary-500-hsl) / 0) 44%)',
            }}
          />

          <div className="relative z-10 flex items-center justify-end px-[var(--shell-panel-padding)] py-[calc(var(--shell-page-padding)+8px)]">
            <a
              href="https://safaridesk.io/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-[12px] font-medium text-white/88 transition-colors hover:text-white"
            >
              <ChevronLeft size={14} stroke={1.8} className="mr-1" />
              Back to site
            </a>
          </div>

          <div className="relative z-10 flex flex-1 items-center px-[var(--shell-panel-padding)] py-[calc(var(--shell-page-padding)+6px)]">
            <div className="w-full max-w-[640px] text-left text-white">
              <a
                href="https://safaridesk.io/helpcenter/new"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-medium text-white/90"
                style={{
                  borderColor: 'hsl(var(--primary-300-hsl) / 0.42)',
                  background: 'hsl(var(--primary-500-hsl) / 0.20)',
                }}
              >
                Unified Access Portal
              </a>

              <h2 className="mt-6 max-w-[620px] text-[clamp(34px,3.6vw,56px)] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
                Powering operational excellence for modern teams.
              </h2>

              <p className="mt-5 max-w-[560px] text-[clamp(16px,1.05vw,18px)] leading-[1.62] text-white/82">
                Log in to your workspace to manage requests, automate support workflows, and keep service quality consistent.
              </p>

              <ul className="mt-8 space-y-3">
                {highlights.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-[14px] text-white/92">
                    <CheckCircle
                      size={16}
                      stroke={2}
                      style={{ color: 'hsl(var(--primary-200-hsl))' }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AuthLayout;
