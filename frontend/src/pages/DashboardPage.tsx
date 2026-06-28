import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout';
import HomeLoadingSkeleton from '../components/ui/DashSkeleton';
import { Input } from '../components/ui/Input';
import { errorNotification } from '../components/ui/Toast';
import { cn } from '../lib/utils';
import { DashboardService } from '../services/dashboard';
import { useAuthStore } from '../stores/authStore';
import type {
  AdminDashboardResponse,
  AgentDashboardResponse,
  DashboardBreakdownItem,
  DashboardFilterValue,
  DashboardMetric,
  DashboardResponse,
  DashboardSingleSeriesPoint,
} from '../types';
import {
  AnalyticsHeroCard,
  BlockerStripCard,
  buildHeroLegend,
  CompactBarCard,
  DashboardKpiTrendCard,
  DonutSummaryCard,
  HeroCardControls,
  MailboxHealthCard,
  MiniTrendCard,
  OldestTicketsTableCard,
  RiskTableCard,
  TopSlowQueuesCard,
} from './dashboard/DashboardVisualSystem';
import { DashboardHeroAreaChart } from './dashboard/RoleDashboardCharts';

const FILTER_GROUP_BY: Partial<Record<DashboardFilterValue, string>> = {
  week: 'day',
  month: 'week',
  year: 'month',
};

const PERIOD_OPTIONS: Array<{ value: DashboardFilterValue; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'range', label: 'Custom Range' },
];

type DateRangeState = {
  start: string;
  end: string;
};

const getDefaultDateRange = (): DateRangeState => {
  const today = new Date().toISOString().slice(0, 10);
  return { start: today, end: today };
};

const groupByLabel = (value: string) => {
  switch (value) {
    case 'day':
      return 'Daily';
    case 'week':
      return 'Weekly';
    case 'month':
      return 'Monthly';
    default:
      return value;
  }
};

const averageSeriesValue = (points: DashboardSingleSeriesPoint[]) => {
  if (points.length === 0) return 0;
  const total = points.reduce((sum, point) => sum + point.value, 0);
  return total / points.length;
};

const sumSeriesValue = (points: DashboardSingleSeriesPoint[]) => points.reduce((sum, point) => sum + point.value, 0);

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<DashboardFilterValue>('week');
  const [draftRange, setDraftRange] = useState<DateRangeState>(getDefaultDateRange);
  const [appliedRange, setAppliedRange] = useState<DateRangeState>(getDefaultDateRange);

  const resolvedGroupBy = useMemo(() => {
    if (filter !== 'range') {
      return FILTER_GROUP_BY[filter];
    }

    const start = new Date(appliedRange.start);
    const end = new Date(appliedRange.end);
    const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
    if (diffDays <= 14) return 'day';
    if (diffDays <= 60) return 'week';
    return 'month';
  }, [appliedRange.end, appliedRange.start, filter]);

  const dashboardQuery = useQuery<DashboardResponse>({
    queryKey: ['dashboard', filter, appliedRange.start, appliedRange.end, resolvedGroupBy],
    queryFn: () =>
      DashboardService.load({
        period: filter,
        start: filter === 'range' ? appliedRange.start : undefined,
        end: filter === 'range' ? appliedRange.end : undefined,
        groupBy: filter === 'range' ? resolvedGroupBy : FILTER_GROUP_BY[filter],
      }),
    staleTime: 5 * 60 * 1000,
  });

  React.useEffect(() => {
    if (dashboardQuery.error) {
      errorNotification('Failed to load dashboard data');
    }
  }, [dashboardQuery.error]);

  const data = dashboardQuery.data;
  const dashboardRole = data?.role ?? (user?.role === 'agent' ? 'agent' : 'admin');

  if (dashboardQuery.isLoading) {
    return <HomeLoadingSkeleton />;
  }

  if (!data) {
    return (
      <div className="min-h-full">
        <PageHeader title="Dashboard" subtitle="Ticket operations overview is currently unavailable." />
        <div className="rounded-[12px] border border-dashed border-[var(--border-color)] bg-[var(--card-bg)] px-6 py-12 text-center shadow-[0_10px_28px_rgba(16,24,40,0.06)]">
          <p className="text-[16px] font-semibold text-[var(--text-primary)]">Dashboard unavailable</p>
          <p className="mt-2 text-[13px] text-[var(--text-secondary)]">We could not load dashboard data. Refresh to try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Dashboard"
        subtitle={
          dashboardRole === 'agent'
            ? 'Your queue, SLA priorities, and ticket progress this week.'
            : 'Real-time overview of your ticket operations and performance.'
        }
        actions={
          <DashboardHeaderControls
            filter={filter}
            setFilter={setFilter}
            draftRange={draftRange}
            setDraftRange={setDraftRange}
            onApplyRange={() => setAppliedRange(draftRange)}
          />
        }
      />

      {dashboardRole === 'agent' && data.agent_dashboard ? (
        <AgentDashboard
          dashboard={data.agent_dashboard}
          filterLabel={data.filter.label}
          groupByLabelValue={groupByLabel(data.filter.group_by)}
          onNavigate={navigate}
        />
      ) : data.admin_dashboard ? (
        <AdminDashboard
          dashboard={data.admin_dashboard}
          filterLabel={data.filter.label}
          groupByLabelValue={groupByLabel(data.filter.group_by)}
          onNavigate={navigate}
        />
      ) : (
        <div className="rounded-[12px] border border-dashed border-[var(--border-color)] bg-[var(--card-bg)] px-6 py-12 text-center shadow-[0_10px_28px_rgba(16,24,40,0.06)]">
          <p className="text-[16px] font-semibold text-[var(--text-primary)]">Dashboard unavailable</p>
          <p className="mt-2 text-[13px] text-[var(--text-secondary)]">This account does not have a dashboard payload yet.</p>
        </div>
      )}
    </div>
  );
};

