/** @jsxImportSource preact */
/* eslint-disable react/no-danger */
import { cloneElement } from 'preact'
import { useCallback, useEffect, useRef, useState, useLayoutEffect, useMemo } from 'preact/hooks'
import type { ComponentChildren, VNode } from 'preact'
import { Portal } from '../portal'
import DOMPurify from 'dompurify'
import { POSITIONS, type PopoverPosition } from '../../../commons/popover/constants'
import { throttle, debounce } from '../../../../utils'

const OFFSET = 12
const SAFETY_MARGIN = 16

export interface PopoverProps {
  /** Where the popover is placed relative to the trigger */
  position?: PopoverPosition
  /** Close when clicking outside */
  closeOnClickOutside?: boolean
  /** Show arrow decoration */
  showArrow?: boolean
  /** Trigger element that opens the popover */
  activator: VNode | ComponentChildren
  /** Extra className for popover element */
  popoverClass?: string
  /** Allow multiple popovers to be open simultaneously */
  allowMultiplePopovers?: boolean
  /** z-index override */
  zIndex?: number
  /** Current open state of the popover */
  open: boolean
  /** Called when the popover requests to be closed */
  onClose: () => void
  /** Called after the popover opens */
  afterOpen?: () => void
  /** Called after the popover closes */
  afterClose?: () => void
  /** The popover content */
  children: ComponentChildren | string
}

/**
 * TailorKit Popover – lightweight conversion of the imperative class to a Preact
 * component. For advanced scenarios the original class can still be used.
 */
