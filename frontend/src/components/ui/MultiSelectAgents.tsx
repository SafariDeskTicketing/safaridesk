import React, { useId, useState } from 'react';
import { FloatingPortal } from '@floating-ui/react';
import { ChevronDown, Search } from '../icons/AppIcons';
import type { AgentType } from '../../types/agents';
import { useAnchoredFloating } from './useAnchoredFloating';

interface MultiSelectAgentsProps {
  agents: AgentType[];
  selectedAgents: number[];
  onChange: (selected: number[]) => void;
  label: string;
  placeholder?: string;
}

const MultiSelectAgents: React.FC<MultiSelectAgentsProps> = ({
  agents,
  selectedAgents,
  onChange,
  label,
  placeholder = "Select agents...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const baseId = useId();
  const buttonId = `${baseId}-button`;
  const panelId = `${baseId}-panel`;

  const close = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  const { refs, floatingStyles, getReferenceProps, getFloatingProps } = useAnchoredFloating({
    open: isOpen,
    onOpenChange: (nextOpen) => {
      if (!nextOpen) close();
    },
    placement: 'bottom-start',
    gap: 4,
  });

  const handleAgentToggle = (agentId: number) => {
    const newSelection = selectedAgents.includes(agentId)
      ? selectedAgents.filter((id) => id !== agentId)
      : [...selectedAgents, agentId];
    onChange(newSelection);
  };

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedAgentNames = selectedAgents
    .map((id) => agents.find((agent) => agent.id === id)?.name)
    .filter(Boolean) as string[];

  return (
    <div className="relative">
      <label
        htmlFor={buttonId}
        className="mb-1.5 block text-[14px] font-medium text-[var(--text-secondary)]"
      >
        {label}
      </label>
      <button
        id={buttonId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        className="flex h-[40px] w-full items-center justify-between rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3.5 text-left text-[14px] text-[var(--text-primary)] shadow-[var(--shell-shadow-sm)] cursor-pointer transition-colors duration-200 hover:border-[var(--shell-search-border)] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
        {...getReferenceProps({
          ref: refs.setReference,
          onClick: () => (isOpen ? close() : setIsOpen(true)),
        })}
      >
        <span className={`min-w-0 truncate ${selectedAgentNames.length > 0 ? '' : 'text-[var(--text-muted)]'}`}>
          {selectedAgentNames.length > 0 ? selectedAgentNames.join(', ') : placeholder}
        </span>
        <ChevronDown
          size={16}
          stroke={1.8}
          className={`ml-2 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <FloatingPortal>
          <div
            id={panelId}
            ref={refs.setFloating}
            style={floatingStyles}
            aria-label={label}
            className="w-72 rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] shadow-[var(--shell-shadow-md)]"
            {...getFloatingProps({
              role: 'dialog',
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === 'Escape') {
                  // Close only this picker, not an enclosing Modal listening on document.
                  event.stopPropagation();
                  close();
                  document.getElementById(buttonId)?.focus();
                }
              },
            })}
          >
            <div className="relative border-b border-[var(--border-color)] p-2">
              <input
                type="text"
                aria-label="Search agents"
                className="h-[38px] w-full rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--shell-field-bg)] px-3 pl-8 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              <Search size={16} stroke={1.8} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            </div>
            <div role="group" aria-label={label} className="max-h-56 overflow-auto py-1 text-[14px]">
              {filteredAgents.length === 0 ? (
                <p className="px-3.5 py-2.5 text-[var(--text-muted)]">No agents found.</p>
              ) : (
                filteredAgents.map((agent) => (
                  <label
                    key={agent.id}
                    className="flex min-h-[44px] cursor-pointer select-none items-center px-3.5 py-2.5 text-[var(--text-primary)] hover:bg-[var(--shell-nav-hover-bg)]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAgents.includes(agent.id)}
                      onChange={() => handleAgentToggle(agent.id)}
                      className="form-checkbox h-4 w-4 shrink-0 text-primary-600"
                    />
                    <span className="ml-3 block truncate">{agent.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
};

export default MultiSelectAgents;
