import React from 'react';
import { UserCheck, Building } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { InlineSelectField, InlineSelectOption } from '../../../../components/ui/InlineSelectField';

interface Agent {
    id: number;
    name: string;
}

interface Department {
    id: number;
    name: string;
}

interface AssignmentSectionProps {
    assignedAgentId?: number | null;
    assignedAgentName?: string;
    departmentId?: number | null;
    departmentName?: string;
    agents: Agent[];
    departments: Department[];
    isSubmitting: boolean;
    onAssignAgent: (agentId: string) => Promise<void>;
    onUpdateDepartment: (departmentId: string) => Promise<void>;
    userRole?: string;
}

export const AssignmentSection: React.FC<AssignmentSectionProps> = ({
    assignedAgentId,
    assignedAgentName,
    departmentId,
    departmentName,
    agents,
    departments,
    isSubmitting,
    onAssignAgent,
    onUpdateDepartment,
    userRole,
}) => {
    const isAdminOrAgent = userRole?.toUpperCase() === 'ADMIN' || userRole?.toUpperCase() === 'AGENT';

    // Build agent options with unassign option
    const agentOptions: InlineSelectOption[] = React.useMemo(() => {
        const opts: InlineSelectOption[] = [];

        // Add unassign option if already assigned
        if (assignedAgentId) {
            opts.push({ value: 'unassign', label: '🚫 Unassign Ticket' });
        }

        // Add all agents except currently assigned
        agents
            .filter(agent => agent.id !== assignedAgentId)
            .forEach(agent => {
                opts.push({ value: agent.id.toString(), label: agent.name });
            });

        return opts;
    }, [agents, assignedAgentId]);

    // Build department options
    const departmentOptions: InlineSelectOption[] = React.useMemo(() =>
        departments.map(dept => ({
            value: dept.id.toString(),
            label: dept.name,
        })),
        [departments]
    );

    return (
        <CollapsibleSection title="Assignment" icon={<UserCheck className="w-4 h-4 text-gray-600 dark:text-[var(--text-muted)]" />}>
            {/* Assigned Agent */}
            {isAdminOrAgent ? (
                <InlineSelectField
                    label="Assigned Agent"
                    currentValue={assignedAgentId?.toString() || null}
                    currentDisplayValue={assignedAgentName || 'Unassigned'}
                    options={agentOptions}
                    onSave={onAssignAgent}
                    allowSearch
                    emptyText="Unassigned"
                    icon={<UserCheck className="w-3 h-3" />}
                />
            ) : (
                <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-[var(--text-muted)]">
                        Assigned Agent
                    </label>
                    <div className="text-sm text-gray-700 dark:text-[var(--text-primary)]">
                        {assignedAgentName || 'Unassigned'}
                    </div>
                </div>
            )}

            {/* Department */}
            <div className="pt-3 border-t border-gray-200 dark:border-subtle">
                {isAdminOrAgent ? (
                    <InlineSelectField
                        label="Department"
                        currentValue={departmentId?.toString() || null}
                        currentDisplayValue={departmentName || 'No department'}
                        options={departmentOptions}
                        onSave={onUpdateDepartment}
                        emptyText="No department"
                        icon={<Building className="w-3 h-3" />}
                    />
                ) : (
                    <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-600 dark:text-[var(--text-muted)] flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            Department
                        </label>
                        <div className="text-sm text-gray-700 dark:text-[var(--text-primary)]">
                            {departmentName || 'No department'}
                        </div>
                    </div>
                )}
            </div>
        </CollapsibleSection>
    );
};
