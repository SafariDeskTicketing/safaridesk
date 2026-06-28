import React, { useEffect, useState } from "react"
import { useUIStore } from "../../stores/uiStore"

interface DrawerProps {
  isOpen: boolean
  close: () => void
  showTitle?: boolean
  title?: string
  content?: React.ComponentType<any> | React.ReactNode
  children?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  height?: 'auto' | 'full'
  showBackdrop?: boolean
}

const Drawer: React.FC<DrawerProps> = ({ 
  isOpen, 
  close, 
  showTitle = true, 
  title, 
  content, 
  children,
  size = 'md',
  height = 'full',
  showBackdrop = true,
}) => {
  const { theme } = useUIStore();
    
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      // Small delay to ensure the element is rendered before animating
      setTimeout(() => setIsAnimating(true), 10)
    } else {
      setIsAnimating(false)
      // Wait for animation to complete before hiding
      setTimeout(() => setIsVisible(false), 300)
    }
  }, [isOpen])

  if (!isVisible) return null

  const sizeClasses = {
    sm: 'w-[35%]',
    md: 'w-[55%]',
    lg: 'w-[75%]',
    xl: 'w-[85%]',
    full: 'w-full'
  };

  const heightClasses = {
    auto: 'h-auto max-h-screen',
    full: 'h-screen'
  }

  const themeClasses = {
    bg: 'bg-white dark:bg-surface',
    text: 'text-gray-900 dark:text-white',
    border: 'border-gray-200 dark:border-subtle',
    headerBg: 'bg-white dark:bg-surface',
    buttonHover: 'hover:bg-gray-100 dark:hover:bg-surface-hover'
  }

  const resolvedContent = content ?? children ?? null
  const ContentComponent = typeof resolvedContent === 'function' ? resolvedContent : () => resolvedContent

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop with blur and fade animation */}
       {showBackdrop && (
        <div 
          className={`fixed inset-0 bg-black/20 dark:bg-[var(--overlay-soft-bg)] backdrop-blur-sm transition-all duration-300 ease-out ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
          onClick={close}
        />
      )}
      
      {/* Drawer with slide and fade animation */}
      <div className={`
        fixed right-0 top-0 ${heightClasses[height]} ${themeClasses.bg} ${themeClasses.text} 
        shadow-2xl transform transition-all duration-300 ease-out
        ${sizeClasses[size]} 
        ${isAnimating ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-95'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header with staggered animation */}
          {showTitle && (
            <div className={`
              flex items-center justify-between p-4 
              ${themeClasses.headerBg} ${themeClasses.border} border-b
              ${height === 'auto' ? 'flex-shrink-0' : ''}
              transform transition-all duration-300 ease-out delay-75
              ${isAnimating ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}
            `}>
              <h2 className="text-lg font-semibold truncate pr-4">{title}</h2>
              <button
                onClick={close}
                className={`
                  p-2 ${themeClasses.buttonHover} rounded-full transition-all duration-200
                  flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
                  hover:scale-110 active:scale-95
                `}
                aria-label="Close drawer"
              >
                <svg 
                  className="w-5 h-5 transition-transform duration-200" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          
          {/* Content with staggered animation */}
          <div className={`
            ${height === 'full' ? 'flex-1' : 'flex-shrink'} 
            overflow-auto p-4 
            ${height === 'auto' ? 'max-h-[calc(100vh-8rem)]' : ''}
            transform transition-all duration-300 ease-out delay-100
            ${isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
          `}>
            <ContentComponent />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Drawer
