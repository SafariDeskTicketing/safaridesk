import type { AxiosResponse } from 'axios';
import http from './http';
import { APIS } from './apis';

export type ExportFormat = 'csv' | 'xlsx' | 'json' | 'pdf';

type ExportJobStatus = 'pending' | 'running' | 'completed' | 'failed';

type ExportJobResponse = {
  export_id: number;
  status: ExportJobStatus;
  filename?: string;
  error?: string;
};

const EXTENSION_BY_FORMAT: Record<ExportFormat, string> = {
  csv: 'csv',
  xlsx: 'xlsx',
  json: 'json',
  pdf: 'pdf',
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const downloadBlob = (blob: Blob, filename: string) => {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
};

export const exportFilename = (prefix: string, format: ExportFormat) => {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.${EXTENSION_BY_FORMAT[format]}`;
};

export const handleExportResponse = async (
  response: AxiosResponse<Blob>,
  fallbackFilename: string
) => {
  if (response.status !== 202) {
    downloadBlob(response.data, fallbackFilename);
    return;
  }

  const job = await parseExportJobBlob(response.data);
  const completedJob = await waitForExportJob(job.export_id);
  if (completedJob.status === 'failed') {
    throw new Error(completedJob.error || 'Export failed.');
  }

  const downloadResponse = await http.get<Blob>(`${APIS.EXPORTS}${job.export_id}/download/`, {
    responseType: 'blob',
  });
  downloadBlob(downloadResponse.data, completedJob.filename || fallbackFilename);
};

export const exportSelectedTickets = async (ticketIds: number[], format: Exclude<ExportFormat, 'pdf'> = 'xlsx') => {
  const response = await http.post<Blob>(
    `${APIS.TICKET_BASE}/export/`,
    { ticket_ids: ticketIds, format },
    { responseType: 'blob', validateStatus: (status) => (status >= 200 && status < 300) || status === 202 }
  );
  await handleExportResponse(response, exportFilename('tickets-export', format));
};

export const exportSelectedTasks = async (taskIds: Array<number | string>, format: Exclude<ExportFormat, 'pdf'> = 'xlsx') => {
  const response = await http.post<Blob>(
    `${APIS.TASK_BASE}/export/`,
    { task_ids: taskIds, format },
    { responseType: 'blob', validateStatus: (status) => (status >= 200 && status < 300) || status === 202 }
  );
  await handleExportResponse(response, exportFilename('tasks-export', format));
};

const parseExportJobBlob = async (blob: Blob): Promise<ExportJobResponse> => {
  const text = await blob.text();
  return JSON.parse(text) as ExportJobResponse;
};

const waitForExportJob = async (exportId: number): Promise<ExportJobResponse> => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await http.get<ExportJobResponse>(`${APIS.EXPORTS}${exportId}/`);
    if (response.data.status === 'completed' || response.data.status === 'failed') {
      return response.data;
    }
    await sleep(2000);
  }
  throw new Error('Export is still running. Try again in a moment.');
};
