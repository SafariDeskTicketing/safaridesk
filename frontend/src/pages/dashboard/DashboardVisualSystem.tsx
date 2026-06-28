import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Layers3,
  Mail,
  MailWarning,
  Minus,
  Ticket,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  AdminDashboardResponse,
  AgentDashboardResponse,
  DashboardBlockerItem,
  DashboardBreakdownItem,
  DashboardMailboxHealth,
  DashboardMetric,
  DashboardOldestTicket,
  DashboardRiskAgentItem,
  DashboardTone,
} from '../../types';
import {
  DASHBOARD_CHART_COLORS,
  DashboardCompactBarChart,
  DashboardDonutSummaryChart,
  DashboardHeroAreaChart,
  DashboardMiniAreaTrendChart,
  DashboardStatusSparkline,
} from './RoleDashboardCharts';

const tonePalette: Record<DashboardTone, { border: string; glow: string; bg: string; color: string }> = {
  info: {
    border: 'var(--status-info-border)',
    glow: 'rgba(255,255,255,0.035)',
    bg: 'var(--status-info-bg)',
    color: 'var(--status-info-text)',
  },
  success: {
    border: 'var(--status-success-border)',
    glow: 'rgba(255,255,255,0.035)',
    bg: 'var(--status-success-bg)',
    color: 'var(--status-success-text)',
  },
  warning: {
    border: 'var(--status-warning-border)',
    glow: 'rgba(255,255,255,0.035)',
    bg: 'var(--status-warning-bg)',
    color: 'var(--status-warning-text)',
  },
  danger: {
    border: 'var(--status-danger-border)',
    glow: 'rgba(255,255,255,0.035)',
    bg: 'var(--status-danger-bg)',
    color: 'var(--status-danger-text)',
  },
  neutral: {
    border: 'var(--status-neutral-border)',
    glow: 'rgba(255,255,255,0.035)',
    bg: 'var(--status-neutral-bg)',
    color: 'var(--status-neutral-text)',
  },
};

const dashboardSurfaceClassName =
  'rounded-[12px] border border-[var(--border-color)] bg-[var(--card-bg)] shadow-[0_8px_22px_rgba(16,24,40,0.06)] dark:shadow-[0_10px_24px_rgba(1,4,9,0.22)]';

const dashboardLabelClass = 'text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]';
const dashboardTitleClass = 'text-[18px] font-bold tracking-[-0.01em] text-[var(--text-primary)]';
const dashboardBodyTextClass = 'text-[13px] font-bold leading-5 text-[var(--text-secondary)]';
const dashboardLinkClass =
  'mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-[var(--status-success-text)] transition-colors hover:text-[var(--text-primary)]';

const formatNumber = (value: number | string) => {
  if (typeof value === 'string') return value;
  if (value >= 1000) return value.toLocaleString();
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const getTrendCopy = (metric: DashboardMetric) => {
  return metric.trend_label || 'From previous period';
};

const getTrendToneClass = (metric: DashboardMetric) => {
  void metric;
  return 'text-white';
};

const getMetricTone = (metric: DashboardMetric) => tonePalette[metric.tone] || tonePalette.neutral;

const getMetricDeltaState = (metric: DashboardMetric): 'positive' | 'negative' | 'neutral' => {
  if (metric.trend_direction === 'flat' || metric.trend_delta_pct === undefined) {
    return 'neutral';
  }

  if (metric.key === 'sla_compliance_pct' || metric.key === 'resolved_today') {
    return metric.trend_direction === 'down' ? 'negative' : 'positive';
  }

  return metric.trend_direction === 'down' ? 'positive' : 'negative';
};

const getMetricDeltaBadgeClass = (metric: DashboardMetric) => {
  const state = getMetricDeltaState(metric);

  if (state === 'positive') {
    return 'bg-[#1FC8F3] text-white shadow-[0_4px_10px_rgba(31,200,243,0.28)]';
  }

  if (state === 'negative') {
    return 'bg-[#F25B57] text-white shadow-[0_4px_10px_rgba(242,91,87,0.24)]';
  }

  return 'bg-[#F3B63E] text-[#5E3B00] shadow-[0_4px_10px_rgba(243,182,62,0.24)]';
};

const getMetricDeltaValue = (metric: DashboardMetric) => {
  if (metric.trend_delta_pct === undefined) {
    return '0%';
  }

  return `${metric.trend_direction === 'up' ? '+' : '-'}${metric.trend_delta_pct}%`;
};

const getMetricDeltaIcon = (metric: DashboardMetric) => {
  const state = getMetricDeltaState(metric);

  if (state === 'positive') {
    return TrendingUp;
  }

  if (state === 'negative') {
    return TrendingDown;
  }

  return Minus;
};

const getMetricIcon = (metricKey: string) => {
  switch (metricKey) {
    case 'backlog':
    case 'my_open_tickets':
      return Layers3;
    case 'unassigned_tickets':
      return UserRound;
    case 'breached':
    case 'sla_at_risk':
      return AlertCircle;
    case 'resolved_today':
    case 'sla_compliance_pct':
      return CheckCircle2;
    case 'due_today':
      return Clock3;
    default:
      return Ticket;
  }
};

const DashboardPanel: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <section className={cn(dashboardSurfaceClassName, className)}>{children}</section>
);

