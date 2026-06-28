import {
  BookOpen,
  PlusCircle,
  Sun,
  Moon,
  Home,
  Menu,
  X,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { useUIStore } from '../../../stores/uiStore';
import { useValidateDomain } from '../../../hooks/useValidateDomain';
import { Dropdown } from '../../../components/ui/Dropdown';

const navLinks = [
  { to: '/helpcenter', label: 'Overview', icon: Home, match: 'exact' as const },
  { to: '/helpcenter/kb', label: 'Knowledge Base', icon: BookOpen, match: 'prefix' as const },
];

export const CustomerHeader = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const location = useLocation();
  const { theme, setTheme } = useUIStore();
  const { businessName, businessLogoUrl } = useValidateDomain();
  const isCustomerAuthenticated = isAuthenticated && user?.category === 'CUSTOMER';
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Determine if light mode is active
  let isLightMode = false;
  if (theme === 'light') {
    isLightMode = true;
  } else if (theme === 'system') {
    if (typeof window !== 'undefined') {
      isLightMode = !window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  }

  const isDarkTheme =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const getThemeIcon = () => (isDarkTheme ? Sun : Moon);

  const ThemeIcon = getThemeIcon();
  const isCreateTicketActive = location.pathname.startsWith('/helpcenter/new');

  const handleThemeToggle = () => {
    setTheme(isDarkTheme ? 'light' : 'dark');
  };

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileNavOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileNavOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileNavOpen]);

  const isActive = (path: string, match: 'exact' | 'prefix') => {
    if (match === 'exact') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const initials =
    businessName
      ?.split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SD';

  const handleLogout = () => {
    logout();
    navigate('/helpcenter/login', { replace: true });
  };

  const accountMenuOptions = [
    {
      label: `${user?.first_name || 'Account'} ${user?.last_name || ''}`,
      onClick: () => { },
      variant: 'default' as const,
    },
    {
      label: 'Sign out',
      onClick: handleLogout,
      variant: 'danger' as const,
    },
  ];

  return (
    <header
      className={`sticky top-0 z-40 border-b border-slate-200/80 backdrop-blur dark:border-subtle ${
        isLightMode ? 'bg-[rgb(238,240,246)]' : 'dark:bg-surface-elevated'
      }`}
    >
      <div className="w-full px-4 py-3 sm:px-5 lg:px-6">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex min-w-0 items-center gap-3">
            {businessLogoUrl ? (
              <img
                src={businessLogoUrl}
                alt={`${businessName || 'SafariDesk'} logo`}
                className="h-9 w-9 rounded-lg border border-slate-200 bg-white object-contain dark:border-subtle"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 font-semibold text-primary-800 dark:bg-primary-900/60 dark:text-primary-100">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                Help Center
              </p>
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-[var(--text-primary)]">
                {businessName || 'SafariDesk'}
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map(({ to, label, icon: Icon, match }) => (
              <Link
                key={to}
                to={to}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(to, match)
                    ? 'bg-white text-primary-700 shadow-sm ring-1 ring-slate-200 dark:bg-primary-900/45 dark:text-primary-100 dark:ring-subtle'
                    : 'text-slate-600 hover:bg-white hover:text-primary-700 dark:text-[var(--text-primary)] dark:hover:bg-surface-hover'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 justify-end">
            <Link
              to="/helpcenter/new"
              className={`hidden h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors sm:inline-flex ${
                isCreateTicketActive
                  ? 'bg-primary-700 text-white shadow-sm'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              <PlusCircle className="h-4 w-4" />
              Create ticket
            </Link>
            <button
              onClick={() => setIsMobileNavOpen((open) => !open)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 lg:hidden dark:border-subtle dark:text-[var(--text-primary)] dark:hover:bg-surface-hover"
              aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileNavOpen}
              aria-controls="customer-mobile-nav"
            >
              {isMobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <button
              onClick={handleThemeToggle}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:border-subtle dark:text-[var(--text-primary)] dark:hover:bg-surface-hover"
              aria-label="Toggle theme"
            >
              <ThemeIcon size={18} />
            </button>
            {isCustomerAuthenticated ? (
              <Dropdown
                trigger={
                  <button className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white cursor-pointer hover:bg-primary-700 transition-colors">
                    {user?.first_name.charAt(0) || 'N'}
                    {user?.last_name.charAt(0) || 'A'}
                  </button>
                }
                options={accountMenuOptions}
                compact
              />
            ) : (
              <Link
                to="/helpcenter/login"
                className="inline-flex h-9 items-center rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-40 lg:hidden ${isMobileNavOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!isMobileNavOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/25 backdrop-blur-[1px] transition-opacity duration-300 ${
            isMobileNavOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsMobileNavOpen(false)}
          tabIndex={isMobileNavOpen ? 0 : -1}
          aria-label="Close navigation overlay"
        />
        <aside
          id="customer-mobile-nav"
          className={`absolute left-0 top-0 h-screen w-[84vw] max-w-xs border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-subtle dark:bg-surface-elevated ${
            isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-subtle">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
                  Navigation
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-[var(--text-primary)]">
                  Help Center
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:border-subtle dark:text-[var(--text-primary)] dark:hover:bg-surface-hover"
                aria-label="Close navigation menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-2 px-4 py-4 bg-white dark:bg-surface-elevated">
              <Link
                to="/helpcenter/new"
                onClick={() => setIsMobileNavOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100 dark:border-primary-900/40 dark:bg-primary-900/25 dark:text-primary-100"
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span>Create ticket</span>
              </Link>
              {navLinks.map(({ to, label, icon: Icon, match }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setIsMobileNavOpen(false)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                    isActive(to, match)
                      ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900/40 dark:bg-primary-900/25 dark:text-primary-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-subtle dark:bg-surface-elevated dark:text-[var(--text-primary)] dark:hover:bg-surface-hover'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </aside>
      </div>
    </header>
  );
};
