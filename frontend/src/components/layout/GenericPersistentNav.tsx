import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    ChevronRight,
    ChevronLeft,
    Menu,
    X,
    Settings,
} from 'lucide-react';

export interface ViewItem {
    name: string;
    path: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
}



interface GenericPersistentNavProps {
    viewItems: ViewItem[];
    viewCounts?: Record<string, number>;
    viewsTitle?: string;
    showSettings?: boolean;
    onSettingsClick?: () => void;
}

/**
 * Generic persistent navigation component
 * Shows only view items - main navigation is in top header
 */
export const GenericPersistentNav: React.FC<GenericPersistentNavProps> = ({
    viewItems,
    viewCounts = {},
    viewsTitle = 'Views',
    showSettings = false,
    onSettingsClick,
}) => {
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const location = useLocation();

    const getCountForView = (viewPath: string): number | undefined => {
        const viewName = new URLSearchParams(viewPath.split('?')[1]).get('view');
        return viewName ? viewCounts[viewName] : undefined;
    };

    const navContent = (
        <div className="flex h-full flex-col border-r border-[var(--border-color)] bg-[var(--sidebar-bg)]">
            {/* Header - Fixed Height */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border-color)] p-4">
                {!isCollapsed && (
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                        Views
                    </h2>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden rounded-[var(--shell-radius)] p-2 transition-colors hover:bg-[var(--shell-nav-hover-bg)] lg:block"
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {isCollapsed ? (
                        <ChevronRight className="h-5 w-5 text-[var(--text-secondary)]" />
                    ) : (
                        <ChevronLeft className="h-5 w-5 text-[var(--text-secondary)]" />
                    )}
                </button>
            </div>

            {/* Views Section - Scrollable */}
            <nav className="flex-1 overflow-y-auto p-2">
                {viewItems.length > 0 && (
                    <div className="mt-2">
                        <div className="mt-1 space-y-0.5">
                                {viewItems.map((view) => {
                                    const count = getCountForView(view.path);
                                    const isActive = location.pathname + location.search === view.path;
                                    const Icon = view.icon;

                                    return (
                                        <NavLink
                                            key={view.path}
                                            to={view.path}
                                            className={`mr-2 flex items-center gap-3 rounded-[var(--shell-radius)] px-2 py-2.5 text-sm transition-colors ${isActive
                                                ? 'bg-[var(--shell-nav-active-bg)] text-[var(--shell-nav-active-text)]'
                                                : 'text-[var(--text-secondary)] hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)]'
                                                }`}
                                        >
                                            <Icon className="w-5 h-5 flex-shrink-0" />
                                            {!isCollapsed && (
                                                <>
                                                    <span className="flex-1 truncate">{view.name}</span>
                                                    {count !== undefined && (
                                                        <span
                                                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${count > 0
                                                                ? 'bg-[var(--shell-nav-active-bg)] text-[var(--shell-nav-active-text)]'
                                                                : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
                                                                }`}
                                                        >
                                                            {count}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </NavLink>
                                    );
                                })}
                        </div>
                    </div>
                )}
            </nav>

            {showSettings && onSettingsClick && (
                <div className="sticky bottom-0 border-t border-[var(--border-color)] bg-[var(--sidebar-bg)] p-2" style={{ paddingBottom: '12px' }}>
                    <button
                        onClick={onSettingsClick}
                        className="flex w-full items-center gap-3 rounded-[var(--shell-radius)] px-2 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)]"
                    >
                        <Settings className="w-5 h-5 flex-shrink-0" />
                        {!isCollapsed && <span>Settings</span>}
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="fixed left-4 top-4 z-50 rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white p-2 shadow-[var(--shell-shadow-sm)] lg:hidden"
                aria-label="Toggle navigation menu"
            >
                {isMobileOpen ? (
                    <X className="h-6 w-6 text-[var(--text-secondary)]" />
                ) : (
                    <Menu className="h-6 w-6 text-[var(--text-secondary)]" />
                )}
            </button>

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 dark:bg-[var(--overlay-bg)] z-40 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:sticky top-0 left-0 h-screen z-40 transition-all duration-300
                    ${isCollapsed ? 'w-16' : 'w-64'}
                    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
            >
                {navContent}
            </aside>
        </>
    );
};