export const DashboardKpiTrendCard: React.FC<{
  metric: DashboardMetric;
  onClick?: () => void;
}> = ({ metric, onClick }) => {
  const tone = getMetricTone(metric);
  const MetricIcon = getMetricIcon(metric.key);
  const DeltaIcon = getMetricDeltaIcon(metric);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex w-full min-w-0 items-center justify-between overflow-hidden rounded-[12px] border px-5 py-4 text-left transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_12px_24px_rgba(10,30,20,0.16)]'
      )}
      style={{
        background: '#257A42',
        borderColor: tone.border,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 34px rgba(11,30,20,0.14)',
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/10" />
      <div
        className="pointer-events-none absolute -right-10 top-6 h-24 w-24 rounded-full blur-2xl"
        style={{ backgroundColor: tone.glow }}
      />
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white">{metric.label}</p>
        <div className="mt-2 flex items-end gap-2">
          <p className="text-[34px] font-bold leading-none tracking-[-0.02em] text-white">
            {formatNumber(metric.value)}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {getMetricDeltaValue(metric) ? (
            <span className={cn('inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold leading-none', getMetricDeltaBadgeClass(metric))}>
              <DeltaIcon size={10} strokeWidth={2.4} />
              {getMetricDeltaValue(metric)}
            </span>
          ) : null}
          <p className={cn('text-[13px] font-bold', getTrendToneClass(metric))}>
            {getTrendCopy(metric)}
          </p>
        </div>
      </div>

      <div className="ml-4 flex flex-col items-end gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-white/25 bg-transparent text-white"
        >
          <MetricIcon size={18} strokeWidth={2} />
        </div>
      </div>
    </button>
  );
};

export const AnalyticsHeroCard: React.FC<{
  title: string;
  description: string;
  controls?: React.ReactNode;
  legend?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}> = ({ title, description, controls, legend, children, footer, className }) => (
  <DashboardPanel className={cn('p-4 sm:p-5', className)}>
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h3 className={dashboardTitleClass}>{title}</h3>
        <p className={cn('mt-1', dashboardBodyTextClass)}>{description}</p>
      </div>
      {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
    </div>
    {legend}
    {children}
    {footer}
  </DashboardPanel>
);

const DashboardPill: React.FC<{
  label: string;
}> = ({ label }) => (
  <span className="inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--surface-subtle)] px-3 py-1 text-[12px] font-bold text-[var(--text-secondary)]">
    {label}
  </span>
);

const HeroLegend: React.FC<{
  items: Array<{ label: string; color: string }>;
}> = ({ items }) => (
  <div className="mb-4 flex flex-wrap items-center gap-4">
    {items.map((item) => (
      <div key={item.label} className="flex items-center gap-2 text-[13px] font-bold text-[var(--text-secondary)]">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
        <span>{item.label}</span>
      </div>
    ))}
  </div>
);

export const DonutSummaryCard: React.FC<{
  title: string;
  description: string;
  data: DashboardBreakdownItem[];
  totalLabel: string;
  centerValue: number;
  rightLabel?: string;
}> = ({ title, description, data, totalLabel, centerValue, rightLabel }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <DashboardPanel className="p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className={dashboardTitleClass}>{title}</h3>
          <p className={cn('mt-1', dashboardBodyTextClass)}>{description}</p>
        </div>
        {rightLabel && <DashboardPill label={rightLabel} />}
      </div>

      <div className="grid grid-cols-1 items-center gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        <DashboardDonutSummaryChart data={data} centerValue={centerValue} centerLabel={totalLabel} />

        <div className="space-y-3">
          {data.map((item, index) => {
            const percentage = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div key={item.label} className="flex items-center justify-between gap-3 text-[14px]">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DASHBOARD_CHART_COLORS[index % DASHBOARD_CHART_COLORS.length] }} />
                  <span className="font-semibold text-[var(--text-secondary)]">{item.label}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[var(--text-primary)]">{item.value}</p>
                  <p className="text-[12px] font-bold text-[var(--text-muted)]">{percentage.toFixed(1)}%</p>
                </div>
              </div>
            );
          })}

          <button type="button" className={dashboardLinkClass}>
            View workload report
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </DashboardPanel>
  );
};

