import React from 'react';
import { ContactCard } from './ContactCard';
import { AssignmentSection } from './AssignmentSection';
import { PropertiesSection } from './PropertiesSection';
import { LabelsSection } from './LabelsSection';
import { WatchersSection } from './WatchersSection';
import { TicketInfoSection } from './TicketInfoSection';
import type { TicketData } from '../../../../types';
import { AgentType } from '../../../../types/agents';

interface Agent {
    id: number;
    name: string;
    department?: Array<{ id: number; name: string }>;
}

interface Department {
    id: number;
    name: string;
}

interface Category {
    id: number;
    name: string;
    department?: number | null;
}

interface Watcher {
    id: number;
    name: string;
    email: string;
    avatar_url: string | null;
}

interface RightSidebarProps {
    ticketData: TicketData;
    agents: Agent[];
    departments: Department[];
    categories: Category[];
    ticketTags: string[];
    ticketWatchers: Watcher[];
    agentsData: AgentType[];

    // State for status modal (still needed)
    selectedStatus: string;
    setSelectedStatus: (status: string) => void;
    statusDescription: string;
    setStatusDescription: (desc: string) => void;
    newTagInput: string;
    setNewTagInput: (input: string) => void;
    selectedWatchers: number[];
    setSelectedWatchers: (watchers: number[]) => void;

    // Handlers (now async for inline editing)
    onAssignAgent: (agentId: string) => Promise<void>;
    onUpdateDepartment: (departmentId: string) => Promise<void>;
    onUpdateCategory: (categoryId: string) => Promise<void>;
    onUpdatePriority: (priority: string) => Promise<void>;
    onUpdateStatus: () => void;
    onAddTags: () => void;
    onAddWatchers: () => void;

    // UI State
    isSubmitting: boolean;
    userRole?: string;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
    ticketData,
    agents,
    departments,
    categories,
    ticketTags,
    ticketWatchers,
    agentsData,
    selectedStatus,
    setSelectedStatus,
    statusDescription,
    setStatusDescription,
    newTagInput,
    setNewTagInput,
    selectedWatchers,
    setSelectedWatchers,
    onAssignAgent,
    onUpdateDepartment,
    onUpdateCategory,
    onUpdatePriority,
    onUpdateStatus,
    onAddTags,
    onAddWatchers,
    isSubmitting,
    userRole,
}) => {
    const { ticket } = ticketData;
    const ticketDepartmentId =
        typeof ticket.department === 'number' ? ticket.department : ticket.department?.id;

    const filteredCategories = React.useMemo(() => {
        if (!ticketDepartmentId) return categories;
        return categories.filter(
            (cat) => cat.department == null || cat.department === ticketDepartmentId
        );
    }, [categories, ticketDepartmentId]);

    return (
        <div className="space-y-4">
            {/* Contact Card */}
            <ContactCard
                creatorName={ticket.creator_name}
                creatorEmail={ticket.creator_email}
                creatorPhone={ticket.creator_phone}
                source={ticket.source}
                avatarUrl={null}
            />

            {/* Assignment Section */}
            <AssignmentSection
                assignedAgentId={ticket.assigned_to?.id}
                assignedAgentName={ticket.assigned_to?.name}
                departmentId={typeof ticket.department === 'number' ? ticket.department : ticket.department?.id}
                departmentName={typeof ticket.department === 'number' ? undefined : ticket.department?.name}
                agents={agents}
                departments={departments}
                isSubmitting={isSubmitting}
                onAssignAgent={onAssignAgent}
                onUpdateDepartment={onUpdateDepartment}
                userRole={userRole}
            />

            {/* Properties Section */}
            <PropertiesSection
                priority={ticket.priority}
                category={ticket.category}
                status={ticket.status}
                source={ticket.source}
                categories={filteredCategories}
                assignedTo={ticket.assigned_to}
                isSubmitting={isSubmitting}
                onUpdatePriority={onUpdatePriority}
                onUpdateCategory={onUpdateCategory}
                onUpdateStatus={onUpdateStatus}
                selectedStatus={selectedStatus}
                setSelectedStatus={setSelectedStatus}
                statusDescription={statusDescription}
                setStatusDescription={setStatusDescription}
                userRole={userRole}
            />

            {/* Labels Section */}
            <LabelsSection
                tags={ticketTags}
                newTagInput={newTagInput}
                setNewTagInput={setNewTagInput}
                onAddTags={onAddTags}
                isSubmitting={isSubmitting}
                userRole={userRole}
            />

            {/* Watchers Section */}
            <WatchersSection
                watchers={ticketWatchers}
                agents={agentsData}
                selectedWatchers={selectedWatchers}
                setSelectedWatchers={setSelectedWatchers}
                onAddWatchers={onAddWatchers}
                isSubmitting={isSubmitting}
                userRole={userRole}
            />

            {/* Ticket Information Section (Collapsed by default) */}
            <TicketInfoSection
                createdAt={ticket.created_at}
                browser={ticket.browser}
                language={ticket.language}
                ipAddress={ticket.ip_address}
                userAgent={ticket.user_agent}
            />
        </div>
    );
};
