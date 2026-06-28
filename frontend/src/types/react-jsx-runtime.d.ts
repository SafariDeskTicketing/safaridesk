export type Notification = {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  notification_type: string;
  ticket?: {
    id: number;
    ticket_id: string;
    title: string;
    status: string;
    priority: string;
  };
  task?: {
    id: number;
    task_trackid: string;
    title: string;
    task_status: string;
    priority: string;
  };
  metadata?: Record<string, any>;
};

export const NOTIFICATION_CHANNELS = ['in_app', 'email'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export interface NotificationChannelSettings {
  in_app: boolean;
  email: boolean;
}

export const defaultNotificationChannels = (): NotificationChannelSettings => ({
  in_app: true,
  email: true,
});

export const NOTIFICATION_TYPE_IDS = [
  'ticket_assigned',
  'ticket_comment',
  'sla_breach',
  'ticket_escalated',
  'task_assigned',
  'task_status_changed',
  'task_comment',
] as const;

export type NotificationTypeKey = (typeof NOTIFICATION_TYPE_IDS)[number];

export type NotificationMatrix = Record<NotificationTypeKey, NotificationChannelSettings>;

export const defaultNotificationMatrix = (): NotificationMatrix => {
  const matrix = {} as NotificationMatrix;
  NOTIFICATION_TYPE_IDS.forEach((key) => {
    matrix[key] = {
      in_app: true,
      email: true,
    };
  });
  return matrix;
};

export type DigestFrequency = 'daily' | 'weekly' | 'off';

export interface QuietHoursPreference {
  enabled: boolean;
  start: string;
  end: string;
}

export interface UserNotificationPreference {
  id: number;
  business_id: number | null;
  delivery_channels: NotificationChannelSettings;
  notification_matrix: NotificationMatrix;
  quiet_hours: QuietHoursPreference;
  mute_until?: string | null;
  browser_push_enabled: boolean;
  email_digest_enabled: boolean;
  digest_frequency: DigestFrequency;
  resolved_matrix: NotificationMatrix;
  updated_at: string;
}

export type UserNotificationPreferencePayload = Pick<
  UserNotificationPreference,
  | 'delivery_channels'
  | 'notification_matrix'
  | 'quiet_hours'
  | 'browser_push_enabled'
  | 'email_digest_enabled'
  | 'digest_frequency'
> & {
  mute_until?: string | null;
};

export interface OrganizationEscalationPolicy {
  enabled: boolean;
  threshold_minutes: number;
  notify_roles: string[];
  additional_emails: string[];
}

export interface OrganizationNotificationSettings {
  id: number;
  business_id: number;
  delivery_channels: NotificationChannelSettings;
  notification_matrix: NotificationMatrix;
  digest_enabled: boolean;
  digest_frequency: DigestFrequency;
  escalation_policy: OrganizationEscalationPolicy;
  webhook_url?: string | null;
  updated_at: string;
}

export type OrganizationNotificationSettingsPayload = Pick<
  OrganizationNotificationSettings,
  'delivery_channels' | 'notification_matrix' | 'digest_enabled' | 'digest_frequency' | 'escalation_policy' | 'webhook_url'
>;

export interface NotificationTypeMeta {
  id: NotificationTypeKey;
  label: string;
  description: string;
  category: 'ticket' | 'task' | 'sla' | 'system';
}

export const NOTIFICATION_TYPE_META: NotificationTypeMeta[] = [
  {
    id: 'ticket_assigned',
    label: 'Ticket assignment',
    description: 'You are assigned to a new ticket or it has been reassigned to you.',
    category: 'ticket',
  },
  {
    id: 'ticket_comment',
    label: 'Ticket comments',
    description: 'Alerts for new public comments or internal notes on your tickets.',
    category: 'ticket',
  },
  {
    id: 'sla_breach',
    label: 'SLA breach alerts',
    description: 'Heads-up when a ticket or task breaches its SLA target.',
    category: 'sla',
  },
  {
    id: 'ticket_escalated',
    label: 'Ticket escalations',
    description: 'Critical escalations triggered by automation or managers.',
    category: 'ticket',
  },
  {
    id: 'task_assigned',
    label: 'Task assignment',
    description: 'You have been assigned or reassigned to a task.',
    category: 'task',
  },
  {
    id: 'task_status_changed',
    label: 'Task status changes',
    description: 'Task transitions across workflow stages.',
    category: 'task',
  },
  {
    id: 'task_comment',
    label: 'Task updates',
    description: 'Comments or internal notes added to tasks you follow.',
    category: 'task',
  },
];
