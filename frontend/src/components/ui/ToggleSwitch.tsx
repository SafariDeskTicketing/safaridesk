import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
}) => {
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={onChange}
        disabled={disabled}
        className={`
          inline-flex h-6 w-11 items-center justify-center [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-label={label}
      >
        <span
          className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors"
          style={checked
            ? {
                backgroundColor: 'hsl(var(--primary-600-hsl))',
                borderColor: 'hsl(var(--primary-700-hsl))',
                boxShadow: 'inset 0 0 0 1px hsl(var(--primary-400-hsl) / 0.35)',
              }
            : {
                backgroundColor: 'var(--surface-muted)',
                borderColor: 'var(--border-color)',
              }}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.35)] transition-transform
              ${checked ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </span>
      </button>
    </div>
  );
};

export default ToggleSwitch;
