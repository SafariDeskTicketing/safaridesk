import React, { useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import SlackIntegrationComponent from '../components/integrations/SlackIntegration';
import TeamsIntegrationComponent from '../components/integrations/TeamsIntegration';
import { TelegramIntegrationModal } from '../components/integrations/TelegramIntegration';
import { SlackLogo, MicrosoftTeamsLogo, WebhookIcon, EmailIcon, TelegramLogo } from '../components/icons/BrandLogos';
import { PageHeader } from '../components/layout';

const pageMeta: Record<string, { title: string; description: string; icon: React.ReactNode }> = {
  slack: {
    title: 'Slack Integration',
    description: 'Connect SafariDesk with your Slack workspace to receive real-time notifications.',
    icon: <SlackLogo size={24} className="h-6 w-6" />
  },
  teams: {
    title: 'Microsoft Teams Integration',
    description: 'Connect SafariDesk with Microsoft Teams to receive real-time notifications.',
    icon: <MicrosoftTeamsLogo size={24} className="h-6 w-6" />
  },
  telegram: {
    title: 'Telegram Integration',
    description: 'Connect SafariDesk with Telegram to receive real-time notifications.',
    icon: <TelegramLogo size={24} className="h-6 w-6" />
  },
  email: {
    title: 'Email Integration',
    description: 'Configure email notifications and SMTP settings.',
    icon: <EmailIcon size={24} className="h-6 w-6" />
  },
  webhooks: {
    title: 'Webhooks',
    description: 'Set up webhooks to integrate with third-party services.',
    icon: <WebhookIcon size={24} className="h-6 w-6" />
  }
};

const IntegrationsPage: React.FC = () => {
  const location = useLocation();
  const path = location.pathname.split('/').pop() || '';
  const meta = pageMeta[path] || {
    title: 'Integrations',
    description: 'Connect SafariDesk with your favorite tools and services',
    icon: <WebhookIcon size={24} className="h-6 w-6" />
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="text-primary-600">{meta.icon}</span>
            <span>{meta.title}</span>
          </span>
        }
        subtitle={meta.description}
      />

      <Routes>
        <Route index element={<IntegrationsOverview />} />
        <Route path="slack" element={<SlackIntegrationComponent />} />
        <Route path="teams" element={<TeamsIntegrationComponent />} />
      </Routes>
    </div>
  );
};

const IntegrationsOverview: React.FC = () => {
  const navigate = useNavigate();
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  const integrations = [
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get real-time notifications in your Slack channels when tickets are created, updated, or assigned.',
      icon: <SlackLogo size={32} className="h-8 w-8" />,
      status: 'available',
      path: '/integrations/slack',
      features: ['Real-time ticket notifications', 'SLA breach alerts', 'Assignment notifications', 'Comment updates']
    },
    {
      id: 'teams',
      name: 'Microsoft Teams',
      description: 'Get real-time notifications in your Microsoft Teams channels when tickets are created, updated, or assigned.',
      icon: <MicrosoftTeamsLogo size={32} className="h-8 w-8" />,
      status: 'available',
      path: '/integrations/teams',
      features: ['Real-time ticket notifications', 'SLA breach alerts', 'Assignment notifications', 'Adaptive Cards support']
    },
    {
      id: 'telegram',
      name: 'Telegram',
      description: 'Receive ticket notifications and updates via Telegram bot in your groups or channels.',
      icon: <TelegramLogo size={32} className="h-8 w-8" />,
      status: 'available',
      useModal: true,
      features: ['Real-time ticket notifications', 'SLA breach alerts', 'Assignment notifications', 'Bot commands support']
    },
    {
      id: 'email',
      name: 'Email',
      description: 'Configure email notifications and SMTP settings for automated ticket communications.',
      icon: <EmailIcon size={32} className="h-8 w-8" />,
      status: 'available',
      path: '/config/email',
      features: ['SMTP configuration', 'Email templates', 'Notification settings', 'Auto-replies']
    },
    {
      id: 'webhooks',
      name: 'Webhooks',
      description: 'Send ticket data to external services using HTTP webhooks.',
      icon: <WebhookIcon size={32} className="h-8 w-8" />,
      status: 'coming-soon',
      path: '#',
      features: ['Custom HTTP endpoints', 'Event filtering', 'Retry mechanisms', 'Security headers']
    }
  ];

  const handleIntegrationClick = (integration: any) => {
    if (integration.id === 'telegram') {
      setShowTelegramModal(true);
    } else if (integration.status === 'available' && integration.path && integration.path !== '#') {
      navigate(integration.path);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)]">
          Available Integrations
        </h2>
        <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
          Connect SafariDesk with your favorite tools and services to streamline your workflow
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} onClick={() => handleIntegrationClick(integration)} />
        ))}
      </div>

      <TelegramIntegrationModal isOpen={showTelegramModal} onClose={() => setShowTelegramModal(false)} />
    </div>
  );
};

const IntegrationCard: React.FC<{ integration: any; onClick: () => void }> = ({ integration, onClick }) => {
  const handleCardClick = () => {
    if (integration.status === 'available' && (integration.path !== '#' || integration.useModal)) {
      onClick();
    }
  };

  return (
    <div
      className={`surface-card p-6 transition-all duration-200 ${
        integration.status === 'available'
          ? 'cursor-pointer hover:border-[var(--text-muted)] hover:shadow-[var(--shell-shadow-md)]'
          : 'opacity-75'
      }`}
      onClick={handleCardClick}
    >
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          {integration.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-[length:var(--font-section-title)] font-medium text-[var(--text-primary)]">
              {integration.name}
            </h3>
            {integration.status === 'coming-soon' && (
              <span
                className="px-2 py-1 text-[length:var(--font-meta)] font-medium rounded-full"
                style={{ backgroundColor: 'var(--status-neutral-bg)', color: 'var(--status-neutral-text)' }}
              >
                Coming Soon
              </span>
            )}
          </div>
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)] mt-1">
            {integration.description}
          </p>

          <ul className="mt-4 space-y-1">
            {integration.features.map((feature: string, index: number) => (
              <li key={index} className="text-[length:var(--font-meta)] text-[var(--text-muted)] flex items-center">
                <div className="w-1 h-1 bg-[var(--text-muted)] rounded-full mr-2" />
                {feature}
              </li>
            ))}
          </ul>

          {integration.status === 'available' && (integration.path !== '#' || integration.useModal) && (
            <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
              <span className="text-[length:var(--font-label)] font-medium text-primary-600 hover:text-primary-700">
                Configure →
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;
