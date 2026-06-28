import React from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Tag,
  RefreshCw,
  CheckCircle,
  XCircle,
  Paperclip,
  AlertCircle,
  UserPlus,
  ArrowRightCircle,
  Lock,
  Unlock,
  Building2,
  Layers,
  GitMerge,
  ListTodo
} from 'lucide-react';
import { ActivitySystemEventData } from './ActivityStream';
import { formatDistanceToNow } from 'date-fns';
import { formatUserDisplayName } from '../../utils/displayHelpers';

interface ActivitySystemEventProps {
  event: ActivitySystemEventData;
}

const getEventIcon = (activityType: string) => {
  switch (activityType) {
    case 'created':
      return <CheckCircle size={16} className="text-primary-600 dark:text-primary-400" />;
    case 'updated':
      return <RefreshCw size={16} className="text-indigo-600 dark:text-indigo-400" />;
    case 'commented':
      return <User size={16} className="text-gray-600 dark:text-[var(--text-primary)]" />;
    case 'assigned':
      return <UserPlus size={16} className="text-blue-600 dark:text-blue-400" />;
    case 'merged':
      return <GitMerge size={16} className="text-primary-600 dark:text-primary-400" />;
    case 'status_changed':
      return <ArrowRightCircle size={16} className="text-indigo-600 dark:text-indigo-400" />;
    case 'priority_changed':
      return <AlertCircle size={16} className="text-orange-600 dark:text-orange-400" />;
    case 'attachment_added':
      return <Paperclip size={16} className="text-gray-600 dark:text-[var(--text-primary)]" />;
    case 'resolved':
      return <CheckCircle size={16} className="text-primary-600 dark:text-primary-400" />;
    case 'closed':
      return <Lock size={16} className="text-red-600 dark:text-red-400" />;
    case 'reopened':
      return <Unlock size={16} className="text-yellow-600 dark:text-yellow-400" />;
    case 'label_added':
      return <Tag size={16} className="text-purple-600 dark:text-purple-400" />;
    case 'label_removed':
      return <Tag size={16} className="text-[var(--text-muted)]" />;
    case 'department_changed':
      return <Building2 size={16} className="text-cyan-600 dark:text-cyan-400" />;
    case 'category_changed':
      return <Layers size={16} className="text-teal-600 dark:text-teal-400" />;
    case 'task_linked':
      return <ListTodo size={16} className="text-blue-600 dark:text-blue-400" />;
    case 'attached_to_ticket':
      return <ListTodo size={16} className="text-primary-600 dark:text-primary-400" />;
    default:
      return <RefreshCw size={16} className="text-gray-600 dark:text-[var(--text-primary)]" />;
  }
};

