import React, { startTransition, useDeferredValue, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileJson,
  FileText as PdfIcon,
  FileSpreadsheet,
} from 'lucide-react';
import { PageCard, PageHeader } from '../../components/layout';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { Table } from '../../components/ui/Table';
import LabelGroup from '../../components/ui/LabelGroup';
import { Search } from '../../components/icons/AppIcons';
import { errorNotification } from '../../components/ui/Toast';
import { ReportsService } from '../../services/reports';
import type { ExportFormat } from '../../services/exports';
import { useAuthStore } from '../../stores/authStore';
import type {
  AgentReportResponse,
  AgentReportRow,
  ReportMetric,
  ReportOption,
  ReportPeriod,
  ReportResponse,
  ReportType,
  TaskReportResponse,
  TaskReportRow,
  TicketReportResponse,
  TicketReportRow,
} from '../../types/reports';
import type { LabelItem } from '../../types';

type ReportsPageProps = {
  reportType: ReportType;
};

type ReportTableRow = Record<string, unknown>;

type DateRangeState = {
  start: string;
  end: string;
};

const REPORT_NAV: Array<{ type: ReportType; label: string; href: string; subtitle: string }> = [
  {
    type: 'tickets',
    label: 'Tickets',
    href: '/reports/tickets',
    subtitle: 'Ticket throughput, SLA, ownership, and satisfaction.',
  },
  {
    type: 'tasks',
    label: 'Tasks',
    href: '/reports/tasks',
    subtitle: 'Task execution, due dates, completion velocity, and workload.',
  },
  {
    type: 'agents',
    label: 'Agents',
    href: '/reports/agents',
    subtitle: 'Agent performance summary across tickets and tasks.',
  },
];

const PERIOD_OPTIONS: ReportOption[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'range', label: 'Custom Range' },
];

const getToday = () => new Date().toISOString().slice(0, 10);

const getMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
};

