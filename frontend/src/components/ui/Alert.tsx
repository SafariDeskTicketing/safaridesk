import React from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

interface AlertProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose?: () => void;
}

const alertStyles = {
  success: {
    bg: 'bg-[var(--status-success-bg)]',
    border: 'border-[var(--status-success-border)]',
    text: 'text-[var(--status-success-text)]',
    icon: <CheckCircle className="h-5 w-5 text-[var(--status-success-text)]" />,
  },
  error: {
    bg: 'bg-[var(--status-danger-bg)]',
    border: 'border-[var(--status-danger-border)]',
    text: 'text-[var(--status-danger-text)]',
    icon: <XCircle className="h-5 w-5 text-[var(--status-danger-text)]" />,
  },
  info: {
    bg: 'bg-[var(--status-info-bg)]',
    border: 'border-[var(--status-info-border)]',
    text: 'text-[var(--status-info-text)]',
    icon: <Info className="h-5 w-5 text-[var(--status-info-text)]" />,
  },
};

const Alert: React.FC<AlertProps> = ({ message, type, onClose }) => {
  const styles = alertStyles[type];

  return (
    <div className={`flex items-start space-x-3 rounded-[var(--shell-radius)] border p-3 ${styles.bg} ${styles.border}`}>
      <div className="flex-shrink-0">{styles.icon}</div>
      <div className="flex-1">
        <p className={`text-[var(--font-label)] ${styles.text}`}>{message}</p>
      </div>
      {onClose && (
        <button onClick={onClose} className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
          <XCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default Alert;
