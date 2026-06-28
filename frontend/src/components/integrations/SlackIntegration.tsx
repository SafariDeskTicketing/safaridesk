import React, { useState, useEffect } from 'react';
import { MessageSquare, Check, Loader2, X, AlertTriangle } from 'lucide-react';
import { 
  getSlackOAuthUrl, 
  getSlackIntegration, 
  getSlackChannels,
  updateSlackConfiguration,
  sendSlackTestNotification,
  disconnectSlackIntegration,
  SlackIntegration, 
  SlackChannel 
} from '../../services/slackIntegration';

const SlackIntegrationComponent: React.FC = () => {
  const [step, setStep] = useState(1);
  const [integration, setIntegration] = useState<SlackIntegration | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [selectedChannelName, setSelectedChannelName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [notificationTypes, setNotificationTypes] = useState({
    notify_new_tickets: true,
    notify_assignments: true,
    notify_status_updates: true,
    notify_sla_breaches: true,
    notify_comments: true
  });

  useEffect(() => {
    checkExistingIntegration();
    
    // Check for OAuth callback parameters
    const urlParams = new URLSearchParams(window.location.search);
    const slackConnected = urlParams.get('slack_connected');
    const slackError = urlParams.get('slack_error');
    const teamName = urlParams.get('team_name');

    if (slackConnected === 'true') {
      setSuccess(`Successfully connected to Slack workspace${teamName ? `: ${teamName}` : ''}!`);
      setStep(2);
      checkExistingIntegration();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (slackError) {
      setError(`Failed to connect to Slack: ${slackError}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const checkExistingIntegration = async () => {
    try {
      const response = await getSlackIntegration();
      if (response.integration) {
        setIntegration(response.integration);
        setNotificationTypes({
          notify_new_tickets: response.integration.notify_new_tickets,
          notify_assignments: response.integration.notify_assignments,
          notify_status_updates: response.integration.notify_status_updates,
          notify_sla_breaches: response.integration.notify_sla_breaches,
          notify_comments: response.integration.notify_comments
        });
        if (response.integration.default_channel) {
          setSelectedChannel(response.integration.default_channel);
          setSelectedChannelName(response.integration.default_channel_name || '');
        }
        setStep(3); // Skip to configuration step
      }
    } catch (err) {
      console.error('Error checking integration:', err);
    }
  };

  const handleConnectSlack = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getSlackOAuthUrl();
      window.location.href = response.oauth_url;
    } catch (err) {
      setError('Failed to initiate Slack connection');
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getSlackChannels();
      setChannels(response.channels);
      setStep(2);
    } catch (err) {
      setError('Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  const handleChannelSelect = (channel: SlackChannel) => {
    setSelectedChannel(channel.id);
    setSelectedChannelName(channel.name);
  };

  const handleConfigurationUpdate = async () => {
    try {
      setLoading(true);
      setError('');
      
      const config = {
        default_channel: selectedChannel,
        default_channel_name: selectedChannelName,
        ...notificationTypes
      };

      await updateSlackConfiguration(config);
      setSuccess('Configuration updated successfully!');
      setStep(3);
    } catch (err) {
      setError('Failed to update configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await sendSlackTestNotification({ 
        channel_id: selectedChannel 
      });
      
      if (response.success) {
        setSuccess(response.message);
      } else {
        setError('Failed to send test notification');
      }
    } catch (err) {
      setError('Failed to send test notification');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Slack integration?')) {
      return;
    }

    try {
      setLoading(true);
      await disconnectSlackIntegration();
      setIntegration(null);
      setChannels([]);
      setSelectedChannel('');
      setSelectedChannelName('');
      setStep(1);
      setSuccess('Slack integration disconnected successfully');
    } catch (err) {
      setError('Failed to disconnect Slack integration');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = (stepNumber: number, completed: boolean, active: boolean) => {
    if (completed) {
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-green-500 text-white rounded-full">
          <Check size={12} />
        </div>
      );
    }
    
    if (active) {
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full">
          {stepNumber}
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center w-8 h-8 bg-gray-300 text-gray-600 rounded-full">
        {stepNumber}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <MessageSquare className="h-8 w-8 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Slack Integration
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Connect CoreDesk with your Slack workspace
              </p>
            </div>
          </div>
        </div>

        {/* Setup Steps */}
        <div className="p-6">
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Setup Steps
            </h3>
            
            <div className="flex items-center space-x-4">
              {/* Step 1 */}
              <div className="flex flex-col items-center">
                {renderStepIndicator(1, integration !== null, step === 1)}
                <span className={`mt-2 text-sm font-medium ${
                  integration !== null ? 'text-green-600' : step === 1 ? 'text-purple-600' : 'text-gray-400'
                }`}>
                  Connect to Slack
                </span>
                <span className="text-xs text-gray-500 mt-1">Authorize CoreDesk access</span>
              </div>
              
              <div className={`flex-1 h-1 ${integration !== null ? 'bg-green-500' : 'bg-gray-200'}`}></div>
              
              {/* Step 2 */}
              <div className="flex flex-col items-center">
                {renderStepIndicator(2, step > 2, step === 2)}
                <span className={`mt-2 text-sm font-medium ${
                  step > 2 ? 'text-green-600' : step === 2 ? 'text-purple-600' : 'text-gray-400'
                }`}>
                  Configure Channels
                </span>
                <span className="text-xs text-gray-500 mt-1">Set up notifications</span>
              </div>
              
              <div className={`flex-1 h-1 ${step > 2 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
              
              {/* Step 3 */}
              <div className="flex flex-col items-center">
                {renderStepIndicator(3, step > 3, step === 3)}
                <span className={`mt-2 text-sm font-medium ${
                  step > 3 ? 'text-green-600' : step === 3 ? 'text-purple-600' : 'text-gray-400'
                }`}>
                  Test & Complete
                </span>
                <span className="text-xs text-gray-500 mt-1">Verify setup works</span>
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
                <span className="text-red-800">{error}</span>
                <button 
                  onClick={() => setError('')}
                  className="ml-auto text-red-400 hover:text-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center">
                <Check className="h-5 w-5 text-green-400 mr-2" />
                <span className="text-green-800">{success}</span>
                <button 
                  onClick={() => setSuccess('')}
                  className="ml-auto text-green-400 hover:text-green-600"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step Content */}
          {step === 1 && !integration && (
            <div className="text-center py-8">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Connect to Slack
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Authorize CoreDesk to access your Slack workspace to receive notifications
              </p>
              <button
                onClick={handleConnectSlack}
                disabled={loading}
                className="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="animate-spin mr-2" />}
                <MessageSquare className="mr-2" />
                Connect to Slack
              </button>
            </div>
          )}

          {integration && step === 2 && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Configure Notifications
              </h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Channel Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Default Channel<span className="text-red-500 ml-1">*</span>
                  </label>
                  
                  {channels.length === 0 && (
                    <button
                      onClick={loadChannels}
                      disabled={loading}
                      className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 text-center"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin mx-auto mb-2" />
                      ) : (
                        'Load Channels'
                      )}
                      <p className="text-sm text-gray-500">
                        Click to load available channels
                      </p>
                    </button>
                  )}
                  
                  {channels.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {channels.map((channel) => (
                        <div
                          key={channel.id}
                          onClick={() => handleChannelSelect(channel)}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedChannel === channel.id
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                              : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                          }`}
                        >
                          <div className="flex items-center">
                            <span className="font-medium text-gray-900 dark:text-white">
                              #{channel.name}
                            </span>
                            {channel.is_private && (
                              <span className="ml-2 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                Private
                              </span>
                            )}
                            {selectedChannel === channel.id && (
                              <Check className="ml-auto text-purple-600" size={16} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Notification Types */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Notification Types
                  </label>
                  <div className="space-y-3">
                    {[
                      { key: 'notify_new_tickets', label: 'New Tickets', description: 'When new tickets are created' },
                      { key: 'notify_assignments', label: 'Assignments', description: 'When tickets are assigned or reassigned' },
                      { key: 'notify_status_updates', label: 'Status Updates', description: 'When ticket is resolved' },
                      { key: 'notify_sla_breaches', label: 'SLA Breaches', description: 'When SLA is breached' },
                      { key: 'notify_comments', label: 'Comments', description: 'When new comments are added' }
                    ].map((notificationType) => (
                      <div key={notificationType.key} className="flex items-center">
                        <input
                          type="checkbox"
                          id={notificationType.key}
                          checked={notificationTypes[notificationType.key as keyof typeof notificationTypes]}
                          onChange={(e) => setNotificationTypes(prev => ({ 
                            ...prev, 
                            [notificationType.key]: e.target.checked 
                          }))}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <label htmlFor={notificationType.key} className="ml-3">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {notificationType.label}
                          </span>
                          <p className="text-xs text-gray-500">
                            {notificationType.description}
                          </p>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfigurationUpdate}
                  disabled={!selectedChannel || loading}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 className="animate-spin mr-2 inline" />}
                  Next
                </button>
              </div>
            </div>
          )}

          {integration && step === 3 && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Test Your Configuration
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Send a test notification to verify everything is working correctly.
              </p>
              
              {/* Configuration Summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Configuration Summary
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Default Channel:</span>
                    <span className="font-mono text-purple-600">#{selectedChannelName || 'all-test'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Notifications Enabled:</span>
                    <span className="text-gray-900 dark:text-white">
                      {Object.values(notificationTypes).filter(Boolean).length} types
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Test Channel */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Test Channel
                </label>
                <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <span className="font-mono text-purple-600">#{selectedChannelName}</span>
                </div>
                <button
                  onClick={handleTestNotification}
                  disabled={loading}
                  className="mt-3 inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading && <Loader2 className="animate-spin mr-2" />}
                  📤 Test Message
                </button>
              </div>

              {/* Ready to Complete */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-200">
                      Ready to Complete!
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      Once you click "Complete Setup", your Slack integration will be active and ready to send notifications.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Back
                </button>
                <div className="space-x-3">
                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setSuccess('Slack integration is now active!')}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Complete Setup
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlackIntegrationComponent;