import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Send, Bot, MessageCircle, TicketPlus, Reply, AlertCircle } from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import {
  connectTelegramBot,
  getTelegramIntegration,
  updateTelegramConfiguration,
  disconnectTelegramIntegration,
  testTelegramConnection,
  sendTelegramTestMessage,
  TelegramIntegration
} from '../../services/telegramIntegration';
import { successNotification, errorNotification } from '../../components/ui/Toast';
import { TelegramLogo } from '../../components/icons/BrandLogos';
import IntegrationSetupScaffold, { SetupWizardStep } from './shared/IntegrationSetupScaffold';

export const TelegramSetupPage: React.FC = () => {
  const navigate = useNavigate();

  const [telegramIntegration, setTelegramIntegration] = useState<TelegramIntegration | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [botToken, setBotToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [config, setConfig] = useState({
    auto_create_tickets: true,
    default_priority: 'medium',
    welcome_message: 'Welcome! You can create a support ticket by sending a message here.',
    ticket_created_message: 'Your ticket #{{ticket_id}} has been created. We\'ll get back to you soon!',
    confirm_ticket_creation: true,
    send_resolution_updates: true,
    send_agent_replies: true,
    is_active: true
  });

  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);
      await loadTelegramIntegration();
      setInitialLoading(false);
    };
    loadInitialData();
  }, []);

  const loadTelegramIntegration = async () => {
    try {
      const response = await getTelegramIntegration();
      setTelegramIntegration(response.integration);
      if (response.integration) {
        setConfig({
          auto_create_tickets: response.integration.auto_create_tickets,
          default_priority: response.integration.default_priority,
          welcome_message: response.integration.welcome_message,
          ticket_created_message: response.integration.ticket_created_message,
          confirm_ticket_creation: response.integration.confirm_ticket_creation,
          send_resolution_updates: response.integration.send_resolution_updates,
          send_agent_replies: response.integration.send_agent_replies,
          is_active: response.integration.is_active
        });
        setCurrentStep(2);
      }
    } catch (error) {
      console.error('Error loading Telegram integration:', error);
    }
  };

  const handleConnect = async () => {
    if (!botToken.trim()) {
      errorNotification('Please enter your bot token');
      return;
    }

    try {
      setIsLoading(true);
      const response = await connectTelegramBot({ bot_token: botToken });
      setTelegramIntegration(response.integration);
      successNotification('Telegram bot connected successfully!');
      setCurrentStep(2);
    } catch (error: any) {
      console.error('Error connecting Telegram bot:', error);
      errorNotification(error?.response?.data?.error || 'Failed to connect Telegram bot');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      const connectionResult = await testTelegramConnection();
      if (!connectionResult.success) {
        errorNotification('Bot connection test failed');
        return;
      }

      const sendResult = await sendTelegramTestMessage();
      if (sendResult.success) {
        successNotification(sendResult.message || 'Test message sent! Check your Telegram.');
      } else {
        if (sendResult.bot_username) {
          errorNotification(`Please message @${sendResult.bot_username} on Telegram first, then try again.`);
        } else {
          errorNotification(sendResult.error || 'Failed to send test message');
        }
      }
    } catch (error: any) {
      console.error('Error testing connection:', error);
      const errorMsg = error?.response?.data?.error || 'Failed to send test message';
      if (errorMsg.includes('No registered chats') || errorMsg.includes('message your bot')) {
        errorNotification(`Please message the bot on Telegram first (send /start), then try again.`);
      } else {
        errorNotification(errorMsg);
      }
    } finally {
      setTestingConnection(false);
    }
  };

  const handleConfigChange = (key: keyof typeof config, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveConfig = async () => {
    try {
      setIsLoading(true);
      await updateTelegramConfiguration(config);
      setCurrentStep(3);
    } catch (error) {
      errorNotification('Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Telegram? This will stop all bot functionality.')) {
      return;
    }

    try {
      setIsLoading(true);
      await disconnectTelegramIntegration();
      successNotification('Telegram bot disconnected successfully');
      navigate('/config/integrations');
    } catch (error) {
      errorNotification('Failed to disconnect Telegram');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    successNotification('Telegram integration setup complete!');
    navigate('/config/integrations');
  };

  const setupSteps: SetupWizardStep[] = [
    {
      id: 'connect',
      title: 'Connect Bot',
      description: 'Enter your bot token',
      status: currentStep === 1 ? 'current' : (currentStep > 1 || telegramIntegration ? 'completed' : 'upcoming'),
      marker: '1',
    },
    {
      id: 'configure',
      title: 'Configure Settings',
      description: 'Set up bot behavior',
      status: currentStep === 2 ? 'current' : (currentStep > 2 ? 'completed' : 'upcoming'),
      marker: '2',
    },
    {
      id: 'test',
      title: 'Test and Complete',
      description: 'Verify bot works',
      status: currentStep === 3 ? 'current' : 'upcoming',
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
      title="Telegram Bot"
      subtitle="Connect your Telegram bot"
      logo={(
        <div className="rounded-full bg-[var(--surface-subtle)] p-2">
          <TelegramLogo size={24} />
        </div>
      )}
      steps={setupSteps}
      onBack={() => navigate('/config/integrations')}
      sidebarFooter={telegramIntegration ? (
        <Button
          variant="danger"
          size="sm"
          className="w-full"
          onClick={handleDisconnect}
          disabled={isLoading}
        >
          Disconnect Bot
        </Button>
      ) : null}
      footer={(
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="outline"
            onClick={() => {
              if (currentStep === 1) {
                navigate('/config/integrations');
              } else {
                setCurrentStep(currentStep - 1);
              }
            }}
          >
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>

          <div className="flex items-center justify-end gap-2">
            {currentStep === 2 && (
              <Button
                variant="primary"
                onClick={handleSaveConfig}
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save and Continue'}
              </Button>
            )}

            {currentStep === 3 && (
              <Button variant="primary" onClick={handleComplete}>
                Complete Setup
              </Button>
            )}
          </div>
        </div>
      )}
    >
      {/* Step 1: Connect Bot */}
      {currentStep === 1 && (
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--surface-subtle)] rounded-full mb-4">
              <Bot className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="text-[length:var(--font-page-title)] font-semibold text-[var(--text-primary)] mb-2">
              Connect Your Telegram Bot
            </h3>
            <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">
              Enter your bot token to connect SafariDesk with Telegram.
            </p>
          </div>

          {/* Instructions */}
          <div
            className="mb-6 p-4 rounded-[var(--shell-radius)] border"
            style={{ backgroundColor: 'var(--status-info-bg)', borderColor: 'var(--status-info-border)' }}
          >
            <h4
              className="text-[length:var(--font-label)] font-medium mb-2"
              style={{ color: 'var(--status-info-text)' }}
            >
              How to get your bot token:
            </h4>
            <ol
              className="text-[length:var(--font-label)] space-y-1 list-decimal list-inside"
              style={{ color: 'var(--status-info-text)' }}
            >
              <li>Open Telegram and search for @BotFather</li>
              <li>Send /newbot to create a new bot</li>
              <li>Follow the prompts to name your bot</li>
              <li>Copy the API token provided</li>
            </ol>
          </div>

          {/* Bot Token Input */}
          <div className="mb-6">
            <label className="block text-[length:var(--font-label)] font-medium text-[var(--text-primary)] mb-2">
              Bot Token
            </label>
            <Input
              type="text"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="Enter your bot token (e.g., 123456789:ABCdefGHIjklMNOpqrs...)"
              className="font-mono"
            />
            <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-muted)]">
              Your token looks like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={handleConnect}
            disabled={isLoading || !botToken.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect Bot'
            )}
          </Button>
        </div>
      )}

      {/* Step 2: Configure Settings */}
      {currentStep === 2 && telegramIntegration && (
        <div className="max-w-2xl">
          <h3 className="text-[length:var(--font-page-title)] font-semibold text-[var(--text-primary)] mb-2">
            Configure Bot Settings
          </h3>
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)] mb-8">
            Customize how your Telegram bot behaves and responds to users.
          </p>

          {/* Connected Info */}
          <div
            className="mb-6 p-4 rounded-[var(--shell-radius)] border"
            style={{ backgroundColor: 'var(--status-success-bg)', borderColor: 'var(--status-success-border)' }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--status-success-text)' }} />
              <span className="text-[length:var(--font-label)] font-medium" style={{ color: 'var(--status-success-text)' }}>
                Connected to @{telegramIntegration.bot_username} Workspace
              </span>
            </div>
          </div>

          {/* Ticket Settings */}
          <div className="mb-8">
            <h4 className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <TicketPlus className="w-4 h-4" />
              Ticket Creation
            </h4>
            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 bg-[var(--surface-muted)] rounded-[var(--shell-radius)] cursor-pointer hover:bg-[var(--hover-bg)]">
                <div>
                  <p className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">Auto-create tickets</p>
                  <p className="text-[length:var(--font-meta)] text-[var(--text-muted)]">Automatically create tickets from new conversations</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.auto_create_tickets}
                  onChange={(e) => handleConfigChange('auto_create_tickets', e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-[var(--border-color)] rounded focus:ring-primary-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[var(--surface-muted)] rounded-[var(--shell-radius)] cursor-pointer hover:bg-[var(--hover-bg)]">
                <div>
                  <p className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">Confirm ticket creation</p>
                  <p className="text-[length:var(--font-meta)] text-[var(--text-muted)]">Ask user to confirm before creating ticket</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.confirm_ticket_creation}
                  onChange={(e) => handleConfigChange('confirm_ticket_creation', e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-[var(--border-color)] rounded focus:ring-primary-500"
                />
              </label>

              <div>
                <label className="block text-[length:var(--font-label)] font-medium text-[var(--text-primary)] mb-2">
                  Default Priority
                </label>
                <Select
                  value={config.default_priority}
                  onChange={(value) => handleConfigChange('default_priority', value)}
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                    { value: 'urgent', label: 'Urgent' },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="mb-8">
            <h4 className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Reply className="w-4 h-4" />
              Notifications
            </h4>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-[var(--surface-muted)] rounded-[var(--shell-radius)] cursor-pointer hover:bg-[var(--hover-bg)]">
                <div>
                  <p className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">Send agent replies</p>
                  <p className="text-[length:var(--font-meta)] text-[var(--text-muted)]">Forward agent responses to users via Telegram</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.send_agent_replies}
                  onChange={(e) => handleConfigChange('send_agent_replies', e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-[var(--border-color)] rounded focus:ring-primary-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[var(--surface-muted)] rounded-[var(--shell-radius)] cursor-pointer hover:bg-[var(--hover-bg)]">
                <div>
                  <p className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">Send resolution updates</p>
                  <p className="text-[length:var(--font-meta)] text-[var(--text-muted)]">Notify when tickets are resolved</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.send_resolution_updates}
                  onChange={(e) => handleConfigChange('send_resolution_updates', e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-[var(--border-color)] rounded focus:ring-primary-500"
                />
              </label>
            </div>
          </div>

          {/* Message Templates */}
          <div className="mb-8">
            <h4 className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Message Templates
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-[length:var(--font-label)] font-medium text-[var(--text-primary)] mb-2">
                  Welcome Message
                </label>
                <textarea
                  value={config.welcome_message}
                  onChange={(e) => handleConfigChange('welcome_message', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-[var(--border-color)] rounded-[var(--shell-radius)] focus:outline-none focus:ring-2 focus:ring-primary-500 bg-[var(--card-bg)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-[length:var(--font-label)] font-medium text-[var(--text-primary)] mb-2">
                  Ticket Created Message
                </label>
                <textarea
                  value={config.ticket_created_message}
                  onChange={(e) => handleConfigChange('ticket_created_message', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-[var(--border-color)] rounded-[var(--shell-radius)] focus:outline-none focus:ring-2 focus:ring-primary-500 bg-[var(--card-bg)] text-[var(--text-primary)]"
                />
                <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-muted)]">
                  Available variables: {'{{ticket_id}}'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Test & Complete */}
      {currentStep === 3 && telegramIntegration && (
        <div className="max-w-2xl">
          <h3 className="text-[length:var(--font-page-title)] font-semibold text-[var(--text-primary)] mb-2">
            Test & Complete Setup
          </h3>
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)] mb-8">
            Verify your bot is working correctly before completing the setup.
          </p>

          {/* Configuration Summary */}
          <div className="mb-8 p-6 bg-[var(--surface-muted)] rounded-[var(--shell-radius)]">
            <h4 className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)] mb-4">Configuration Summary</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[length:var(--font-label)] text-[var(--text-secondary)]">Bot Username</span>
                <span className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">
                  @{telegramIntegration.bot_username}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[length:var(--font-label)] text-[var(--text-secondary)]">Auto-create Tickets</span>
                <span className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">
                  {config.auto_create_tickets ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[length:var(--font-label)] text-[var(--text-secondary)]">Default Priority</span>
                <span className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)] capitalize">
                  {config.default_priority}
                </span>
              </div>
              <div className="pt-3 border-t border-[var(--border-color)]">
                <span className="text-[length:var(--font-label)] text-[var(--text-secondary)]">Features enabled:</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {config.send_agent_replies && (
                    <span
                      className="px-2 py-1 text-[length:var(--font-meta)] rounded"
                      style={{ backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)' }}
                    >Agent Replies</span>
                  )}
                  {config.send_resolution_updates && (
                    <span
                      className="px-2 py-1 text-[length:var(--font-meta)] rounded"
                      style={{ backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)' }}
                    >Resolution Updates</span>
                  )}
                  {config.confirm_ticket_creation && (
                    <span
                      className="px-2 py-1 text-[length:var(--font-meta)] rounded"
                      style={{ backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)' }}
                    >Confirm Creation</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Test Connection */}
          <div
            className="mb-8 p-4 rounded-[var(--shell-radius)] border"
            style={{ backgroundColor: 'var(--status-info-bg)', borderColor: 'var(--status-info-border)' }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: 'var(--status-info-text)' }} />
              <div>
                <p className="text-[length:var(--font-label)] font-medium" style={{ color: 'var(--status-info-text)' }}>How to test your bot</p>
                <p className="text-[length:var(--font-label)] mt-1" style={{ color: 'var(--status-info-text)' }}>
                  1. Open Telegram and search for <strong>@{telegramIntegration.bot_username}</strong><br />
                  2. Send <code>/start</code> to begin a conversation<br />
                  3. Click the button below to receive a test notification
                </p>
              </div>
            </div>
          </div>

          {/* Test Button */}
          <div className="mb-8">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {testingConnection ? 'Sending...' : 'Send Test Message'}
            </Button>
            <p className="text-[length:var(--font-meta)] text-[var(--text-muted)] mt-2">
              You must message the bot first before it can send you notifications.
            </p>
          </div>
        </div>
      )}
    </IntegrationSetupScaffold>
  );
};

export default TelegramSetupPage;