type DashboardHeaderControlsProps = {
  filter: DashboardFilterValue;
  setFilter: (value: DashboardFilterValue) => void;
  draftRange: DateRangeState;
  setDraftRange: React.Dispatch<React.SetStateAction<DateRangeState>>;
  onApplyRange: () => void;
};

const DashboardHeaderControls: React.FC<DashboardHeaderControlsProps> = ({
  filter,
  setFilter,
  draftRange,
  setDraftRange,
  onApplyRange,
}) => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    <div className="inline-flex flex-wrap items-center gap-1 rounded-[12px] border border-[var(--border-color)] bg-[var(--card-bg)] p-1 shadow-[0_6px_16px_rgba(16,24,40,0.05)] dark:shadow-[0_8px_18px_rgba(1,4,9,0.18)]">
      {PERIOD_OPTIONS.map((option) => {
        const active = filter === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={cn(
              'inline-flex h-9 items-center rounded-[10px] px-3.5 text-[12px] font-semibold transition-all duration-150',
              active
                ? 'bg-[#257A42] text-white shadow-[0_8px_16px_rgba(12,33,24,0.18)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>

    {filter === 'range' && (
      <div className="inline-flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--border-color)] bg-[var(--card-bg)] p-1.5 shadow-[0_6px_16px_rgba(16,24,40,0.05)] dark:shadow-[0_8px_18px_rgba(1,4,9,0.18)]">
        <Input
          type="date"
          value={draftRange.start}
          onChange={(event) => setDraftRange((current) => ({ ...current, start: event.target.value }))}
          className="h-9 w-[144px] rounded-[10px] border-[var(--border-color)] bg-[var(--surface-subtle)] text-[var(--text-primary)] shadow-none [&::-webkit-calendar-picker-indicator]:opacity-70"
        />
        <Input
          type="date"
          value={draftRange.end}
          onChange={(event) => setDraftRange((current) => ({ ...current, end: event.target.value }))}
          className="h-9 w-[144px] rounded-[10px] border-[var(--border-color)] bg-[var(--surface-subtle)] text-[var(--text-primary)] shadow-none [&::-webkit-calendar-picker-indicator]:opacity-70"
        />
        <button
          type="button"
          onClick={onApplyRange}
          className="inline-flex h-9 items-center rounded-[10px] bg-[#257A42] px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#1E6034]"
        >
          Apply
        </button>
      </div>
    )}
  </div>
);

type DashboardShellProps = {
  dashboard: AdminDashboardResponse | AgentDashboardResponse;
  onNavigate: ReturnType<typeof useNavigate>;
};

type AdminProps = DashboardShellProps & {
  dashboard: AdminDashboardResponse;
  filterLabel: string;
  groupByLabelValue: string;
};

const AdminDashboard: React.FC<AdminProps> = ({
  dashboard,
  filterLabel,
  groupByLabelValue,
  onNavigate,
}) => {
  const summaryMetrics = dashboard.summary;
  const workloadTotal = dashboard.workload_distribution.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryMetrics.map((metric) => (
          <DashboardKpiTrendCard
            key={metric.key}
            metric={metric}
            onClick={() => onNavigate(resolveDashboardMetricHref(metric.key, 'admin'))}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,1fr)]">
        <AnalyticsHeroCard
          title="Tickets Created vs Resolved"
          description="See whether the helpdesk backlog is growing or contracting."
          controls={<HeroCardControls left={filterLabel} right={groupByLabelValue} />}
          legend={buildHeroLegend([
            { label: 'Tickets Created', color: '#00C8FF' },
            { label: 'Tickets Resolved', color: '#257A42' },
          ])}
        >
          <DashboardHeroAreaChart
            data={dashboard.created_vs_resolved}
            primaryKey="created"
            secondaryKey="resolved"
            primaryLabel="Tickets Created"
            secondaryLabel="Tickets Resolved"
          />
        </AnalyticsHeroCard>

        <DonutSummaryCard
          title="Agent Workload Distribution"
          description="Open assigned workload split by department."
          data={dashboard.workload_distribution}
          totalLabel="Total Tickets"
          centerValue={workloadTotal}
          rightLabel="All Departments"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(360px,1.25fr)]">
        <CompactBarCard
          title="Unassigned by Department"
          description="Queues still waiting for assignment."
          data={dashboard.unassigned_by_department}
          orientation="horizontal"
          color="#257A42"
          footerLabel="View all unassigned"
          onFooterClick={() => onNavigate('/tickets?view=all_unassigned')}
          onBarClick={(item) => {
            const href = resolveDepartmentBreakdownHref(item, 'unassigned');
            if (href) {
              onNavigate(href);
            }
          }}
        />
        <CompactBarCard
          title="Breached by Department"
          description="Department queues already outside SLA."
          data={dashboard.breached_by_department}
          orientation="vertical"
          color="#FF6B57"
          footerLabel="View all breached"
          onFooterClick={() => onNavigate('/tickets?status=sla_breached_tickets')}
          onBarClick={(item) => {
            const href = resolveDepartmentBreakdownHref(item, 'breached');
            if (href) {
              onNavigate(href);
            }
          }}
        />
        <MailboxHealthCard mailbox={dashboard.mailbox_health} onViewAll={() => onNavigate('/config/email')} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <MiniTrendCard
          title="CSAT Trend"
          metricValue={averageSeriesValue(dashboard.csat_trend).toFixed(2)}
          metricLabel="Average CSAT"
          data={dashboard.csat_trend}
          color="#257A42"
          badge={filterLabel}
        />
        <MiniTrendCard
          title="Reopened Ticket Trend"
          metricValue={sumSeriesValue(dashboard.reopened_trend)}
          metricLabel="Total reopened"
          data={dashboard.reopened_trend}
          color="#257A42"
          badge={filterLabel}
        />
        <TopSlowQueuesCard
          items={dashboard.top_slow_queues}
          onViewAll={() => onNavigate('/tickets?view=slow_queues')}
          onRowClick={(item) => {
            const href = resolveSlowQueueHref(item.category_id);
            if (href) {
              onNavigate(href);
            }
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <BlockerStripCard items={dashboard.operational_blockers} onViewAll={() => onNavigate('/tickets?view=all_unassigned')} />
        <RiskTableCard items={dashboard.risk_agents} onViewAll={() => onNavigate('/users/agents')} />
      </div>
    </div>
  );
};

type AgentProps = DashboardShellProps & {
  dashboard: AgentDashboardResponse;
  filterLabel: string;
  groupByLabelValue: string;
};

const AgentDashboard: React.FC<AgentProps> = ({
  dashboard,
  filterLabel,
  groupByLabelValue,
  onNavigate,
}) => {
  const workloadTotal = dashboard.workload_breakdown.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.summary.map((metric) => (
          <DashboardKpiTrendCard
            key={metric.key}
            metric={metric}
            onClick={() => onNavigate(resolveDashboardMetricHref(metric.key, 'agent'))}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,1fr)]">
        <AnalyticsHeroCard
          title="My Queue Trend"
          description="Assigned tickets coming in versus work being resolved in your queue."
          controls={<HeroCardControls left={filterLabel} right={groupByLabelValue} />}
          legend={buildHeroLegend([
            { label: 'Assigned to Me', color: '#00C8FF' },
            { label: 'Resolved in My Queue', color: '#257A42' },
          ])}
        >
          <DashboardHeroAreaChart
            data={dashboard.queue_trend}
            primaryKey="assigned"
            secondaryKey="resolved"
            primaryLabel="Assigned to Me"
            secondaryLabel="Resolved in My Queue"
          />
        </AnalyticsHeroCard>

        <DonutSummaryCard
          title="My Workload Breakdown"
          description="Your current assigned ticket mix by status."
          data={dashboard.workload_breakdown}
          totalLabel="Total Tickets"
          centerValue={workloadTotal}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(360px,1.2fr)]">
        <CompactBarCard
          title="Unassigned in My Departments"
          description="Visible tickets still waiting for ownership."
          data={dashboard.unassigned_by_department}
          orientation="horizontal"
          color="#257A42"
          footerLabel="View all unassigned"
          onFooterClick={() => onNavigate('/tickets?view=all_unassigned')}
          onBarClick={(item) => {
            const href = resolveDepartmentBreakdownHref(item, 'unassigned');
            if (href) {
              onNavigate(href);
            }
          }}
        />
        <CompactBarCard
          title="Breached in My Departments"
          description="Visible department queues already outside SLA."
          data={dashboard.breached_by_department}
          orientation="vertical"
          color="#FF6B57"
          footerLabel="View all breached"
          onFooterClick={() => onNavigate('/tickets?status=sla_breached_tickets')}
          onBarClick={(item) => {
            const href = resolveDepartmentBreakdownHref(item, 'breached');
            if (href) {
              onNavigate(href);
            }
          }}
        />
        <OldestTicketsTableCard
          items={dashboard.oldest_assigned_tickets}
          onNavigate={onNavigate}
          onViewAll={() => onNavigate('/tickets?view=my_unresolved')}
        />
      </div>
    </div>
  );
};

const resolveDepartmentBreakdownHref = (
  item: DashboardBreakdownItem,
  type: 'unassigned' | 'breached',
) => {
  if (!item.department_id || item.value <= 0) {
    return null;
  }

  return type === 'unassigned'
    ? `/tickets?view=all_unassigned&department=${item.department_id}`
    : `/tickets?status=sla_breached_tickets&department=${item.department_id}`;
};

const resolveSlowQueueHref = (categoryId?: number | null) => {
  if (!categoryId) {
    return null;
  }

  return `/tickets?view=slow_queues&category=${categoryId}`;
};

const resolveDashboardMetricHref = (key: string, role: 'admin' | 'agent') => {
  switch (key) {
    case 'backlog':
      return '/tickets?view=all_unresolved';
    case 'unassigned_tickets':
      return '/tickets?view=all_unassigned';
    case 'my_open_tickets':
      return '/tickets?view=my_unresolved';
    case 'breached':
    case 'sla_at_risk':
      return '/tickets?status=sla_breached_tickets';
    case 'resolved_today':
      return role === 'agent' ? '/tickets?view=my_resolved' : '/tickets?view=all_resolved';
    case 'sla_compliance_pct':
      return '/tickets?view=all_resolved';
    case 'due_today':
      return '/tickets?view=my_due_today';
    default:
      return '/tickets';
  }
};

export default DashboardPage;
