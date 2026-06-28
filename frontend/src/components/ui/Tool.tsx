import { useEffect, useRef, useState } from "react";

type ToolProp = {
    children: React.ReactNode;
    content: React.ReactNode;
    className?: string;
}
export const Tooltip = ({ children, content, className = '' }: ToolProp) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom' });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const buttonRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    const spacing = 8; // Gap between button and tooltip
    
    let top = 0;
    let left = 0;
    let placement = 'bottom';

    // Try bottom first (default)
    if (buttonRect.bottom + tooltipRect.height + spacing <= windowHeight) {
      top = buttonRect.bottom + spacing;
      left = buttonRect.left + (buttonRect.width / 2) - (tooltipRect.width / 2);
      placement = 'bottom';
    }
    // Try top
    else if (buttonRect.top - tooltipRect.height - spacing >= 0) {
      top = buttonRect.top - tooltipRect.height - spacing;
      left = buttonRect.left + (buttonRect.width / 2) - (tooltipRect.width / 2);
      placement = 'top';
    }
    // Try right
    else if (buttonRect.right + tooltipRect.width + spacing <= windowWidth) {
      top = buttonRect.top + (buttonRect.height / 2) - (tooltipRect.height / 2);
      left = buttonRect.right + spacing;
      placement = 'right';
    }
    // Try left
    else if (buttonRect.left - tooltipRect.width - spacing >= 0) {
      top = buttonRect.top + (buttonRect.height / 2) - (tooltipRect.height / 2);
      left = buttonRect.left - tooltipRect.width - spacing;
      placement = 'left';
    }
    // Fallback to bottom with horizontal adjustment
    else {
      top = buttonRect.bottom + spacing;
      left = buttonRect.left + (buttonRect.width / 2) - (tooltipRect.width / 2);
      placement = 'bottom';
    }

    // Ensure tooltip doesn't go off screen horizontally
    if (left < spacing) {
      left = spacing;
    } else if (left + tooltipRect.width > windowWidth - spacing) {
      left = windowWidth - tooltipRect.width - spacing;
    }

    // Ensure tooltip doesn't go off screen vertically
    if (top < spacing) {
      top = spacing;
    } else if (top + tooltipRect.height > windowHeight - spacing) {
      top = windowHeight - tooltipRect.height - spacing;
    }

    setPosition({ top, left, placement });
  };

  useEffect(() => {
    if (isVisible) {
      calculatePosition();
      
      const handleResize = () => calculatePosition();
      const handleScroll = () => calculatePosition();
      
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [isVisible]);

  const handleClick = () => {
    setIsVisible(!isVisible);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
        tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
      setIsVisible(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isVisible]);

  const getArrowClasses = () => {
    const baseArrow = "absolute w-2 h-2 bg-white dark:bg-surface-elevated border-l border-t border-gray-200 dark:border-subtle transform rotate-45";
    
    switch (position.placement) {
      case 'top':
        return `${baseArrow} -bottom-1 left-1/2 -translate-x-1/2`;
      case 'bottom':
        return `${baseArrow} -top-1 left-1/2 -translate-x-1/2`;
      case 'left':
        return `${baseArrow} -right-1 top-1/2 -translate-y-1/2`;
      case 'right':
        return `${baseArrow} -left-1 top-1/2 -translate-y-1/2`;
      default:
        return `${baseArrow} -top-1 left-1/2 -translate-x-1/2`;
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleClick}
        className={`relative ${className}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 bg-white dark:bg-surface-elevated rounded-lg shadow-xl border border-gray-200 dark:border-subtle max-w-sm"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          <div className={getArrowClasses()}></div>
          <div className="relative z-10">
            {typeof content === 'string' ? (
              <div className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-[var(--text-primary)]">
                {content}
              </div>
            ) : (
              content
            )}
          </div>
        </div>
      )}
    </>
  );
};