export const CompactBarCard: React.FC<{
  title: string;
  description: string;
  data: DashboardBreakdownItem[];
  orientation?: 'horizontal' | 'vertical';
  color?: string;
  footerLabel?: string;
  onFooterClick?: () => void;
  onBarClick?: (item: DashboardBreakdownItem) => void;
}> = ({ title, description, data, orientation = 'horizontal', color, footerLabel, onFooterClick, onBarClick }) => (
  <DashboardPanel className="p-4">
    <div className="mb-4">
      <h3 className="text-[16px] font-bold tracking-[-0.01em] text-[var(--text-primary)]">{title}</h3>
      <p className={cn('mt-1', dashboardBodyTextClass)}>{description}</p>
    </div>
    <DashboardCompactBarChart data={data} orientation={orientation} color={color} onItemClick={onBarClick} />
    {footerLabel && (
      <button
        type="button"
        onClick={onFooterClick}
        className={dashboardLinkClass}
      >
        {footerLabel}
        <ArrowRight size={14} />
      </button>
    )}
  </DashboardPanel>
);

export const MiniTrendCard: React.FC<{
  title: string;
  metricValue: number | string;
  metricLabel: string;
  data: { label: string; value: number }[];
  color: string;
  badge?: string;
}> = ({ title, metricValue, metricLabel, data, color, badge }) => (
  <DashboardPanel className="p-4">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[16px] font-bold tracking-[-0.01em] text-[var(--text-primary)]">{title}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[28px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">{metricValue}</span>
          <span className="text-[13px] font-bold text-[var(--text-secondary)]">{metricLabel}</span>
        </div>
      </div>
      {badge && <DashboardPill label={badge} />}
    </div>
    <DashboardMiniAreaTrendChart data={data} color={color} />
  </DashboardPanel>
);

