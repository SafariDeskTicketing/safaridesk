import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Edit3,
  Save,
  X,
  User,
  Mail,
  Shield,
  Bell,
  BarChart3,
  Clock,
  CheckCircle,
  TrendingUp,
  Upload,
  Building2,
  Briefcase,
  Settings
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import { Card } from '../../components/ui/Card';
import ProfileScreenSkeleton from '../../components/ui/ProfileScreenSkeleton';
import { useAuthStore } from '../../stores/authStore';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { errorNotification, successNotification } from '../../components/ui/Toast';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPE_META,
  NotificationChannel,
  NotificationTypeKey,
  UserNotificationPreference,
  defaultNotificationChannels,
  defaultNotificationMatrix,
} from '../../types/notification';
import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from '../../services/notifications/settings';
import SecurityTab from './SecurityTab';
import { PageHeader } from '../../components/layout';

// Tab types
type TabType = 'profile' | 'security' | 'settings' | 'notifications';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ElementType;
}

const TABS: TabConfig[] = [
  { id: 'profile', label: 'Profile information', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  // { id: 'settings', label: 'Settings', icon: Settings },
  // Commented out - tabs without functionality
  // { id: 'theme', label: 'Theme', icon: Palette },
  // { id: 'background', label: 'Background Settings', icon: Image },
  // { id: 'tokens', label: 'Personal Access Tokens', icon: Key },
];

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange, label }) => (
  <label className="flex items-center justify-between cursor-pointer group">
    <span className="text-[length:var(--font-label)] text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
      {label}
    </span>
    <div className="relative">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <div className={`h-6 w-11 rounded-full transition-all duration-200 ${checked ? 'bg-primary-600' : 'bg-[var(--surface-muted)]'}`}>
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
      </div>
    </div>
  </label>
);

type StatCardColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple';

