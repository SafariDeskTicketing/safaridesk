import React, { useState } from 'react';
import { List, Tag, AlertCircle } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { InlineSelectField, InlineSelectOption } from '../../../../components/ui/InlineSelectField';
import { getStatusColor, getPriorityColor } from '../../../../utils/displayHelpers';
import { Modal } from '../../../../components/ui/Modal';
import { DynamicStepper } from '../../../../components/ui/Stepper';

interface Category {
    id: number;
    name: string;
    department?: number | null;
}

interface PropertiesSectionProps {
    priority: string;
    category?: { id: number; name: string } | null;
    status: string;
    source?: string;
    categories: Category[];
    assignedTo?: { id: number; name: string } | null;
    isSubmitting: boolean;
    onUpdatePriority: (priority: string) => Promise<void>;
    onUpdateCategory: (categoryId: string) => Promise<void>;
    onUpdateStatus: () => void;
    selectedStatus: string;
    setSelectedStatus: (status: string) => void;
    statusDescription: string;
    setStatusDescription: (desc: string) => void;
    userRole?: string;
}

export const PropertiesSection: React.FC<PropertiesSectionProps> = ({
    priority,
    category,
    status,
    source,
    categories,
    assignedTo,
    isSubmitting,
    onUpdatePriority,
    onUpdateCategory,
    onUpdateStatus,
    selectedStatus,
    setSelectedStatus,
    statusDescription,
    setStatusDescription,
    userRole,
}) => {
    const [showStatusModal, setShowStatusModal] = useState(false);

    const isAdminOrAgent = userRole?.toUpperCase() === 'ADMIN' || userRole?.toUpperCase() === 'AGENT';

    // Priority options
    const priorityOptions: InlineSelectOption[] = [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' },
    ];

    // Category options
    const categoryOptions: InlineSelectOption[] = categories.map(cat => ({
        value: cat.id.toString(),
        label: cat.name,
    }));

    const handleUpdateStatus = () => {
        onUpdateStatus();
        setShowStatusModal(false);
    };

    // Custom render for priority to show colored badge
    const getPriorityDisplay = (priorityValue: string) => {
        return (
            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold border-2 ${getPriorityColor(priorityValue)}`}>
                {priorityValue.toUpperCase()}
            </span>
        );
    };

    return (
        <>
            <CollapsibleSection title="Properties" icon={<List className="w-4 h-4 text-gray-600 dark:text-[var(--text-muted)]" />}>
                {/* Priority */}
                {isAdminOrAgent ? (
                    <InlineSelectField
                        label="Priority"
                        currentValue={priority}
                        currentDisplayValue={priority.toUpperCase()}
                        options={priorityOptions}
                        onSave={onUpdatePriority}
                        variant="badge"
                        icon={<AlertCircle className="w-3 h-3 text-gray-600 dark:text-[var(--text-muted)]" />}
                        className="priority-field"
                    />
                ) : (
                    <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-600 dark:text-[var(--text-muted)] flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Priority
                        </label>
                        <div className={`px-3 py-2 rounded-lg text-sm font-semibold border ${getPriorityColor(priority)}`}>
                            {priority.toUpperCase()}
                        </div>
                    </div>
                )}

                {/* Category */}
                <div className="pt-3 border-t border-gray-200 dark:border-subtle">
                    {isAdminOrAgent ? (
                        <InlineSelectField
                            label="Category"
                            currentValue={category?.id.toString() || null}
                            currentDisplayValue={category?.name || 'No category'}
                            options={categoryOptions}
                            onSave={onUpdateCategory}
                            emptyText="No category"
                            icon={<Tag className="w-3 h-3 text-gray-600 dark:text-[var(--text-muted)]" />}
                        />
                    ) : (
                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-gray-600 dark:text-[var(--text-muted)] flex items-center gap-1">
                                <Tag className="w-3 h-3" />
                                Category
                            </label>
                            <div className="text-sm text-gray-700 dark:text-[var(--text-primary)]">
                                {category?.name || 'No category'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Status - Clickable Badge (Keep as-is) */}
                <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-subtle">
                    <label className="block text-xs font-medium text-gray-600 dark:text-[var(--text-muted)]">
                        Status
                    </label>
                    <button
                        onClick={() => isAdminOrAgent && setShowStatusModal(true)}
                        disabled={!isAdminOrAgent}
                        className={`w-full px-3 py-2 rounded-lg text-sm font-semibold border ${getStatusColor(status)} ${isAdminOrAgent ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                            } transition-opacity`}
                    >
                        {status.toUpperCase()}
                    </button>
                    {isAdminOrAgent && (
                        <p className="text-xs text-gray-500 dark:text-[var(--text-muted)] text-center">
                            Click to update status
                        </p>
                    )}
                </div>

                {/* Source - Read Only */}
                <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-subtle">
                    <label className="block text-xs font-medium text-gray-600 dark:text-[var(--text-muted)]">
                        Source
                    </label>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-surface-hover rounded-lg text-sm text-gray-900 dark:text-[var(--text-primary)]">
                        {source ? source.toUpperCase() : 'WEB'}
                    </div>
                </div>
            </CollapsibleSection>

            {/* Status Update Modal */}
            {showStatusModal && (
                <Modal
                    isOpen={showStatusModal}
                    onClose={() => setShowStatusModal(false)}
                    title="Update Ticket Status"
                >
                    <div className="p-4 space-y-4">
                        <DynamicStepper
                            status={status}
                            assignedTo={assignedTo}
                            onStatusChange={(newStatus) => {
                                setSelectedStatus(newStatus);
                                setStatusDescription('');
                            }}
                        />

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-[var(--text-primary)]">
                                Status Notes (optional)
                            </label>
                            <textarea
                                value={statusDescription}
                                onChange={(e) => setStatusDescription(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-surface-hover dark:text-white"
                                placeholder="Add notes about this status change..."
                            />
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setShowStatusModal(false)}
                                className="px-4 py-2 border border-gray-300 dark:border-subtle rounded-lg text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateStatus}
                                disabled={isSubmitting || !selectedStatus || selectedStatus === status}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                            >
                                {isSubmitting ? 'Updating...' : 'Update Status'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};
