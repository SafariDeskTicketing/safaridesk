import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Layout specifically for task-related pages
 * Shows GenericPersistentNav with task-specific views and counts
 */
export const TaskPageLayout: React.FC = () => {
    return (
        <div className="flex h-full min-h-0 w-full justify-center overflow-auto px-[var(--shell-page-padding)] py-4 sm:py-5">
            <main className="sd-route-shell flex min-h-0 w-full max-w-[var(--shell-content-max-width)] flex-1 overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
};
