import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import http from '../../services/http';
import { APIS } from '../../services/apis';

interface Contact {
    id: number;
    name: string;
    email: string;
}

interface EmailRecipientInputProps {
    label: string;
    emails: string[];
    onChange: (emails: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * Email chip input with contact autocomplete.
 * - Type to search contacts from /contacts/?search=
 * - Press Enter/Tab/comma to add a typed email
 * - Arrow keys + Enter to select from dropdown
 * - Click X to remove a chip
 */
export const EmailRecipientInput: React.FC<EmailRecipientInputProps> = ({
    label,
    emails,
    onChange,
    placeholder = 'Enter email...',
    disabled = false,
}) => {
    const [inputValue, setInputValue] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<Contact[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const isValidEmail = (email: string): boolean => {
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailPattern.test(email.trim());
    };

    const addEmail = (email: string) => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) return;

        if (!isValidEmail(trimmed)) {
            setError('Invalid email format');
            return;
        }

        if (emails.includes(trimmed)) {
            setError('Email already added');
            return;
        }

        setError(null);
        onChange([...emails, trimmed]);
        setInputValue('');
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const selectContact = (contact: Contact) => {
        const email = contact.email.toLowerCase();
        if (!emails.includes(email)) {
            onChange([...emails, email]);
        }
        setInputValue('');
        setSuggestions([]);
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        inputRef.current?.focus();
    };

    const removeEmail = (emailToRemove: string) => {
        onChange(emails.filter((e) => e !== emailToRemove));
    };

    // Debounced contact search
    useEffect(() => {
        if (!inputValue.trim()) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await http.get(APIS.CONTACTS, { params: { search: inputValue, page_size: 5 } });
                const data: Contact[] = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                const filtered = data.filter((c) => c.email && !emails.includes(c.email.toLowerCase())).slice(0, 5);
                setSuggestions(filtered);
                setShowSuggestions(filtered.length > 0);
                setHighlightedIndex(-1);
            } catch {
                setSuggestions([]);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [inputValue]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIndex((i) => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Escape') {
                setShowSuggestions(false);
                return;
            }
            if (e.key === 'Enter' && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                e.preventDefault();
                selectContact(suggestions[highlightedIndex]);
                return;
            }
        }

        if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
            e.preventDefault();
            addEmail(inputValue);
        } else if (e.key === 'Backspace' && !inputValue && emails.length > 0) {
            removeEmail(emails[emails.length - 1]);
        }
    };

    const handleBlur = () => {
        // Delay so click on suggestion registers first
        setTimeout(() => {
            if (inputValue.trim() && !showSuggestions) {
                addEmail(inputValue);
            }
        }, 150);
    };

    return (
        <div ref={containerRef} className="relative flex items-start">
            <span className="text-[length:var(--font-meta)] font-semibold text-[var(--text-secondary)] w-16 pt-1.5 shrink-0">
                {label}:
            </span>
            <div className="flex-1">
                <div
                    className="flex flex-wrap items-center gap-1 min-h-[32px] cursor-text"
                    onClick={() => inputRef.current?.focus()}
                >
                    {emails.map((email) => (
                        <span
                            key={email}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[length:var(--font-meta)]"
                            style={{
                                backgroundColor: 'var(--surface-muted)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                            }}
                        >
                            {email}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeEmail(email);
                                    }}
                                    className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </span>
                    ))}
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            setError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        placeholder={emails.length === 0 ? placeholder : ''}
                        disabled={disabled}
                        className="flex-1 min-w-[120px] bg-transparent text-[length:var(--font-body)] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                    />
                </div>

                {/* Contact suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <div
                        className="absolute left-16 right-0 z-50 mt-1 rounded-[var(--shell-radius)] overflow-hidden shadow-[var(--shell-shadow-md)]"
                        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
                    >
                        {suggestions.map((contact, i) => (
                            <button
                                key={contact.id}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); selectContact(contact); }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                                style={{ backgroundColor: i === highlightedIndex ? 'var(--hover-bg)' : undefined }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--hover-bg)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = i === highlightedIndex ? 'var(--hover-bg)' : 'transparent')}
                            >
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: 'var(--status-info-bg)' }}
                                >
                                    <span className="text-[length:var(--font-meta)] font-semibold" style={{ color: 'var(--status-info-text)' }}>
                                        {contact.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[length:var(--font-label)] font-semibold text-[var(--text-primary)] truncate">{contact.name}</p>
                                    <p className="text-[length:var(--font-meta)] text-[var(--text-muted)] truncate">{contact.email}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {error && (
                    <span className="text-[length:var(--font-meta)] mt-0.5 block" style={{ color: 'var(--status-danger-text)' }}>
                        {error}
                    </span>
                )}
            </div>
        </div>
    );
};

export default EmailRecipientInput;
