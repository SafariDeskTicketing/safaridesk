import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, MessageSquare, Phone, Smartphone, Bell, Edit3, ChevronDown, ChevronUp, RefreshCcw, UserCheck, AtSign, MessagesSquare, AlertCircle, CheckCircle2, Power, Loader2, Send } from 'lucide-react';
import Button from '../../components/ui/Button';
import { successNotification, errorNotification } from '../../components/ui/Toast';
import http from '../../services/http';
import IntegrationSetupScaffold, { SetupWizardStep } from './shared/IntegrationSetupScaffold';

const SafariSmsLogo: React.FC<{ size?: number; className?: string }> = ({ size = 40, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect fill="#0F766E" width="256" height="256" rx="40" />
    <g fill="#FFF">
      <path d="M128 45c-45.8 0-83 32.6-83 72.8 0 23.5 13 44.5 33.2 58.3l-8.2 30.9 35.3-18.3c7.2 1.9 14.8 2.9 22.7 2.9 45.8 0 83-32.6 83-72.8S173.8 45 128 45z" />
      <circle fill="#0F766E" cx="98" cy="118" r="12" />
      <circle fill="#0F766E" cx="128" cy="118" r="12" />
      <circle fill="#0F766E" cx="158" cy="118" r="12" />
    </g>
  </svg>
);

const defaultTemplates = {
  status_update: 'Ticket #{{ticket_id}} status changed to {{new_status}}. View at: {{ticket_url}}',
  ticket_assigned: 'You have been assigned ticket #{{ticket_id}}: {{ticket_title}}. View at: {{ticket_url}}',
  mention: 'You were mentioned in ticket #{{ticket_id}} by {{mentioned_by}}. View at: {{ticket_url}}',
  comment_added: 'New comment on ticket #{{ticket_id}} by {{commenter_name}}. View at: {{ticket_url}}',
  sla_breach: '⚠️ SLA breach alert! Ticket #{{ticket_id}} has exceeded the response time. Immediate action required.',
  ticket_resolved: 'Ticket #{{ticket_id}} has been resolved. Thank you for contacting support!'
};

type NotificationKey = keyof typeof defaultTemplates;

interface NotificationSetting {
  key: NotificationKey;
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  template: string;
}

export const SafariSmsSetupPage: React.FC = () => {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [expandedTemplate, setExpandedTemplate] = useState<NotificationKey | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const [notifications, setNotifications] = useState<NotificationSetting[]>([
    { key: 'status_update', label: 'Status Update', description: 'When ticket status changes', icon: <RefreshCcw className="w-5 h-5 text-[var(--status-info-text)]" />, enabled: true, template: defaultTemplates.status_update },
    { key: 'ticket_assigned', label: 'Ticket Assigned', description: 'Notify the agent when a ticket is assigned to them', icon: <UserCheck className="w-5 h-5 text-[var(--status-neutral-text)]" />, enabled: true, template: defaultTemplates.ticket_assigned },
    { key: 'mention', label: 'Mention', description: 'When someone is mentioned in a ticket', icon: <AtSign className="w-5 h-5 text-[var(--status-warning-text)]" />, enabled: true, template: defaultTemplates.mention },
    { key: 'comment_added', label: 'New Comment', description: 'When a new comment is added', icon: <MessagesSquare className="w-5 h-5 text-[var(--status-info-text)]" />, enabled: false, template: defaultTemplates.comment_added },
    { key: 'sla_breach', label: 'SLA Breach Warning', description: 'When SLA is about to breach or breached', icon: <AlertCircle className="w-5 h-5 text-[var(--status-warning-text)]" />, enabled: true, template: defaultTemplates.sla_breach },
    { key: 'ticket_resolved', label: 'Ticket Resolved', description: 'When a ticket is marked as resolved', icon: <CheckCircle2 className="w-5 h-5 text-[var(--status-success-text)]" />, enabled: true, template: defaultTemplates.ticket_resolved }
  ]);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const statusRes = await http.get('/integrations/safari-sms/status/');
      setIsActivated(statusRes.data.is_activated);

      const configRes = await http.get('/integrations/safari-sms/config/');
      const config = configRes.data;

      setSmsEnabled(config.sms_enabled);
      setWhatsappEnabled(config.whatsapp_enabled);

      setNotifications(prev => prev.map(n => ({
        ...n,
        enabled: config[`notify_${n.key}`] ?? n.enabled,
        template: config[`template_${n.key}`] || n.template,
      })));

      if (statusRes.data.is_activated) {
        setCurrentStep(1);
      }
    } catch (error) {
      console.error('Error loading Safari SMS config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async () => {
    try {
      setIsSaving(true);
      await http.post('/integrations/safari-sms/activate/', { is_activated: true });
      setIsActivated(true);
      setCurrentStep(1);
      successNotification('Safari SMS activated successfully!');
    } catch (error) {
      console.error('Error activating Safari SMS:', error);
      errorNotification('Failed to activate Safari SMS');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      setIsSaving(true);
      await http.post('/integrations/safari-sms/activate/', { is_activated: false });
      setIsActivated(false);
      setCurrentStep(0);
      successNotification('Safari SMS deactivated');
    } catch (error) {
      console.error('Error deactivating Safari SMS:', error);
      errorNotification('Failed to deactivate Safari SMS');
    } finally {
      setIsSaving(false);
    }
  };

  const saveConfig = async () => {
    try {
      setIsSaving(true);
      const configData: Record<string, string | boolean> = {
        sms_enabled: smsEnabled,
        whatsapp_enabled: whatsappEnabled,
      };

      notifications.forEach(n => {
        configData[`notify_${n.key}`] = n.enabled;
        configData[`template_${n.key}`] = n.template;
      });

      await http.put('/integrations/safari-sms/config/', configData);
      successNotification('Configuration saved successfully!');
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      errorNotification('Failed to save configuration');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestMessage = async (channel: 'sms' | 'whatsapp') => {
    if (!testPhone) {
      errorNotification('Please enter a phone number');
      return;
    }

    try {
      setIsTesting(true);
      const response = await http.post('/integrations/safari-sms/test/', { to: testPhone, channel });

      if (channel === 'whatsapp' && response.data.note) {
        successNotification(`Test WhatsApp queued! Note: ${response.data.note}`);
      } else {
        successNotification(`Test ${channel.toUpperCase()} sent successfully!`);
      }
    } catch (error: unknown) {
      console.error('Error sending test message:', error);
      const errorMessage = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send test message';
      errorNotification(errorMessage);
    } finally {
      setIsTesting(false);
    }
  };

  const hasAnyChannelEnabled = smsEnabled || whatsappEnabled;
  const hasAnyNotificationEnabled = notifications.some(n => n.enabled);

  const handleToggleNotification = (key: NotificationKey) => {
    setNotifications(prev => prev.map(n =>
      n.key === key ? { ...n, enabled: !n.enabled } : n
    ));
  };

  const handleUpdateTemplate = (key: NotificationKey, template: string) => {
    setNotifications(prev => prev.map(n =>
      n.key === key ? { ...n, template } : n
    ));
  };

  const handleResetTemplate = (key: NotificationKey) => {
    setNotifications(prev => prev.map(n =>
      n.key === key ? { ...n, template: defaultTemplates[key] } : n
    ));
  };

  const handleComplete = async () => {
    const saved = await saveConfig();
    if (saved) {
      const channels = [];
      if (smsEnabled) channels.push('SMS');
      if (whatsappEnabled) channels.push('WhatsApp');
      successNotification(`Safari SMS configured with ${channels.join(' and ')}!`);
      navigate('/config/integrations');
    }
  };

  const setupSteps: SetupWizardStep[] = [
    {
      id: 'activation',
      title: 'Activation',
      description: 'Enable Safari SMS',
      status: currentStep === 0 ? 'current' : (isActivated ? 'completed' : 'upcoming'),
      marker: <Power className="h-3.5 w-3.5" />,
      completedMarker: <Check className="h-3.5 w-3.5" />,
    },
    {
      id: 'channels',
      title: 'Choose Channels',
      description: 'Select SMS and/or WhatsApp',
      status: currentStep === 1 ? 'current' : (currentStep > 1 ? 'completed' : 'upcoming'),
      marker: '1',
    },
    {
      id: 'notifications',
      title: 'Notification Settings',
      description: 'Configure events and templates',
      status: currentStep === 2 ? 'current' : (currentStep > 2 ? 'completed' : 'upcoming'),
      marker: '2',
    },
    {
      id: 'confirmation',
      title: 'Confirmation',
      description: 'Review and activate',
      status: currentStep === 3 ? 'current' : 'upcoming',
      marker: '3',
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)]">Loading Safari SMS configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <IntegrationSetupScaffold
      title="Safari SMS"
      subtitle="SMS and WhatsApp notifications"
      logo={<SafariSmsLogo size={28} />}
      steps={setupSteps}
      onBack={() => navigate('/config/integrations')}
      sidebarFooter={isActivated ? (
        <button
          onClick={handleDeactivate}
          disabled={isSaving}
          className="w-full rounded-[var(--shell-radius)] px-4 py-2 text-[length:var(--font-body)] text-[var(--status-danger-text)] transition-colors hover:bg-[var(--status-danger-bg)]"
        >
          <span className="inline-flex items-center gap-2">
            <Power className="h-4 w-4" />
            Deactivate Safari SMS
          </span>
        </button>
      ) : null}
      footer={(
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              if (currentStep === 0 || currentStep === 1) {
                navigate('/config/integrations');
              } else {
                setCurrentStep(currentStep - 1);
              }
            }}
          >
            {currentStep === 0 ? 'Cancel' : currentStep === 1 ? 'Back to Integrations' : 'Back'}
          </Button>

          <div className="flex items-center justify-end gap-2">
            {currentStep === 0 && (
              <Button onClick={handleActivate} disabled={isSaving}>
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Activating...</>
                ) : (
                  <><Power className="w-4 h-4 mr-2" />Activate Safari SMS</>
                )}
              </Button>
            )}

            {currentStep === 1 && (
              <Button onClick={() => setCurrentStep(2)} disabled={!hasAnyChannelEnabled}>
                Continue <Smartphone className="w-4 h-4 ml-2" />
              </Button>
            )}

            {currentStep === 2 && (
              <Button onClick={() => setCurrentStep(3)} disabled={!hasAnyNotificationEnabled}>
                Continue <Bell className="w-4 h-4 ml-2" />
              </Button>
            )}

            {currentStep === 3 && (
              <Button onClick={handleComplete} disabled={isSaving}>
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <>Save Configuration <Check className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    >
      {/* Step 0: Activation */}
      {currentStep === 0 && (
        <div className="max-w-xl mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-[var(--surface-subtle)] flex items-center justify-center mx-auto mb-6">
            <SafariSmsLogo size={48} />
          </div>

          <h1 className="text-[length:var(--font-page-title)] font-bold text-[var(--text-primary)] mb-2">
            Activate Safari SMS
          </h1>
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)] mb-8">
            Send automated SMS and WhatsApp notifications to your customers and team when ticket events occur.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 text-left">
            {[
              { Icon: Phone, color: 'text-[var(--status-info-text)]', title: 'SMS Notifications', desc: 'Reach customers on any phone' },
              { Icon: MessageSquare, color: 'text-[var(--status-success-text)]', title: 'WhatsApp Messages', desc: 'Rich media and read receipts' },
              { Icon: Bell, color: 'text-[var(--status-neutral-text)]', title: 'Automated Triggers', desc: 'Notify on ticket events' },
              { Icon: Edit3, color: 'text-[var(--status-warning-text)]', title: 'Custom Templates', desc: 'Personalize your messages' },
            ].map(({ Icon, color, title, desc }) => (
              <div key={title} className="p-4 bg-[var(--surface-muted)] rounded-[var(--shell-radius)]">
                <Icon className={`w-6 h-6 mb-2 ${color}`} />
                <h3 className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">{title}</h3>
                <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">{desc}</p>
              </div>
            ))}
          </div>

          <Button onClick={handleActivate} disabled={isSaving} className="w-full">
            {isSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Activating...</>
            ) : (
              <><Power className="w-4 h-4 mr-2" />Activate Safari SMS</>
            )}
          </Button>
        </div>
      )}

      {/* Step 1: Choose Channels */}
      {currentStep === 1 && (
        <div className="max-w-2xl">
          <h1 className="text-[length:var(--font-page-title)] font-bold text-[var(--text-primary)] mb-2">
            Choose Your Channels
          </h1>
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)] mb-8">
            Select one or both channels to send notifications to your customers and team.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SMS Card */}
            <button
              onClick={() => setSmsEnabled(!smsEnabled)}
              className={`relative p-6 rounded-[var(--shell-radius)] border-2 transition-all text-left ${
                smsEnabled
                  ? 'border-primary-500 bg-[var(--surface-subtle)]'
                  : 'border-[var(--border-color)] hover:border-[var(--text-muted)]'
              }`}
            >
              {smsEnabled && (
                <div className="absolute top-3 right-3 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className="w-12 h-12 rounded-[var(--shell-radius)] flex items-center justify-center mb-4"
                style={{ backgroundColor: 'var(--status-info-bg)' }}
              >
                <Phone className="w-6 h-6" style={{ color: 'var(--status-info-text)' }} />
              </div>
              <h3 className="text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)] mb-1">SMS</h3>
              <p className="text-[length:var(--font-label)] text-[var(--text-secondary)]">
                Send text message notifications directly to phone numbers
              </p>
              <ul className="mt-4 space-y-2 text-[length:var(--font-meta)] text-[var(--text-muted)]">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                  Wide device compatibility
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                  No internet required
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                  High delivery rates
                </li>
              </ul>
            </button>

            {/* WhatsApp Card */}
            <button
              onClick={() => setWhatsappEnabled(!whatsappEnabled)}
              className={`relative p-6 rounded-[var(--shell-radius)] border-2 transition-all text-left ${
                whatsappEnabled
                  ? 'border-primary-500 bg-[var(--surface-subtle)]'
                  : 'border-[var(--border-color)] hover:border-[var(--text-muted)]'
              }`}
            >
              {whatsappEnabled && (
                <div className="absolute top-3 right-3 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className="w-12 h-12 rounded-[var(--shell-radius)] flex items-center justify-center mb-4"
                style={{ backgroundColor: 'var(--status-success-bg)' }}
              >
                <MessageSquare className="w-6 h-6" style={{ color: 'var(--status-success-text)' }} />
              </div>
              <h3 className="text-[length:var(--font-section-title)] font-semibold text-[var(--text-primary)] mb-1">WhatsApp</h3>
              <p className="text-[length:var(--font-label)] text-[var(--text-secondary)]">
                Send rich notifications via WhatsApp Business API
              </p>
              <ul className="mt-4 space-y-2 text-[length:var(--font-meta)] text-[var(--text-muted)]">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                  Rich media support
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                  Read receipts
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                  Two-way messaging
                </li>
              </ul>
            </button>
          </div>

          {hasAnyChannelEnabled && (
            <div className="mt-6 p-4 bg-[var(--surface-muted)] rounded-[var(--shell-radius)]">
              <p className="text-[length:var(--font-label)] text-[var(--text-secondary)]">
                <span className="font-medium">Selected channels:</span>{' '}
                {[smsEnabled && 'SMS', whatsappEnabled && 'WhatsApp'].filter(Boolean).join(', ')}
              </p>
            </div>
          )}

          {!hasAnyChannelEnabled && (
            <p className="mt-6 text-[length:var(--font-label)] text-[var(--status-warning-text)] flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Please select at least one channel to continue
            </p>
          )}
        </div>
      )}

      {/* Step 2: Notification Settings */}
      {currentStep === 2 && (
        <div className="max-w-3xl">
          <h1 className="text-[length:var(--font-page-title)] font-bold text-[var(--text-primary)] mb-2">
            Notification Settings
          </h1>
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)] mb-6">
            Choose which events trigger notifications and customize the message templates.
          </p>

          <div className="flex items-center gap-2 mb-6">
            <span className="text-[length:var(--font-label)] text-[var(--text-muted)]">Active on:</span>
            {smsEnabled && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[length:var(--font-meta)] font-medium"
                style={{ backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)' }}
              >
                <Phone className="w-3 h-3" /> SMS
              </span>
            )}
            {whatsappEnabled && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[length:var(--font-meta)] font-medium"
                style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}
              >
                <MessageSquare className="w-3 h-3" /> WhatsApp
              </span>
            )}
          </div>

          {/* Available placeholders info */}
          <div
            className="mb-6 p-4 rounded-[var(--shell-radius)] border"
            style={{ backgroundColor: 'var(--status-info-bg)', borderColor: 'var(--status-info-border)' }}
          >
            <h4 className="text-[length:var(--font-label)] font-medium mb-2" style={{ color: 'var(--status-info-text)' }}>
              Available Placeholders
            </h4>
            <div className="flex flex-wrap gap-2">
              {['{{ticket_id}}', '{{ticket_title}}', '{{ticket_url}}', '{{customer_name}}', '{{agent_name}}', '{{new_status}}', '{{mentioned_by}}', '{{commenter_name}}'].map(placeholder => (
                <code
                  key={placeholder}
                  className="px-2 py-1 rounded text-[length:var(--font-meta)]"
                  style={{ backgroundColor: 'var(--status-info-border)', color: 'var(--status-info-text)' }}
                >
                  {placeholder}
                </code>
              ))}
            </div>
          </div>

          {/* Notification toggles and templates */}
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.key}
                className="border border-[var(--border-color)] rounded-[var(--shell-radius)] overflow-hidden"
              >
                {/* Toggle header */}
                <div className="flex items-center justify-between p-4 bg-[var(--card-bg)]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[var(--shell-radius)] bg-[var(--surface-muted)] flex items-center justify-center">
                      {notification.icon}
                    </div>
                    <div>
                      <h4 className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">{notification.label}</h4>
                      <p className="text-[length:var(--font-meta)] text-[var(--text-muted)]">{notification.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleNotification(notification.key)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        notification.enabled ? 'bg-primary-600' : 'bg-[var(--surface-muted)]'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          notification.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>

                    <button
                      onClick={() => setExpandedTemplate(expandedTemplate === notification.key ? null : notification.key)}
                      className="p-1.5 hover:bg-[var(--hover-bg)] rounded-[var(--shell-radius)] transition-colors"
                      title="Edit template"
                    >
                      {expandedTemplate === notification.key ? (
                        <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded template editor */}
                {expandedTemplate === notification.key && (
                  <div className="p-4 bg-[var(--surface-muted)] border-t border-[var(--border-color)]">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[length:var(--font-meta)] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5" />
                        Message Template
                      </label>
                      <button
                        onClick={() => handleResetTemplate(notification.key)}
                        className="text-[length:var(--font-meta)] text-primary-600 hover:text-primary-700"
                      >
                        Reset to default
                      </button>
                    </div>
                    <textarea
                      value={notification.template}
                      onChange={(e) => handleUpdateTemplate(notification.key, e.target.value)}
                      className="w-full px-3 py-2 text-[length:var(--font-label)] border border-[var(--border-color)] rounded-[var(--shell-radius)] bg-[var(--card-bg)] text-[var(--text-primary)] focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                      rows={3}
                      placeholder="Enter message template..."
                    />
                    <p className="mt-2 text-[length:var(--font-meta)] text-[var(--text-muted)]">
                      Use placeholders like {`{{ticket_id}}`} to insert dynamic content.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-[var(--surface-muted)] rounded-[var(--shell-radius)]">
            <p className="text-[length:var(--font-label)] text-[var(--text-secondary)]">
              <span className="font-medium">{notifications.filter(n => n.enabled).length}</span> notification events enabled
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Confirmation */}
      {currentStep === 3 && (
        <div className="max-w-xl">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: 'var(--status-success-bg)' }}
          >
            <Check className="w-8 h-8" style={{ color: 'var(--status-success-text)' }} />
          </div>

          <h1 className="text-[length:var(--font-page-title)] font-bold text-[var(--text-primary)] text-center mb-2">
            Ready to Activate
          </h1>
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)] text-center mb-8">
            Your Safari SMS integration is configured and ready to go.
          </p>

          <div className="bg-[var(--surface-muted)] rounded-[var(--shell-radius)] p-6 space-y-4">
            <h3 className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">Configuration Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[length:var(--font-label)] text-[var(--text-secondary)]">SMS Notifications</span>
                <span
                  className="text-[length:var(--font-label)] font-medium"
                  style={{ color: smsEnabled ? 'var(--status-success-text)' : 'var(--text-muted)' }}
                >
                  {smsEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[length:var(--font-label)] text-[var(--text-secondary)]">WhatsApp Notifications</span>
                <span
                  className="text-[length:var(--font-label)] font-medium"
                  style={{ color: whatsappEnabled ? 'var(--status-success-text)' : 'var(--text-muted)' }}
                >
                  {whatsappEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="border-t border-[var(--border-color)] pt-3">
                <h4 className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)] mb-2">Active Notifications</h4>
                <div className="flex flex-wrap gap-2">
                  {notifications.filter(n => n.enabled).map(n => (
                    <span
                      key={n.key}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[length:var(--font-meta)]"
                      style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}
                    >
                      {n.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Test Message Section */}
          <div
            className="mt-6 rounded-[var(--shell-radius)] p-4"
            style={{ backgroundColor: 'var(--status-info-bg)' }}
          >
            <h4 className="text-[length:var(--font-label)] font-medium mb-3" style={{ color: 'var(--status-info-text)' }}>
              Send a Test Message
            </h4>
            <div className="flex gap-2 mb-3">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+1234567890"
                className="flex-1 px-3 py-2 text-[length:var(--font-label)] border border-[var(--border-color)] rounded-[var(--shell-radius)] bg-[var(--card-bg)] text-[var(--text-primary)]"
              />
            </div>
            <div className="flex gap-2">
              {smsEnabled && (
                <Button variant="outline" size="sm" onClick={() => handleTestMessage('sms')} disabled={isTesting || !testPhone}>
                  {isTesting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                  Test SMS
                </Button>
              )}
              {whatsappEnabled && (
                <Button variant="outline" size="sm" onClick={() => handleTestMessage('whatsapp')} disabled={isTesting || !testPhone}>
                  {isTesting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                  Test WhatsApp
                </Button>
              )}
            </div>
            {whatsappEnabled && (
              <p className="mt-3 text-[length:var(--font-meta)]" style={{ color: 'var(--status-info-text)' }}>
                <strong>WhatsApp Note:</strong> To receive test messages, the recipient must first message your WhatsApp Business number.
                WhatsApp only allows freeform messages within a 24-hour window after the customer initiates contact.
              </p>
            )}
          </div>

          <div
            className="mt-6 rounded-[var(--shell-radius)] border p-4"
            style={{ backgroundColor: 'var(--status-warning-bg)', borderColor: 'var(--status-warning-border)' }}
          >
            <p className="text-[length:var(--font-label)]" style={{ color: 'var(--status-warning-text)' }}>
              <strong>Note:</strong> This feature is in preview. SMS and WhatsApp credits will be deducted from your account balance per message sent.
            </p>
          </div>
        </div>
      )}
    </IntegrationSetupScaffold>
  );
};

export default SafariSmsSetupPage;