export const MailboxHealthCard: React.FC<{
  mailbox: DashboardMailboxHealth;
  onViewAll?: () => void;
}> = ({ mailbox, onViewAll }) => {
  const statusTone = (status: string): 'healthy' | 'warning' | 'error' => {
    if (status === 'connected') return 'healthy';
    if (status === 'error') return 'error';
    return 'warning';
  };

  const statusCountCards = [
    { label: 'Connected', value: mailbox.connected },
    { label: 'Errors', value: mailbox.error },
    { label: 'Offline', value: mailbox.disconnected },
  ];

  return (
  <DashboardPanel className="p-4">
    <div className="mb-4">
        <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">Mailbox / Integration Health</h3>
        <p className={cn('mt-1', dashboardBodyTextClass)}>Mailbox connection state across active integrations.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {statusCountCards.map((item) => (
          <div key={item.label} className="rounded-[10px] border border-[var(--border-color)] bg-[var(--surface-subtle)] px-3 py-3">
            <p className="text-[11px] font-bold text-[var(--text-secondary)]">{item.label}</p>
            <p className="mt-2 text-[20px] font-semibold text-[var(--text-primary)]">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-2.5">
        {mailbox.integrations.length > 0 ? mailbox.integrations.slice(0, 4).map((integration) => (
          <div key={integration.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--border-color)] bg-[var(--surface-subtle)] px-3 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                  <Mail size={16} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{integration.label}</p>
                  <p className="truncate text-[11px] font-semibold text-[var(--text-secondary)]">{integration.department || 'Unassigned department'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'rounded-full px-2 py-1 text-[10px] font-semibold capitalize',
                  integration.status === 'connected'
                    ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
                    : integration.status === 'error'
                      ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                      : 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
                )}
              >
                {integration.status}
              </span>
              <DashboardStatusSparkline tone={statusTone(integration.status)} />
            </div>
          </div>
        )) : (
          <div className="rounded-[16px] border border-dashed border-[var(--border-color)] bg-[var(--surface-subtle)] px-4 py-8 text-center text-[12px] text-[var(--text-secondary)]">
            No mailbox integrations configured yet.
          </div>
        )}
      </div>

      <button type="button" onClick={onViewAll} className={dashboardLinkClass}>
        View all integrations
        <ArrowRight size={14} />
      </button>
    </DashboardPanel>
  );
};

export const TopSlowQueuesCard: React.FC<{
  items: AdminDashboardResponse['top_slow_queues'];
  onViewAll?: () => void;
  onRowClick?: (item: AdminDashboardResponse['top_slow_queues'][number]) => void;
}> = ({ items, onViewAll, onRowClick }) => (
  <DashboardPanel className="p-4">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">Top Slow Categories</h3>
        <p className={cn('mt-1', dashboardBodyTextClass)}>Highest average resolution times across queues.</p>
      </div>
      <DashboardPill label="By resolve time" />
    </div>

    <div className="space-y-3">
      {items.length > 0 ? items.map((item, index) => (
        <button
          key={`${item.label}-${item.category_id ?? index}`}
          type="button"
          onClick={() => onRowClick?.(item)}
          className={cn(
            'w-full text-left',
            onRowClick ? 'transition-opacity hover:opacity-85' : ''
          )}
          disabled={!onRowClick || !item.category_id}
        >
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]">
            <span className="truncate font-bold text-[var(--text-primary)]">{index + 1}. {item.label}</span>
            <span className="font-semibold text-[var(--text-secondary)]">{item.value}h</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--surface-muted)]">
            <div
              className="h-2 rounded-full bg-[#257A42]"
              style={{ width: `${Math.min(100, item.value * 6)}%` }}
            />
          </div>
        </button>
      )) : (
        <div className="rounded-[16px] border border-dashed border-[var(--border-color)] bg-[var(--surface-subtle)] px-4 py-8 text-center text-[12px] text-[var(--text-secondary)]">
          No resolved ticket history yet.
        </div>
      )}
    </div>

    <button type="button" onClick={onViewAll} className={dashboardLinkClass}>
      View all sluggish queues
      <ArrowRight size={14} />
    </button>
  </DashboardPanel>
);

const blockerIconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  no_assignee: UserRound,
  no_department: Users,
  no_category: Ticket,
  no_sla: AlertCircle,
  failed_mail_sync: MailWarning,
};

export const BlockerStripCard: React.FC<{
  items: DashboardBlockerItem[];
  onViewAll?: () => void;
}> = ({ items, onViewAll }) => (
  <DashboardPanel className="p-4">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">Ticket Blockers & Alerts</h3>
        <p className={cn('mt-1', dashboardBodyTextClass)}>Operational blockers that need admin intervention.</p>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => {
        const tone = tonePalette[item.tone];
        const Icon = blockerIconMap[item.key] || AlertCircle;
        return (
          <div key={item.key} className="rounded-[10px] border border-[var(--border-color)] bg-[var(--surface-subtle)] px-3 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-[12px]" style={{ background: tone.bg, color: tone.color }}>
                <Icon size={16} />
              </div>
              <p className="text-[12px] font-bold text-[var(--text-primary)]">{item.label}</p>
            </div>
            <p className="mt-3 text-[24px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{item.count}</p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{item.description}</p>
          </div>
        );
      })}
    </div>

    <button type="button" onClick={onViewAll} className={dashboardLinkClass}>
      View all alerts
      <ArrowRight size={14} />
    </button>
  </DashboardPanel>
);

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SD';

