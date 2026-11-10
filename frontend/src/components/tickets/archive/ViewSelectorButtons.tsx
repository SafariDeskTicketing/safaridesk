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
    // Inactive hover uses --border-color (not --hover-bg, which is the inactive base) so hover is visible in both modes
    const inactiveClasses = "bg-[var(--hover-bg)] text-[var(--text-secondary)] hover:bg-[var(--border-color)]";

    return (
        <div className="flex items-center space-x-1 border border-[var(--border-color)] rounded-lg p-1">
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
