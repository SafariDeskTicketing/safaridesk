import type { LabelItem } from './index';

export type ReportType = 'tickets' | 'tasks' | 'agents';
export type ReportPeriod = 'today' | 'week' | 'month' | 'year' | 'range';

export type ReportOption = {
  value: string;
  label: string;
};

export type ReportMetric = {
  key: string;
  label: string;
  value: string | number | null;
  display_value: string | number;
};

export type ReportColumn = {
  key: string;
  label: string;
};

export type BaseReportRow = {
  id?: number | string;
};

export type TicketReportRow = BaseReportRow & {
  ticket_id: string;
  subject: string;
  customer: string;
  department: string;
  category: string;
  priority: string;
  status: string;
  source: string;
  assigned_agent: string;
  created_at: string;
  first_response_at: string;
  resolved_at: string;
  first_response_time: string;
  resolution_time: string;
  sla_status: string;
  csat_score: string | number;
  labels: LabelItem[];
  labels_text: string;
};

export type TaskReportRow = BaseReportRow & {
  task_id: string;
  title: string;
  linked_ticket: string;
  department: string;
  assigned_agent: string;
  priority: string;
  status: string;
  due_date: string;
  created_at: string;
  completed_at: string;
  completion_time: string;
  overdue: string;
  labels: LabelItem[];
  labels_text: string;
};

export type AgentReportRow = BaseReportRow & {
  agent_name: string;
  email: string;
  departments: string;
  active_status: string;
  open_tickets: number;
  resolved_tickets: number;
  assigned_tasks: number;
  completed_tasks: number;
  avg_first_response: string;
  avg_resolution: string;
  sla_breach_count: number;
  avg_csat: string;
  backlog_count: number;
  workload_total?: number;
};

export type ReportFilterOptions = {
  periods: ReportOption[];
  departments: ReportOption[];
  agents: ReportOption[];
  statuses?: ReportOption[];
  priorities?: ReportOption[];
  categories?: ReportOption[];
  sources?: ReportOption[];
  sla_statuses?: ReportOption[];
  csat_options?: ReportOption[];
  overdue_options?: ReportOption[];
  agent_statuses?: ReportOption[];
  workload_bands?: ReportOption[];
};

export type ReportWindow = {
  period: ReportPeriod | string;
  label: string;
  start_date: string;
  end_date: string;
};

export type ReportResponse<TRow extends BaseReportRow> = {
  report_type: ReportType;
  title: string;
  window: ReportWindow;
  summary: ReportMetric[];
  columns: ReportColumn[];
  rows: TRow[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  filter_options: ReportFilterOptions;
  applied_filters: Record<string, string>;
};

export type TicketReportResponse = ReportResponse<TicketReportRow>;
export type TaskReportResponse = ReportResponse<TaskReportRow>;
export type AgentReportResponse = ReportResponse<AgentReportRow>;
