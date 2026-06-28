import React, { useState } from 'react';
import { sanitizePreviewHTML } from '../../utils/sanitize';
import { MoreVertical, Check, Clock, User, Ticket, Zap, ArrowRight, AlertTriangle, Eye } from 'lucide-react';
import { DropdownMenu, DropdownItem } from '../ui/Dropdown';
import ConfirmDialog from '../ui/ConfirmDialog';
import { RequestViewModal } from './RequestViewModal';
import { useNavigate } from 'react-router-dom';

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
  attached_to?: string;
}

interface RequestCardProps {
  request: Request;
  onAction: (action: string, request: Request) => void;
}

export const RequestCard: React.FC<RequestCardProps> = ({ request, onAction }) => {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    action: string;
    message: string;
    variant: 'warning' | 'info';
  }>({ show: false, action: '', message: '', variant: 'warning' });

  const handleNavigateToTicket = () => {
    if (request.attached_to) {
      navigate(`/ticket/${request.attached_to}`);
    } else {
      // Fallback - navigate to tickets list
      navigate('/tickets');
    }
  };

  const handleNavigateToTask = () => {
    if (request.attached_to) {
      navigate(`/task/${request.attached_to}`);
    } else {
      // Fallback - navigate to tasks list
      navigate('/tasks');
    }
  };

  const handleViewClick = () => {
    setShowViewModal(true);
    setIsDropdownOpen(false);
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
  };

  const handleActionClick = (action: string) => {
    if (action === 'view') {
      handleViewClick();
      return;
    }

    if (action === 'make_ticket') {
      setConfirmDialog({
        show: true,
        action: 'make_ticket',
        message: `Are you sure you want to convert this request to a support ticket? This will create a new ticket with SLA rules and assign it to the appropriate department.`,
        variant: 'info'
      });
    } else if (action === 'make_task') {
      setConfirmDialog({
        show: true,
        action: 'make_task',
        message: `Are you sure you want to convert this request to an internal task? This will create a task for department members to work on.`,
        variant: 'warning'
      });
    } else {
      onAction(action, request);
    }
    setIsDropdownOpen(false);
  };

  const handleConfirm = () => {
    onAction(confirmDialog.action, request);
    setConfirmDialog({ show: false, action: '', message: '', variant: 'warning' });
  };

  const handleCancel = () => {
    setConfirmDialog({ show: false, action: '', message: '', variant: 'warning' });
  };

  return (
    <div
      className="rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 group p-4"
      style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-[length:var(--font-label)] font-semibold text-[var(--text-primary)]">{request.title}</p>
          <p className="text-[length:var(--font-meta)] text-[var(--text-muted)]">{request.ref_number}</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="p-1.5 hover:bg-[var(--hover-bg)] rounded"
          >
            <MoreVertical size={14} className="text-[var(--text-muted)]" />
          </button>
          {isDropdownOpen && (
            <DropdownMenu isOpen={isDropdownOpen} onClose={() => setIsDropdownOpen(false)}>
              <div data-dropdown className="dropdown-menu">
                {/* View action always available */}
                <DropdownItem icon={Eye} onClick={() => handleActionClick('view')}>
                  View Details
                </DropdownItem>

                {(!request.converted_to_task  &&  !request.converted_to_ticket) && (
                  <DropdownItem icon={ArrowRight} onClick={() => handleActionClick('make_ticket')}>
                    Make Ticket
                  </DropdownItem>
                )}
                {(!request.converted_to_task  &&  !request.converted_to_ticket) && (
                  <DropdownItem icon={Zap} onClick={() => handleActionClick('make_task')}>
                    Make Task
                  </DropdownItem>
                )}
                {/* {request.status !== 'approved' && (
                  <DropdownItem icon={Check} onClick={() => handleActionClick('approve')}>
                    Approve
                  </DropdownItem>
                )} */}
              </div>
            </DropdownMenu>
          )}
        </div>
      </div>
      <div
        className="text-[length:var(--font-label)] text-[var(--text-secondary)] mt-2 line-clamp-2"
        dangerouslySetInnerHTML={{ __html: sanitizePreviewHTML(request.description || '') }}
      />
      <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
        <div className="flex items-center justify-between text-[length:var(--font-meta)] text-[var(--text-muted)]">
          <div className="flex items-center">
            <User size={12} className="mr-1" />
            {request.creator_name}
          </div>
          <div className="flex items-center">
            <Clock size={12} className="mr-1" />
            {new Date(request.created_at).toLocaleDateString()}
          </div>
        </div>

        {/* Converted Status Indicators */}
        {(request.converted_to_ticket || request.converted_to_task || request.status === 'approved') && (
          <div className="mt-2 flex flex-wrap gap-1">
            {request.converted_to_ticket && (
              <div
                onClick={handleNavigateToTicket}
                className="inline-flex items-center px-2 py-1 rounded-full text-[length:var(--font-meta)] border cursor-pointer transition-colors duration-200 hover:opacity-80"
                style={{
                  backgroundColor: 'var(--status-info-bg)',
                  color: 'var(--status-info-text)',
                  borderColor: 'var(--status-info-border)',
                }}
                title="Click to view ticket"
              >
                <Ticket size={10} className="mr-1" />
                Ticket: {request.attached_to || "Created"}
              </div>
            )}
            {request.converted_to_task && (
              <div
                onClick={handleNavigateToTask}
                className="inline-flex items-center px-2 py-1 rounded-full text-[length:var(--font-meta)] border cursor-pointer transition-colors duration-200 hover:opacity-80"
                style={{
                  backgroundColor: 'var(--status-neutral-bg)',
                  color: 'var(--status-neutral-text)',
                  borderColor: 'var(--status-neutral-border)',
                }}
                title="Click to view task"
              >
                <Zap size={10} className="mr-1" />
                Task: {request.attached_to || "Created"}
              </div>
            )}
            {request.status === 'approved' && (
              <div
                className="inline-flex items-center px-2 py-1 rounded-full text-[length:var(--font-meta)] border"
                style={{
                  backgroundColor: 'var(--status-success-bg)',
                  color: 'var(--status-success-text)',
                  borderColor: 'var(--status-success-border)',
                }}
              >
                <Check size={10} className="mr-1" />
                Approved
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        message={confirmDialog.message}
        show={confirmDialog.show}
        onConfirm={handleConfirm}
        cancel={handleCancel}
        variant={confirmDialog.variant}
        title="Confirm Action"
        confirmText="Yes, Proceed"
        cancelText="Cancel"
      />

      {/* Request View Modal */}
      <RequestViewModal
        request={showViewModal ? request : null}
        isOpen={showViewModal}
        onClose={handleCloseViewModal}
      />
    </div>
  );
};
