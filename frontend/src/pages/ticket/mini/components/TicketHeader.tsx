import React from 'react';
import { ArrowLeft, RotateCcw, LinkIcon } from 'lucide-react';
import { getStatusColor, getPriorityColor } from '../../../../utils/displayHelpers';

interface TicketHeaderProps {
    ticketId: string;
    title: string;
    status: string;
    priority: string;
    breached?: boolean;
    isOverdue?: boolean;
    isMerged?: boolean;
    isTicketClosed: boolean;
    onReopen: () => void;
    onMerge: () => void;
    isSubmitting: boolean;
    isReopening?: boolean;
}

export const TicketHeader: React.FC<TicketHeaderProps> = ({
    ticketId,
    title,
    status,
    priority,
    breached,
    isOverdue,
    isMerged,
    isTicketClosed,
    onReopen,
    onMerge,
    isSubmitting,
    isReopening,
}) => {
    return (
        <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle p-6">
            {/* Back Button and Ticket ID */}
            <div className="flex items-center gap-4 mb-4">
                <button
                    onClick={() => globalThis.history.back()}
                    className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 dark:border-subtle bg-white dark:bg-surface-elevated hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
                    aria-label="Go back"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-[var(--text-muted)]" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--text-primary)]">
                        {ticketId}
                    </h1>
                </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-4">
                {title}
            </h2>

            {/* Badges and Actions */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                {/* Status and Priority Badges */}
                <div className="flex items-center flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(status)}`}>
                        {status.toUpperCase()}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(priority)}`}>
                        {priority.toUpperCase()}
                    </span>
                    {breached && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700">
                            SLA BREACHED
                        </span>
                    )}
                    {isOverdue && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700">
                            OVERDUE
                        </span>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    {isTicketClosed && (
                        <button
                            onClick={onReopen}
                            disabled={isSubmitting || isReopening}
                            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            {isReopening ? 'Reopening...' : 'Reopen Ticket'}
                        </button>
                    )}

                    {!isMerged && !isTicketClosed && (
                        <button
                            onClick={onMerge}
                            className="inline-flex items-center px-4 py-2 bg-white dark:bg-surface-elevated border border-gray-300 dark:border-subtle text-gray-700 dark:text-[var(--text-primary)] text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200"
                        >
                            <LinkIcon className="w-4 h-4 mr-2" />
                            Merge Tickets
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
