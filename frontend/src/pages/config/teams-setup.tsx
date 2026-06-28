import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Send, Bell, MessageSquare, UserPlus, AlertTriangle, RefreshCcw } from 'lucide-react';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import {
  getTeamsOAuthUrl,
  getTeamsIntegration,
  disconnectTeamsIntegration,
  updateTeamsConfiguration,
  getTeamsList,
  getTeamsChannels,
  sendTeamsTestNotification,
  TeamsIntegration,
  TeamsTeam,
  TeamsChannel
} from '../../services/teamsIntegration';
import { successNotification, errorNotification } from '../../components/ui/Toast';
import { MicrosoftTeamsLogo } from '../../components/icons/BrandLogos';
import IntegrationSetupScaffold, { SetupWizardStep } from './shared/IntegrationSetupScaffold';

export const TeamsSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [teamsIntegration, setTeamsIntegration] = useState<TeamsIntegration | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [teams, setTeams] = useState<TeamsTeam[]>([]);
  const [channels, setChannels] = useState<TeamsChannel[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [notificationPrefs, setNotificationPrefs] = useState({
    notify_new_tickets: true,
    notify_assignments: true,
    notify_status_updates: true,
    notify_sla_breaches: true,
    notify_comments: false
  });

  useEffect(() => {
    const handleOAuthCallback = async () => {
      const teamsConnected = searchParams.get('teams_connected');
      const teamsError = searchParams.get('teams_error');
      const userName = searchParams.get('user_name');

      if (teamsConnected === 'true') {
        successNotification(`Microsoft Teams connected${userName ? ` as ${userName}` : ''}!`);
        setSearchParams({});
        await loadTeamsIntegration();
        setCurrentStep(2);
      } else if (teamsError) {
        let errorMessage = 'Failed to connect Microsoft Teams';
        switch (teamsError) {
          case 'access_denied':
            errorMessage = 'Microsoft Teams authorization was denied';
            break;
          case 'missing_state':
          case 'invalid_state':
            errorMessage = 'Invalid authorization state';
            break;
          case 'token_exchange_failed':
            errorMessage = 'Failed to exchange authorization code';
            break;
          default:
            errorMessage = `Teams integration error: ${teamsError}`;
        }
        errorNotification(errorMessage);
        setSearchParams({});
      }
    };

    handleOAuthCallback();
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);
      await loadTeamsIntegration();
      setInitialLoading(false);
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (currentStep === 2 && teamsIntegration) {
      loadTeams();
    }
  }, [currentStep, teamsIntegration]);

  const loadTeamsIntegration = async () => {
    try {
      const response = await getTeamsIntegration();
      setTeamsIntegration(response.integration);
      if (response.integration) {
        setNotificationPrefs({
          notify_new_tickets: response.integration.notify_new_tickets || false,
          notify_assignments: response.integration.notify_assignments || false,
          notify_status_updates: response.integration.notify_status_updates || false,
          notify_sla_breaches: response.integration.notify_sla_breaches || false,
          notify_comments: response.integration.notify_comments || false
        });
        setSelectedTeam(response.integration.team_id || '');
        setSelectedChannel(response.integration.default_channel_id || '');
        setCurrentStep(2);
      }
    } catch (error) {
      console.error('Error loading Teams integration:', error);
    }
  };

  const loadTeams = async () => {
    try {
      setTeamsLoading(true);
      const response = await getTeamsList();
      setTeams(response.teams || []);
      if (teamsIntegration?.team_id) {
        setSelectedTeam(teamsIntegration.team_id);
        await loadChannels(teamsIntegration.team_id);
      }
    } catch (error) {
      console.error('Error loading Teams:', error);
      errorNotification('Failed to load Teams. Please check your permissions.');
    } finally {
      setTeamsLoading(false);
    }
  };

  const loadChannels = async (teamId: string) => {
    if (!teamId) return;
    try {
      setChannelsLoading(true);
      const response = await getTeamsChannels(teamId);
      setChannels(response.channels || []);
      if (teamsIntegration?.default_channel_id) {
        setSelectedChannel(teamsIntegration.default_channel_id);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
      errorNotification('Failed to load channels.');
    } finally {
      setChannelsLoading(false);
    }
  };

  const handleTeamSelect = async (teamId: string) => {
    setSelectedTeam(teamId);
    setSelectedChannel('');
    setChannels([]);
    if (teamId) {
      await loadChannels(teamId);
    }
  };

  const handleTeamsConnect = async () => {
    try {
      setIsLoading(true);
      const response = await getTeamsOAuthUrl();
      window.location.href = response.oauth_url;
    } catch (error) {
      console.error('Error initiating Teams OAuth:', error);
      errorNotification('Failed to initiate Microsoft Teams connection');
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (!selectedTeam || !selectedChannel) {
      errorNotification('Please select a team and channel first');
      return;
    }

    try {
      setTestingNotification(true);
      const result = await sendTeamsTestNotification({
        team_id: selectedTeam,
        channel_id: selectedChannel
      });
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

  const handleNotificationPrefChange = (prefKey: keyof typeof notificationPrefs, value: boolean) => {
    setNotificationPrefs(prev => ({
      ...prev,
      [prefKey]: value
    }));
  };

  const handleSaveAndNext = async () => {
    if (!selectedTeam || !selectedChannel) {
      errorNotification('Please select a team and channel');
      return;
    }

    try {
      setIsLoading(true);
      const selectedTeamData = teams.find(t => t.id === selectedTeam);
      const selectedChannelData = channels.find(ch => ch.id === selectedChannel);

      await updateTeamsConfiguration({
        team_id: selectedTeam,
        team_name: selectedTeamData?.name || '',
        default_channel_id: selectedChannel,
        default_channel_name: selectedChannelData?.name || '',
        ...notificationPrefs
      });
      setCurrentStep(3);
    } catch (error) {
      errorNotification('Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Microsoft Teams? This will stop all notifications.')) {
      return;
    }

    try {
      setIsLoading(true);
      await disconnectTeamsIntegration();
      successNotification('Microsoft Teams disconnected successfully');
      navigate('/config/integrations');
    } catch (error) {
      errorNotification('Failed to disconnect Microsoft Teams');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    successNotification('Microsoft Teams integration setup complete!');
    navigate('/config/integrations');
  };

  const setupSteps: SetupWizardStep[] = [
    {
      id: 'connect',
      title: 'Connect to Teams',
      description: 'Authorize Microsoft access',
      status: currentStep === 1 ? 'current' : (currentStep > 1 || teamsIntegration ? 'completed' : 'upcoming'),
      marker: '1',
    },
    {
      id: 'configure',
      title: 'Configure Channel',
      description: 'Select team and channel',
      status: currentStep === 2 ? 'current' : (currentStep > 2 ? 'completed' : 'upcoming'),
      marker: '2',
    },
    {
      id: 'test',
      title: 'Test and Complete',
      description: 'Verify setup works',
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
      title="Microsoft Teams"
      subtitle="Connect SafariDesk with Teams"
      logo={<MicrosoftTeamsLogo size={28} />}
      steps={setupSteps}
      onBack={() => navigate('/config/integrations')}
      sidebarFooter={teamsIntegration ? (
        <Button
          variant="danger"
          size="sm"
          className="w-full"
          onClick={handleDisconnect}
          disabled={isLoading}
        >
          Disconnect Teams
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
                onClick={handleSaveAndNext}
                disabled={!selectedTeam || !selectedChannel || isLoading}
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
      {/* Step 1: Connect to Teams */}
      {currentStep === 1 && (
        <div className="mx-auto flex min-h-[360px] max-w-lg flex-col items-center justify-center text-center">
          <MicrosoftTeamsLogo size={64} className="mb-6" />
          <h3 className="mb-2 text-[length:var(--font-page-title)] font-semibold text-[var(--text-primary)]">
            Connect to Microsoft Teams
          </h3>
          <p className="mb-8 text-[length:var(--font-body)] text-[var(--text-secondary)]">
            Authorize SafariDesk to send notifications to your Microsoft Teams workspace. We'll need permission to post messages to channels.
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={handleTeamsConnect}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <MicrosoftTeamsLogo size={20} />
            {isLoading ? 'Connecting...' : 'Connect Microsoft Teams'}
          </Button>
        </div>
      )}

      {/* Step 2: Configure Channel */}
      {currentStep === 2 && teamsIntegration && (
        <div className="max-w-2xl">
          <h3 className="text-[length:var(--font-page-title)] font-semibold text-[var(--text-primary)] mb-2">
            Configure Channel & Notifications
          </h3>
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)] mb-8">
            Choose which Teams channel should receive notifications and select the types of events you want to be notified about.
          </p>

          {/* Connected Info */}
          <div
            className="mb-6 p-4 rounded-[var(--shell-radius)] border"
            style={{
              backgroundColor: 'var(--status-success-bg)',
              borderColor: 'var(--status-success-border)',
            }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--status-success-text)' }} />
              <span className="text-[length:var(--font-label)] font-medium" style={{ color: 'var(--status-success-text)' }}>
                Connected as {teamsIntegration.user_display_name || teamsIntegration.user_email}
              </span>
            </div>
          </div>

          {/* Team Selection */}
          <div className="mb-6">
            <label className="block text-[length:var(--font-label)] font-medium text-[var(--text-primary)] mb-2">
              Select Team
            </label>
            {teamsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
                <span className="ml-2 text-[length:var(--font-label)] text-[var(--text-muted)]">Loading teams...</span>
              </div>
            ) : (
              <Select
                value={selectedTeam}
                onChange={handleTeamSelect}
                options={teams.map((team) => ({
                  value: team.id,
                  label: team.name,
                }))}
                placeholder="Select a team..."
                allowSearch
              />
            )}
          </div>

          {/* Channel Selection */}
          {selectedTeam && (
            <div className="mb-8">
              <label className="block text-[length:var(--font-label)] font-medium text-[var(--text-primary)] mb-2">
                Select Channel
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
                  options={channels.map((channel) => ({
                    value: channel.id,
                    label: channel.name,
                  }))}
                  placeholder="Select a channel..."
                  allowSearch
                />
              )}
            </div>
          )}

          {/* Notification Preferences */}
          <div className="mb-8">
            <h4 className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)] mb-4">
              Notification Events
            </h4>
            <div className="space-y-3">
              {[
                { key: 'notify_new_tickets', label: 'New Tickets', description: 'When a new ticket is created', icon: <Bell className="w-4 h-4" /> },
                { key: 'notify_assignments', label: 'Ticket Assignments', description: 'When a ticket is assigned', icon: <UserPlus className="w-4 h-4" /> },
                { key: 'notify_status_updates', label: 'Status Updates', description: 'When ticket status changes', icon: <RefreshCcw className="w-4 h-4" /> },
                { key: 'notify_sla_breaches', label: 'SLA Breaches', description: 'When SLA is breached', icon: <AlertTriangle className="w-4 h-4" /> },
                { key: 'notify_comments', label: 'Comments', description: 'When comments are added', icon: <MessageSquare className="w-4 h-4" /> },
              ].map(({ key, label, description, icon }) => (
                <label
                  key={key}
                  className="flex items-center justify-between p-3 bg-[var(--surface-muted)] rounded-[var(--shell-radius)] cursor-pointer hover:bg-[var(--hover-bg)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-[var(--text-muted)]">{icon}</div>
                    <div>
                      <p className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">{label}</p>
                      <p className="text-[length:var(--font-meta)] text-[var(--text-muted)]">{description}</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPrefs[key as keyof typeof notificationPrefs]}
                    onChange={(e) => handleNotificationPrefChange(key as keyof typeof notificationPrefs, e.target.checked)}
                    className="w-4 h-4 text-primary-600 border-[var(--border-color)] rounded focus:ring-primary-500"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Test & Complete */}
      {currentStep === 3 && teamsIntegration && (
        <div className="max-w-2xl">
          <h3 className="text-[length:var(--font-page-title)] font-semibold text-[var(--text-primary)] mb-2">
            Test & Complete Setup
          </h3>
          <p className="text-[length:var(--font-body)] text-[var(--text-secondary)] mb-8">
            Send a test notification to verify everything is working correctly.
          </p>

          {/* Configuration Summary */}
          <div className="mb-8 p-6 bg-[var(--surface-muted)] rounded-[var(--shell-radius)]">
            <h4 className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)] mb-4">Configuration Summary</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[length:var(--font-label)] text-[var(--text-secondary)]">Team</span>
                <span className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">
                  {teams.find(t => t.id === selectedTeam)?.name || 'Not selected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[length:var(--font-label)] text-[var(--text-secondary)]">Channel</span>
                <span className="text-[length:var(--font-label)] font-medium text-[var(--text-primary)]">
                  {channels.find(c => c.id === selectedChannel)?.name || 'Not selected'}
                </span>
              </div>
              <div className="pt-3 border-t border-[var(--border-color)]">
                <span className="text-[length:var(--font-label)] text-[var(--text-secondary)]">Notifications enabled:</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {notificationPrefs.notify_new_tickets && (
                    <span
                      className="px-2 py-1 text-[length:var(--font-meta)] rounded"
                      style={{ backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)' }}
                    >New Tickets</span>
                  )}
                  {notificationPrefs.notify_assignments && (
                    <span
                      className="px-2 py-1 text-[length:var(--font-meta)] rounded"
                      style={{ backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)' }}
                    >Assignments</span>
                  )}
                  {notificationPrefs.notify_status_updates && (
                    <span
                      className="px-2 py-1 text-[length:var(--font-meta)] rounded"
                      style={{ backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)' }}
                    >Status Updates</span>
                  )}
                  {notificationPrefs.notify_sla_breaches && (
                    <span
                      className="px-2 py-1 text-[length:var(--font-meta)] rounded"
                      style={{ backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)' }}
                    >SLA Breaches</span>
                  )}
                  {notificationPrefs.notify_comments && (
                    <span
                      className="px-2 py-1 text-[length:var(--font-meta)] rounded"
                      style={{ backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info-text)' }}
                    >Comments</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Test Button */}
          <div className="mb-8">
            <Button
              variant="outline"
              onClick={handleTestNotification}
              disabled={testingNotification}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {testingNotification ? 'Sending...' : 'Send Test Notification'}
            </Button>
          </div>
        </div>
      )}
    </IntegrationSetupScaffold>
  );
};

export default TeamsSetupPage;
