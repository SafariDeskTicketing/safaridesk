import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, LayoutGrid, LayoutList } from 'lucide-react';

export type TicketListViewMode = 'card' | 'list';

interface ViewModeDropdownProps {
    viewMode: TicketListViewMode;
    onViewChange: (mode: TicketListViewMode) => void;
}

const viewModeConfig = {
    card: { label: 'Card View', icon: LayoutGrid },
    list: { label: 'List View', icon: LayoutList },
};

export const ViewModeDropdown: React.FC<ViewModeDropdownProps> = ({
    viewMode,
    onViewChange,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const currentConfig = viewModeConfig[viewMode];
    const CurrentIcon = currentConfig.icon;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex h-[36px] w-[164px] items-center justify-between rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white px-3 text-[14px] font-medium text-[var(--text-primary)] shadow-[var(--shell-shadow-sm)] transition-colors hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)] dark:bg-[var(--card-bg)]"
            >
                <span className="flex min-w-0 items-center gap-2">
                    <CurrentIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{currentConfig.label}</span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-[164px] overflow-hidden rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-white shadow-[var(--shell-shadow-md)] z-50 dark:bg-[var(--card-bg)]">
                    {(Object.keys(viewModeConfig) as Array<keyof typeof viewModeConfig>).map((mode) => {
                        const config = viewModeConfig[mode];
                        if (!config) return null; // Safety check for undefined config
                        const Icon = config.icon;
                        const isSelected = viewMode === mode;

                        return (
                            <button
                                key={mode}
                                onClick={() => {
                                    onViewChange(mode);
                                    setIsOpen(false);
                                }}
                                className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-[14px] transition-colors ${isSelected
                                        ? 'bg-[var(--shell-nav-active-bg)] text-[var(--shell-nav-active-text)] font-medium'
                                        : 'text-[var(--text-primary)] hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)]'
                                    }`}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span>{config.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
