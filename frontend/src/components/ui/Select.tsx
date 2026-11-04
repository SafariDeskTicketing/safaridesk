import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { FloatingPortal } from '@floating-ui/react'
import { ChevronDown, Search } from '../icons/AppIcons'
import { useAnchoredFloating } from './useAnchoredFloating'

interface Option {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  id?: string
  label?: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  allowSearch?: boolean
  disabled?: boolean
  required?: boolean
  error?: string

  size?: 'sm' | 'md' | 'lg'
  /** Preferred side; the list still flips if there isn't room. */
  direction?: 'down' | 'up'
  className?: string
  labelClassName?: string
}

const sizeClasses = {
  sm: 'h-[38px] px-3 text-[14px]',
  md: 'h-[40px] px-3.5 text-[14px]',
  lg: 'h-[44px] px-4 text-[14px]'
}

/** Next enabled index from `start` moving by `step`, wrapping; -1 if none are enabled. */
function nextEnabledIndex(options: Option[], start: number, step: 1 | -1): number {
  for (let i = 1; i <= options.length; i++) {
    const index = (start + step * i + options.length) % options.length
    if (!options[index].disabled) return index
  }
  return -1
}

const Select: React.FC<SelectProps> = ({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Choose an option...",
  allowSearch = false,
  disabled = false,
  required = false,
  error,
  size = 'md',
  direction = 'down',
  className = '',
  labelClassName = ''
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

  const fallbackId = useId()
  const listboxId = `${id ?? fallbackId}-listbox`
  const optionId = (index: number) => `${listboxId}-option-${index}`

  const safeOptions = options || []
  const filteredOptions = safeOptions.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const selectedOption = safeOptions.find(option => option.value === value)

  const close = ({ restoreFocus }: { restoreFocus: boolean }) => {
    setIsOpen(false)
    setSearchTerm('')
    setHighlightedIndex(-1)
    if (restoreFocus) buttonRef.current?.focus()
  }

  const open = () => {
    if (disabled) return
    const selectedIndex = safeOptions.findIndex(option => option.value === value && !option.disabled)
    setSearchTerm('')
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : nextEnabledIndex(safeOptions, -1, 1))
    setIsOpen(true)
  }

  const { refs, floatingStyles, getReferenceProps, getFloatingProps } = useAnchoredFloating({
    open: isOpen,
    onOpenChange: (nextOpen) => {
      // useDismiss only ever closes (outside press / Escape); opening is handled by `open()`.
      if (!nextOpen) close({ restoreFocus: false })
    },
    placement: direction === 'up' ? 'top-start' : 'bottom-start',
    matchAnchorWidth: true,
    maxHeight: 240,
  })

  // FloatingPortal mounts its children a render after `isOpen` flips, so an effect keyed on
  // `isOpen` runs before the input exists. Focus it when it actually mounts instead.
  const searchInputRef = useCallback((node: HTMLInputElement | null) => {
    node?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (highlightedIndex >= 0) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex])

  const handleOptionSelect = (option: Option) => {
    if (option.disabled) return
    onChange(option.value)
    close({ restoreFocus: true })
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        open()
      }
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setHighlightedIndex(prev => nextEnabledIndex(filteredOptions, prev, 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setHighlightedIndex(prev => nextEnabledIndex(filteredOptions, prev < 0 ? 0 : prev, -1))
        break
      case 'Enter': {
        const option = filteredOptions[highlightedIndex]
        if (option) {
          event.preventDefault()
          handleOptionSelect(option)
        }
        break
      }
      case 'Escape':
        // Close only this select, not an enclosing Modal listening on document.
        event.preventDefault()
        event.stopPropagation()
        close({ restoreFocus: true })
        break
      case 'Tab':
        close({ restoreFocus: false })
        break
    }
  }

  const activeDescendant = isOpen && highlightedIndex >= 0 ? optionId(highlightedIndex) : undefined

  return (
    <div className={`relative ${className}`}>
      {/* Label */}
      {label && (
        <label
          htmlFor={id}
          className={`mb-1.5 block text-[14px] font-medium text-[var(--text-secondary)] ${labelClassName}`}
        >
          {label}
          {required && <span className="ml-1 text-[var(--text-primary)]">*</span>}
        </label>
      )}

      {/* Select Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        className={`
          w-full ${sizeClasses[size]} rounded-[var(--shell-radius)] border shadow-[var(--shell-shadow-sm)]
          focus:outline-none focus:ring-2
          flex items-center justify-between
          transition-colors duration-200
          ${error
            ? 'border-[var(--status-danger-text)] text-[var(--status-danger-text)] focus:border-[var(--status-danger-text)] focus:ring-[rgba(224,82,69,0.14)]'
            : 'border-[var(--border-color)] bg-[var(--shell-field-bg)] text-[var(--text-primary)] hover:border-[var(--shell-search-border)] focus:border-primary-500 focus:ring-[var(--focus-ring)]'
          }
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={allowSearch ? undefined : activeDescendant}
        {...getReferenceProps({
          ref: (node: HTMLButtonElement | null) => {
            buttonRef.current = node
            refs.setReference(node)
          },
          onClick: () => (isOpen ? close({ restoreFocus: false }) : open()),
          onKeyDown: handleKeyDown,
        })}
      >
        <span className={`min-w-0 truncate text-left ${selectedOption ? '' : 'text-[var(--text-muted)]'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          stroke={1.8}
          className={`text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="overflow-auto rounded-[var(--shell-radius)] border border-[var(--border-color)] bg-[var(--card-bg)] shadow-[var(--shell-shadow-md)]"
            {...getFloatingProps()}
          >
            {/* Search Input */}
            {allowSearch && (
              <div className="relative border-b border-[var(--border-color)] p-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search options..."
                  aria-label="Search options"
                  aria-controls={listboxId}
                  aria-activedescendant={activeDescendant}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setHighlightedIndex(-1)
                  }}
                  onKeyDown={handleKeyDown}
                  className={`
                    h-[38px] w-full rounded-[var(--shell-radius)] border px-3 pl-8 text-[14px]
                    focus:outline-none focus:ring-2
                    border-[var(--border-color)] bg-[var(--shell-field-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-primary-500 focus:ring-[var(--focus-ring)]
                  `}
                />
                <Search size={16} stroke={1.8} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              </div>
            )}

            {/* Options */}
            <div role="listbox" id={listboxId} aria-labelledby={id}>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => (
                  <button
                    key={option.value}
                    id={optionId(index)}
                    ref={(node) => { optionRefs.current[index] = node }}
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleOptionSelect(option)}
                    onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
                    disabled={option.disabled}
                    className={`
                      w-full px-3.5 py-2.5 text-left text-[14px] leading-5
                      transition-colors duration-150
                      ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      ${option.value === value
                        ? 'bg-[var(--shell-nav-active-bg)] text-[var(--shell-nav-active-text)]'
                        : 'text-[var(--text-primary)] hover:bg-[var(--shell-nav-hover-bg)]'
                      }
                      ${index === highlightedIndex
                        ? 'bg-[var(--shell-nav-hover-bg)]'
                        : ''
                      }
                    `}
                    role="option"
                    aria-selected={option.value === value}
                    aria-disabled={option.disabled || undefined}
                  >
                    {option.label}
                  </button>
                ))
              ) : (
                <div className="px-3.5 py-2.5 text-[14px] text-[var(--text-muted)]">
                  No options found
                </div>
              )}
            </div>
          </div>
        </FloatingPortal>
      )}

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-[14px] text-[var(--status-danger-text)]">
          {error}
        </p>
      )}
    </div>
  )
}

export default Select
