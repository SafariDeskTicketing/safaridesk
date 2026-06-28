import React, { useState, useRef, useEffect } from 'react';

interface PopoverProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  contentClassName?: string;
}

const Tip: React.FC<PopoverProps> = ({
  trigger,
  content,
  position = 'bottom',
  className = '',
  contentClassName = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const togglePopover = () => {
    if (!isOpen) {
      setIsPositioned(false);
    }
    setIsOpen(!isOpen);
  };

  const closePopover = () => {
    setIsOpen(false);
    setIsPositioned(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        popoverRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        closePopover();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'; // Disable scrolling
      if (triggerRef.current && !isPositioned) {
        // Use requestAnimationFrame to ensure the popover is rendered before calculating position
        requestAnimationFrame(() => {
          if (triggerRef.current && popoverRef.current) {
            const triggerRect = triggerRef.current.getBoundingClientRect();
            const popoverRect = popoverRef.current.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            
            const viewport = {
              width: window.innerWidth,
              height: window.innerHeight
            };

            let finalPosition = position;
            let top = 0;
            let left = 0;

            // Calculate initial position
            const positions = {
              top: {
                top: triggerRect.top + scrollTop - popoverRect.height - 8,
                left: triggerRect.left + scrollLeft + triggerRect.width / 2
              },
              bottom: {
                top: triggerRect.bottom + scrollTop + 8,
                left: triggerRect.left + scrollLeft + triggerRect.width / 2
              },
              left: {
                top: triggerRect.top + scrollTop + triggerRect.height / 2,
                left: triggerRect.left + scrollLeft - popoverRect.width - 8
              },
              right: {
                top: triggerRect.top + scrollTop + triggerRect.height / 2,
                left: triggerRect.right + scrollLeft + 8
              }
            };

            // Check if the preferred position fits in viewport
            const preferredPos = positions[position];
            let fitsInViewport = true;

            // Check viewport boundaries
            if (position === 'top' && preferredPos.top < scrollTop) {
              fitsInViewport = false;
            } else if (position === 'bottom' && preferredPos.top + popoverRect.height > scrollTop + viewport.height) {
              fitsInViewport = false;
            } else if (position === 'left' && preferredPos.left < scrollLeft) {
              fitsInViewport = false;
            } else if (position === 'right' && preferredPos.left + popoverRect.width > scrollLeft + viewport.width) {
              fitsInViewport = false;
            }

            // If preferred position doesn't fit, find the best alternative
            if (!fitsInViewport) {
              const alternatives = {
                top: 'bottom',
                bottom: 'top',
                left: 'right',
                right: 'left'
              } as const;

              const alternativePosition = alternatives[position];
              const alternativePos = positions[alternativePosition];
              
              // Check if alternative position fits better
              let alternativeFits = true;
              if (alternativePosition === 'top' && alternativePos.top < scrollTop) {
                alternativeFits = false;
              } else if (alternativePosition === 'bottom' && alternativePos.top + popoverRect.height > scrollTop + viewport.height) {
                alternativeFits = false;
              } else if (alternativePosition === 'left' && alternativePos.left < scrollLeft) {
                alternativeFits = false;
              } else if (alternativePosition === 'right' && alternativePos.left + popoverRect.width > scrollLeft + viewport.width) {
                alternativeFits = false;
              }

              if (alternativeFits) {
                finalPosition = alternativePosition;
              } else {
                // If neither primary nor alternative fits, try other positions
                const allPositions: Array<'top' | 'bottom' | 'left' | 'right'> = ['bottom', 'top', 'right', 'left'];
                for (const pos of allPositions) {
                  const testPos = positions[pos];
                  let testFits = true;
                  
                  if (pos === 'top' && testPos.top < scrollTop) {
                    testFits = false;
                  } else if (pos === 'bottom' && testPos.top + popoverRect.height > scrollTop + viewport.height) {
                    testFits = false;
                  } else if (pos === 'left' && testPos.left < scrollLeft) {
                    testFits = false;
                  } else if (pos === 'right' && testPos.left + popoverRect.width > scrollLeft + viewport.width) {
                    testFits = false;
                  }

                  if (testFits) {
                    finalPosition = pos;
                    break;
                  }
                }
              }
            }

            // Set final position
            const finalPos = positions[finalPosition];
            top = finalPos.top;
            left = finalPos.left;

            // Ensure popover doesn't go outside horizontal viewport bounds
            const popoverWidth = popoverRect.width;
            if (left - popoverWidth/2 < scrollLeft) {
              left = scrollLeft + popoverWidth/2 + 10;
            } else if (left + popoverWidth/2 > scrollLeft + viewport.width) {
              left = scrollLeft + viewport.width - popoverWidth/2 - 10;
            }

            setPopoverPosition({ top, left });
            // Store the final position for arrow positioning
            (popoverRef.current as any).dataset.position = finalPosition;
            setIsPositioned(true);
          }
        });
      }
    } else {
      document.body.style.overflow = ''; // Re-enable scrolling
    }
  }, [isOpen, position, isPositioned]);

  const getPositionClasses = () => {
    // Get the actual position used (might be different from requested position due to viewport constraints)
    const actualPosition = popoverRef.current?.dataset.position || position;
    
    switch (actualPosition) {
      case 'top':
        return '-translate-x-1/2 -translate-y-full';
      case 'bottom':
        return '-translate-x-1/2';
      case 'left':
        return '-translate-x-full -translate-y-1/2';
      case 'right':
        return '-translate-y-1/2';
      default:
        return '-translate-x-1/2';
    }
  };

  const getArrowClasses = () => {
    // Get the actual position used (might be different from requested position due to viewport constraints)
    const actualPosition = popoverRef.current?.dataset.position || position;
    
    const baseClasses = 'absolute w-0 h-0 border-solid';
    switch (actualPosition) {
      case 'top':
        return `${baseClasses} border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white top-full left-1/2 -translate-x-1/2`;
      case 'bottom':
        return `${baseClasses} border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white bottom-full left-1/2 -translate-x-1/2`;
      case 'left':
        return `${baseClasses} border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-white left-full top-1/2 -translate-y-1/2`;
      case 'right':
        return `${baseClasses} border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-white right-full top-1/2 -translate-y-1/2`;
      default:
        return `${baseClasses} border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white bottom-full left-1/2 -translate-x-1/2`;
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onClick={togglePopover}
        className={`inline-block cursor-pointer ${className}`}
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={popoverRef}
          className={`fixed z-50 transition-opacity duration-150 ${getPositionClasses()} ${
            isPositioned ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            top: `${popoverPosition.top}px`,
            left: `${popoverPosition.left}px`,
          }}
        >
          <div
            className={`bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm relative ${contentClassName}`}
          >
            <div className={getArrowClasses()}></div>
            {content}
          </div>
        </div>
      )}
    </>
  );
};

export default Tip;