export function Popover({
  position = POSITIONS.BOTTOM,
  closeOnClickOutside = true,
  showArrow = false,
  popoverClass = 'emtlkit--popover',
  zIndex,
  open,
  onClose,
  afterOpen,
  afterClose,
  activator,
  children,
}: PopoverProps) {
  const triggerRef = useRef<HTMLElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [, setPositioned] = useState(false)

  // Store position-related props in a ref to avoid dependency changes
  const positionPropsRef = useRef({
    position,
    showArrow,
    zIndex: zIndex ?? 999999,
  })

  // Update ref values when props change (only during render, not affecting dependencies)
  useEffect(() => {
    positionPropsRef.current = {
      position,
      showArrow,
      zIndex: zIndex ?? 999999,
    }
  }, [position, showArrow, zIndex])

  const closePopover = useCallback(() => {
    onClose()
    afterClose?.()
  }, [onClose, afterClose])

  // --- Outside click / escape handling
  useEffect(() => {
    if (!open) return undefined

    function handleClick(e: MouseEvent) {
      if (
        !popoverRef.current
        || !triggerRef.current
        || popoverRef.current.contains(e.target as Node)
        || triggerRef.current.contains(e.target as Node)
      ) {
        return
      }
      if (closeOnClickOutside) closePopover()
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closePopover()
    }

    document.addEventListener('click', handleClick, true)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, closeOnClickOutside, closePopover])

  // Core position calculation function - stable reference that doesn't depend on props
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current || !popoverRef.current || !open) return

    // Force a reflow to ensure we get the latest position
    void triggerRef.current.offsetHeight

    const t = triggerRef.current.getBoundingClientRect()
    const p = popoverRef.current.getBoundingClientRect()

    // Get accurate viewport dimensions
    const viewportWidth = Math.min(window.innerWidth, document.documentElement.clientWidth)
    const viewportHeight = Math.min(window.innerHeight, document.documentElement.clientHeight)

    const { position, showArrow, zIndex } = positionPropsRef.current

    let top = 0
    let left = 0

    // Calculate initial position based on requested position
    switch (position) {
      // TOP
      case POSITIONS.TOP:
      case POSITIONS.TOP_CENTER:
        top = t.top - p.height - OFFSET
        left = t.left + t.width / 2 - p.width / 2
        break
      case POSITIONS.TOP_LEFT:
        top = t.top - p.height - OFFSET
        left = t.left
        break
      case POSITIONS.TOP_RIGHT:
        top = t.top - p.height - OFFSET
        left = t.right - p.width
        break
      // BOTTOM
      case POSITIONS.BOTTOM:
      case POSITIONS.BOTTOM_CENTER:
        top = t.bottom + OFFSET
        left = t.left + t.width / 2 - p.width / 2
        break
      case POSITIONS.BOTTOM_LEFT:
        top = t.bottom + OFFSET
        left = t.left
        break
      case POSITIONS.BOTTOM_RIGHT:
        top = t.bottom + OFFSET
        left = t.right - p.width
        break
      // LEFT
      case POSITIONS.LEFT:
      case POSITIONS.LEFT_CENTER:
        top = t.top + t.height / 2 - p.height / 2
        left = t.left - p.width - OFFSET
        break
      case POSITIONS.LEFT_TOP:
        top = t.top
        left = t.left - p.width - OFFSET
        break
      case POSITIONS.LEFT_BOTTOM:
        top = t.bottom - p.height
        left = t.left - p.width - OFFSET
        break
      // RIGHT
      case POSITIONS.RIGHT:
      case POSITIONS.RIGHT_CENTER:
        top = t.top + t.height / 2 - p.height / 2
        left = t.right + OFFSET
        break
      case POSITIONS.RIGHT_TOP:
        top = t.top
        left = t.right + OFFSET
        break
      case POSITIONS.RIGHT_BOTTOM:
        top = t.bottom - p.height
        left = t.right + OFFSET
        break
      default:
        top = t.bottom + OFFSET
        left = t.left + t.width / 2 - p.width / 2
        break
    }

    // Check for boundary violations and adjust if needed
    let adjustedPosition = position

    // Detect horizontal overflow
    if (left + p.width > viewportWidth - SAFETY_MARGIN) {
      // Right side overflow
      if (position.includes('right')) {
        // Try flipping from right to left
        const leftSidePosition = position.replace('right', 'left')
        const flippedLeft = t.left - p.width - OFFSET

        if (flippedLeft >= SAFETY_MARGIN) {
          // We can safely flip to the left side
          adjustedPosition = leftSidePosition as PopoverPosition
          left = flippedLeft
        } else {
          // Can't flip, adjust to fit on screen
          left = Math.max(SAFETY_MARGIN, viewportWidth - p.width - SAFETY_MARGIN)
        }
      } else if (position.includes('center')) {
        // Center aligned, shift left
        left = Math.max(SAFETY_MARGIN, viewportWidth - p.width - SAFETY_MARGIN)
      } else {
        // Other positions, constrain to viewport
        left = Math.max(SAFETY_MARGIN, viewportWidth - p.width - SAFETY_MARGIN)
      }
    } else if (left < SAFETY_MARGIN) {
      // Left side overflow
      if (position.includes('left')) {
        // Try flipping from left to right
        const rightSidePosition = position.replace('left', 'right')
        const flippedLeft = t.right + OFFSET

        if (flippedLeft + p.width <= viewportWidth - SAFETY_MARGIN) {
          // We can safely flip to the right side
          adjustedPosition = rightSidePosition as PopoverPosition
          left = flippedLeft
        } else {
          // Can't flip, adjust to fit on screen
          left = SAFETY_MARGIN
        }
      } else {
        // Other positions, constrain to viewport
        left = SAFETY_MARGIN
      }
    }

    // Detect vertical overflow
    if (top + p.height > viewportHeight - SAFETY_MARGIN) {
      // Bottom overflow
      if (position.includes('bottom')) {
        // Try flipping from bottom to top
        const topSidePosition = position.replace('bottom', 'top')
        const flippedTop = t.top - p.height - OFFSET

        if (flippedTop >= SAFETY_MARGIN) {
          // We can safely flip to the top
          adjustedPosition = topSidePosition as PopoverPosition
          top = flippedTop
        } else {
          // Can't flip, adjust to fit on screen
          top = Math.max(SAFETY_MARGIN, viewportHeight - p.height - SAFETY_MARGIN)
          // If there's not enough space, add scrolling
          if (p.height > viewportHeight - SAFETY_MARGIN * 2) {
            const maxHeight = viewportHeight - SAFETY_MARGIN * 2
            popoverRef.current.style.maxHeight = `${maxHeight}px`
            popoverRef.current.style.overflowY = 'auto'
          }
        }
      } else if (!position.includes('top')) {
        // Not explicitly positioned to top, constrain to viewport
        top = Math.max(SAFETY_MARGIN, viewportHeight - p.height - SAFETY_MARGIN)
        // If there's not enough space, add scrolling
        if (p.height > viewportHeight - SAFETY_MARGIN * 2) {
          const maxHeight = viewportHeight - SAFETY_MARGIN * 2
          popoverRef.current.style.maxHeight = `${maxHeight}px`
          popoverRef.current.style.overflowY = 'auto'
        }
      }
    } else if (top < SAFETY_MARGIN) {
      // Top overflow
      if (position.includes('top')) {
        // Try flipping from top to bottom
        const bottomSidePosition = position.replace('top', 'bottom')
        const flippedTop = t.bottom + OFFSET

        if (flippedTop + p.height <= viewportHeight - SAFETY_MARGIN) {
          // We can safely flip to the bottom
          adjustedPosition = bottomSidePosition as PopoverPosition
          top = flippedTop
        } else {
          // Can't flip, adjust to fit on screen
          top = SAFETY_MARGIN
          // If there's not enough space, add scrolling
          if (p.height > viewportHeight - SAFETY_MARGIN * 2) {
            const maxHeight = viewportHeight - SAFETY_MARGIN * 2
            popoverRef.current.style.maxHeight = `${maxHeight}px`
            popoverRef.current.style.overflowY = 'auto'
          }
        }
      } else {
        // Other positions, constrain to viewport
        top = SAFETY_MARGIN
      }
    }

    // For very small screens, prioritize visibility over perfect positioning
    if (viewportWidth < 480) {
      // Special handling for narrow mobile screens
      const isWiderThanViewport = p.width > viewportWidth - SAFETY_MARGIN * 2

      if (isWiderThanViewport) {
        // If popover is wider than viewport, center it with fixed width
        left = SAFETY_MARGIN
        popoverRef.current.style.width = `calc(100vw - ${SAFETY_MARGIN * 2}px)`
        popoverRef.current.style.maxWidth = `calc(100vw - ${SAFETY_MARGIN * 2}px)`
      }
    }

    // Apply calculated position
    const styles: Partial<CSSStyleDeclaration> = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: zIndex.toString(),
      visibility: 'visible',
      opacity: '1',
    }

    Object.assign(popoverRef.current.style, styles)
    popoverRef.current.setAttribute('data-position', adjustedPosition)
    popoverRef.current.setAttribute('data-arrow', showArrow.toString())
    popoverRef.current.setAttribute('data-adjusted', adjustedPosition !== position ? 'true' : 'false')

    setPositioned(true)
  }, [open])

  // Create stable memoized versions of the position update functions
  const updatePositionFunctions = useMemo(() => {
    // Immediate update for critical positioning (like initial placement)
    const updatePositionImmediate = () => calculatePosition()

    // Throttled version for scroll events (limits to ~60fps)
    const updatePositionThrottled = throttle(calculatePosition)

    // Debounced version for resize events (only runs after changes stop)
    const updatePositionDebounced = debounce(calculatePosition)

    return {
      immediate: updatePositionImmediate,
      throttled: updatePositionThrottled as typeof updatePositionThrottled & { cancel: () => void },
      debounced: updatePositionDebounced as typeof updatePositionDebounced & { cancel: () => void },
    }
  }, [calculatePosition])

  // Initial position update after open
  useLayoutEffect(() => {
    if (!open) {
      setPositioned(false)
      return
    }
    // Ensure the popover is rendered before calculating position
    requestAnimationFrame(() => {
      updatePositionFunctions.immediate()
      afterOpen?.()
    })
  }, [open, updatePositionFunctions, afterOpen])

  // Set up event listeners
  useEffect(() => {
    if (!open) return

    // Find all scrollable parent elements
    const scrollableParents: HTMLElement[] = []

    if (triggerRef.current) {
      let parent = triggerRef.current.parentElement

      while (parent) {
        const { overflow, overflowX, overflowY } = window.getComputedStyle(parent)
        if (
          /(auto|scroll|overlay)/.test(overflow)
          || /(auto|scroll|overlay)/.test(overflowX)
          || /(auto|scroll|overlay)/.test(overflowY)
        ) {
          scrollableParents.push(parent)
        }
        parent = parent.parentElement
      }
    }

    // Use throttled version for scroll events (smoother performance)
    window.addEventListener('scroll', updatePositionFunctions.throttled, { capture: true, passive: true })

    // Use debounced version for resize (only runs after resizing stops)
    window.addEventListener('resize', updatePositionFunctions.debounced)

    // Add event listeners to all scrollable parents (throttled for performance)
    scrollableParents.forEach(el => {
      el.addEventListener('scroll', updatePositionFunctions.throttled, { passive: true })
    })

    // Use immediate version for orientation change (critical positioning)
    window.addEventListener('orientationchange', updatePositionFunctions.immediate)

    // Use ResizeObserver to detect size changes in the popover or trigger
    let resizeObserver: ResizeObserver | null = null
    try {
      resizeObserver = new ResizeObserver(updatePositionFunctions.debounced)

      if (popoverRef.current) {
        resizeObserver.observe(popoverRef.current)
      }

      if (triggerRef.current) {
        resizeObserver.observe(triggerRef.current)
      }
    } catch (e) {
      console.warn('ResizeObserver not supported in this browser')
    }

    // Create a MutationObserver to watch for DOM changes that might affect positioning (debounced)
    const observer = new MutationObserver(updatePositionFunctions.debounced)
    if (triggerRef.current) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: false,
      })
    }

    return () => {
      window.removeEventListener('resize', updatePositionFunctions.debounced)
      window.removeEventListener('scroll', updatePositionFunctions.throttled, { capture: true })
      window.removeEventListener('orientationchange', updatePositionFunctions.immediate)

      scrollableParents.forEach(el => {
        el.removeEventListener('scroll', updatePositionFunctions.throttled)
      })

      if (resizeObserver) {
        resizeObserver.disconnect()
      }

      observer.disconnect()

      // Cancel any pending throttled/debounced calls to prevent memory leaks
      updatePositionFunctions.throttled.cancel()
      updatePositionFunctions.debounced.cancel()
    }
  }, [open, updatePositionFunctions])

  // Render the activator and attach the ref
  const activatorElement = useMemo(() => {
    const firstChild = Array.isArray(activator) ? activator[0] : activator
    if (firstChild && typeof firstChild === 'object' && firstChild !== null && 'props' in firstChild) {
      return cloneElement(firstChild as VNode<any>, {
        ref: (node: any) => {
          triggerRef.current = node
          // Handle original ref if it exists
          const { ref: originalRef } = (firstChild as VNode<any>).props
          if (typeof originalRef === 'function') {
            originalRef(node)
          } else if (originalRef && typeof originalRef === 'object' && 'current' in originalRef) {
            originalRef.current = node
          }
        },
        onClick: (e: MouseEvent) => {
          // Preserve the original onClick if it exists
          ;(firstChild as VNode<any>).props?.onClick?.(e)
        },
      })
    }
    return activator
  }, [activator])

  // --- Build popover node
  const popoverNode = (
    <div
      ref={popoverRef}
      className={`${popoverClass} ${open ? 'active' : ''}`}
      aria-hidden={!open}
      style={{
        position: 'fixed',
        zIndex: zIndex ?? 999999,
        visibility: open ? 'visible' : 'hidden',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 150ms ease-in-out',
      }}
    >
      {typeof children === 'string' ? (
        <div
          dangerouslySetInnerHTML={{
            __html:
              typeof window !== 'undefined'
                ? DOMPurify.sanitize(children, {
                    ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'br', 'span'],
                    ALLOWED_ATTR: ['href', 'target', 'rel'],
                    FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'object', 'embed', 'link'],
                    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover'],
                  })
                : children.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
          }}
        />
      ) : (
        children
      )}
    </div>
  )

  return (
    <>
      {activatorElement}
      <Portal>{popoverNode}</Portal>
    </>
  )
}

export default Popover
