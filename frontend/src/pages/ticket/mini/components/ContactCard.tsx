import React from 'react';
import { User, Mail, Phone, MessageSquare } from 'lucide-react';
import { getSourceLabel, getSourceIcon as getSourceIconHelper } from '../../../../utils/displayHelpers';

interface ContactCardProps {
    creatorName: string;
    creatorEmail: string;
    creatorPhone?: string;
    source?: string;
    avatarUrl?: string | null;
}

export const ContactCard: React.FC<ContactCardProps> = ({
    creatorName,
    creatorEmail,
    creatorPhone,
    source,
    avatarUrl,
}) => {
    const SourceIcon = getSourceIconHelper(source);
    const sourceLabel = getSourceLabel(source);

    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            {/* Avatar */}
            <div className="flex justify-center mb-3">
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={creatorName}
                        className="w-16 h-16 rounded-full border-2 border-blue-300 dark:border-blue-700"
                    />
                ) : (
                    <div className="w-16 h-16 bg-blue-200 dark:bg-blue-800 rounded-full flex items-center justify-center border-2 border-blue-300 dark:border-blue-700">
                        <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                )}
            </div>

            {/* Name */}
            <h3 className="text-center text-lg font-semibold text-gray-900 dark:text-[var(--text-primary)] mb-3">
                {creatorName}
            </h3>

            {/* Contact Details */}
            <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-700 dark:text-[var(--text-primary)]">
                    <Mail className="w-4 h-4 mr-2 text-gray-500 dark:text-[var(--text-muted)] flex-shrink-0" />
                    <span className="truncate">{creatorEmail}</span>
                </div>

                {creatorPhone && (
                    <div className="flex items-center text-sm text-gray-700 dark:text-[var(--text-primary)]">
                        <Phone className="w-4 h-4 mr-2 text-gray-500 dark:text-[var(--text-muted)] flex-shrink-0" />
                        <span>{creatorPhone}</span>
                    </div>
                )}

                <div className="flex items-center text-sm text-gray-700 dark:text-[var(--text-primary)]">
                    {React.createElement(SourceIcon, {
                        className: 'w-4 h-4 mr-2 text-gray-500 dark:text-[var(--text-muted)] flex-shrink-0',
                    })}
                    <span>{sourceLabel}</span>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-blue-200 dark:border-blue-700">
                <button
                    className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 transition-colors"
                    title="Send Email"
                >
                    <Mail className="w-4 h-4" />
                </button>
                <button
                    className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 transition-colors"
                    title="Call"
                >
                    <Phone className="w-4 h-4" />
                </button>
                <button
                    className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 transition-colors"
                    title="Chat"
                >
                    <MessageSquare className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