const ReportsPage: React.FC<ReportsPageProps> = ({ reportType }) => {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [range, setRange] = useState<DateRangeState>({ start: getMonthStart(), end: getToday() });
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [agent, setAgent] = useState('');
  const [page, setPage] = useState(1);
  const [ticketStatus, setTicketStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [slaStatus, setSlaStatus] = useState('');
  const [csat, setCsat] = useState('');
  const [taskStatus, setTaskStatus] = useState('');
  const [overdue, setOverdue] = useState('');
  const [linkedTicket, setLinkedTicket] = useState('');
  const [agentStatus, setAgentStatus] = useState('');
  const [workloadBand, setWorkloadBand] = useState('');

  const deferredSearch = useDeferredValue(search.trim());
  const navMeta = REPORT_NAV.find((item) => item.type === reportType) ?? REPORT_NAV[0];

  const queryKey = [
    'reports',
    reportType,
    period,
    range.start,
    range.end,
    department,
    agent,
    deferredSearch,
    page,
    ticketStatus,
    priority,
    category,
    source,
    slaStatus,
    csat,
    taskStatus,
    overdue,
    linkedTicket,
    agentStatus,
    workloadBand,
  ];

  const reportQuery = useQuery<
    TicketReportResponse | TaskReportResponse | AgentReportResponse
  >({
    queryKey,
    queryFn: () =>
      ReportsService.load(reportType, {
        period,
        start: period === 'range' ? range.start : undefined,
        end: period === 'range' ? range.end : undefined,
        department: department || undefined,
        agent: agent || undefined,
        search: deferredSearch || undefined,
        page,
        pageSize: 10,
        status: reportType === 'tickets' ? ticketStatus || undefined : undefined,
        priority: priority || undefined,
        category: reportType === 'tickets' ? category || undefined : undefined,
        source: reportType === 'tickets' ? source || undefined : undefined,
        slaStatus: reportType === 'tickets' ? slaStatus || undefined : undefined,
        csat: reportType === 'tickets' ? csat || undefined : undefined,
        taskStatus: reportType === 'tasks' ? taskStatus || undefined : undefined,
        overdue: reportType === 'tasks' ? overdue || undefined : undefined,
        linkedTicket: reportType === 'tasks' ? linkedTicket || undefined : undefined,
        agentStatus: reportType === 'agents' ? agentStatus || undefined : undefined,
        workloadBand: reportType === 'agents' ? workloadBand || undefined : undefined,
      }),
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (reportQuery.error) {
      errorNotification('Failed to load report data.');
    }
  }, [reportQuery.error]);

  const reportData = reportQuery.data;
  const filterOptions = reportData?.filter_options;

  const tableColumns = useMemo(() => buildColumns(reportType), [reportType]);
  const tableRows = useMemo<ReportTableRow[]>(
    () => ((reportData?.rows ?? []) as unknown as ReportTableRow[]),
    [reportData?.rows]
  );

  if ((user?.role || '').toLowerCase() !== 'admin') {
    return (
      <div className="min-h-full">
        <PageHeader
          title="Reports"
          subtitle="Reports are available to admin users only."
        />
        <PageCard>
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
            You do not have permission to view operational reports for this workspace.
          </p>
        </PageCard>
      </div>
    );
  }

  const handlePeriodChange = (value: string) => {
    startTransition(() => {
      setPeriod(value as ReportPeriod);
      setPage(1);
      if (value !== 'range') {
        const today = getToday();
        if (value === 'month') {
          setRange({ start: getMonthStart(), end: today });
        } else {
          setRange({ start: today, end: today });
        }
      }
    });
  };

  const handleExport = async (format: ExportFormat) => {
    try {
      await ReportsService.export(reportType, {
        period,
        start: period === 'range' ? range.start : undefined,
        end: period === 'range' ? range.end : undefined,
        department: department || undefined,
        agent: agent || undefined,
        search: deferredSearch || undefined,
        status: reportType === 'tickets' ? ticketStatus || undefined : undefined,
        priority: priority || undefined,
        category: reportType === 'tickets' ? category || undefined : undefined,
        source: reportType === 'tickets' ? source || undefined : undefined,
        slaStatus: reportType === 'tickets' ? slaStatus || undefined : undefined,
        csat: reportType === 'tickets' ? csat || undefined : undefined,
        taskStatus: reportType === 'tasks' ? taskStatus || undefined : undefined,
        overdue: reportType === 'tasks' ? overdue || undefined : undefined,
        linkedTicket: reportType === 'tasks' ? linkedTicket || undefined : undefined,
        agentStatus: reportType === 'agents' ? agentStatus || undefined : undefined,
        workloadBand: reportType === 'agents' ? workloadBand || undefined : undefined,
      }, format);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Report export failed. Narrow the filters or try again.';
      errorNotification(message);
    }
  };

  return (
    <div className="min-h-full">
      <PageHeader
        title={reportData?.title ?? 'Reports'}
        subtitle={navMeta.subtitle}
        meta={<ReportsNav />}
        actions={
          <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-2 text-[12px] font-medium text-[var(--text-secondary)] shadow-[var(--shell-shadow-sm)]">
            Live business data
          </div>
        }
      />

      <div className="space-y-6">
        <ReportMetricsGrid metrics={reportData?.summary ?? []} loading={reportQuery.isLoading} />

        <PageCard className="overflow-hidden" padding="none">
          <div className="border-b border-[var(--border-color)] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2
                    className="text-[length:var(--font-section-title)] text-[var(--text-primary)]"
                    style={{ fontWeight: 'var(--font-weight-title)' }}
                  >
                    Report List
                  </h2>
                  <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                    Filter the current report, review the data table, then export the filtered result.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" icon={PdfIcon} onClick={() => handleExport('pdf')}>
                    Export PDF
                  </Button>
                  <Button variant="outline" icon={FileSpreadsheet} onClick={() => handleExport('xlsx')}>
                    Export Excel
                  </Button>
                  <Button variant="outline" icon={FileSpreadsheet} onClick={() => handleExport('csv')}>
                    Export CSV
                  </Button>
                  <Button variant="outline" icon={FileJson} onClick={() => handleExport('json')}>
                    Export JSON
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Select
                  value={period}
                  onChange={handlePeriodChange}
                  options={PERIOD_OPTIONS}
                  placeholder="Period"
                />
                <Select
                  value={department}
                  onChange={(value) => resetPage(() => setDepartment(value), setPage)}
                  options={withAllOption(filterOptions?.departments, 'All Departments')}
                  placeholder="Department"
                />
                <Select
                  value={agent}
                  onChange={(value) => resetPage(() => setAgent(value), setPage)}
                  options={withAllOption(filterOptions?.agents, 'All Agents')}
                  placeholder="Assigned Agent"
                />
                <Input
                  value={search}
                  onChange={(event) => {
                    const value = event.target.value;
                    startTransition(() => {
                      setSearch(value);
                      setPage(1);
                    });
                  }}
                  placeholder="Search current report..."
                  icon={Search}
                />
                <div className="hidden xl:block" />
              </div>

              {period === 'range' && (
                <div className="grid gap-3 md:grid-cols-2 xl:max-w-[420px] xl:grid-cols-2">
                  <Input
                    type="date"
                    value={range.start}
                    onChange={(event) => {
                      const value = event.target.value;
                      startTransition(() => {
                        setRange((current) => ({ ...current, start: value }));
                        setPage(1);
                      });
                    }}
                  />
                  <Input
                    type="date"
                    value={range.end}
                    onChange={(event) => {
                      const value = event.target.value;
                      startTransition(() => {
                        setRange((current) => ({ ...current, end: value }));
                        setPage(1);
                      });
                    }}
                  />
                </div>
              )}

              <SpecificFilters
                reportType={reportType}
                filterOptions={filterOptions}
                ticketStatus={ticketStatus}
                setTicketStatus={setTicketStatus}
                priority={priority}
                setPriority={setPriority}
                category={category}
                setCategory={setCategory}
                source={source}
                setSource={setSource}
                slaStatus={slaStatus}
                setSlaStatus={setSlaStatus}
                csat={csat}
                setCsat={setCsat}
                taskStatus={taskStatus}
                setTaskStatus={setTaskStatus}
                overdue={overdue}
                setOverdue={setOverdue}
                linkedTicket={linkedTicket}
                setLinkedTicket={setLinkedTicket}
                agentStatus={agentStatus}
                setAgentStatus={setAgentStatus}
                workloadBand={workloadBand}
                setWorkloadBand={setWorkloadBand}
                setPage={setPage}
              />
            </div>
          </div>

          <div className="px-5 py-5 sm:px-6">
            {reportQuery.isLoading ? (
              <ReportTableSkeleton />
            ) : tableRows.length > 0 ? (
              <>
                <Table<ReportTableRow>
                  data={tableRows}
                  columns={tableColumns}
                  showPagination={false}
                />
                <ReportPagination
                  page={reportData?.page ?? 1}
                  totalPages={reportData?.total_pages ?? 1}
                  totalCount={reportData?.total_count ?? 0}
                  pageSize={reportData?.page_size ?? 10}
                  onPageChange={setPage}
                />
              </>
            ) : (
              <EmptyReportState reportType={reportType} />
            )}
          </div>
        </PageCard>
      </div>
    </div>
  );
};

const ReportsNav: React.FC = () => {
  return (
    <div className="flex flex-wrap gap-2">
      {REPORT_NAV.map((item) => (
        <NavLink
          key={item.type}
          to={item.href}
          className={({ isActive }) =>
            [
              'inline-flex items-center rounded-[var(--shell-radius)] border px-3.5 py-2 text-[13px] font-medium transition-colors',
              isActive
                ? 'border-primary-600 bg-primary-600 text-white'
                : 'border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]',
            ].join(' ')
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
};

const ReportMetricsGrid: React.FC<{ metrics: ReportMetric[]; loading: boolean }> = ({ metrics, loading }) => {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <PageCard key={index} className="animate-pulse">
            <div className="h-3 w-24 rounded bg-[var(--surface-muted)]" />
            <div className="mt-4 h-8 w-28 rounded bg-[var(--surface-muted)]" />
            <div className="mt-6 h-10 rounded bg-[var(--surface-muted)]" />
          </PageCard>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {metrics.map((metric, index) => (
        <PageCard key={metric.key} className="min-h-[148px]">
          <div className="flex h-full flex-col justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                {metric.label}
              </p>
              <p
                className="mt-3 text-[28px] leading-none text-[var(--text-primary)]"
                style={{ fontWeight: 'var(--font-weight-title)' }}
              >
                {metric.display_value}
              </p>
            </div>
            <div className="flex items-end justify-between gap-3">
              <span className="text-[12px] text-[var(--text-secondary)]">Auto-updates in report view</span>
              <MetricSparkline index={index} />
            </div>
          </div>
        </PageCard>
      ))}
    </div>
  );
};

const MetricSparkline: React.FC<{ index: number }> = ({ index }) => {
  const shapes = [
    '6,26 24,26 36,16 54,16 72,8',
    '6,24 22,18 38,11 56,14 72,13',
    '6,26 24,26 24,13 50,13 72,5',
    '6,22 18,20 34,18 52,12 72,7',
    '6,28 18,22 30,21 48,12 72,10',
    '6,24 26,17 42,17 58,9 72,6',
  ];

  return (
    <svg width="84" height="32" viewBox="0 0 84 32" fill="none" aria-hidden="true">
      <polyline
        points={shapes[index % shapes.length]}
        stroke="var(--status-success-text)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

type SpecificFiltersProps = {
  reportType: ReportType;
  filterOptions: ReportResponse<TicketReportRow | TaskReportRow | AgentReportRow>['filter_options'] | undefined;
  ticketStatus: string;
  setTicketStatus: React.Dispatch<React.SetStateAction<string>>;
  priority: string;
  setPriority: React.Dispatch<React.SetStateAction<string>>;
  category: string;
  setCategory: React.Dispatch<React.SetStateAction<string>>;
  source: string;
  setSource: React.Dispatch<React.SetStateAction<string>>;
  slaStatus: string;
  setSlaStatus: React.Dispatch<React.SetStateAction<string>>;
  csat: string;
  setCsat: React.Dispatch<React.SetStateAction<string>>;
  taskStatus: string;
  setTaskStatus: React.Dispatch<React.SetStateAction<string>>;
  overdue: string;
  setOverdue: React.Dispatch<React.SetStateAction<string>>;
  linkedTicket: string;
  setLinkedTicket: React.Dispatch<React.SetStateAction<string>>;
  agentStatus: string;
  setAgentStatus: React.Dispatch<React.SetStateAction<string>>;
  workloadBand: string;
  setWorkloadBand: React.Dispatch<React.SetStateAction<string>>;
  setPage: React.Dispatch<React.SetStateAction<number>>;
};

const SpecificFilters: React.FC<SpecificFiltersProps> = ({
  reportType,
  filterOptions,
  ticketStatus,
  setTicketStatus,
  priority,
  setPriority,
  category,
  setCategory,
  source,
  setSource,
  slaStatus,
  setSlaStatus,
  csat,
  setCsat,
  taskStatus,
  setTaskStatus,
  overdue,
  setOverdue,
  linkedTicket,
  setLinkedTicket,
  agentStatus,
  setAgentStatus,
  workloadBand,
  setWorkloadBand,
  setPage,
}) => {
  if (reportType === 'tickets') {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Select
          value={ticketStatus}
          onChange={(value) => resetPage(() => setTicketStatus(value), setPage)}
          options={withAllOption(filterOptions?.statuses, 'All Statuses')}
          placeholder="Status"
        />
        <Select
          value={priority}
          onChange={(value) => resetPage(() => setPriority(value), setPage)}
          options={withAllOption(filterOptions?.priorities, 'All Priorities')}
          placeholder="Priority"
        />
        <Select
          value={category}
          onChange={(value) => resetPage(() => setCategory(value), setPage)}
          options={withAllOption(filterOptions?.categories, 'All Categories')}
          placeholder="Category"
        />
        <Select
          value={source}
          onChange={(value) => resetPage(() => setSource(value), setPage)}
          options={withAllOption(filterOptions?.sources, 'All Sources')}
          placeholder="Source"
        />
        <Select
          value={slaStatus}
          onChange={(value) => resetPage(() => setSlaStatus(value), setPage)}
          options={withAllOption(filterOptions?.sla_statuses, 'All SLA States')}
          placeholder="SLA"
        />
        <Select
          value={csat}
          onChange={(value) => resetPage(() => setCsat(value), setPage)}
          options={withAllOption(filterOptions?.csat_options, 'All CSAT')}
          placeholder="CSAT"
        />
      </div>
    );
  }

  if (reportType === 'tasks') {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Select
          value={taskStatus}
          onChange={(value) => resetPage(() => setTaskStatus(value), setPage)}
          options={withAllOption(filterOptions?.statuses, 'All Statuses')}
          placeholder="Status"
        />
        <Select
          value={priority}
          onChange={(value) => resetPage(() => setPriority(value), setPage)}
          options={withAllOption(filterOptions?.priorities, 'All Priorities')}
          placeholder="Priority"
        />
        <Select
          value={overdue}
          onChange={(value) => resetPage(() => setOverdue(value), setPage)}
          options={withAllOption(filterOptions?.overdue_options, 'All Due States')}
          placeholder="Due State"
        />
        <Input
          value={linkedTicket}
          onChange={(event) => {
            const value = event.target.value;
            startTransition(() => {
              setLinkedTicket(value);
              setPage(1);
            });
          }}
          placeholder="Linked ticket..."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Select
        value={agentStatus}
        onChange={(value) => resetPage(() => setAgentStatus(value), setPage)}
        options={withAllOption(filterOptions?.agent_statuses, 'All Agent States')}
        placeholder="Agent Status"
      />
      <Select
        value={workloadBand}
        onChange={(value) => resetPage(() => setWorkloadBand(value), setPage)}
        options={withAllOption(filterOptions?.workload_bands, 'All Workload Bands')}
        placeholder="Workload Band"
      />
    </div>
  );
};

const ReportPagination: React.FC<{
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}> = ({ page, totalPages, totalCount, pageSize, onPageChange }) => {
  const pages = buildVisiblePages(page, totalPages);
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border-color)] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[13px] text-[var(--text-secondary)]">
        Showing {startItem} to {endItem} of {totalCount} rows
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        {pages.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-[13px] text-[var(--text-secondary)]">
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={[
                'inline-flex h-[34px] min-w-[34px] items-center justify-center rounded-full border px-3 text-[13px] font-medium transition-colors',
                item === page
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {item}
            </button>
          )
        )}
        <Button variant="outline" size="sm" icon={ChevronRight} iconPosition="right" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
};

const EmptyReportState: React.FC<{ reportType: ReportType }> = ({ reportType }) => (
  <div className="rounded-[var(--shell-radius)] border border-dashed border-[var(--border-color)] bg-[var(--surface-subtle)] px-6 py-12 text-center">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--text-secondary)]">
      <BarChart3 size={22} />
    </div>
    <h3 className="mt-4 text-[18px] font-semibold text-[var(--text-primary)]">No {reportType} data found</h3>
    <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
      Adjust the current filters or widen the date range to populate this report.
    </p>
  </div>
);

const ReportTableSkeleton: React.FC = () => (
  <div className="space-y-3">
    {Array.from({ length: 8 }).map((_, index) => (
      <div key={index} className="h-12 animate-pulse rounded-[var(--shell-radius)] bg-[var(--surface-muted)]" />
    ))}
  </div>
);

const buildColumns = (reportType: ReportType) => {
  if (reportType === 'tickets') {
    return [
      { key: 'ticket_id', header: 'Ticket ID', render: renderTextCell },
      { key: 'subject', header: 'Subject', render: renderTextCell },
      { key: 'customer', header: 'Customer', render: renderTextCell },
      { key: 'department', header: 'Department', render: renderTextCell },
      { key: 'category', header: 'Category', render: renderTextCell },
      { key: 'priority', header: 'Priority', render: renderBadgeCell },
      { key: 'status', header: 'Status', render: renderBadgeCell },
      { key: 'source', header: 'Source', render: renderTextCell },
      { key: 'assigned_agent', header: 'Assigned Agent', render: renderTextCell },
      { key: 'created_at', header: 'Created', render: renderTextCell },
      { key: 'first_response_time', header: 'First Response', render: renderTextCell },
      { key: 'resolution_time', header: 'Resolution', render: renderTextCell },
      { key: 'sla_status', header: 'SLA', render: renderBadgeCell },
      { key: 'csat_score', header: 'CSAT', render: renderTextCell },
      { key: 'labels', header: 'Labels', render: renderLabelsCell },
    ] as Array<{ key: string; header: string; render?: (value: unknown, row: ReportTableRow) => React.ReactNode }>;
  }

  if (reportType === 'tasks') {
    return [
      { key: 'task_id', header: 'Task ID', render: renderTextCell },
      { key: 'title', header: 'Title', render: renderTextCell },
      { key: 'linked_ticket', header: 'Linked Ticket', render: renderTextCell },
      { key: 'department', header: 'Department', render: renderTextCell },
      { key: 'assigned_agent', header: 'Assigned Agent', render: renderTextCell },
      { key: 'priority', header: 'Priority', render: renderBadgeCell },
      { key: 'status', header: 'Status', render: renderBadgeCell },
      { key: 'due_date', header: 'Due Date', render: renderTextCell },
      { key: 'created_at', header: 'Created', render: renderTextCell },
      { key: 'completed_at', header: 'Completed', render: renderTextCell },
      { key: 'completion_time', header: 'Completion', render: renderTextCell },
      { key: 'overdue', header: 'Overdue', render: renderBadgeCell },
      { key: 'labels', header: 'Labels', render: renderLabelsCell },
    ] as Array<{ key: string; header: string; render?: (value: unknown, row: ReportTableRow) => React.ReactNode }>;
  }

  return [
    { key: 'agent_name', header: 'Agent', render: renderTextCell },
    { key: 'email', header: 'Email', render: renderTextCell },
    { key: 'departments', header: 'Departments', render: renderTextCell },
    { key: 'active_status', header: 'Status', render: renderBadgeCell },
    { key: 'open_tickets', header: 'Open Tickets', render: renderTextCell },
    { key: 'resolved_tickets', header: 'Resolved Tickets', render: renderTextCell },
    { key: 'assigned_tasks', header: 'Assigned Tasks', render: renderTextCell },
    { key: 'completed_tasks', header: 'Completed Tasks', render: renderTextCell },
    { key: 'avg_first_response', header: 'Avg First Response', render: renderTextCell },
    { key: 'avg_resolution', header: 'Avg Resolution', render: renderTextCell },
    { key: 'sla_breach_count', header: 'SLA Breaches', render: renderTextCell },
    { key: 'avg_csat', header: 'Avg CSAT', render: renderTextCell },
    { key: 'backlog_count', header: 'Backlog', render: renderTextCell },
  ] as Array<{ key: string; header: string; render?: (value: unknown, row: ReportTableRow) => React.ReactNode }>;
};

const renderTextCell = (value: unknown) => (
  <span className="text-[length:var(--font-body)] text-[var(--text-primary)]">
    {String(value ?? '—')}
  </span>
);

const renderBadgeCell = (value: unknown) => {
  const label = String(value ?? '—');
  const tone = getBadgeTone(label);
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium',
        tone,
      ].join(' ')}
    >
      {label}
    </span>
  );
};

