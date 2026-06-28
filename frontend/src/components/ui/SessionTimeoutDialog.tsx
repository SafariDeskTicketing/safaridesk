import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface SessionTimeoutDialogProps {
  isOpen: boolean;
  countdown: number;
  onClose: () => void;
}

export const SessionTimeoutDialog: React.FC<SessionTimeoutDialogProps> = ({ isOpen, countdown, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Session Timeout Warning" closeOnBackdropClick={false} closeOnEscape={false}>
      <div className="p-4">
        <p className="text-gray-700 dark:text-[var(--text-primary)] mb-4">
          Your session is being terminated due to inactivity. You will be logged out in{' '}
          <span className="font-bold text-red-500">{countdown}</span> seconds.
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose}>Stay Logged In</Button>
        </div>
      </div>
    </Modal>
  );
};
