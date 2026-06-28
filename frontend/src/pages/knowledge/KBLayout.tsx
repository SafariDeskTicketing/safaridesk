import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FileText, Folder, BarChart2, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import http from '../../services/http';
import { APIS } from '../../services/apis';

interface KBLayoutProps {
  children: React.ReactNode;
}

const KB_TABS: Array<{
  to: string;
  label: string;
  icon: React.ElementType;
  exact: boolean;
  adminOnly?: boolean;
  requiresAILearning?: boolean;
}> = [
  { to: '/knowledge', label: 'Articles', icon: FileText, exact: true },
  { to: '/knowledge/categories', label: 'Categories', icon: Folder, exact: false },
  { to: '/knowledge/ai-suggestions', label: 'AI Suggestions', icon: Sparkles, exact: false, adminOnly: true, requiresAILearning: true },
  { to: '/knowledge/analytics', label: 'Analytics', icon: BarChart2, exact: false },
];

// Hide tab bar on article detail / editor routes
const HIDE_TABS_PATTERNS = [
  /^\/knowledge\/articles\/.+\/edit$/,
  /^\/knowledge\/articles\/new$/,
  /^\/knowledge\/articles\/.+$/,
];

const ADMIN_ROLES = new Set(['admin', 'owner', 'manager', 'super_admin', 'superadmin', 'superuser']);

const roleKey = (role: unknown): string => {
  const raw = typeof role === 'string' ? role : (role as { name?: string } | null)?.name;
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, '_');
};

const parseBoolSetting = (raw: string | undefined, fallback = false): boolean => {
  if (raw === undefined || raw === null) return fallback;
  const value = String(raw).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(value)) return true;
  if (['false', '0', 'no', 'off', ''].includes(value)) return false;
  return fallback;
};

const KBLayout: React.FC<KBLayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user } = useAuthStore();
  const hideTabs = HIDE_TABS_PATTERNS.some((pattern) => pattern.test(location.pathname));
  const isAdmin = ADMIN_ROLES.has(roleKey(user?.role));
  const [aiLearningEnabled, setAiLearningEnabled] = useState(false);

  // Fetch the AI learning toggle so we can hide the AI Suggestions tab when
  // it's switched off in KB settings. Admins-only request — silently defaults
  // to false on 403/404 (e.g. backend hasn't shipped the setting yet).
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    http
      .get<{ results?: Array<{ key: string; value: string }> }>(APIS.KB_SETTINGS)
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.data)
          ? res.data
          : (Array.isArray(res.data?.results) ? res.data.results : []);
        const row = rows.find((r) => r.key === 'enable_ai_learning');
        setAiLearningEnabled(parseBoolSetting(row?.value, false));
      })
      .catch(() => {
        if (!cancelled) setAiLearningEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const visibleTabs = KB_TABS.filter((tab) => {
    if (tab.adminOnly && !isAdmin) return false;
    if (tab.requiresAILearning && !aiLearningEnabled) return false;
    return true;
  });

  return (
    <section className="w-full bg-[var(--app-bg)]">
      <div className="sd-route-shell overflow-hidden">
        <div className="sd-route-body">
          {!hideTabs && (
            <div className="border-b border-[var(--border-color)] bg-[var(--card-bg)] px-[var(--shell-page-padding)]">
              <div className="flex items-center gap-1">
                {visibleTabs.map((tab) => {
                  const isActive = tab.exact
                    ? location.pathname === tab.to || location.pathname === '/knowledge/'
                    : location.pathname.startsWith(tab.to);
                  return (
                    <NavLink
                      key={tab.to}
                      to={tab.to}
                      className={[
                        'flex items-center gap-2 border-b-2 px-3 py-3.5 text-[length:var(--font-label)] transition-colors',
                        isActive
                          ? 'border-[var(--primary,#4F46E5)] text-[var(--text-primary)]'
                          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                      ].join(' ')}
                      style={isActive ? { fontWeight: 'var(--font-weight-label)' } : undefined}
                    >
                      <tab.icon size={15} />
                      {tab.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          )}
          <div className={!hideTabs ? 'p-[var(--shell-page-padding)]' : ''}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
};

export default KBLayout;
