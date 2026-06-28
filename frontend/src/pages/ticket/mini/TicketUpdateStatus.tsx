import React from 'react';
import Select from '../../../components/ui/Select';

type Props = {
  selectedOption: string;
  setSelectedOption: (value: string) => void;
  statusDescription: string;
  setStatusDescription: (value: string) => void;
  handleStatusUpdate: () => void;
  isSubmitting: boolean;
  currentStatus: string;
}


type InfoBoxProps = {
  color: 'amber' | 'green' | 'yellow';
  iconPath: string;
  title: string;
  message: string;
};

const UpdateTicketStatus: React.FC<Props> = ({
  selectedOption,
  setSelectedOption,
  statusDescription,
  setStatusDescription,
  handleStatusUpdate,
  isSubmitting,
  currentStatus
}) => {
  // Build options based on current status
  const getStatusOptions = () => {
    const allStatuses = [
      { value: "", label: "Choose status...", disabled: true },
      { value: "open", label: "Open" },
      { value: "in_progress", label: "In Progress" },
      { value: "pending", label: "Pending" },
      { value: "on_hold", label: "On Hold" },
      { value: "closed", label: "Closed" },
    ];

    // Filter out current status from options
    return allStatuses.filter(opt => opt.value !== currentStatus);
  };

  const options = getStatusOptions();

  return (
    <div className="p-6">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-4">
            Update Ticket Status
          </h3>

          <div className="space-y-4">
            <Select
              id="status"
              label="Select New Status"
              value={selectedOption}
              onChange={setSelectedOption}
              options={options}
              placeholder="Choose status..."
              size="md"
              required
              allowSearch={true}
            />

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)] mb-2 ">
                Description <span className="text-gray-700 dark:text-[var(--text-primary)]">(optional)</span>
              </label>
              <textarea
                id="description"
                value={statusDescription}
                onChange={(e) => setStatusDescription(e.target.value)}
                placeholder="Add a note about this status change..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-subtle bg-white dark:bg-surface-elevated text-gray-900 dark:text-[var(--text-primary)] rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>

            {selectedOption === 'in_progress' && (
              <InfoBox color="amber" iconPath="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                title="Note:" message="Setting status to &quot;In Progress&quot; will resume active work on this ticket." />
            )}

            {selectedOption === 'pending' && (
              <InfoBox color="yellow" iconPath="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                title="Info:" message="This will mark the ticket as waiting for customer response. SLA timer will pause." />
            )}

            {selectedOption === 'on_hold' && (
              <InfoBox color="yellow" iconPath="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                title="Info:" message="This will put the ticket on hold (waiting for third party/internal). SLA timer will pause." />
            )}

            {selectedOption === 'closed' && (
              <InfoBox color="green" iconPath="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                title="Info:" message="This will close the ticket permanently." />
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={handleStatusUpdate}
          disabled={!selectedOption || isSubmitting}
          className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Updating..." : "Update Status"}
        </button>
      </div>
    </div>
  );
};


const InfoBox: React.FC<InfoBoxProps> = ({ color, iconPath, title, message }) => {
  const colorClasses = {
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      title: "text-amber-800",
      icon: "text-amber-600"
    },
    green: {
      bg: "bg-primary-50",
      border: "border-primary-200",
      text: "text-primary-700",
      title: "text-primary-800",
      icon: "text-primary-600"
    },
    yellow: {
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      text: "text-yellow-700",
      title: "text-yellow-800",
      icon: "text-yellow-600"
    }
  };

  const styles = colorClasses[color];

  return (
    <div className={`${styles.bg} ${styles.border} rounded-md p-3`}>
      <div className="flex items-center">
        <svg className={`w-5 h-5 ${styles.icon} mr-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
        </svg>
        <span className={`${styles.title} font-medium`}>{title}</span>
      </div>
      <p className={`${styles.text} mt-1`}>
        {message}
      </p>
    </div>
  );
};

export default UpdateTicketStatus;
