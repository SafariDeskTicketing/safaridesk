import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  type Placement,
} from '@floating-ui/react'

/**
 * Shared positioning for anything that floats next to an anchor (selects,
 * menus, popovers). Rendered inside a <FloatingPortal>, so it is never clipped
 * by an `overflow` ancestor, and it flips/shifts to stay inside the viewport
 * instead of each component hand-rolling `absolute` offsets.
 */

/** Above the Modal stack (1000 + 10 per open modal) and Drawer (z-50). */
export const FLOATING_Z_INDEX = 10000

const VIEWPORT_PADDING = 8

interface UseAnchoredFloatingOptions {
  open: boolean
  onOpenChange: (open: boolean) => void
  placement?: Placement
  /** Gap between anchor and floating element, in px. */
  gap?: number
  /** Make the floating element at least as wide as the anchor (it may grow to fit content, up to the viewport). */
  matchAnchorWidth?: boolean
  /** Upper bound on height; it also shrinks to the space actually available. */
  maxHeight?: number
  /** ARIA role wiring for anchor + floating element. Omit to manage ARIA yourself. */
  role?: 'menu' | 'dialog'
}

export function useAnchoredFloating({
  open,
  onOpenChange,
  placement = 'bottom-start',
  gap = 8,
  matchAnchorWidth = false,
  maxHeight,
  role,
}: UseAnchoredFloatingOptions) {
  const floating = useFloating({
    open,
    onOpenChange,
    placement,
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(gap),
      flip({ padding: VIEWPORT_PADDING }),
      shift({ padding: VIEWPORT_PADDING }),
      size({
        padding: VIEWPORT_PADDING,
        apply({ rects, availableHeight, availableWidth, elements }) {
          Object.assign(elements.floating.style, {
            ...(matchAnchorWidth && {
              minWidth: `${rects.reference.width}px`,
              maxWidth: `${Math.max(rects.reference.width, availableWidth)}px`,
            }),
            ...(maxHeight !== undefined && {
              maxHeight: `${Math.max(0, Math.min(maxHeight, availableHeight))}px`,
            }),
          })
        },
      }),
    ],
  })

  const dismiss = useDismiss(floating.context)
  const roleProps = useRole(floating.context, { role: role ?? 'dialog', enabled: role !== undefined })
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, roleProps])

  return {
    refs: floating.refs,
    floatingStyles: { ...floating.floatingStyles, zIndex: FLOATING_Z_INDEX },
    getReferenceProps,
    getFloatingProps,
  }
}
