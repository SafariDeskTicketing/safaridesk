import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import type { AgentType } from '../../types/agents';

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
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties | null>(null);

  const handleToggle = () => setIsOpen(!isOpen);

  // Position the dropdown in a portal to avoid layout shifts
  useEffect(() => {
    if (!isOpen) {
      setDropdownStyle(null);
      return;
    }

    const updatePosition = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      // Use fixed positioning so the dropdown sits above transformed/stacked parents (modals)
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      let left = rect.left;
      const width = 288; // w-72
      // Clamp to viewport to avoid overflow
      if (left + width > vw - 8) {
        left = Math.max(8, vw - width - 8);
      }
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: left,
        width: width,
        zIndex: 99999,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && dropdownRef.current.contains(target)
      ) {
        return;
      }
      if (buttonRef.current && buttonRef.current.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutside);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [isOpen]);

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
    <div className="relative overflow-visible">
      <label className="block text-[14px] font-medium text-gray-700 dark:text-[var(--text-primary)] mb-1">
        {label}
      </label>
      <button
        type="button"
        ref={buttonRef}
        className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3.5 py-2.5 text-left text-[14px] text-gray-900 shadow-sm cursor-pointer focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-subtle dark:bg-surface-elevated dark:text-[var(--text-primary)]"
        onClick={handleToggle}
      >
        <span className="block truncate text-gray-900 dark:text-[var(--text-primary)]">
          {selectedAgentNames.length > 0
            ? selectedAgentNames.join(', ')
            : placeholder}
        </span>
        <svg
          className="-mr-1 ml-2 h-5 w-5 text-gray-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && dropdownStyle && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-white dark:bg-surface-elevated shadow-lg rounded-md ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
        >
          <div className="p-2">
            <input
              type="text"
              className="block w-full rounded-md border border-gray-300 bg-white px-3.5 py-2.5 text-[14px] shadow-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-primary-500 dark:border-subtle dark:bg-surface-hover"
              placeholder="Search agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          <ul
            tabIndex={-1}
            role="listbox"
            aria-labelledby="listbox-label"
            className="max-h-56 overflow-auto rounded-b-md py-1 text-[14px] ring-1 ring-black ring-opacity-5 focus:outline-none border-t-0"
            style={{ marginBottom: 4 }}
          >
            {filteredAgents.length === 0 ? (
              <li className="relative py-2.5 pl-3.5 pr-9 text-gray-900 dark:text-[var(--text-primary)]">
                No agents found.
              </li>
            ) : (
              filteredAgents.map((agent) => (
                <li
                  key={agent.id}
                  className="relative cursor-default select-none py-2.5 pl-3.5 pr-9 text-gray-900 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover"
                  onClick={() => handleAgentToggle(agent.id)}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      readOnly
                      checked={selectedAgents.includes(agent.id)}
                      className="form-checkbox h-4 w-4 text-primary-600 transition duration-150 ease-in-out"
                    />
                    <span className="ml-3 block truncate font-normal">
                      {agent.name}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MultiSelectAgents;
