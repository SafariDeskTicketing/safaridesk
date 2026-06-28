import React from 'react';
import { List, LayoutGrid, Grid3x3 } from 'lucide-react';

interface ViewSelectorButtonsProps {
    viewMode: 'detailed' | 'card' | 'grid';
    onViewChange: (mode: 'detailed' | 'card' | 'grid') => void;
}

/**
 * View selector with icon-only buttons for seamless view switching
 * No text labels - users learn by clicking
 */
export const ViewSelectorButtons: React.FC<ViewSelectorButtonsProps> = ({
    viewMode,
    onViewChange,
}) => {
    const baseClasses = "p-2 rounded-lg transition-all duration-200";
    const activeClasses = "bg-primary-600 text-white shadow-md";
    const inactiveClasses = "bg-gray-100 dark:bg-surface-hover text-gray-600 dark:text-[var(--text-muted)] hover:bg-gray-200 dark:hover:bg-surface-hover";

    return (
        <div className="flex items-center space-x-1 border border-gray-300 dark:border-subtle rounded-lg p-1">
            {/* Detailed View (List Icon) */}
            <button
                onClick={() => onViewChange('detailed')}
                className={`${baseClasses} ${viewMode === 'detailed' ? activeClasses : inactiveClasses}`}
                title="Detailed View"
            >
                <List size={18} />
            </button>

            {/* Card View (LayoutGrid Icon) */}
            <button
                onClick={() => onViewChange('card')}
                className={`${baseClasses} ${viewMode === 'card' ? activeClasses : inactiveClasses}`}
                title="Card View"
            >
                <LayoutGrid size={18} />
            </button>

            {/* Grid View (Grid3x3 Icon) */}
            <button
                onClick={() => onViewChange('grid')}
                className={`${baseClasses} ${viewMode === 'grid' ? activeClasses : inactiveClasses}`}
                title="Grid View"
            >
                <Grid3x3 size={18} />
            </button>
        </div>
    );
};