interface StatCardProps {
  icon: React.ElementType;
  title: string;
  value: string;
  trend?: string;
  color?: StatCardColor;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, value, trend, color = 'blue' }) => {
  const colors: Record<StatCardColor, string> = {
    blue: 'bg-[var(--status-info-bg)] text-[var(--status-info-text)]',
    green: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
    yellow: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
    red: 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]',
    purple: 'bg-[var(--status-info-bg)] text-[var(--status-info-text)]'
  };

  return (
    <div className="group rounded-xl border border-[var(--border-color)] bg-white p-4 shadow-[var(--shell-shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shell-shadow-md)]">
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors[color]} ring-1 ring-black/5`}>
          <Icon className="w-4 h-4" />
        </div>
        {trend && (
          <div className="flex items-center space-x-1 text-[length:var(--font-meta)] text-primary-600" style={{ fontWeight: 'var(--font-weight-label)' }}>
            <TrendingUp className="w-3.5 h-3.5 text-primary-500" />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className="mt-3">
        <h3 className="text-[length:var(--font-stat-value)] font-semibold text-[var(--text-primary)]">{value}</h3>
        <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">{title}</p>
      </div>
    </div>
  );
};

const Profile = () => {
  const { user, updateUserProfile } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingProfileUpdate, setLoadingProfileUpdate] = useState(false);
  const [loadingPasswordChange, setLoadingPasswordChange] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.first_name,
    lastName: user?.last_name,
    email: user?.email,
    phone: user?.phone_number,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'security' || tabParam === 'profile' || tabParam === 'settings' || tabParam === 'notifications') {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);

  const [cardData, setCardData] = useState({
    assigned_tickets: 0,
    resolved_tickets: 0,
    assigned_tasks: 0,
    completed_tasks: 0,
  });

  const [settingsDraft, setSettingsDraft] = useState({
    compactMode: false,
    showTips: true,
    weeklyDigest: true,
    autoAssign: false,
  });

  const [notificationPrefs, setNotificationPrefs] = useState<UserNotificationPreference | null>(null);
  const [loadingNotificationPrefs, setLoadingNotificationPrefs] = useState(true);
  const [savingNotificationPrefs, setSavingNotificationPrefs] = useState(false);

  useEffect(() => {
    const fetchCardData = async () => {
      try {
        const response = await http.get(APIS.PROFILE_ANALYSIS);
        setCardData({
          assigned_tickets: 0,
          resolved_tickets: 0,
          assigned_tasks: 0,
          completed_tasks: 0,
          ...response.data,
        });
      } catch {
        errorNotification('Failed to load card data');
      }
    };

    fetchCardData();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleSetting = (key: keyof typeof settingsDraft) => {
    setSettingsDraft(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const prefs = await getUserNotificationPreferences();
        setNotificationPrefs(prefs);
      } catch {
        errorNotification('Failed to load notification preferences');
      } finally {
        setLoadingNotificationPrefs(false);
      }
    };

    fetchPreferences();
  }, []);

  const handleDeliveryChannelToggle = (channel: NotificationChannel) => {
    setNotificationPrefs(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        delivery_channels: {
          ...prev.delivery_channels,
          [channel]: !prev.delivery_channels[channel],
        },
      };
    });
  };

  const handleMatrixToggle = (type: NotificationTypeKey, channel: NotificationChannel) => {
    setNotificationPrefs(prev => {
      if (!prev) return prev;
      const nextMatrix = { ...prev.notification_matrix };
      const row = nextMatrix[type] ? { ...nextMatrix[type] } : defaultNotificationChannels();
      row[channel] = !row[channel];
      nextMatrix[type] = row;
      return {
        ...prev,
        notification_matrix: nextMatrix,
      };
    });
  };

  const handleQuietHoursToggle = () => {
    setNotificationPrefs(prev => {
      if (!prev) return prev;
      const quietHours = prev.quiet_hours || { enabled: false, start: '22:00', end: '06:00' };
      return {
        ...prev,
        quiet_hours: {
          ...quietHours,
          enabled: !quietHours.enabled,
        },
      };
    });
  };

  const handleQuietHoursTimeChange = (field: 'start' | 'end', value: string) => {
    setNotificationPrefs(prev => {
      if (!prev) return prev;
      const quietHours = prev.quiet_hours || { enabled: false, start: '22:00', end: '06:00' };
      return {
        ...prev,
        quiet_hours: {
          ...quietHours,
          [field]: value,
        },
      };
    });
  };

  const handleDigestToggle = () => {
    setNotificationPrefs(prev => (prev ? { ...prev, email_digest_enabled: !prev.email_digest_enabled } : prev));
  };

  const handleDigestFrequencyChange = (value: 'daily' | 'weekly' | 'off') => {
    setNotificationPrefs(prev => (prev ? { ...prev, digest_frequency: value } : prev));
  };

  const handleBrowserPushToggle = () => {
    setNotificationPrefs(prev => (prev ? { ...prev, browser_push_enabled: !prev.browser_push_enabled } : prev));
  };

  const handleMute = (minutes: number) => {
    const muteUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    setNotificationPrefs(prev => (prev ? { ...prev, mute_until: muteUntil } : prev));
  };

  const clearMute = () => {
    setNotificationPrefs(prev => (prev ? { ...prev, mute_until: null } : prev));
  };

  const handleResetNotificationPrefs = () => {
    setNotificationPrefs(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        delivery_channels: defaultNotificationChannels(),
        notification_matrix: defaultNotificationMatrix(),
      };
    });
  };

  const handleSaveNotificationPreferences = async () => {
    if (!notificationPrefs) return;
    setSavingNotificationPrefs(true);
    try {
      const quietHours = notificationPrefs.quiet_hours || { enabled: false, start: '22:00', end: '06:00' };
      const payload = {
        delivery_channels: notificationPrefs.delivery_channels,
        notification_matrix: notificationPrefs.notification_matrix,
        quiet_hours: quietHours,
        browser_push_enabled: notificationPrefs.browser_push_enabled,
        email_digest_enabled: notificationPrefs.email_digest_enabled,
        digest_frequency: notificationPrefs.digest_frequency,
        mute_until: notificationPrefs.mute_until,
      };
      const updated = await updateUserNotificationPreferences(payload);
      setNotificationPrefs(updated);
      successNotification('Notification preferences saved');
    } catch {
      errorNotification('Failed to update notification preferences');
    } finally {
      setSavingNotificationPrefs(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingProfileUpdate(true);
    const profileData = new FormData();
    profileData.append('first_name', formData.firstName || '');
    profileData.append('last_name', formData.lastName || '');
    profileData.append('email', formData.email || '');
    profileData.append('phone_number', formData.phone || '');
    if (fileInputRef.current?.files?.[0]) {
      profileData.append('avatar', fileInputRef.current.files[0]);
    }

    try {
      const response = await http.put(APIS.UPDATE_PROFILE, profileData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      updateUserProfile(response.data.user);
      successNotification('Profile updated successfully');
      setIsEditing(false);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string; detail?: string } }; message?: string };
      const errorMessage = err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to update profile';
      errorNotification(errorMessage);
    } finally {
      setLoadingProfileUpdate(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPasswordChange(true);
    if (formData.newPassword !== formData.confirmPassword) {
      errorNotification('New passwords do not match');
      setLoadingPasswordChange(false);
      return;
    }
    try {
      await http.post(APIS.CHANGE_PASSWORD, {
        old_password: formData.currentPassword,
        new_password: formData.newPassword,
      });
      successNotification('Password changed successfully');
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    } catch {
      errorNotification('Failed to change password');
    } finally {
      setLoadingPasswordChange(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      firstName: user?.first_name,
      lastName: user?.last_name,
      email: user?.email,
      phone: user?.phone_number,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  // Tab Content Renderers
  const renderProfileTab = () => {
    const accountStatus = user ? (user.is_active ? 'Active' : 'Inactive') : 'N/A';
    const systemDetails = [
      { label: 'User ID', value: user?.user_id ? user.user_id.toString() : 'N/A' },
      { label: 'Account Status', value: accountStatus },
      { label: 'Category', value: user?.category || 'N/A' },
      { label: 'Staff Access', value: user ? (user.is_staff ? 'Yes' : 'No') : 'N/A' },
      { label: 'Business', value: user?.business?.name || 'N/A' },
      { label: 'Workspace Domain', value: user?.business?.domain_url || 'N/A' },
      { label: 'Timezone', value: user?.business?.timezone || 'N/A' },
    ];

    return (
      <div className="space-y-5">
        {/* Work Overview Stats */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="flex items-center text-[length:var(--font-section-title)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-title)' }}>
              <BarChart3 className="w-4 h-4 mr-2" />
              My Work Overview
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-subtle)] p-4">
              <h3 className="mb-3 text-[length:var(--font-meta)] uppercase tracking-wide text-[var(--text-secondary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>Tickets</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  icon={Clock}
                  title="Assigned to Me"
                  value={cardData.assigned_tickets.toString()}
                  color="blue"
                />
                <StatCard
                  icon={CheckCircle}
                  title="Resolved"
                  value={cardData.resolved_tickets.toString()}
                  color="green"
                />
              </div>
            </div>
            <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-subtle)] p-4">
              <h3 className="mb-3 text-[length:var(--font-meta)] uppercase tracking-wide text-[var(--text-secondary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>Tasks</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  icon={Clock}
                  title="Assigned to Me"
                  value={cardData.assigned_tasks.toString()}
                  color="purple"
                />
                <StatCard
                  icon={CheckCircle}
                  title="Completed"
                  value={cardData.completed_tasks.toString()}
                  color="green"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Profile Information */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="flex items-center text-[length:var(--font-section-title)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-title)' }}>
              <User className="w-4 h-4 mr-2" />
              Profile Information
            </h2>
            <div className="flex space-x-2">
              {isEditing ? (
                <Button variant="secondary" size="sm" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>

          <form onSubmit={handleProfileUpdate}>
            <div className="space-y-6">
              {/* Avatar Section */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="relative">
                  <img
                    src={imagePreview || user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.first_name}+${user?.last_name}`}
                    alt="Avatar"
                    className="h-20 w-20 rounded-full object-cover shadow-[var(--shell-shadow-sm)] ring-2 ring-white"
                  />
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white transition-colors hover:bg-primary-700"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    className="hidden"
                    accept="image/png, image/jpeg, image/gif"
                  />
                </div>
                <div>
                  <h3 className="text-[length:var(--font-section-title)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-title)' }}>
                    {formData.firstName} {formData.lastName}
                  </h3>
                  <p className="text-[var(--text-secondary)]">{formData.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {user?.role && (
                      <Badge variant="success" className="gap-1">
                        <Briefcase className="w-3 h-3 mr-1" />
                        {user.role}
                      </Badge>
                    )}
                    {user?.departments && user.departments.length > 0 ? (
                      user.departments.map((dept) => (
                        <Badge key={dept.id} variant="info" className="gap-1">
                          <Building2 className="w-3 h-3 mr-1" />
                          {dept.name}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="default" className="gap-1">
                        <Building2 className="w-3 h-3 mr-1" />
                        No department assigned
                      </Badge>
                    )}
                  </div>
                  {isEditing && (
                    <div className="mt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        Change Avatar
                      </Button>
                      <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                        JPG, PNG or GIF. Max 2MB.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Personal Information */}
              <div>
                <h3 className="mb-4 flex items-center text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                  <Mail className="w-4 h-4 mr-2" />
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    disabled={!isEditing}
                  />
                  <Input
                    label="Last Name"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    disabled={!isEditing}
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={!isEditing}
                  />
                  <Input
                    label="Phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>
              <div>
                <h3 className="mb-4 flex items-center text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                  <Shield className="w-4 h-4 mr-2" />
                  Account Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {systemDetails.map((detail) => (
                    <div
                      key={detail.label}
                      className="rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--surface-subtle)] p-4"
                    >
                      <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                        {detail.label}
                      </p>
                      <p className="mt-1 text-[length:var(--font-body)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                        {detail.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {isEditing && (
                <div className="flex justify-end">
                  <Button type="submit" loading={loadingProfileUpdate} disabled={loadingProfileUpdate}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              )}
            </div>
          </form>
        </Card>
      </div>
    );
  };

  const renderSecurityTab = () => (
    <SecurityTab
      formData={formData}
      handleInputChange={handleInputChange}
      handlePasswordChange={handlePasswordChange}
      loadingPasswordChange={loadingPasswordChange}
    />
  );

  const renderSettingsTab = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center text-[length:var(--font-section-title)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-title)' }}>
            <Settings className="w-5 h-5 mr-2" />
            General Settings
          </h2>
          <Badge variant="default">
            Preview
          </Badge>
        </div>
        <p className="mt-2 text-[length:var(--font-body)] text-[var(--text-secondary)]">
          Tailor the way SafariDesk looks and behaves for your account.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
            Workspace Preferences
          </h3>
          <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
            Adjust your workspace density and helper prompts.
          </p>
          <div className="mt-4 space-y-4">
            <Switch
              checked={settingsDraft.compactMode}
              onChange={() => toggleSetting('compactMode')}
              label="Compact spacing"
            />
            <Switch
              checked={settingsDraft.showTips}
              onChange={() => toggleSetting('showTips')}
              label="Show in-app tips"
            />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
            Automation & Digest
          </h3>
          <p className="mt-1 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
            Lightweight automations for your daily flow.
          </p>
          <div className="mt-4 space-y-4">
            <Switch
              checked={settingsDraft.weeklyDigest}
              onChange={() => toggleSetting('weeklyDigest')}
              label="Weekly productivity digest"
            />
            <Switch
              checked={settingsDraft.autoAssign}
              onChange={() => toggleSetting('autoAssign')}
              label="Auto-assign new tickets to me"
            />
          </div>
        </Card>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="py-2">
    <Card className="p-5 sm:p-6">
      <h2 className="mb-6 flex items-center text-[length:var(--font-section-title)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-title)' }}>
        <Bell className="w-5 h-5 mr-2" />
        Notification Settings
      </h2>

      {loadingNotificationPrefs ? (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-[var(--shell-radius)] border border-[var(--border-color)] p-4">
                <div className="sd-shimmer h-4 w-28 rounded-[var(--shell-radius)]" />
                <div className="sd-shimmer mt-2 h-3.5 w-40 rounded-[var(--shell-radius)]" />
                <div className="mt-4 space-y-3">
                  {Array.from({ length: index === 0 ? 2 : 3 }).map((__, rowIndex) => (
                    <div key={rowIndex} className="flex items-center justify-between">
                      <div className="sd-shimmer h-3.5 w-24 rounded-[var(--shell-radius)]" />
                      <div className="sd-shimmer h-6 w-11 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)]">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_80px_80px] items-center border-t border-[var(--border-color)] px-4 py-3 first:border-t-0">
                <div>
                  <div className="sd-shimmer h-3.5 w-32 rounded-[var(--shell-radius)]" />
                  <div className="sd-shimmer mt-2 h-3 w-44 rounded-[var(--shell-radius)]" />
                </div>
                <div className="sd-shimmer mx-auto h-4 w-4 rounded" />
                <div className="sd-shimmer mx-auto h-4 w-4 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : !notificationPrefs ? (
        <div className="rounded-lg bg-[var(--status-danger-bg)] p-4 text-[length:var(--font-body)] text-[var(--status-danger-text)]">
          We could not load your notification preferences. Please refresh to try again.
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-[var(--shell-radius)] border border-[var(--border-color)] p-4">
              <h3 className="mb-3 text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                Delivery Channels
              </h3>
              <p className="mb-4 text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                Toggle the channels SafariDesk can use when sending updates.
              </p>
              <div className="space-y-3">
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <Switch
                    key={channel}
                    checked={notificationPrefs.delivery_channels?.[channel]}
                    onChange={() => handleDeliveryChannelToggle(channel)}
                    label={{
                      in_app: 'In-app feed & bell menu',
                      email: 'Email alerts',
                    }[channel as 'in_app' | 'email']}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-[var(--shell-radius)] border border-[var(--border-color)] p-4">
              <div>
                <h3 className="mb-3 text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                  Quiet Hours
                </h3>
                <Switch
                  checked={notificationPrefs.quiet_hours?.enabled}
                  onChange={handleQuietHoursToggle}
                  label="Silence email at night"
                />
                {notificationPrefs.quiet_hours?.enabled && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                        Start
                      </label>
                      <Input
                        type="time"
                        value={notificationPrefs.quiet_hours?.start || '22:00'}
                        onChange={(e) => handleQuietHoursTimeChange('start', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                        End
                      </label>
                      <Input
                        type="time"
                        value={notificationPrefs.quiet_hours?.end || '06:00'}
                        onChange={(e) => handleQuietHoursTimeChange('end', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-[var(--border-color)] pt-4">
                <h4 className="mb-2 text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                  Temporary Snooze
                </h4>
                <div className="flex flex-wrap gap-2">
                  {[30, 60, 120].map((minutes) => (
                    <Button
                      key={minutes}
                      variant="outline"
                      size="sm"
                      onClick={() => handleMute(minutes)}
                    >
                      Snooze {minutes}m
                    </Button>
                  ))}
                  {notificationPrefs.mute_until && (
                    <Button variant="outline" size="sm" onClick={clearMute}>
                      Clear snooze
                    </Button>
                  )}
                </div>
                {notificationPrefs.mute_until && (
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    Snoozed until{' '}
                    {new Date(notificationPrefs.mute_until).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                )}
              </div>

              <div className="border-t border-dashed border-[var(--border-color)] pt-4">
                <h4 className="mb-2 text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
                  Email digests
                </h4>
                <div className="flex items-center justify-between">
                  <Switch
                    checked={notificationPrefs.email_digest_enabled}
                    onChange={handleDigestToggle}
                    label="Send me summary emails"
                  />
                  <Select
                    value={notificationPrefs.digest_frequency}
                    onChange={(value) => handleDigestFrequencyChange(value as 'daily' | 'weekly' | 'off')}
                    disabled={!notificationPrefs.email_digest_enabled}
                    options={[
                      { value: 'daily', label: 'Daily' },
                      { value: 'weekly', label: 'Weekly' },
                      { value: 'off', label: 'Off' },
                    ]}
                    className="w-[150px]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="mb-4 text-[length:var(--font-label)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-label)' }}>
              Notification Categories
            </h3>
            <div className="overflow-x-auto rounded-[var(--shell-radius)] border border-[var(--border-color)]">
              <table className="w-full text-[length:var(--font-body)]">
                <thead>
                  <tr className="bg-[var(--surface-subtle)] text-left text-[length:var(--font-meta)] uppercase tracking-wide text-[var(--text-secondary)]">
                    <th className="px-4 py-2">Event</th>
                    {NOTIFICATION_CHANNELS.map((channel) => (
                      <th key={channel} className="px-4 py-2 text-center">
                        {
                          {
                            in_app: 'In-app',
                            email: 'Email',
                          }[channel as 'in_app' | 'email']
                        }
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {NOTIFICATION_TYPE_META.map((meta) => {
                    const row = notificationPrefs.notification_matrix?.[meta.id] || defaultNotificationChannels();
                    return (
                      <tr key={meta.id} className="border-t border-[var(--border-color)]">
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--text-primary)]">{meta.label}</div>
                          <p className="text-xs text-[var(--text-secondary)]">{meta.description}</p>
                        </td>
                        {NOTIFICATION_CHANNELS.map((channel) => (
                          <td key={`${meta.id}-${channel}`} className="px-4 text-center">
                            <input
                              type="checkbox"
                              checked={row[channel]}
                              onChange={() => handleMatrixToggle(meta.id, channel)}
                              className="h-4 w-4 rounded border-[var(--border-color)] text-primary-600 focus:ring-primary-500"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-[var(--text-secondary)]">
              Last updated {new Date(notificationPrefs.updated_at).toLocaleString()}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleResetNotificationPrefs} disabled={savingNotificationPrefs}>
                Reset to defaults
              </Button>
              <Button onClick={handleSaveNotificationPreferences} loading={savingNotificationPrefs}>
                Save preferences
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
    </div>
  );

  // const renderThemeTab = () => (
  //   <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-subtle p-6">
  //     <h2 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-6 flex items-center">
  //       <Palette className="w-5 h-5 mr-2" />
  //       Theme Settings
  //     </h2>
  //     <div className="space-y-6">
  //       <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">
  //         Theme customization options will be available here. You can toggle between light and dark mode using the theme button in the header.
  //       </p>
  //     </div>
  //   </div>
  // );

  // const renderBackgroundTab = () => (
  //   <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-subtle p-6">
  //     <h2 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-6 flex items-center">
  //       <Image className="w-5 h-5 mr-2" />
  //       Background Settings
  //     </h2>
  //     <div className="space-y-6">
  //       <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">
  //         Background customization options will be available here.
  //       </p>
  //     </div>
  //   </div>
  // );

  // const renderTokensTab = () => (
  //   <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-subtle p-6">
  //     <h2 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-6 flex items-center">
  //       <Key className="w-5 h-5 mr-2" />
  //       Personal Access Tokens
  //     </h2>
  //     <div className="space-y-6">
  //       <p className="text-sm text-gray-600 dark:text-[var(--text-primary)]">
  //         Personal access tokens allow you to authenticate with the API. Token management functionality will be available here.
  //       </p>
  //     </div>
  //   </div>
  // );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileTab();
      case 'security':
        return renderSecurityTab();
      // case 'settings':
      //   return renderSettingsTab();
      case 'notifications':
        return renderNotificationsTab();
      // Commented out - tabs without functionality
      // case 'theme':
      //   return renderThemeTab();
      // case 'background':
      //   return renderBackgroundTab();
      // case 'tokens':
      //   return renderTokensTab();
      default:
        return renderProfileTab();
    }
  };

  if (!user) {
    return <ProfileScreenSkeleton tab={activeTab === 'settings' ? 'profile' : activeTab} />;
  }

  return (
    <div className="w-full">
      <PageHeader title="My Profile" subtitle="Manage your personal details, security, and notification preferences." />
        {/* Tab Navigation */}
        <div className="mb-4">
          <div className="overflow-x-auto rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] px-3 shadow-[var(--shell-shadow-sm)]">
            <nav className="flex min-w-max items-center gap-4" aria-label="Tabs">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-1.5 whitespace-nowrap border-b-2 py-2.5 text-[length:var(--font-nav)] transition-colors
                      ${isActive
                        ? 'border-primary-600 text-primary-700'
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }
                    `}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[500px] bg-transparent">
          {renderTabContent()}
        </div>
      </div>
  );
};

export default Profile;
