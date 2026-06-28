import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useNavigate } from 'react-router-dom';
import { 
  Plug, 
  Search,
  CheckCircle2,
  Settings
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { slackService, SlackIntegration } from '../../services/slackService';
import { getTeamsIntegration, TeamsIntegration } from '../../services/teamsIntegration';
import { errorNotification } from '../../components/ui/Toast';
import { SlackLogo, MicrosoftTeamsLogo, WebhookIcon, EmailIcon, SafariSmsLogo } from '../../components/icons/BrandLogos';
import { PageCard, PageHeader } from '../../components/layout';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: 'communication' | 'productivity' | 'analytics' | 'security' | 'storage';
  status: 'connected' | 'available' | 'coming-soon';
  integrationType?: 'general' | 'ticketing-competitor';
  settingsPath?: string;
}

const integrations: Integration[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send ticket notifications and updates to Slack channels',
    icon: SlackLogo,
    category: 'communication',
    status: 'available',
  },
  {
    id: 'email',
    name: 'Email Integration',
    description: 'Connect your email account to create tickets from emails',
    icon: EmailIcon,
    category: 'communication',
    status: 'connected',
    settingsPath: '/config/email',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Receive notifications and manage tickets in Teams',
    icon: MicrosoftTeamsLogo,
    category: 'communication',
    status: 'available',
  },
  {
    id: 'webhook',
    name: 'Webhooks',
    description: 'Send real-time ticket events to your custom endpoints',
    icon: WebhookIcon,
    category: 'productivity',
    status: 'available',
  },
  {
    id: 'safari-sms',
    name: 'Safari SMS',
    description: 'Send SMS and WhatsApp notifications for ticket updates',
    icon: SafariSmsLogo,
    category: 'communication',
    status: 'coming-soon',
  },
];

