import React, { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Trash2,
  Copy,
  ExternalLink,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { customDomainsService } from '../../services/customDomains';
import {
  CustomDomain,
  DomainStatus,
  CreateDomainRequest,
  DomainSetupGuide,
} from '../../types/customDomain';
import { successNotification, errorNotification } from '../ui/Toast';

export const CustomDomainsSettings: React.FC = () => {
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [status, setStatus] = useState<DomainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'dns_txt' | 'dns_cname'>('dns_txt');
  const [submitting, setSubmitting] = useState(false);
  const [expandedDomainId, setExpandedDomainId] = useState<number | null>(null);
  const [verifyingDomainId, setVerifyingDomainId] = useState<number | null>(null);
  const [setupGuides, setSetupGuides] = useState<Record<number, DomainSetupGuide>>({});

  // Polling for verification status
  const [pollingIntervals, setPollingIntervals] = useState<Record<number, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    loadDomains();
    return () => {
      // Cleanup all polling intervals on unmount
      Object.values(pollingIntervals).forEach(clearInterval);
    };
  }, []);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const [domainsData, statusData] = await Promise.all([
        customDomainsService.listDomains(),
        customDomainsService.getDomainStatus(),
      ]);
      
      // Handle both array and paginated response
      const domains = Array.isArray(domainsData) ? domainsData : (domainsData as any)?.results || [];
      setDomains(domains);
      setStatus(statusData);

      // Start polling for unverified domains
      domains.forEach(domain => {
        if (!domain.is_verified && domain.verification_status !== 'failed') {
          startPolling(domain.id);
        }
      });
    } catch (error: any) {
      errorNotification(error.response?.data?.message || 'Failed to load domains');
      // Set empty array on error to prevent map error
      setDomains([]);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (domainId: number) => {
    // Clear existing interval if any
    if (pollingIntervals[domainId]) {
      clearInterval(pollingIntervals[domainId]);
    }

    // Poll every 30 seconds
    const interval = setInterval(async () => {
      try {
        const result = await customDomainsService.checkVerification(domainId);
        if (result.dns_propagated) {
          // DNS is propagated, try to verify
          await verifyDomain(domainId, false); // silent verification
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 30000); // 30 seconds

    setPollingIntervals(prev => ({ ...prev, [domainId]: interval }));
  };

  const stopPolling = (domainId: number) => {
    if (pollingIntervals[domainId]) {
      clearInterval(pollingIntervals[domainId]);
      setPollingIntervals(prev => {
        const newIntervals = { ...prev };
        delete newIntervals[domainId];
        return newIntervals;
      });
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) {
      errorNotification('Please enter a domain');
      return;
    }

    try {
      setSubmitting(true);
      const data: CreateDomainRequest = {
        domain: newDomain.trim(),
        verification_method: verificationMethod,
      };
      const createdDomain = await customDomainsService.createDomain(data);
      successNotification('Domain added successfully! Please add the DNS records to verify.');
      setDomains([...domains, createdDomain]);
      setShowAddModal(false);
      setNewDomain('');
      setExpandedDomainId(createdDomain.id);
      
      // Start polling for this new domain
      startPolling(createdDomain.id);
      
      // Load status
      const statusData = await customDomainsService.getDomainStatus();
      setStatus(statusData);
    } catch (error: any) {
      errorNotification(error.response?.data?.message || 'Failed to add domain');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyDomain = async (domainId: number, showNotifications = true) => {
    try {
      setVerifyingDomainId(domainId);
      const result = await customDomainsService.verifyDomain(domainId);
      
      if (result.success) {
        if (showNotifications) {
          successNotification(result.message || 'Domain verified successfully!');
        }
        stopPolling(domainId);
        await loadDomains();
      } else {
        if (showNotifications) {
          errorNotification(result.message || 'Domain verification failed');
        }
      }
    } catch (error: any) {
      if (showNotifications) {
        errorNotification(error.response?.data?.message || 'Failed to verify domain');
      }
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const checkVerification = async (domainId: number) => {
    try {
      const result = await customDomainsService.checkVerification(domainId);
      if (result.dns_propagated) {
        successNotification('DNS records found! You can now verify your domain.');
      } else if (result.records_found.length > 0) {
        successNotification(`Found ${result.records_found.length} DNS record(s), but verification record not found yet.`);
      } else {
        errorNotification('DNS records not found yet. Please wait for DNS propagation (10-30 minutes).');
      }
    } catch (error: any) {
      errorNotification(error.response?.data?.message || 'Failed to check DNS');
    }
  };

  const deleteDomain = async (domainId: number) => {
    if (!confirm('Are you sure you want to delete this domain?')) return;

    try {
      await customDomainsService.deleteDomain(domainId);
      successNotification('Domain deleted successfully');
      stopPolling(domainId);
      await loadDomains();
    } catch (error: any) {
      errorNotification(error.response?.data?.message || 'Failed to delete domain');
    }
  };

  const regenerateToken = async (domainId: number) => {
    if (!confirm('Regenerate verification token? You will need to update your DNS records.')) return;

    try {
      const updatedDomain = await customDomainsService.regenerateToken(domainId);
      successNotification('Token regenerated. Please update your DNS records.');
      setDomains(domains.map(d => d.id === domainId ? updatedDomain : d));
    } catch (error: any) {
      errorNotification(error.response?.data?.message || 'Failed to regenerate token');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    successNotification(`${label} copied to clipboard`);
  };

  const toggleExpanded = async (domainId: number) => {
    if (expandedDomainId === domainId) {
      setExpandedDomainId(null);
    } else {
      setExpandedDomainId(domainId);
      
      // Load setup guide if not already loaded
      if (!setupGuides[domainId]) {
        try {
          const guide = await customDomainsService.getSetupGuide(domainId);
          setSetupGuides(prev => ({ ...prev, [domainId]: guide }));
        } catch (error) {
          console.error('Failed to load setup guide:', error);
        }
      }
    }
  };

  const getStatusIcon = (domain: CustomDomain) => {
    if (domain.is_verified) {
      return <CheckCircle className="h-5 w-5 text-[var(--text-secondary)]" />;
    } else if (domain.verification_status === 'failed') {
      return <XCircle className="h-5 w-5 text-[var(--text-secondary)]" />;
    } else {
      return <Clock className="h-5 w-5 text-[var(--text-secondary)]" />;
    }
  };

  const getStatusText = (domain: CustomDomain) => {
    if (domain.is_verified) return 'Verified';
    if (domain.verification_status === 'failed') return 'Failed';
    return 'Pending';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="sd-config-content">
      <div className="w-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">Custom Domains</h2>
            <p className="mt-1 text-[length:var(--font-body)] text-[var(--text-secondary)]">
              Use your own custom domain for a branded experience
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!status?.can_add_domain}
            className="flex items-center px-2 py-1 h-8 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </button>
        </div>

        {/* Status Banner */}
      {status && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-[var(--shell-radius)] p-3">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Domain Status</h3>
              <p className="mt-1 text-[length:var(--font-body)] text-blue-800 dark:text-blue-200">
                {status.has_verified_domain ? (
                  <>Active domain: <span className="font-mono font-semibold">{status.verified_domain}</span></>
                ) : (
                  <>You can have one verified custom domain per business.</>
                )}
                {status.pending_domains > 0 && (
                  <> You have {status.pending_domains} pending domain(s).</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Domains List */}
      <div className="space-y-4">
        {domains.length === 0 ? (
          <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-[var(--shell-radius)] border border-[var(--border-color)]">
            <Globe className="h-10 w-10 text-gray-400 mx-auto mb-2" />
            <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
              No custom domains yet
            </h3>
            <p className="text-[length:var(--font-meta)] text-gray-600 dark:text-gray-400 mb-2">
              Add your first custom domain to get started
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-2 py-1 h-8 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </button>
          </div>
        ) : (
          domains.map(domain => (
            <div
              key={domain.id}
              className="bg-white dark:bg-surface-elevated rounded-[var(--shell-radius)] border border-[var(--border-color)] overflow-hidden"
            >
              {/* Domain Header */}
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(domain)}
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)]">
                        {domain.domain}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`text-[length:var(--font-meta)] px-2 py-0.5 rounded-full ${
                          domain.is_verified
                            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300'
                            : domain.verification_status === 'failed'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}>
                          {getStatusText(domain)}
                        </span>
                        <span className="text-[length:var(--font-meta)] text-gray-500 dark:text-[var(--text-secondary)]">
                          Method: {domain.verification_method === 'dns_txt' ? 'TXT' : 'CNAME'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!domain.is_verified && (
                      <>
                        <button
                          onClick={() => checkVerification(domain.id)}
                          className="p-2 text-gray-600 hover:text-gray-900 dark:text-[var(--text-primary)] dark:hover:text-gray-200"
                          title="Check DNS Status"
                        >
                          <RefreshCw className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => verifyDomain(domain.id)}
                          disabled={verifyingDomainId === domain.id}
                          className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50 transition-colors"
                        >
                          {verifyingDomainId === domain.id ? 'Verifying...' : 'Verify'}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteDomain(domain.id)}
                      className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      title="Delete Domain"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => toggleExpanded(domain.id)}
                      className="p-2 text-gray-600 hover:text-gray-900 dark:text-[var(--text-primary)] dark:hover:text-gray-200"
                    >
                      {expandedDomainId === domain.id ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedDomainId === domain.id && (
                <div className="border-t border-[var(--border-color)] bg-gray-50 dark:bg-surface-50 p-3 space-y-3">
                  {/* Verification Instructions */}
                  {!domain.is_verified && (
                    <div className="bg-white dark:bg-surface-elevated rounded-[var(--shell-radius)] p-3 space-y-3">
                      <h4 className="font-semibold text-[var(--text-primary)] flex items-center">
                        <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
                        DNS Verification Record
                      </h4>
                      
                      <div className="space-y-2">
                        <div>
                          <label className="text-[length:var(--font-meta)] text-gray-600 dark:text-[var(--text-secondary)] uppercase">
                            Record Type
                          </label>
                          <div className="flex items-center justify-between mt-1 p-2 bg-gray-50 dark:bg-surface rounded border border-[var(--border-color)]">
                            <code className="text-[length:var(--font-body)]">{domain.verification_method === 'dns_txt' ? 'TXT' : 'CNAME'}</code>
                          </div>
                        </div>

                        <div>
                          <label className="text-[length:var(--font-meta)] text-gray-600 dark:text-[var(--text-secondary)] uppercase">
                            Record Name
                          </label>
                          <div className="flex items-center justify-between mt-1 p-2 bg-gray-50 dark:bg-surface rounded border border-[var(--border-color)]">
                            <code className="text-[length:var(--font-body)] break-all">{domain.verification_record_name}</code>
                            <button
                              onClick={() => copyToClipboard(domain.verification_record_name, 'Record name')}
                              className="ml-2 p-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                              title="Copy record name"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[length:var(--font-meta)] text-gray-600 dark:text-[var(--text-secondary)] uppercase">
                            Record Value
                          </label>
                          <div className="flex items-center justify-between mt-1 p-2 bg-gray-50 dark:bg-surface rounded border border-[var(--border-color)]">
                            <code className="text-[length:var(--font-body)] break-all">{domain.verification_record_value}</code>
                            <button
                              onClick={() => copyToClipboard(domain.verification_record_value, 'Record value')}
                              className="ml-2 p-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                              title="Copy record value"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[length:var(--font-meta)] text-gray-600 dark:text-[var(--text-secondary)] uppercase">
                            TTL (Time To Live)
                          </label>
                          <div className="flex items-center justify-between mt-1 p-2 bg-gray-50 dark:bg-surface rounded border border-[var(--border-color)]">
                            <code className="text-[length:var(--font-body)]">3600 (or default)</code>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <button
                          onClick={() => regenerateToken(domain.id)}
                          className="text-[length:var(--font-body)] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Regenerate Token
                        </button>
                        <a
                          href="https://dnschecker.org"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[length:var(--font-body)] text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                        >
                          Check DNS Propagation
                          <ExternalLink className="h-4 w-4 ml-1" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Setup Guide */}
                  {setupGuides[domain.id] && (
                    <div className="bg-white dark:bg-surface-elevated rounded-[var(--shell-radius)] p-3">
                      <h4 className="font-semibold text-[var(--text-primary)] mb-3">
                        Setup Instructions
                      </h4>
                      <div className="text-[length:var(--font-body)] text-gray-600 dark:text-[var(--text-primary)] space-y-2">
                        <p>1. Log in to your DNS provider</p>
                        <p>2. Add the verification record shown above</p>
                        <p>3. Wait for DNS propagation (10-30 minutes)</p>
                        <p>4. Click "Verify" button to complete setup</p>
                        {domain.is_verified && (
                          <div className="mt-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded">
                            <p className="text-primary-800 dark:text-primary-300">
                              ✓ Your domain is verified and active!
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="text-[length:var(--font-meta)] text-gray-500 dark:text-[var(--text-secondary)] space-y-1">
                    <p>Added: {new Date(domain.created_at).toLocaleString()}</p>
                    {domain.verified_at && (
                      <p>Verified: {new Date(domain.verified_at).toLocaleString()}</p>
                    )}
                    {domain.last_verification_attempt && (
                      <p>Last check: {new Date(domain.last_verification_attempt).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Domain Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-[var(--overlay-bg)] flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-surface-elevated rounded-[var(--shell-radius)] max-w-md w-full p-6">
            <h3 className="mb-4 text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">
              Add Custom Domain
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[length:var(--font-label)] font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                  Domain Name
                </label>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="support.yourcompany.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[var(--border-color)] rounded-[var(--shell-radius)] focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-surface-hover text-gray-900 dark:text-[var(--text-primary)]"
                />
                <p className="mt-1 text-[length:var(--font-meta)] text-gray-500 dark:text-[var(--text-secondary)]">
                  Enter your custom subdomain (e.g., support.yourcompany.com)
                </p>
              </div>

              <div>
                <label className="block text-[length:var(--font-label)] font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2">
                  Verification Method
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="dns_txt"
                      checked={verificationMethod === 'dns_txt'}
                      onChange={(e) => setVerificationMethod(e.target.value as 'dns_txt')}
                      className="mr-2"
                    />
                    <span className="text-[length:var(--font-body)] text-gray-700 dark:text-[var(--text-primary)]">
                      TXT Record (Recommended)
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="dns_cname"
                      checked={verificationMethod === 'dns_cname'}
                      onChange={(e) => setVerificationMethod(e.target.value as 'dns_cname')}
                      className="mr-2"
                    />
                    <span className="text-[length:var(--font-body)] text-gray-700 dark:text-[var(--text-primary)]">
                      CNAME Record
                    </span>
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-[var(--shell-radius)] p-3">
                <p className="text-[length:var(--font-meta)] text-blue-800 dark:text-blue-200">
                  <Info className="h-4 w-4 inline mr-1" />
                  After adding, you'll need to add DNS records at your domain provider to verify ownership.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewDomain('');
                }}
                disabled={submitting}
                className="px-4 py-2 text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover rounded-[var(--shell-radius)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDomain}
                disabled={submitting || !newDomain.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-[var(--shell-radius)] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Adding...' : 'Add Domain'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
