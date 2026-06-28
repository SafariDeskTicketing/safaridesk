import http from './http';
import { APIS } from './apis';
import type {
  AgentReportResponse,
  ReportPeriod,
  ReportType,
  TaskReportResponse,
  TicketReportResponse,
} from '../types/reports';
import type { ExportFormat } from './exports';
import { exportFilename, handleExportResponse } from './exports';

type ReportParams = {
  period: ReportPeriod | string;
  start?: string;
  end?: string;
  department?: string;
  agent?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  status?: string;
  priority?: string;
  category?: string;
  source?: string;
  slaStatus?: string;
  csat?: string;
  taskStatus?: string;
  overdue?: string;
  linkedTicket?: string;
  agentStatus?: string;
  workloadBand?: string;
};

const REPORT_ENDPOINTS: Record<ReportType, string> = {
  tickets: APIS.REPORTS_TICKETS,
  tasks: APIS.REPORTS_TASKS,
  agents: APIS.REPORTS_AGENTS,
};

const REPORT_EXPORT_ENDPOINTS: Record<ReportType, string> = {
  tickets: APIS.REPORTS_TICKETS_EXPORT,
  tasks: APIS.REPORTS_TASKS_EXPORT,
  agents: APIS.REPORTS_AGENTS_EXPORT,
};

const buildQuery = (params: ReportParams) => {
  const searchParams = new URLSearchParams();
  searchParams.set('q', params.period);
  if (params.start) searchParams.set('start', params.start);
  if (params.end) searchParams.set('end', params.end);
  if (params.department) searchParams.set('department', params.department);
  if (params.agent) searchParams.set('agent', params.agent);
  if (params.search) searchParams.set('search', params.search);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.pageSize) searchParams.set('page_size', String(params.pageSize));
  if (params.status) searchParams.set('status', params.status);
  if (params.priority) searchParams.set('priority', params.priority);
  if (params.category) searchParams.set('category', params.category);
  if (params.source) searchParams.set('source', params.source);
  if (params.slaStatus) searchParams.set('sla_status', params.slaStatus);
  if (params.csat) searchParams.set('csat', params.csat);
  if (params.taskStatus) searchParams.set('task_status', params.taskStatus);
  if (params.overdue) searchParams.set('overdue', params.overdue);
  if (params.linkedTicket) searchParams.set('linked_ticket', params.linkedTicket);
  if (params.agentStatus) searchParams.set('agent_status', params.agentStatus);
  if (params.workloadBand) searchParams.set('workload_band', params.workloadBand);
  return searchParams.toString();
};

export const ReportsService = {
  async load(type: ReportType, params: ReportParams) {
    const query = buildQuery(params);
    const response = await http.get<TicketReportResponse | TaskReportResponse | AgentReportResponse>(
      `${REPORT_ENDPOINTS[type]}?${query}`
    );
    return response.data;
  },

  async export(type: ReportType, params: ReportParams, format: ExportFormat) {
    const query = buildQuery(params);
    const response = await http.get(`${REPORT_EXPORT_ENDPOINTS[type]}?${query}&format=${format}`, {
      responseType: 'blob',
      validateStatus: (status) => (status >= 200 && status < 300) || status === 202,
    });
    await handleExportResponse(response, exportFilename(`${type}-report`, format));
  },
};
