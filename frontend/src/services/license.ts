import { APIS } from './apis';
import http from './http';
import type { LicenseStatus } from '../types';

export const fetchLicenseStatus = async (): Promise<LicenseStatus> => {
  const response = await http.get<LicenseStatus>(APIS.LICENSE_STATUS);
  return response.data;
};