export const IntegrationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Integration states
  const [slackIntegration, setSlackIntegration] = useState<SlackIntegration | null>(null);
  const [teamsIntegration, setTeamsIntegration] = useState<TeamsIntegration | null>(null);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  
  // Handle URL params for OAuth callbacks - redirect to setup pages
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const slackConnected = searchParams.get('slack_connected');
      const slackError = searchParams.get('slack_error');
      const teamsConnected = searchParams.get('teams_connected');
      const teamsError = searchParams.get('teams_error');
      
      if (slackConnected === 'true') {
        navigate('/config/integrations/slack/setup?slack_connected=true');
        return;
      } else if (slackError) {
        errorNotification(`Slack integration error: ${slackError}`);
        setSearchParams({});
      }
      
      if (teamsConnected === 'true') {
        navigate('/config/integrations/teams/setup?teams_connected=true');
        return;
      } else if (teamsError) {
        errorNotification(`Teams integration error: ${teamsError}`);
        setSearchParams({});
      }
    };
    
    handleOAuthCallback();
  }, [searchParams, setSearchParams, navigate]);
  
  // Load all integrations on mount
  useEffect(() => {
    const loadAllIntegrations = async () => {
      setIntegrationsLoading(true);
      await Promise.all([
        loadSlackIntegration(),
        loadTeamsIntegration(),
      ]);
      setIntegrationsLoading(false);
    };
    loadAllIntegrations();
  }, []);

  const loadTeamsIntegration = async () => {
    try {
      const response = await getTeamsIntegration();
      setTeamsIntegration(response.integration);
    } catch (error) {
      console.error('Error loading Teams integration:', error);
    }
  };
  
  const loadSlackIntegration = async () => {
    try {
      const integration = await slackService.getIntegration();
      setSlackIntegration(integration);
    } catch (error) {
      console.error('Error loading Slack integration:', error);
    }
  };

  const visibleIntegrations = useMemo(() => {
    const deduped = new Map<string, Integration>();
    for (const integration of integrations) {
      if (!deduped.has(integration.id)) {
        deduped.set(integration.id, integration);
      }
    }
    return Array.from(deduped.values()).filter(
      (integration) => integration.integrationType !== 'ticketing-competitor'
    );
  }, []);

  const filteredIntegrations = visibleIntegrations.filter((integration) => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }).map(integration => {
    if (integration.id === 'slack') {
      return { ...integration, status: slackIntegration ? 'connected' as const : 'available' as const };
    }
    if (integration.id === 'teams') {
      return { ...integration, status: teamsIntegration ? 'connected' as const : 'available' as const };
    }
    return integration;
  });

  const getStatusBadge = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[length:var(--font-meta)] font-medium bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
            <CheckCircle2 className="w-3 h-3" />
            Connected
          </span>
        );
      case 'available':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[length:var(--font-meta)] font-medium bg-[var(--status-info-bg)] text-[var(--status-info-text)]">
            Available
          </span>
        );
      case 'coming-soon':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[length:var(--font-meta)] font-medium bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
            Coming Soon
          </span>
        );
    }
  };

  const getIntegrationButton = (integration: Integration) => {
    if (integration.status === 'coming-soon') {
      return (
        <Button size="sm" variant="outline" className="w-full" disabled>
          Coming Soon
        </Button>
      );
    }

    const isConnected = integration.status === 'connected';

    // Email has its own settings path
    if (integration.settingsPath) {
      return (
        <Button
          size="sm"
          variant="outline"
          icon={Settings}
          className="w-full"
          onClick={() => navigate(integration.settingsPath!)}
        >
          Configure
        </Button>
      );
    }
    
    // Navigate to setup pages for all integration types
    const setupPaths: Record<string, string> = {
      'slack': '/config/integrations/slack/setup',
      'teams': '/config/integrations/teams/setup',
    };
    
    const setupPath = setupPaths[integration.id];
    
    if (setupPath) {
      return (
        <Button
          size="sm"
          variant={isConnected ? 'outline' : 'primary'}
          icon={isConnected ? Settings : undefined}
          className="w-full"
          onClick={() => navigate(setupPath)}
        >
          {isConnected ? 'Manage' : 'Connect'}
        </Button>
      );
    }
    
    // Fallback for other integrations
    return (
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        disabled
      >
        Coming Soon
      </Button>
    );
  };

  return (
    <div className="sd-config-content gap-4">
        <PageHeader
          title="Integrations"
          subtitle="Connect SafariDesk with your favorite tools and services"
        />

        {/* Search */}
        <PageCard padding="sm">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-muted)]" />
                <Input
                  type="text"
                  placeholder="Search integrations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </PageCard>

        {/* Integrations Grid */}
        {integrationsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="surface-card p-5">
                <div className="flex items-center gap-4">
                  <div className="sd-shimmer h-12 w-12 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="sd-shimmer h-4 w-1/2 rounded" />
                    <div className="sd-shimmer h-3 w-1/3 rounded-full" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="sd-shimmer h-3 w-full rounded" />
                  <div className="sd-shimmer h-3 w-4/5 rounded" />
                </div>
                <div className="mt-5 sd-shimmer h-8 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filteredIntegrations.length === 0 ? (
          <div className="surface-card py-16 text-center">
            <Plug className="mx-auto h-10 w-10 text-[var(--text-muted)]" />
            <h3 className="mt-3 text-[length:var(--font-label)] font-semibold text-[var(--text-primary)]">No integrations found</h3>
            <p className="mt-1 text-[length:var(--font-body)] text-[var(--text-secondary)]">
              Try adjusting your search query
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredIntegrations.map((integration) => {
              const Icon = integration.icon;
              const isConnected = integration.status === 'connected';
              return (
                <div
                  key={integration.id}
                  className="surface-card p-5 flex flex-col transition-shadow hover:shadow-[var(--shell-shadow-md)]"
                  style={isConnected ? { borderColor: 'var(--status-success-border)' } : undefined}
                >
                  {/* Header row: icon + status badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0"
                      style={{ backgroundColor: 'var(--surface-subtle)' }}
                    >
                      <Icon className="w-7 h-7" />
                    </div>
                    {getStatusBadge(integration.status)}
                  </div>

                  {/* Name + description */}
                  <div className="mt-4 flex-1">
                    <h3 className="text-[length:var(--font-label)] font-semibold text-[var(--text-primary)]">
                      {integration.name}
                    </h3>
                    <p className="mt-1 text-[length:var(--font-body)] text-[var(--text-secondary)] leading-relaxed">
                      {integration.description}
                    </p>
                  </div>

                  {/* Divider + action */}
                  <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                    {getIntegrationButton(integration)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
};

export default IntegrationsPage;