export const RiskTableCard: React.FC<{
  items: DashboardRiskAgentItem[];
  onViewAll?: () => void;
}> = ({ items, onViewAll }) => (
  <DashboardPanel className="p-4">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">At-Risk Agents</h3>
        <p className={cn('mt-1', dashboardBodyTextClass)}>Agents showing queue pressure or active SLA risk.</p>
      </div>
    </div>

    <div className="space-y-3">
      {items.length > 0 ? items.map((item) => (
        <div key={item.agent_id} className="grid grid-cols-[minmax(0,1.2fr)_110px_70px_80px] items-center gap-3 rounded-[10px] border border-[var(--border-color)] bg-[var(--surface-subtle)] px-3 py-3 text-[12px]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(0,200,255,0.16),rgba(37,122,66,0.22))] text-[11px] font-semibold text-[var(--text-primary)]">
              {getInitials(item.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-[var(--text-primary)]">{item.name}</p>
              <p className="truncate text-[11px] font-semibold text-[var(--text-secondary)]">{item.department}</p>
            </div>
          </div>
          <div>
            <span
              className={cn(
                'inline-flex rounded-full px-2 py-1 text-[10px] font-semibold',
                item.tone === 'danger'
                  ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                  : item.tone === 'warning'
                    ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
                    : 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
              )}
            >
              {item.status}
            </span>
          </div>
          <div className="text-right">
            <p className="font-semibold text-[var(--text-primary)]">{item.open_tickets}</p>
            <p className="text-[10px] text-[var(--text-muted)]">Open</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-[var(--text-primary)]">{formatPercent(item.sla_compliance_pct)}</p>
            <p className="text-[10px] text-[var(--text-muted)]">SLA</p>
          </div>
        </div>
      )) : (
        <div className="rounded-[16px] border border-dashed border-[var(--border-color)] bg-[var(--surface-subtle)] px-4 py-8 text-center text-[12px] text-[var(--text-secondary)]">
          No agents are currently at risk.
        </div>
      )}
    </div>

    <button type="button" onClick={onViewAll} className={dashboardLinkClass}>
      View all agents
      <ArrowRight size={14} />
    </button>
  </DashboardPanel>
);

export const OldestTicketsTableCard: React.FC<{
  items: DashboardOldestTicket[];
  onNavigate: ReturnType<typeof useNavigate>;
  onViewAll?: () => void;
}> = ({ items, onNavigate, onViewAll }) => (
  <DashboardPanel className="p-4">
    <div className="mb-4">
      <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">Oldest Tickets Assigned to Me</h3>
      <p className={cn('mt-1', dashboardBodyTextClass)}>Longest-running items in your active queue.</p>
    </div>

    <div className="space-y-2">
      {items.length > 0 ? items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onNavigate(`/ticket/${item.ticket_id}`)}
          className="grid w-full grid-cols-[minmax(0,1.25fr)_68px_74px] items-center gap-3 rounded-[10px] border border-[var(--border-color)] bg-[var(--surface-subtle)] px-3 py-3 text-left transition-colors hover:bg-[var(--hover-bg)]"
        >
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[var(--text-primary)]">{item.ticket_id}</p>
            <p className="mt-1 truncate text-[11px] font-semibold text-[var(--text-secondary)]">{item.title}</p>
          </div>
          <div className="text-right">
            <p className="text-[12px] font-semibold text-[var(--text-primary)]">{item.age_hours}h</p>
            <p className="text-[10px] text-[var(--text-muted)]">Age</p>
          </div>
          <div className="flex justify-end">
            <span
              className={cn(
                'rounded-full px-2 py-1 text-[10px] font-semibold',
                item.is_breached
                  ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                  : 'bg-[var(--status-info-bg)] text-[var(--status-info-text)]'
              )}
            >
              {item.is_breached ? 'Breached' : 'In Progress'}
            </span>
          </div>
        </button>
      )) : (
        <div className="rounded-[16px] border border-dashed border-[var(--border-color)] bg-[var(--surface-subtle)] px-4 py-8 text-center text-[12px] text-[var(--text-secondary)]">
          No assigned backlog tickets.
        </div>
      )}
    </div>

    <button type="button" onClick={onViewAll} className={dashboardLinkClass}>
      View all my tickets
      <ArrowRight size={14} />
    </button>
  </DashboardPanel>
);

export const HeroCardControls: React.FC<{
  left: string;
  right?: string;
}> = ({ left, right }) => (
  <>
    <DashboardPill label={left} />
    {right ? <DashboardPill label={right} /> : null}
  </>
);

export const buildHeroLegend = (items: Array<{ label: string; color: string }>) => <HeroLegend items={items} />;
