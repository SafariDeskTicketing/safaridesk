import http from './http';
import { APIS } from './apis';
import type { DashboardFilterValue, DashboardResponse } from '../types';

type DashboardParams = {
  period: DashboardFilterValue;
  start?: string;
  end?: string;
  groupBy?: string;
};

const buildDashboardQuery = ({ period, start, end, groupBy }: DashboardParams) => {
  const searchParams = new URLSearchParams({ q: period });
  if (start) searchParams.set('start', start);
  if (end) searchParams.set('end', end);
  if (groupBy) searchParams.set('groupby', groupBy);
  return searchParams.toString();
};

export const DashboardService = {
  async load(params: DashboardParams): Promise<DashboardResponse> {
    const query = buildDashboardQuery(params);
    const response = await http.get<DashboardResponse>(`${APIS.LOAD_DASHBOARD}/?${query}`);
    return response.data;
  },
};
