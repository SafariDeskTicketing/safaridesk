import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from '../icons/AppIcons'

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
  direction?: 'down' | 'up'
  className?: string
  labelClassName?: string
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
  const selectRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Ensure options is always an array
  const safeOptions = options || []

  // Filter options based on search term
  const filteredOptions = safeOptions.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Get selected option for display
  const selectedOption = safeOptions.find(option => option.value === value)

  // Size classes
  const sizeClasses = {
    sm: 'h-[38px] px-3 text-[14px]',
    md: 'h-[40px] px-3.5 text-[14px]',
    lg: 'h-[44px] px-4 text-[14px]'
  }

  const currentSize = sizeClasses[size]

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
        setHighlightedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setHighlightedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          )
          break
        case 'Enter':
          event.preventDefault()
          if (highlightedIndex >= 0) {
            handleOptionSelect(filteredOptions[highlightedIndex].value)
          }
          break
        case 'Escape':
          setIsOpen(false)
          setSearchTerm('')
          setHighlightedIndex(-1)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, highlightedIndex, filteredOptions])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && allowSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen, allowSearch])

  const handleOptionSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
    setSearchTerm('')
    setHighlightedIndex(-1)
  }

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
      if (!isOpen) {
        setSearchTerm('')
        setHighlightedIndex(-1)
      }
    }
  }

  return (
    <div className={`relative ${className}`} ref={selectRef}>
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
        onClick={toggleDropdown}
        disabled={disabled}
        className={`
          w-full ${currentSize} rounded-[var(--shell-radius)] border shadow-[var(--shell-shadow-sm)]
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
        <div className={`
          absolute z-50 max-h-60 w-full overflow-auto rounded-[var(--shell-radius)] border
          border-[var(--border-color)] bg-[var(--card-bg)] shadow-[var(--shell-shadow-md)]
          ${direction === 'up' ? 'bottom-full mb-2' : 'mt-2'}
        `}>
          {/* Search Input */}
          {allowSearch && (
            <div className="relative border-b border-[var(--border-color)] p-2">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search options..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setHighlightedIndex(-1)
                }}
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
          <div role="listbox">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleOptionSelect(option.value)}
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
