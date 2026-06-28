import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
    title: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
    icon?: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    title,
    defaultOpen = true,
    children,
    icon,
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-white dark:bg-surface-elevated rounded-lg border border-gray-200 dark:border-subtle">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-surface-hover-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="font-semibold text-sm text-gray-900 dark:text-[var(--text-primary)]">
                        {title}
                    </span>
                </div>
                {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 dark:text-[var(--text-muted)]" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500 dark:text-[var(--text-muted)]" />
                )}
            </button>

            {isOpen && (
                <div className="p-4 pt-0 space-y-3">
                    {children}
                </div>
            )}
        </div>
    );
};
