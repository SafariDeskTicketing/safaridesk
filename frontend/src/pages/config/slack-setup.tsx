import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, CheckCircle2, Loader2, Send, ArrowLeft, Ticket, UserPlus, RefreshCcw, AlertTriangle, MessageSquare, Unplug } from 'lucide-react';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { slackService, SlackIntegration, SlackChannel } from '../../services/slackService';
import { successNotification, errorNotification } from '../../components/ui/Toast';
import { SlackLogo } from '../../components/icons/BrandLogos';
import IntegrationSetupScaffold, { SetupWizardStep } from './shared/IntegrationSetupScaffold';

export const SlackSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [slackIntegration, setSlackIntegration] = useState<SlackIntegration | null>(null);
  const [slackSetupStep, setSlackSetupStep] = useState(1);
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  
  const [notificationPrefs, setNotificationPrefs] = useState({
    notify_new_tickets: false,
    notify_assignments: false,
    notify_status_updates: false,
    notify_sla_breaches: false,
    notify_comments: false
  });

  // Handle OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const slackConnected = searchParams.get('slack_connected');
      const slackError = searchParams.get('slack_error');
      
      if (slackConnected === 'true') {
        successNotification('Slack integration connected successfully!');
        setSearchParams({});
        await loadSlackIntegration();
        setSlackSetupStep(2);
      } else if (slackError) {
        let errorMessage = 'Failed to connect Slack integration';
        switch (slackError) {
          case 'access_denied':
            errorMessage = 'Slack authorization was denied';
            break;
          case 'missing_state':
          case 'invalid_state':
            errorMessage = 'Invalid authorization state';
            break;
          case 'token_exchange_failed':
            errorMessage = 'Failed to exchange authorization code';
            break;
          default:
            errorMessage = `Slack integration error: ${slackError}`;
        }
        errorNotification(errorMessage);
        setSearchParams({});
      }
    };
    
    handleOAuthCallback();
  }, [searchParams, setSearchParams]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);
      await loadSlackIntegration();
      setInitialLoading(false);
    };
    loadInitialData();
  }, []);

  // Load channels when step 2 is reached
  useEffect(() => {
    if (slackSetupStep === 2 && slackIntegration) {
      loadSlackChannels();
    }
  }, [slackSetupStep, slackIntegration]);

  const loadSlackIntegration = async () => {
    try {
      const integration = await slackService.getIntegration();
      setSlackIntegration(integration);
      if (integration) {
        // Set notification preferences from existing integration
        setNotificationPrefs({
          notify_new_tickets: integration.notify_new_tickets || false,
          notify_assignments: integration.notify_assignments || false,
          notify_status_updates: integration.notify_status_updates || false,
          notify_sla_breaches: integration.notify_sla_breaches || false,
          notify_comments: integration.notify_comments || false
        });
        setSelectedChannel(integration.default_channel || '');
        // If already connected, start at step 2
        setSlackSetupStep(2);
      }
    } catch (error) {
      console.error('Error loading Slack integration:', error);
    }
  };

  const loadSlackChannels = async () => {
    try {
      setChannelsLoading(true);
      const channels = await slackService.getChannels();
      setSlackChannels(channels);
      if (slackIntegration?.default_channel) {
        setSelectedChannel(slackIntegration.default_channel);
      }
    } catch (error) {
      console.error('Error loading Slack channels:', error);
      errorNotification('Failed to load Slack channels. Please check your permissions.');
    } finally {
      setChannelsLoading(false);
    }
  };

  const handleSlackConnect = async () => {
    try {
      setIsLoading(true);
      const response = await slackService.getOAuthUrl();
      window.location.href = response.oauth_url;
    } catch (error) {
      console.error('Error initiating Slack OAuth:', error);
      errorNotification('Failed to initiate Slack connection');
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (!selectedChannel) {
      errorNotification('Please select a channel first');
      return;
    }
    
    try {
      setTestingNotification(true);
      const result = await slackService.sendTestNotification(selectedChannel);
      if (result.success) {
        successNotification('Test notification sent successfully!');
      } else {
        errorNotification('Failed to send test notification');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      errorNotification('Failed to send test notification');
    } finally {
      setTestingNotification(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Slack? This will stop all Slack notifications.')) {
      return;
    }
    
    try {
      setDisconnecting(true);
      await slackService.disconnectIntegration();
      successNotification('Slack integration disconnected successfully');
      setSlackIntegration(null);
      setSlackSetupStep(1);
      setSelectedChannel('');
      setSlackChannels([]);
      setNotificationPrefs({
        notify_new_tickets: false,
        notify_assignments: false,
        notify_status_updates: false,
        notify_sla_breaches: false,
        notify_comments: false
      });
    } catch (error) {
      console.error('Error disconnecting Slack:', error);
      errorNotification('Failed to disconnect Slack integration');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleNotificationPrefChange = (prefKey: keyof typeof notificationPrefs, value: boolean) => {
    setNotificationPrefs(prev => ({
      ...prev,
      [prefKey]: value
    }));
  };

  const handleSaveAndNext = async () => {
    if (!selectedChannel) {
      errorNotification('Please select a channel');
      return;
    }
    
    try {
      setIsLoading(true);
      const selectedChannelData = slackChannels.find(ch => ch.id === selectedChannel);
      await slackService.updateIntegration({
        default_channel: selectedChannel,
        default_channel_name: selectedChannelData?.name || '',
        ...notificationPrefs
      });
      setSlackSetupStep(3);
    } catch (error) {
      errorNotification('Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    successNotification('Slack integration setup complete!');
    navigate('/config/integrations');
  };

  const setupSteps: SetupWizardStep[] = [
    {
      id: 'connect',
      title: 'Connect to Slack',
      description: 'Authorize SafariDesk access',
      status: slackSetupStep === 1 ? 'current' : (slackSetupStep > 1 || slackIntegration ? 'completed' : 'upcoming'),
      marker: '1',
    },
    {
      id: 'configure',
      title: 'Configure Notifications',
      description: 'Select channel and events',
      status: slackSetupStep === 2 ? 'current' : (slackSetupStep > 2 ? 'completed' : 'upcoming'),
      marker: '2',
    },
    {
      id: 'test',
      title: 'Test and Complete',
      description: 'Verify setup works',
      status: slackSetupStep === 3 ? 'current' : 'upcoming',
      marker: '3',
    },
  ];

  if (initialLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <IntegrationSetupScaffold
      title="Slack Integration"
      subtitle="Connect SafariDesk with your Slack workspace"
      logo={<SlackLogo size={28} />}
      steps={setupSteps}
      onBack={() => navigate('/config/integrations')}
      footer={(
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" onClick={() => navigate('/config/integrations')}>
            Cancel
          </Button>
          <div className="flex items-center justify-end gap-2">
            {slackSetupStep === 2 && (
              <Button
                variant="primary"
                onClick={handleSaveAndNext}
                disabled={!selectedChannel || isLoading}
              >
                {isLoading ? 'Saving...' : 'Next'}
              </Button>
            )}

            {slackSetupStep === 3 && (
              <Button variant="primary" onClick={handleComplete}>
                Complete Setup
              </Button>
            )}
          </div>
        </div>
      )}
      sidebarFooter={slackIntegration ? (
        <div className="mt-6 pt-6 border-t border-[var(--border-color)]">
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="w-full flex items-center gap-2 px-3 py-2 text-[length:var(--font-label)] text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] rounded-lg transition-colors disabled:opacity-50"
          >
            {disconnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Unplug className="w-4 h-4" />
            )}
            {disconnecting ? 'Disconnecting...' : 'Disconnect Slack'}
          </button>
        </div>
      ) : undefined}
    >
          {/* Step 1: Connect to Slack */}
          {slackSetupStep === 1 && (
            <div className="mx-auto flex min-h-[360px] max-w-lg flex-col items-center justify-center text-center">
              <SlackLogo size={64} className="mb-6" />
              <h3 className="mb-2 text-[length:var(--font-display-lg)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-title)' }}>
                Connect to Slack
              </h3>
              <p className="mb-8 text-[length:var(--font-body)] text-[var(--text-secondary)]">
                Authorize SafariDesk to send notifications to your Slack workspace. We'll need permission to post messages and read channel information.
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={handleSlackConnect}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <SlackLogo size={20} />
                {isLoading ? 'Connecting...' : 'Install Slack App'}
              </Button>
            </div>
          )}
          
          {/* Step 2: Configure Notifications */}
          {slackSetupStep === 2 && slackIntegration && (
            <div className="max-w-2xl">
              <h3 className="mb-2 text-[length:var(--font-display-lg)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-title)' }}>
                Configure Notifications
              </h3>
              <p className="mb-8 text-[length:var(--font-body)] text-[var(--text-secondary)]">
                Select which events should trigger notifications and choose the Slack channel to receive them.
              </p>
              
              {/* Connected Info */}
              <div className="mb-6 rounded-[var(--shell-radius)] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[var(--status-success-text)]" />
                  <span className="text-[length:var(--font-label)] text-[var(--status-success-text)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                    Connected to {slackIntegration.team_name} Workspace
                  </span>
                </div>
              </div>
              
              {/* Notification Types */}
              <div className="mb-8">
                <h4 className="mb-3 text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                  Notification Types
                </h4>
                <div className="space-y-2">
                  {[
                    { key: 'notify_new_tickets', label: 'New tickets', icon: <Ticket className="w-5 h-5 text-primary-600" />, description: 'When new support tickets are created' },
                    { key: 'notify_assignments', label: 'Ticket assignments', icon: <UserPlus className="w-5 h-5 text-purple-600" />, description: 'When tickets are assigned to agents' },
                    { key: 'notify_status_updates', label: 'Status updates', icon: <RefreshCcw className="w-5 h-5 text-blue-600" />, description: 'When ticket status changes' },
                    { key: 'notify_sla_breaches', label: 'SLA breaches', icon: <AlertTriangle className="w-5 h-5 text-amber-600" />, description: 'When SLA deadlines are missed' },
                    { key: 'notify_comments', label: 'Comments', icon: <MessageSquare className="w-5 h-5 text-cyan-600" />, description: 'When new comments are added' }
                  ].map((item) => (
                    <label key={item.key} className="flex cursor-pointer items-center gap-3 rounded-[var(--shell-radius)] bg-[var(--surface-subtle)] p-3 hover:bg-[var(--surface-muted)]">
                      <input
                        type="checkbox"
                        checked={notificationPrefs[item.key as keyof typeof notificationPrefs]}
                        onChange={(e) => handleNotificationPrefChange(item.key as keyof typeof notificationPrefs, e.target.checked)}
                        className="w-4 h-4 text-primary-600 border-[var(--border-color)] rounded focus:ring-primary-500"
                      />
                      {item.icon}
                      <div className="flex-1">
                        <span className="text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>{item.label}</span>
                        <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">{item.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Channel Selection */}
              <div>
                <label className="mb-2 block text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                  Default Channel
                </label>
                {channelsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
                    <span className="ml-2 text-[length:var(--font-label)] text-[var(--text-muted)]">Loading channels...</span>
                  </div>
                ) : (
                  <Select
                    value={selectedChannel}
                    onChange={setSelectedChannel}
                    options={slackChannels.map((channel) => ({
                      value: channel.id,
                      label: `#${channel.name} ${channel.is_private ? '(Private)' : ''}`,
                    }))}
                    placeholder="Select a channel..."
                    allowSearch
                  />
                )}
                <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                  Choose where notification messages will be sent
                </p>
              </div>
            </div>
          )}
          
          {/* Step 3: Test & Complete */}
          {slackSetupStep === 3 && slackIntegration && (
            <div className="mx-auto flex min-h-[360px] max-w-lg flex-col items-center justify-center text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--status-success-bg)]">
                <CheckCircle2 className="w-10 h-10 text-[var(--status-success-text)]" />
              </div>
              <h3 className="mb-2 text-[length:var(--font-display-lg)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-title)' }}>
                Almost Done!
              </h3>
              <p className="mb-8 text-[length:var(--font-body)] text-[var(--text-secondary)]">
                Your Slack integration is configured. Send a test message to verify everything is working correctly.
              </p>
              
              <div className="w-full max-w-xs space-y-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleTestNotification}
                  disabled={testingNotification || !selectedChannel}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {testingNotification ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Test Message
                    </>
                  )}
                </Button>
                
                <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                  A test notification will be sent to #{slackChannels.find(c => c.id === selectedChannel)?.name || 'selected channel'}
                </p>
              </div>
            </div>
          )}
    </IntegrationSetupScaffold>
  );
};

export default SlackSetupPage;
