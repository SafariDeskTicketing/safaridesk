import React from 'react';

interface TicketLayoutProps {
    children: React.ReactNode;
}

/**
 * TicketLayout component provides the 75/25 split layout for ticket detail pages.
 * Left column (75%): Main content (header, stepper, description, tabs)
 * Right sidebar (25%): Metadata sections
 */
export const TicketLayout: React.FC<TicketLayoutProps> = ({ children }) => {
    return (
        <div className="flex gap-6 p-6 h-full">
            {children}
        </div>
    );
};

interface TicketLayoutMainProps {
    children: React.ReactNode;
}

/**
 * Main content area (left column, 75% width)
 */
export const TicketLayoutMain: React.FC<TicketLayoutMainProps> = ({ children }) => {
    return (
        <div className="flex-1 max-w-[75%] space-y-6">
            {children}
        </div>
    );
};

interface TicketLayoutSidebarProps {
    children: React.ReactNode;
}

/**
 * Right sidebar (25% width, fixed)
 */
export const TicketLayoutSidebar: React.FC<TicketLayoutSidebarProps> = ({ children }) => {
    return (
        <aside className="w-[25%] min-w-[280px] max-w-[350px] space-y-4">
            {children}
        </aside>
    );
};
