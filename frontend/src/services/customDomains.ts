import http from './http';
import { APIS } from './apis';
import {
  CustomDomain,
  DomainStatus,
  DomainSetupGuide,
  DomainCheckRequest,
  DomainCheckResponse,
  CreateDomainRequest,
  VerifyDomainResponse,
} from '../types/customDomain';

export const customDomainsService = {
  /**
   * Get all domains for the current business
   */
  async listDomains(): Promise<CustomDomain[]> {
    const response = await http.get<CustomDomain[] | { results: CustomDomain[] }>(APIS.CUSTOM_DOMAINS);
    // Handle both array and paginated response
    return Array.isArray(response.data) ? response.data : response.data.results || [];
  },

  /**
   * Get domain status for the current business
   */
  async getDomainStatus(): Promise<DomainStatus> {
    const response = await http.get<DomainStatus>(APIS.CUSTOM_DOMAINS_STATUS);
    return response.data;
  },

  /**
   * Create a new custom domain
   */
  async createDomain(data: CreateDomainRequest): Promise<CustomDomain> {
    const response = await http.post<CustomDomain>(APIS.CUSTOM_DOMAINS, data);
    return response.data;
  },

  /**
   * Get details of a specific domain
   */
  async getDomain(id: number): Promise<CustomDomain> {
    const response = await http.get<CustomDomain>(`${APIS.CUSTOM_DOMAIN_DETAIL}${id}/`);
    return response.data;
  },

  /**
   * Update a domain
   */
  async updateDomain(id: number, data: Partial<CustomDomain>): Promise<CustomDomain> {
    const response = await http.patch<CustomDomain>(`${APIS.CUSTOM_DOMAIN_DETAIL}${id}/`, data);
    return response.data;
  },

  /**
   * Delete a domain
   */
  async deleteDomain(id: number): Promise<void> {
    await http.delete(`${APIS.CUSTOM_DOMAIN_DETAIL}${id}/`);
  },

  /**
   * Verify domain ownership
   */
  async verifyDomain(id: number): Promise<VerifyDomainResponse> {
    const response = await http.post<VerifyDomainResponse>(`${APIS.CUSTOM_DOMAIN_VERIFY}${id}/verify/`);
    return response.data;
  },

  /**
   * Check DNS verification status without updating the domain
   */
  async checkVerification(id: number): Promise<DomainCheckResponse> {
    const response = await http.get<DomainCheckResponse>(`${APIS.CUSTOM_DOMAIN_CHECK_VERIFICATION}${id}/check_verification/`);
    return response.data;
  },

  /**
   * Regenerate verification token
   */
  async regenerateToken(id: number): Promise<CustomDomain> {
    const response = await http.post<CustomDomain>(`${APIS.CUSTOM_DOMAIN_REGENERATE_TOKEN}${id}/regenerate_token/`);
    return response.data;
  },

  /**
   * Get detailed setup guide for a domain
   */
  async getSetupGuide(id: number): Promise<DomainSetupGuide> {
    const response = await http.get<DomainSetupGuide>(`${APIS.CUSTOM_DOMAIN_SETUP_GUIDE}${id}/setup_guide/`);
    return response.data;
  },

  /**
   * Check DNS propagation
   */
  async checkDNS(data: DomainCheckRequest): Promise<DomainCheckResponse> {
    const response = await http.post<DomainCheckResponse>(APIS.CUSTOM_DOMAINS_CHECK_DNS, data);
    return response.data;
  },
};