const renderLabelsCell = (value: unknown) => {
  if (!isLabelArray(value)) {
    return <span className="text-[length:var(--font-body)] text-[var(--text-secondary)]">—</span>;
  }
  return <LabelGroup labels={value} size="table" maxVisible={2} emptyText="—" />;
};

const isLabelArray = (value: unknown): value is LabelItem[] => {
  return Array.isArray(value);
};

const getBadgeTone = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized.includes('breach') || normalized === 'overdue' || normalized === 'yes' || normalized === 'inactive') {
    return 'bg-[rgba(224,82,69,0.12)] text-[var(--status-danger-text)]';
  }
  if (normalized.includes('resolved') || normalized.includes('closed') || normalized.includes('completed') || normalized.includes('active') || normalized === 'within sla') {
    return 'bg-[rgba(37,122,66,0.12)] text-[var(--status-success-text)]';
  }
  if (normalized.includes('pending') || normalized.includes('hold') || normalized.includes('approaching')) {
    return 'bg-[rgba(190,120,20,0.14)] text-[var(--status-warning-text)]';
  }
  return 'bg-[var(--surface-muted)] text-[var(--text-secondary)]';
};

const withAllOption = (options: ReportOption[] | undefined, label: string): ReportOption[] => {
  return [{ value: '', label }, ...(options ?? [])];
};

const buildVisiblePages = (currentPage: number, totalPages: number): Array<number | 'ellipsis'> => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, 'ellipsis', totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
};

const resetPage = (callback: () => void, setPage: React.Dispatch<React.SetStateAction<number>>) => {
  startTransition(() => {
    callback();
    setPage(1);
  });
};

export default ReportsPage;
