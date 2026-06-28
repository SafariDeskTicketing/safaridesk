import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Loader2, Send, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Button from '../ui/Button';
import { Input } from '../ui/Input';
import {
  connectTelegramBot,
  getTelegramIntegration,
  TelegramIntegration as TelegramIntegrationType,
  testTelegramConnection,
  updateTelegramConfiguration,
} from '../../services/telegramIntegration';

interface TelegramConfig {
  botToken: string;
  botUsername: string;
  autoCreateTickets: boolean;
  defaultPriority: string;
  welcomeMessage: string;
  confirmTicketCreation: boolean;
  notifyOnResolved: boolean;
  sendAgentReplies: boolean;
}

interface TelegramIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TelegramIntegrationModal: React.FC<TelegramIntegrationModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState<TelegramConfig>({
    botToken: '',
    botUsername: '',
    autoCreateTickets: true,
    defaultPriority: 'Normal',
    welcomeMessage: 'Hello! Welcome to SafariDesk. How can we assist?',
    confirmTicketCreation: true,
    notifyOnResolved: true,
    sendAgentReplies: true,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [existingIntegration, setExistingIntegration] = useState<TelegramIntegrationType | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadExistingIntegration = async () => {
      try {
        const { integration } = await getTelegramIntegration();
        if (!integration) return;

        setExistingIntegration(integration);
        setIsConnected(true);
        setWebhookUrl(integration.webhook_url);
        setConfig((prev) => ({
          ...prev,
          botUsername: integration.bot_username,
          autoCreateTickets: integration.auto_create_tickets,
          defaultPriority: integration.default_priority,
          welcomeMessage: integration.welcome_message,
          confirmTicketCreation: integration.confirm_ticket_creation,
          notifyOnResolved: integration.send_resolution_updates,
          sendAgentReplies: integration.send_agent_replies,
        }));
      } catch {
        // No existing integration is a valid empty state.
      }
    };

    void loadExistingIntegration();
  }, [isOpen]);

  const resetState = () => {
    setCurrentStep(1);
    setIsConnected(false);
    setCopied(false);
    setWebhookUrl('');
    setError('');
    setExistingIntegration(null);
    setConfig({
      botToken: '',
      botUsername: '',
      autoCreateTickets: true,
      defaultPriority: 'Normal',
      welcomeMessage: 'Hello! Welcome to SafariDesk. How can we assist?',
      confirmTicketCreation: true,
      notifyOnResolved: true,
      sendAgentReplies: true,
    });
  };

  const handleClose = () => {
    onClose();
    resetState();
  };

  const handleConnectBot = async () => {
    if (!config.botToken.trim()) return;

    setIsConnecting(true);
    setError('');

    try {
      const response = await connectTelegramBot({ bot_token: config.botToken });
      setExistingIntegration(response.integration);
      setIsConnected(true);
      setWebhookUrl(response.integration?.webhook_url || '');
      setConfig((prev) => ({ ...prev, botUsername: response.integration?.bot_username || '' }));
      toast.success('Telegram bot connected successfully');
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.response?.data?.detail || 'Failed to connect bot. Please check your token.';
      setError(message);
      toast.error(message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleVerifyConnection = async () => {
    setIsVerifying(true);
    try {
      const result = await testTelegramConnection();
      if (result.success) {
        toast.success('Connection verified successfully');
      } else {
        toast.error(result.message || 'Connection test failed');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to verify connection');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCompleteSetup = async () => {
    setIsSaving(true);
    try {
      await updateTelegramConfiguration({
        auto_create_tickets: config.autoCreateTickets,
        default_priority: config.defaultPriority,
        welcome_message: config.welcomeMessage,
        confirm_ticket_creation: config.confirmTicketCreation,
        send_resolution_updates: config.notifyOnResolved,
        send_agent_replies: config.sendAgentReplies,
        is_active: true,
      });
      toast.success('Telegram integration configured successfully');
      onSuccess?.();
      handleClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyWebhook = async () => {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const canProceed = currentStep === 1 ? isConnected : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-surface-elevated">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-subtle">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)]">Telegram Integration</h2>
            <p className="text-sm text-gray-500 dark:text-[var(--text-muted)]">Connect Telegram without losing your current integrations UI.</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-[var(--hover-bg)] dark:hover:text-[var(--text-primary)]"
            title="Close Telegram integration"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-gray-200 px-6 py-4 dark:border-subtle">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { id: 1, title: 'Connect Bot', description: 'Enter your bot token' },
              { id: 2, title: 'Configure Settings', description: 'Set ticket behavior' },
              { id: 3, title: 'Test & Complete', description: 'Verify and finish' },
            ].map((step) => (
              <div key={step.id} className={`rounded-xl border p-3 ${currentStep === step.id ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/20' : 'border-gray-200 dark:border-subtle'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${currentStep >= step.id ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                    {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)]">{step.title}</p>
                    <p className="text-xs text-gray-500 dark:text-[var(--text-muted)]">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          {currentStep === 1 && (
            <div className="mx-auto max-w-xl text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-950/20">
                <Send className="h-8 w-8 text-sky-500" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-[var(--text-primary)]">Connect Your Telegram Bot</h3>
              <p className="mb-6 text-gray-600 dark:text-[var(--text-muted)]">
                Create a bot with <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">@BotFather</a> and paste the bot token below.
              </p>

              <div className="text-left">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Bot Token from @BotFather</label>
                <Input
                  type="text"
                  placeholder="123456789:ABCdefGhIJKlmNOPQRsTUVwxyZ..."
                  value={config.botToken}
                  onChange={(e) => {
                    setConfig((prev) => ({ ...prev, botToken: e.target.value }));
                    setError('');
                  }}
                  fullWidth
                  disabled={isConnected}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-[var(--text-muted)]">Your token is securely stored and only used to connect to your bot.</p>
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-left dark:border-red-900 dark:bg-red-950/20">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <Button className="mt-6 bg-sky-500 px-8 text-white hover:bg-sky-600" onClick={handleConnectBot} disabled={!config.botToken.trim() || isConnecting || isConnected}>
                {isConnecting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting...</> : isConnected ? <><Check className="mr-2 h-4 w-4" />Connected as @{config.botUsername}</> : <><Send className="mr-2 h-4 w-4" />Connect Telegram Bot</>}
              </Button>

              <div className="mt-8 text-left">
                <h4 className="mb-3 font-medium text-gray-900 dark:text-[var(--text-primary)]">How to create a Telegram bot:</h4>
                <ol className="space-y-2 text-sm text-gray-600 dark:text-[var(--text-muted)]">
                  <li>1. Open Telegram and search for <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">@BotFather</a></li>
                  <li>2. Send <code className="rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-800">/newbot</code></li>
                  <li>3. Follow the prompts to name your bot</li>
                  <li>4. Copy the API token and paste it above</li>
                </ol>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="mx-auto max-w-2xl space-y-6">
              <div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-[var(--text-primary)]">Configure Ticket Settings</h3>
                <p className="text-gray-600 dark:text-[var(--text-muted)]">Set up how tickets are created from Telegram messages and how updates are sent back.</p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-[var(--text-primary)]">Auto-create Tickets</h4>
                    <p className="text-sm text-gray-500 dark:text-[var(--text-muted)]">Automatically create support tickets from new Telegram conversations.</p>
                  </div>
                  <input type="checkbox" checked={config.autoCreateTickets} onChange={(e) => setConfig((prev) => ({ ...prev, autoCreateTickets: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-sky-500 focus:ring-sky-500" aria-label="Auto-create tickets from Telegram conversations" title="Auto-create tickets from Telegram conversations" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Default Ticket Priority</label>
                <select value={config.defaultPriority} onChange={(e) => setConfig((prev) => ({ ...prev, defaultPriority: e.target.value }))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white" aria-label="Default Telegram ticket priority" title="Default Telegram ticket priority">
                  <option value="Low">Low</option>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Welcome Message</label>
                <textarea value={config.welcomeMessage} onChange={(e) => setConfig((prev) => ({ ...prev, welcomeMessage: e.target.value }))} rows={3} className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white" aria-label="Telegram welcome message" title="Telegram welcome message" />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={config.confirmTicketCreation} onChange={(e) => setConfig((prev) => ({ ...prev, confirmTicketCreation: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-sky-500 focus:ring-sky-500" />
                  Confirm ticket creation to the user
                </label>
                <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={config.notifyOnResolved} onChange={(e) => setConfig((prev) => ({ ...prev, notifyOnResolved: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-sky-500 focus:ring-sky-500" />
                  Notify user when ticket is resolved
                </label>
                <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={config.sendAgentReplies} onChange={(e) => setConfig((prev) => ({ ...prev, sendAgentReplies: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-sky-500 focus:ring-sky-500" />
                  Send agent replies back to Telegram
                </label>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="mx-auto max-w-2xl space-y-6">
              <div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-[var(--text-primary)]">Test & Complete Setup</h3>
                <p className="text-gray-600 dark:text-[var(--text-muted)]">Verify your Telegram integration and review the current configuration.</p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-subtle">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <p className="font-medium text-gray-900 dark:text-[var(--text-primary)]">Bot connected as @{config.botUsername || existingIntegration?.bot_username || 'telegram-bot'}</p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Webhook URL</label>
                  <div className="flex gap-2">
                    <Input type="text" value={webhookUrl} readOnly fullWidth />
                    <Button type="button" variant="outline" onClick={handleCopyWebhook}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-subtle">
                <h4 className="mb-3 font-medium text-gray-900 dark:text-[var(--text-primary)]">Configuration Summary</h4>
                <div className="grid gap-3 text-sm text-gray-600 dark:text-[var(--text-muted)] md:grid-cols-2">
                  <div>Auto-create tickets: <span className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{config.autoCreateTickets ? 'Enabled' : 'Disabled'}</span></div>
                  <div>Default priority: <span className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{config.defaultPriority}</span></div>
                  <div>Confirm creation: <span className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{config.confirmTicketCreation ? 'Enabled' : 'Disabled'}</span></div>
                  <div>Resolution updates: <span className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{config.notifyOnResolved ? 'Enabled' : 'Disabled'}</span></div>
                  <div>Send agent replies: <span className="font-medium text-gray-900 dark:text-[var(--text-primary)]">{config.sendAgentReplies ? 'Enabled' : 'Disabled'}</span></div>
                </div>
              </div>

              <div className="flex justify-start">
                <Button type="button" variant="outline" onClick={handleVerifyConnection} disabled={isVerifying}>
                  {isVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Testing...</> : 'Test Connection'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-subtle">
          <Button type="button" variant="outline" onClick={currentStep === 1 ? handleClose : () => setCurrentStep((prev) => prev - 1)}>
            {currentStep === 1 ? 'Cancel' : <><ArrowLeft className="mr-2 h-4 w-4" />Back</>}
          </Button>

          {currentStep < 3 ? (
            <Button type="button" variant="primary" onClick={() => setCurrentStep((prev) => prev + 1)} disabled={!canProceed}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" variant="primary" onClick={handleCompleteSetup} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Complete Setup'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
