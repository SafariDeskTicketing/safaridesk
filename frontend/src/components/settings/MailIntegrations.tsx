import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { ChevronDown, Settings as SettingsIcon, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { MailIntegrationWizard } from './MailIntegrationWizard';
import { MailIntegrationDrawer } from './MailIntegrationDrawer';
import ConfirmDialog from '../ui/ConfirmDialog';
import {
  fetchMailIntegrations,
  startGoogleMailIntegration,
  startMicrosoftMailIntegration,
  provisionForwardingAddress,
  createMailIntegration,
  deleteMailIntegration,
  MailIntegration,
  MailIntegrationDirection,
  MailIntegrationPayload,
} from '../../services/settings';
import { formatDate } from '../../utils/date';
import { Loader } from '../loader/loader';

const statusColors: Record<string, string> = {
  connected: 'text-primary-600 bg-primary-50',
  connecting: 'text-yellow-700 bg-yellow-50',
  error: 'text-red-600 bg-red-50',
  disconnected: 'text-gray-600 bg-gray-100',
};

const getMailboxStatusLabel = (integration: MailIntegration) => {
  if (integration.provider === 'safaridesk' && integration.forwarding_status === 'pending_verification') {
    return 'Awaiting forwarded test email';
  }
  if (integration.connection_status === 'connected') {
    return 'Connected';
  }
  if (integration.connection_status === 'error') {
    return 'Needs attention';
  }
  if (integration.provider === 'gmail' || integration.provider === 'office365') {
    return 'Pending authorization';
  }
  return integration.connection_status || 'Pending setup';
};

export const MailIntegrations: React.FC = () => {
  const queryClient = useQueryClient();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardDirection, setWizardDirection] = useState<MailIntegrationDirection>('both');
  const [selectedDirection, setSelectedDirection] = useState<MailIntegrationDirection>('both');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeIntegrationId, setActiveIntegrationId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; integration: MailIntegration | null }>({ show: false, integration: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pendingOAuthIntegrationId, setPendingOAuthIntegrationId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refreshIntegrations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['mailIntegrations'] });
  }, [queryClient]);

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'mailIntegrationOauth') return;
      setPendingOAuthIntegrationId((current) => {
        if (data.status === 'success') {
          toast.success('Mailbox connected');
          queryClient.invalidateQueries({ queryKey: ['mailIntegrations'] });
        } else {
          const reason = data.error ? ` (${data.error})` : '';
          toast.error(`Mailbox connection failed${reason}`);
          queryClient.invalidateQueries({ queryKey: ['mailIntegrations'] });
        }
        return null;
      });
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [queryClient]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openOAuthPopup = (url: string): Window | null => {
    const popup = window.open(url, 'mailIntegrationOAuth', 'width=520,height=720');
    if (!popup) {
      toast.error('Popup blocked. Please allow popups and try again.');
    }
    return popup;
  };

  const watchPopupClose = useCallback((popup: Window | null, integrationId: number) => {
    if (!popup) return;
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        setPendingOAuthIntegrationId((current) => {
          if (current === integrationId) {
            queryClient.invalidateQueries({ queryKey: ['mailIntegrations'] });
            return null;
          }
          return current;
        });
      }
    }, 500);
  }, [queryClient]);

  const getReturnUrl = () => window.location.href;

  const { data: integrations, isLoading } = useQuery<MailIntegration[]>({
    queryKey: ['mailIntegrations'],
    queryFn: fetchMailIntegrations,
  });
  const activeIntegration = useMemo(() => {
    if (!integrations || activeIntegrationId === null) {
      return null;
    }
    return integrations.find((integration) => integration.id === activeIntegrationId) ?? null;
  }, [integrations, activeIntegrationId]);

  const openSettingsDrawer = (integration: MailIntegration) => {
    setActiveIntegrationId(integration.id);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setActiveIntegrationId(null);
  };
  const handleOAuthStart = async (integration: MailIntegration) => {
    try {
      const payload = { return_url: getReturnUrl() };
      const response =
        integration.provider === 'gmail'
          ? await startGoogleMailIntegration(integration.id, payload)
          : await startMicrosoftMailIntegration(integration.id, payload);
      if (response.authorization_url) {
        setPendingOAuthIntegrationId(integration.id);
        const popup = openOAuthPopup(response.authorization_url);
        watchPopupClose(popup, integration.id);
      } else {
        toast.error('Authorization URL missing from response');
      }
    } catch (error) {
      console.error(error);
      toast.error('Unable to start OAuth flow');
    }
  };

  const handleForwardingProvision = async (integration: MailIntegration) => {
    try {
      await provisionForwardingAddress(integration.id);
      toast.success('Forwarding address generated');
      refreshIntegrations();
    } catch (error) {
      console.error(error);
      toast.error('Unable to provision forwarding address');
    }
  };

  const createStubIntegration = async (provider: MailIntegration['provider']) => {
    const payload: MailIntegrationPayload = {
      provider,
      direction: selectedDirection,
    };
    return createMailIntegration(payload);
  };

  const handleGmailConnect = async () => {
    try {
      const integration = await createStubIntegration('gmail');
      const response = await startGoogleMailIntegration(integration.id, { return_url: getReturnUrl() });
      if (response.authorization_url) {
        setPendingOAuthIntegrationId(integration.id);
        const popup = openOAuthPopup(response.authorization_url);
        watchPopupClose(popup, integration.id);
        toast('Complete Google sign-in in the popup window.');
      } else {
        toast.error('Authorization URL missing from response');
        refreshIntegrations();
      }
    } catch (error) {
      console.error(error);
      toast.error('Unable to start Google OAuth flow');
    }
  };

  const handleMicrosoftConnect = async () => {
    try {
      const integration = await createStubIntegration('office365');
      const response = await startMicrosoftMailIntegration(integration.id, { return_url: getReturnUrl() });
      if (response.authorization_url) {
        setPendingOAuthIntegrationId(integration.id);
        const popup = openOAuthPopup(response.authorization_url);
        watchPopupClose(popup, integration.id);
        toast('Complete Microsoft sign-in in the popup window.');
      } else {
        toast.error('Authorization URL missing from response');
        refreshIntegrations();
      }
    } catch (error) {
      console.error(error);
      toast.error('Unable to start Microsoft OAuth flow');
    }
  };

  const handleSafariDeskConnect = async () => {
    const existing = integrations?.find((i) => i.provider === 'safaridesk');
    if (existing) {
      toast.error(
        `You already have a forwarding address${existing.forwarding_address ? `: ${existing.forwarding_address}` : ' (pending)'}. Delete it first to create a new one.`,
        { duration: 5000 }
      );
      return;
    }
    try {
      const integration = await createStubIntegration('safaridesk');
      await provisionForwardingAddress(integration.id);
      toast.success('Forwarding address generated.');
      refreshIntegrations();
    } catch (error) {
      console.error(error);
      toast.error('Unable to provision SafariDesk forwarding address');
    }
  };

  const handleDeleteClick = (integration: MailIntegration) => {
    setConfirmDelete({ show: true, integration });
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete.integration) return;
    setIsDeleting(true);
    try {
      await deleteMailIntegration(confirmDelete.integration.id);
      toast.success('Mailbox deleted');
      refreshIntegrations();
      setConfirmDelete({ show: false, integration: null });
    } catch (error) {
      console.error(error);
      // Possible transient/network error — revalidate integrations and check if it was removed server-side
      try {
        await queryClient.invalidateQueries({ queryKey: ['mailIntegrations'] });
        const latest = queryClient.getQueryData<MailIntegration[]>(['mailIntegrations']) || [];
        const stillExists = latest.some((i) => i.id === confirmDelete.integration!.id);
        if (!stillExists) {
          toast.success('Mailbox deleted');
          setConfirmDelete({ show: false, integration: null });
        } else {
          toast.error('Unable to delete mailbox');
        }
      } catch (e) {
        console.error('Post-delete verification failed', e);
        toast.error('Unable to delete mailbox');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  const renderConnectPanel = () => (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-[#202020] dark:to-[#202020] rounded-xl p-4 space-y-3 border border-blue-100 dark:border-[var(--border-color)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Connect New Mailbox
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Choose a provider to integrate your email inbox
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Direction:</label>
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center justify-between gap-3 px-4 py-2.5 min-w-[160px] text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-[var(--border-color)] rounded-xl shadow-sm hover:border-gray-300 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all cursor-pointer text-gray-900 dark:text-white"
            >
              <span className="capitalize">{selectedDirection}</span>
              <ChevronDown className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isDropdownOpen && (
              <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-[var(--border-color)] rounded-xl shadow-lg overflow-hidden z-50">
                {[
                  { value: 'incoming', label: 'Incoming' },
                  { value: 'outgoing', label: 'Outgoing' },
                  { value: 'both', label: 'Both' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSelectedDirection(option.value as MailIntegrationDirection);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                      selectedDirection === option.value
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={handleGmailConnect}
          className="group bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-[var(--border-color)] hover:border-red-400 dark:hover:border-red-500 rounded-xl p-4 text-left transition-all duration-200 hover:shadow-lg"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <img 
                src="https://www.google.com/gmail/about/static-2.0/images/logo-gmail.png" 
                alt="Gmail"
                className="h-6 w-6 object-contain"
              />
            </div>
            <div className="font-bold text-gray-900 dark:text-white">Gmail</div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Connect via Google OAuth</p>
          <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all">
            Sign in <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </button>

        <button
          type="button"
          onClick={handleMicrosoftConnect}
          className="group bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-[var(--border-color)] hover:border-blue-400 dark:hover:border-blue-500 rounded-xl p-4 text-left transition-all duration-200 hover:shadow-lg"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" 
                alt="Microsoft"
                className="h-6 w-6 object-contain"
              />
            </div>
            <div className="font-bold text-gray-900 dark:text-white">Microsoft</div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Connect via Microsoft Graph</p>
          <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all">
            Sign in <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setWizardDirection(selectedDirection);
            setIsWizardOpen(true);
          }}
          className="group bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-[var(--border-color)] hover:border-purple-400 dark:hover:border-purple-500 rounded-xl p-4 text-left transition-all duration-200 hover:shadow-lg"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <div className="font-bold text-gray-900 dark:text-white">Custom IMAP</div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Configure IMAP/SMTP manually</p>
          <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all">
            Configure <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </button>

        <button
          type="button"
          onClick={handleSafariDeskConnect}
          className="group bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-[var(--border-color)] hover:border-primary-400 dark:hover:border-primary-500 rounded-xl p-4 text-left transition-all duration-200 hover:shadow-lg"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="h-6 w-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="font-bold text-gray-900 dark:text-white">Forwarding</div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Generate forwarding alias</p>
          <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all">
            Generate <span className="group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-full px-4 md:px-8 py-4 space-y-6">
        {renderConnectPanel()}

      {(!integrations || integrations.length === 0) && (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-[var(--border-color)]">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="mt-4 text-sm font-medium text-gray-900 dark:text-white">No mailboxes connected</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by connecting your first email provider above</p>
        </div>
      )}

      {integrations && integrations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="h-5 w-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Connected Mailboxes
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({integrations.length})</span>
            </h3>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-[var(--border-color)] rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left section - Email info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center">
                      {integration.provider === 'gmail' && (
                        <img 
                          src="https://www.google.com/gmail/about/static-2.0/images/logo-gmail.png" 
                          alt="Gmail"
                          className="h-7 w-7 object-contain"
                        />
                      )}
                      {integration.provider === 'office365' && (
                        <img 
                          src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" 
                          alt="Microsoft"
                          className="h-7 w-7 object-contain"
                        />
                      )}
                      {integration.provider !== 'gmail' && integration.provider !== 'office365' && (
                        <svg className="h-7 w-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                          {integration.email_address || 'Pending'}
                        </h4>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[integration.connection_status] ?? 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          title={integration.connection_status_detail || undefined}
                        >
                          {getMailboxStatusLabel(integration)}
                        </span>
                      </div>
                      
                      {integration.display_name && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{integration.display_name}</p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                          </svg>
                          <span className="capitalize">{integration.provider}</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          {integration.direction === 'incoming' && '📥'}
                          {integration.direction === 'outgoing' && '📤'}
                          {integration.direction === 'both' && (
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 11a8 8 0 10-5.07 7.45M20 11v-5m0 5h-5" />
                            </svg>
                          )}
                          <span className="capitalize">{integration.direction}</span>
                        </div>
                        
                        {integration.department_name && (
                          <div className="flex items-center gap-1.5">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span>{integration.department_name}</span>
                          </div>
                        )}
                        {integration.default_assignee_name && (
                          <div className="flex items-center gap-1.5">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span>{integration.default_assignee_name}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1.5">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{integration.last_success_at ? formatDate(integration.last_success_at) : 'Never synced'}</span>
                        </div>
                      </div>
                      
                      {integration.connection_status_detail && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-start gap-1.5">
                          <svg className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {integration.connection_status_detail}
                        </p>
                      )}
                      
                      {integration.forwarding_address && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Forwarding:</span>
                          <code className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">
                            {integration.forwarding_address}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right section - Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(integration.provider === 'gmail' || integration.provider === 'office365') && (
                      <Button
                        size="sm"
                        onClick={() => handleOAuthStart(integration)}
                        variant={integration.connection_status === 'connected' ? 'secondary' : 'primary'}
                      >
                        {integration.connection_status === 'connected' ? 'Reconnect' : 'Continue'}
                      </Button>
                    )}
                    {integration.provider === 'safaridesk' && !integration.forwarding_address && (
                      <Button size="sm" onClick={() => handleForwardingProvision(integration)}>
                        Generate Address
                      </Button>
                    )}
                    <button
                      type="button"
                      className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                      title="Mailbox settings"
                      onClick={() => openSettingsDrawer(integration)}
                    >
                      <SettingsIcon className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      title="Delete mailbox"
                      onClick={() => handleDeleteClick(integration)}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <MailIntegrationWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onCompleted={() => {
          refreshIntegrations();
          toast.success('Mailbox added');
        }}
        presetProvider="custom"
        presetDirection={wizardDirection}
      />
      <MailIntegrationDrawer
        integration={activeIntegration}
        isOpen={Boolean(isDrawerOpen && activeIntegration)}
        onClose={closeDrawer}
        onUpdated={refreshIntegrations}
        onStartOAuth={handleOAuthStart}
      />

      <ConfirmDialog
        show={confirmDelete.show}
        message={`Are you sure you want to delete mailbox ${confirmDelete.integration?.email_address || confirmDelete.integration?.provider || ''}?`}
        variant="danger"
        state={isDeleting}
        onConfirm={handleDeleteConfirm}
        cancel={() => setConfirmDelete({ show: false, integration: null })}
      />
      </div>
    </div>
  );
};