export const ActivitySystemEvent: React.FC<ActivitySystemEventProps> = ({ event }) => {
  // Handle cases where user might be undefined or have missing properties
  if (!event) {
    return null;
  }

  const userBaseName = event.user?.name || event.user?.email || 'System';
  const userDisplayName = formatUserDisplayName(event.user, userBaseName);
  const userAvatar = event.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userBaseName)}&background=random&size=20`;

  return (
    <div className="relative flex items-start gap-2 py-5 text-sm">
      {/* Icon - Positioned on timeline with colored background, aligned with text */}
      <div className="absolute -left-8 top-[1.125rem] transform -translate-x-1/2 bg-white dark:bg-surface p-1 rounded-full border border-gray-200 dark:border-subtle">
        {getEventIcon(event.activity_type)}
      </div>

      {/* User Avatar - Small for system events, optional */}
      {event.user && event.user.avatar && (
        <img
          className="size-5 rounded-full mt-0.5 flex-shrink-0"
          src={userAvatar}
          alt={`Avatar of ${userBaseName}`}
        />
      )}

      {/* Event Description - GitHub-style inline */}
      <div className="flex-1 text-gray-700 dark:text-[var(--text-primary)]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 dark:text-[var(--text-primary)]">{userDisplayName}</span>
          {getEventDescription(event)}
          <span className="text-gray-500 dark:text-[var(--text-primary)] text-xs" title={event.timestamp ? new Date(event.timestamp).toLocaleString() : ''}>
            {event.timestamp ? formatDistanceToNow(new Date(event.timestamp), { addSuffix: true }) : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

function getEventDescription(event: ActivitySystemEventData): React.ReactNode {
  // System events should be SHORT and CONCISE - never show full descriptions
  // Based on activity_type and old_value/new_value, create short inline text

  switch (event.activity_type) {
    case 'merged': {
      const mergedList = event.new_value
        ? event.new_value.split(',').map(t => t.trim()).filter(Boolean)
        : [];
      // Use description to distinguish source (consumed) vs target (receiving) tickets:
      // - Source description: "Merged into <target>"
      // - Target description: "Merged tickets: <child list>"
      const isSourceTicket = (event.description || '').startsWith('Merged into');

      if (mergedList.length > 1) {
        return (
          <>
            {isSourceTicket ? (
              <>
                merged this ticket into{' '}
                <a href={`/ticket/${mergedList.join(',')}`} className="text-primary-700 dark:text-primary-300 underline">
                  #{mergedList.join(',')}
                </a>
              </>
            ) : (
              <>
                merged{' '}
                {mergedList.map((tid, idx) => (
                  <React.Fragment key={tid}>
                    <a href={`/ticket/${tid}`} className="text-primary-700 dark:text-primary-300 underline">
                      #{tid}
                    </a>
                    {idx < mergedList.length - 1 ? ', ' : ''}
                  </React.Fragment>
                ))}{' '}
                into this ticket
              </>
            )}
          </>
        );
      }

      const targetTicket = mergedList[0] || event.new_value;
      return (
        <>
          {isSourceTicket ? (
            <>
              merged this ticket into{' '}
              {targetTicket ? (
                <a href={`/ticket/${targetTicket}`} className="text-primary-700 dark:text-primary-300 underline">
                  #{targetTicket}
                </a>
              ) : (
                'another ticket'
              )}
            </>
          ) : (
            <>
              merged{' '}
              {targetTicket ? (
                <a href={`/ticket/${targetTicket}`} className="text-primary-700 dark:text-primary-300 underline">
                  #{targetTicket}
                </a>
              ) : (
                'another ticket'
              )}{' '}
              into this ticket
            </>
          )}
        </>
      );
    }

    case 'created': {
      const description = (event.description || '').toLowerCase();
      const entity = description.includes('task') ? 'task' : 'ticket';
      return `created this ${entity}`;
    }

    case 'updated':
      // For generic updates, show what changed based on old/new values
      if (event.old_value && event.new_value) {
        // For merged lists on primary ticket, hyperlink merged children if present
        const values = (event.description || '').startsWith('Merged tickets:') && event.new_value
          ? event.new_value.split(',').map(v => v.trim()).filter(Boolean)
          : null;
        if (values && values.length) {
          return (
            <>
              merged tickets:{' '}
              {values.map((tid, idx) => (
                <React.Fragment key={tid}>
                  <a href={`/ticket/${tid}`} className="text-primary-700 dark:text-primary-300 underline">
                    #{tid}
                  </a>
                  {idx < values.length - 1 ? ', ' : ''}
                </React.Fragment>
              ))}
            </>
          );
        }

        return (
          <>
            changed the status from{' '}
            <span className="font-semibold">{event.old_value}</span>
            {' to '}
            <span className="font-semibold text-purple-600 dark:text-purple-400">{event.new_value}</span>
          </>
        );
      }
      return 'updated this ticket';

    case 'commented':
      return 'added a comment';

    case 'assigned':
      return (
        <>
          assigned this
          {event.new_value && (
            <>
              {' to '}
              <span className="font-semibold">{event.new_value}</span>
            </>
          )}
        </>
      );

    case 'status_changed':
      return (
        <>
          changed the status from{' '}
          <span className="font-semibold">{event.old_value || 'Open'}</span>
          {' to '}
          <span className="font-semibold text-purple-600 dark:text-purple-400">{event.new_value}</span>
        </>
      );

    case 'priority_changed':
      return (
        <>
          changed the priority from{' '}
          <span className="font-semibold">{event.old_value || 'Normal'}</span>
          {' to '}
          <span className={`font-semibold ${getPriorityColor(event.new_value || '')}`}>
            {event.new_value}
          </span>
        </>
      );

    case 'label_added': {
      // Handle multiple labels if new_value contains commas or parse as array
      const labels = event.new_value?.split(',').map(l => l.trim()) || [event.new_value];
      return (
        <>
          added the{' '}
          {labels.map((label, index) => (
            <React.Fragment key={index}>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-600 text-xs font-medium">
                {label}
              </span>
              {index < labels.length - 2 && ', '}
              {index === labels.length - 2 && ' and '}
            </React.Fragment>
          ))}
          {' '}label{labels.length > 1 ? 's' : ''}
        </>
      );
    }

    case 'label_removed': {
      const labels = event.old_value?.split(',').map(l => l.trim()) || [event.old_value];
      return (
        <>
          removed the{' '}
          {labels.map((label, index) => (
            <React.Fragment key={index}>
              <span className="px-2 py-0.5 rounded-full bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-color)] text-xs font-medium line-through">
                {label}
              </span>
              {index < labels.length - 2 && ', '}
              {index === labels.length - 2 && ' and '}
            </React.Fragment>
          ))}
          {' '}label{labels.length > 1 ? 's' : ''}
        </>
      );
    }

    case 'attachment_added':
      return (
        <>
          added an attachment
          {event.new_value && (
            <>
              {' '}
              <span className="font-semibold">{event.new_value}</span>
            </>
          )}
        </>
      );

    case 'resolved':
      return 'marked this as resolved';

    case 'closed':
      return 'closed this ticket';

    case 'task_linked': {
      // new_value contains the task ID
      const taskId = event.new_value;
      
      return (
        <>
          linked task{' '}
          {taskId ? (
            <Link 
              to={`/task/${taskId}`} 
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              #{taskId}
            </Link>
          ) : (
            'a task'
          )}
          {' '}to this ticket
        </>
      );
    }

    case 'attached_to_ticket': {
      // new_value contains the ticket_id (string ID like 'TKT-001')
      const ticketId = event.new_value;
      return (
        <>
          attached this task to ticket{' '}
          <Link 
            to={`/ticket/${ticketId}`} 
            className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
          >
            #{ticketId}
          </Link>
        </>
      );
    }

    default:
      return event.description || 'performed an action';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'critical':
    case 'urgent':
      return 'text-[#d93f0b]';
    case 'high':
      return 'text-[#fbca04]';
    case 'medium':
      return 'text-[#006b75]';
    case 'low':
      return 'text-[#7ae53d]';
    default:
      return 'text-gray-600 dark:text-[var(--text-primary)]';
  }
}
