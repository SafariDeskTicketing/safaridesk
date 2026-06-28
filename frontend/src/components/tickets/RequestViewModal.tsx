import React from 'react';
import { sanitizeHTML } from '../../utils/sanitize';
import { Modal } from '../ui/Modal';
import { Clock, User, Mail, Phone, Tag, Check, X, AlertCircle } from 'lucide-react';

interface Request {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  creator_name: string;
  creator_email: string;
  creator_phone: string;
  ref_number: string;
  created_at: string;
  updated_at: string;
  converted_to_ticket: boolean;
  converted_to_task: boolean;
  ticket_id?: string;
  task_id?: string;
}

interface RequestViewModalProps {
  request: Request | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RequestViewModal: React.FC<RequestViewModalProps> = ({
  request,
  isOpen,
  onClose,
}) => {
  if (!request) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'approved':
        return 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200';
      case 'converted':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-surface dark:text-[var(--text-primary)]';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'technical':
        return <AlertCircle className="w-4 h-4" />;
      case 'billing':
        return <Tag className="w-4 h-4" />;
      case 'bug':
        return <X className="w-4 h-4" />;
      default:
        return <Tag className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'technical':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'billing':
        return 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200';
      case 'bug':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'feature':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-surface dark:text-[var(--text-primary)]';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={`Request Details - ${request.ref_number}`}
    >
      <div className="space-y-6">
        {/* Header Info */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-200 dark:border-subtle">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-[var(--text-primary)]">
              {request.title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-[var(--text-muted)] mt-1">
              Reference: {request.ref_number}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getTypeColor(request.type)}`}>
              {getTypeIcon(request.type)}
              {request.type}
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
              {request.status}
            </div>
          </div>
        </div>

        {/* Creator Details */}
        <div className="bg-gray-50 dark:bg-surface-elevated rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] mb-3">Creator Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <User size={16} className="text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-[var(--text-muted)]">{request.creator_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-[var(--text-muted)]">{request.creator_email}</span>
            </div>
            <div className="flex items-center gap-2 col-span-1 md:col-span-2">
              <Phone size={16} className="text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-[var(--text-muted)]">{request.creator_phone || 'Not provided'}</span>
            </div>
          </div>
        </div>

        {/* Request Description */}
        <div className="bg-gray-50 dark:bg-surface-elevated rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] mb-3">Request Description</h3>
          <div
            className="text-sm text-gray-600 dark:text-[var(--text-muted)] prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(request.description || '') }}
          />
        </div>

        {/* Conversion Status */}
        {(request.converted_to_ticket || request.converted_to_task || request.status === 'approved') && (
          <div className="bg-gray-50 dark:bg-surface-elevated rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-[var(--text-primary)] mb-3">Processing Status</h3>
            <div className="flex flex-wrap gap-2">
              {request.converted_to_ticket && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  <Check size={12} className="mr-1" />
                  Converted to Ticket ID: {request.ticket_id}
                </div>
              )}
              {request.converted_to_task && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  <Check size={12} className="mr-1" />
                  Converted to Task ID: {request.task_id}
                </div>
              )}
              {request.status === 'approved' && !request.converted_to_ticket && !request.converted_to_task && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                  <Check size={12} className="mr-1" />
                  Approved - Ready for action
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-subtle">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-500 dark:text-[var(--text-muted)]">Created</p>
              <p className="text-sm text-gray-700 dark:text-[var(--text-primary)]">
                {new Date(request.created_at).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            <div>
              <p className="text-xs text-gray-500 dark:text-[var(--text-muted)]">Last Updated</p>
              <p className="text-sm text-gray-700 dark:text-[var(--text-primary)]">
                {new Date(request.updated_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
