import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TourGuideBackdropProps } from '../types'
import styles from '../styles.module.css'
import evaluateHighlightRectSize from '../utils/evaluateHighlightRectSize'
import { DEFAULT_HIGH_LIGHT_RECT, TRIGGER_ELEMENT } from '../constants'

const TourGuideBackdrop: React.FC<TourGuideBackdropProps> = props => {
  const { highlightRect, canInteractHighlight = true } = props

  const svgRef = useRef<SVGSVGElement>(null)
  const [isClient, setIsClient] = useState(false)
  const { rx = 10, ry = 10, padding = 0, disableActiveInteraction = false } = highlightRect || DEFAULT_HIGH_LIGHT_RECT

  const {
    width,
    height,
    x: rectX,
    y: rectY,
  } = useMemo(
    () => evaluateHighlightRectSize(highlightRect || DEFAULT_HIGH_LIGHT_RECT, padding),
    [highlightRect, padding]
  )

  // Check if a point (x,y) is within the highlighted rectangle
  const isPointInRect = useCallback(
    (x: number, y: number): boolean => {
      if (!highlightRect) return false

      return x >= rectX && x <= rectX + width && y >= rectY && y <= rectY + height
    },
    [height, highlightRect, rectX, rectY, width]
  )

  const isMouseInsideTourGuideCard = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement | SVGElement

    if (!target) return false

    const closest = typeof target.closest === 'function'

    if (!closest) return false

    // Check if the target is inside the tour guide card
    const isInsideTourGuideCard = !!target.closest('#tour-guide-card')

    // Check if the target is inside the tour guide backdrop
    const isInsideTourGuideBackdrop = !!target.closest('#tour-guide-backdrop')

    // Check if the target is inside a button element
    const isInsideActivator = target.closest('button')

    // Return true if the target is inside either the tour guide card or the backdrop and the activator
    return (isInsideTourGuideCard || isInsideTourGuideBackdrop) && isInsideActivator
  }, [])

  const canTargetElementBeInteracted = useCallback(
    (e: Event) => {
      const target = e.target

      if (!(target instanceof Element)) return false

      // Get bounding rect of the target
      const { x: highlightX, y: highlightY, width, height } = target.getBoundingClientRect()

      // Check if the mouse is inside center of the highlight
      const isInsideHighlight = isPointInRect(highlightX + width / 2, highlightY + height / 2)

      // Check if the mouse is inside the tour guide card
      const isInsideTourGuideCard = isMouseInsideTourGuideCard(e as MouseEvent)

      // Check if the target itself or any of its parent elements is a trigger element
      const isTriggerElement
        = target.getAttribute('role') === TRIGGER_ELEMENT || !!target.closest(`[role="${TRIGGER_ELEMENT}"]`)

      // Check if the target is a navigation element (link or button)
      const isNavigationElement = !!target.closest('a[href]')

      // Only interact with the highlight if the mouse is inside the card or the highlight is interactable or the target is a trigger element
      const canInteract
        = isInsideTourGuideCard
        || (isInsideHighlight && canInteractHighlight && !disableActiveInteraction)
        || isTriggerElement
        || isNavigationElement

      return canInteract
    },
    [canInteractHighlight, disableActiveInteraction, isMouseInsideTourGuideCard, isPointInRect]
  )

  const onHandleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!svgRef.current) return

      const canInteract = canTargetElementBeInteracted(e)

      svgRef.current.style.pointerEvents = !canInteract ? 'none' : 'auto'
    },
    [canTargetElementBeInteracted]
  )

  useEffect(() => {
    function handleStopGlobalEvent(e: Event) {
      const canInteract = canTargetElementBeInteracted(e)

      if (canInteract) {
        return
      }

      // Stop event outside the box
      e.stopPropagation()
      e.stopImmediatePropagation()
    }

    // Add listeners for click, drag, and checkbox change globally
    window.addEventListener('click', handleStopGlobalEvent, true)
    window.addEventListener('dragstart', handleStopGlobalEvent, true)
    window.addEventListener('change', handleStopGlobalEvent, true)
    window.addEventListener('focus', handleStopGlobalEvent, true)
    window.addEventListener('mousedown', handleStopGlobalEvent, true)
    window.addEventListener('mousemove', onHandleMouseMove)

    return () => {
      // Set timeout for waiting synchronous tasks resolve
      setTimeout(() => {
        // Remove listeners
        window.removeEventListener('click', handleStopGlobalEvent, true)
        window.removeEventListener('dragstart', handleStopGlobalEvent, true)
        window.removeEventListener('change', handleStopGlobalEvent, true)
        window.removeEventListener('focus', handleStopGlobalEvent, true)
        window.removeEventListener('mousedown', handleStopGlobalEvent, true)
        window.removeEventListener('mousemove', onHandleMouseMove, true)
      }, 150)
    }
  }, [
    canInteractHighlight,
    canTargetElementBeInteracted,
    highlightRect,
    isMouseInsideTourGuideCard,
    isPointInRect,
    disableActiveInteraction,
    onHandleMouseMove,
  ])

  // Set isClient to true on mount for SSR safety
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Don't render on server-side or if document.body is not available
  if (!isClient || typeof document === 'undefined') {
    return null
  }

  const backdropElement = (
    <svg id="tour-guide-backdrop" ref={svgRef} className={styles.backdrop} aria-hidden="true">
      <defs>
        <mask id="hole-mask">
          {/* White background for the mask */}
          <rect width="100%" height="100%" fill="white" />
          {/* Black "hole" that creates the transparent area */}
          <rect x={rectX} y={rectY} width={width} height={height} fill="black" rx={rx} ry={ry} />
        </mask>
      </defs>
      {/* Main overlay rectangle with mask applied */}
      <rect width="100%" height="100%" fill={`rgba(0, 0, 0, 0.4)`} mask="url(#hole-mask)" />
    </svg>
  )

  // Render backdrop using portal to document.body for proper z-index handling
  return createPortal(backdropElement, document.body)
}

export default memo(TourGuideBackdrop)
