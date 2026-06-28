import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CreateTicketModal } from '../../components/tickets/CreateTicketModal';

export const CreateTicketPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface">
      <div className="px-4 py-6">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate('/tickets')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-subtle dark:bg-surface-elevated dark:text-[var(--text-muted)] dark:hover:bg-surface-hover dark:hover:text-[var(--text-primary)]"
            title="Back to tickets"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">Create New Ticket</h1>
            <p className="text-sm text-gray-600 dark:text-[var(--text-muted)]">
              Shared labels, categories, and assignment use the same flow as the main ticket workspace.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-subtle dark:bg-surface-elevated">
          <CreateTicketModal
            loadFromApi
            onclose={() => navigate('/tickets')}
            onSuccess={() => navigate('/tickets')}
          />
        </div>
      </div>
    </div>
  );
};

export default CreateTicketPage;
