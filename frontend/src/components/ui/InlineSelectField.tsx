import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from '../icons/AppIcons';
import { Loader, AlertCircle, Check } from 'lucide-react';

export interface InlineSelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface InlineSelectFieldProps {
    label: string;
    currentValue: string | null;
    currentDisplayValue: string;
    options: InlineSelectOption[];
    onSave: (newValue: string) => Promise<void>;
    isDisabled?: boolean;
    placeholder?: string;
    emptyText?: string;
    size?: 'sm' | 'md';
    variant?: 'default' | 'badge';
    allowSearch?: boolean;
    icon?: React.ReactNode;
    className?: string;
}

/**
 * InlineSelectField - Chatwoot-style inline editable dropdown
 * 
 * Features:
 * - Click current value to open dropdown
 * - Select new value to auto-save
 * - Loading state during save
 * - Error handling
 * - Keyboard navigation
 * - Search for long lists
 */
export const InlineSelectField: React.FC<InlineSelectFieldProps> = ({
    label,
    currentValue,
    currentDisplayValue,
    options,
    onSave,
    isDisabled = false,
    placeholder = 'Select...',
    emptyText = 'Not set',
    size = 'sm',
    variant = 'default',
    allowSearch = false,
    icon,
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Filter options based on search
    const filteredOptions = allowSearch && searchQuery
        ? options.filter(opt =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : options;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                !buttonRef.current?.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && allowSearch && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen, allowSearch]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setHighlightedIndex(prev =>
                        prev < filteredOptions.length - 1 ? prev + 1 : prev
                    );
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
                        handleSelect(filteredOptions[highlightedIndex].value);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    setIsOpen(false);
                    setSearchQuery('');
                    break;
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, highlightedIndex, filteredOptions]);

    const handleSelect = async (newValue: string) => {
        if (newValue === currentValue) {
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await onSave(newValue);
            setIsOpen(false);
            setSearchQuery('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update');
            // Keep dropdown open on error
        } finally {
            setIsLoading(false);
        }
    };

    const toggleDropdown = () => {
        if (!isDisabled && !isLoading) {
            setIsOpen(!isOpen);
            setError(null);
            setHighlightedIndex(0);
        }
    };

    const displayValue = currentDisplayValue || emptyText;
    const hasValue = currentValue !== null && currentValue !== '';

    // Size classes
    const sizeClasses = {
        sm: 'h-[32px] px-3 text-[14px]',
        md: 'h-[34px] px-3 text-[14px]',
    };

    // Variant classes
    const getVariantClasses = () => {
        if (variant === 'badge') {
            // For status/priority - keep colored badge styling
            return 'font-semibold border-2';
        }
        return 'bg-white dark:bg-surface-elevated border border-[var(--border-color)] dark:border-subtle shadow-[0_1px_2px_rgba(16,24,40,0.04)]';
    };

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Label */}
            <label className="flex items-center gap-2 text-[14px] font-medium text-[var(--text-secondary)] dark:text-[var(--text-primary)]">
                {icon}
                {label}
            </label>

            {/* Current Value Button (Clickable) */}
            <div className="relative">
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={toggleDropdown}
                    disabled={isDisabled || isLoading}
                    className={`
                        w-full rounded-lg transition-all duration-200
                        ${sizeClasses[size]}
                        ${getVariantClasses()}
                        ${isDisabled
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:border-[#D7E0D7] cursor-pointer'
                        }
                        ${isOpen ? 'ring-2 ring-primary-500/10 border-primary-500' : ''}
                        ${error ? 'border-red-500 dark:border-red-500' : ''}
                        flex items-center justify-between
                        text-[var(--text-primary)]
                    `}
                >
                    <span className={!hasValue ? 'text-gray-500 dark:text-[var(--text-primary)]' : ''}>
                        {displayValue}
                    </span>

                    {isLoading ? (
                        <Loader className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
                    ) : (
                        <ChevronDown
                            size={14}
                            stroke={1.8}
                            className={`text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''
                                }`}
                        />
                    )}
                </button>

                {/* Dropdown */}
                {isOpen && (
                    <div
                        ref={dropdownRef}
                        className="absolute z-50 mt-2 w-full max-h-64 overflow-hidden rounded-[8px] border border-[var(--border-color)] bg-white shadow-[0_12px_24px_rgba(16,24,40,0.08)] dark:border-subtle dark:bg-surface-elevated dark:shadow-xl"
                    >
                        {/* Search Input */}
                        {allowSearch && (
                            <div className="p-2 border-b border-[var(--border-color)] dark:border-subtle">
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setHighlightedIndex(0);
                                    }}
                                    placeholder="Search..."
                                    className="h-[32px] w-full rounded-[8px] border border-[var(--border-color)] bg-white px-3 text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/10 dark:border-subtle dark:bg-surface-elevated dark:text-[var(--text-primary)]"
                                />
                            </div>
                        )}

                        {/* Options List */}
                        <div className="overflow-y-auto max-h-52">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((option, index) => {
                                    const isSelected = option.value === currentValue;
                                    const isHighlighted = index === highlightedIndex;

                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => !option.disabled && handleSelect(option.value)}
                                            disabled={option.disabled}
                                            className={`
                                                w-full px-3 py-2 text-left text-[14px] transition-colors
                                                flex items-center justify-between
                                                ${option.disabled
                                                    ? 'opacity-50 cursor-not-allowed'
                                                    : 'cursor-pointer'
                                                }
                                                ${isSelected
                                                    ? 'bg-[var(--shell-nav-active-bg)] text-[var(--shell-nav-active-text)] font-medium'
                                                    : isHighlighted
                                                        ? 'bg-[var(--shell-nav-hover-bg)] text-[var(--text-primary)] dark:bg-surface-hover dark:text-[var(--text-primary)]'
                                                        : 'text-[var(--text-secondary)] hover:bg-[var(--shell-nav-hover-bg)] dark:text-[var(--text-primary)] dark:hover:bg-surface-hover'
                                                }
                                            `}
                                            onMouseEnter={() => setHighlightedIndex(index)}
                                        >
                                            <span>{option.label}</span>
                                            {isSelected && (
                                                <Check className="h-4 w-4 text-[var(--shell-nav-active-text)]" />
                                            )}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="px-3 py-8 text-center text-sm text-gray-500 dark:text-[var(--text-primary)]">
                                    No options found
                                </div>
                            )}
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
                                <div className="flex items-center gap-2 text-[14px] text-red-700 dark:text-red-400">
                                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
