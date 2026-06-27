/**
 * usePinchZoom - Hook for pinch-to-zoom gesture handling on Konva Stage
 *
 * Handles two-finger pinch gestures for zooming and panning the canvas.
 * Uses refs for gesture state to avoid re-renders during gestures.
 */

import { useCallback, useRef, useEffect } from 'react'
import type Konva from 'konva'
import type { ViewPort } from '~/types/template'
import { MIN_SCALE } from '~/constants/canvas'
import useDevices from '~/utils/hooks/useDevice'

interface UsePinchZoomOptions {
  /** Reference to the Konva Stage */
  stageRef: React.RefObject<Konva.Stage>
  /** Current viewport state (scale, position) */
  viewport: ViewPort
  /** Whether pinch zoom is enabled */
  enabled?: boolean
  /** Callback to update viewport */
  onViewportChange?: (viewport: ViewPort) => void
  /** Function to check if viewport is within bounds */
  isWithinBounds?: (viewport: ViewPort) => boolean
  /** Callback when pinch gesture starts */
  onPinchStart?: () => void
  /** Callback when pinch gesture ends */
  onPinchEnd?: () => void
}

interface TouchState {
  /** Last distance between two touch points */
  lastDistance: number | null
  /** Last center point between touches */
  lastCenter: { x: number; y: number } | null
  /** Whether currently in pinch gesture */
  isPinching: boolean
  /** Initial distance at pinch start (for dead zone calculation) */
  initialDistance: number | null
  /** Cached container rect to avoid layout thrashing */
  containerRect: DOMRect | null
  /** Whether the gesture has passed the dead zone threshold */
  gestureConfirmed: boolean
}

/** Minimum distance change (in pixels) before pinch gesture is confirmed */
const PINCH_DEAD_ZONE = 8

/**
 * Calculate distance between two touch points
 */
function getDistance(touches: TouchList): number {
  if (touches.length < 2) return 0
  const dx = touches[1].clientX - touches[0].clientX
  const dy = touches[1].clientY - touches[0].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate center point between two touches
 */
function getCenter(touches: TouchList): { x: number; y: number } {
  if (touches.length < 2) {
    return { x: touches[0].clientX, y: touches[0].clientY }
  }
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  }
}

/**
 * Hook for handling pinch-to-zoom gestures on canvas
 */
export function usePinchZoom(options: UsePinchZoomOptions) {
  const { stageRef, viewport, enabled = true, onViewportChange, isWithinBounds, onPinchStart, onPinchEnd } = options
  const { isMobile } = useDevices()

  // Use refs to avoid re-renders during gesture
  const touchStateRef = useRef<TouchState>({
    lastDistance: null,
    lastCenter: null,
    isPinching: false,
    initialDistance: null,
    containerRect: null,
    gestureConfirmed: false,
  })

  const animationFrameRef = useRef<number | null>(null)

  // Ref to track if pinch was recently active (for tap suppression)
  // This stays true briefly after pinch ends to prevent accidental taps
  const wasPinchingRef = useRef(false)
  const pinchEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Store viewport in ref to access current value in event handlers
  const viewportRef = useRef(viewport)
  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  /**
   * Update viewport with animation frame synchronization
   * Prevents multiple updates within the same frame
   */
  const updateViewport = useCallback(
    (newViewport: ViewPort) => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        if (!isWithinBounds || isWithinBounds(newViewport)) {
          onViewportChange?.(newViewport)
        }
        animationFrameRef.current = null
      })
    },
    [onViewportChange, isWithinBounds]
  )

  /**
   * Handle touch start - initialize pinch state when 2 fingers detected
   * Immediately disables element interaction to prevent accidental moves
   */
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!isMobile || !enabled || e.touches.length !== 2) return

      e.preventDefault()

      // Clear any pending pinch end timeout
      if (pinchEndTimeoutRef.current) {
        clearTimeout(pinchEndTimeoutRef.current)
        pinchEndTimeoutRef.current = null
      }

      // IMMEDIATELY disable element interaction when 2 fingers detected
      // This prevents elements from responding to touch events during pinch
      if (typeof window !== 'undefined' && (window as any).Konva) {
        const Konva = (window as any).Konva
        Konva.hitOnDragEnabled = false

        // Stop any node that is currently being dragged (element or stage)
        // Konva.DD is the drag-and-drop manager that tracks the dragging node
        if (Konva.DD && Konva.DD.node) {
          Konva.DD.node.stopDrag()
        }
      }

      const distance = getDistance(e.touches)
      const center = getCenter(e.touches)

      // Cache container rect to avoid layout thrashing during touchmove
      const container = stageRef.current?.container()
      const containerRect = container?.getBoundingClientRect() ?? null

      touchStateRef.current = {
        lastDistance: distance,
        lastCenter: center,
        isPinching: true,
        initialDistance: distance,
        containerRect,
        gestureConfirmed: false, // Will be confirmed after passing dead zone
      }

      // Mark that pinch is active and notify
      wasPinchingRef.current = true
      onPinchStart?.()
    },
    [enabled, isMobile, onPinchStart, stageRef]
  )

  /**
   * Handle touch move - calculate scale and position updates
   * Uses dead zone to prevent initial jitter when starting pinch
   */
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isMobile || !enabled || !touchStateRef.current.isPinching || e.touches.length !== 2) return

      e.preventDefault()

      const { lastDistance, lastCenter, initialDistance, containerRect, gestureConfirmed } = touchStateRef.current
      if (lastDistance === null || lastCenter === null || initialDistance === null) return

      // Use cached container rect to avoid layout thrashing
      if (!containerRect) return

      const currentDistance = getDistance(e.touches)
      const currentCenter = getCenter(e.touches)

      // Check if gesture has passed the dead zone threshold
      // This prevents jittery movement at the start of pinch
      if (!gestureConfirmed) {
        const distanceChange = Math.abs(currentDistance - initialDistance)
        if (distanceChange < PINCH_DEAD_ZONE) {
          // Still in dead zone - update tracking but don't apply scale yet
          touchStateRef.current.lastDistance = currentDistance
          touchStateRef.current.lastCenter = currentCenter
          return
        }
        // Passed dead zone - confirm gesture and continue
        touchStateRef.current.gestureConfirmed = true
      }

      const currentViewport = viewportRef.current

      // Calculate new scale based on distance ratio
      const scaleRatio = currentDistance / lastDistance
      let newScale = currentViewport.scale * scaleRatio
      newScale = Math.max(MIN_SCALE, newScale)

      // Get center position relative to container (using cached rect)
      const relCenter = {
        x: currentCenter.x - containerRect.left,
        y: currentCenter.y - containerRect.top,
      }

      // Calculate the point we're zooming toward in scene coordinates
      const pointTo = {
        x: (relCenter.x - currentViewport.left) / currentViewport.scale,
        y: (relCenter.y - currentViewport.top) / currentViewport.scale,
      }

      // Calculate center movement (pan while zooming)
      const deltaX = currentCenter.x - lastCenter.x
      const deltaY = currentCenter.y - lastCenter.y

      // Calculate new position
      const newLeft = relCenter.x - pointTo.x * newScale + deltaX
      const newTop = relCenter.y - pointTo.y * newScale + deltaY

      // Update touch state
      touchStateRef.current.lastDistance = currentDistance
      touchStateRef.current.lastCenter = currentCenter

      // Apply viewport update
      updateViewport({
        scale: newScale,
        left: newLeft,
        top: newTop,
      })
    },
    [enabled, isMobile, updateViewport]
  )

  /** Duration to suppress taps after pinch ends (ms) */
  const TAP_SUPPRESSION_DELAY = 200

  /**
   * Handle touch end - clean up pinch state and re-enable element interaction
   */
  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!isMobile || !enabled) return

      // Reset pinch state when going below 2 fingers
      if (e.touches.length < 2) {
        const wasPinching = touchStateRef.current.isPinching

        // Re-enable element interaction
        if (typeof window !== 'undefined' && (window as any).Konva) {
          ;(window as any).Konva.hitOnDragEnabled = true
        }

        touchStateRef.current = {
          lastDistance: null,
          lastCenter: null,
          isPinching: false,
          initialDistance: null,
          containerRect: null,
          gestureConfirmed: false,
        }

        // If was pinching, notify and keep wasPinchingRef true briefly
        // to suppress any tap events that fire right after pinch ends
        if (wasPinching) {
          onPinchEnd?.()

          // Clear wasPinchingRef after delay to allow taps again
          pinchEndTimeoutRef.current = setTimeout(() => {
            wasPinchingRef.current = false
            pinchEndTimeoutRef.current = null
          }, TAP_SUPPRESSION_DELAY)
        }
      }
    },
    [enabled, isMobile, onPinchEnd]
  )

  /**
   * Handle touch cancel - reset all state and re-enable element interaction
   */
  const handleTouchCancel = useCallback(() => {
    if (!isMobile) return

    // Re-enable element interaction
    if (typeof window !== 'undefined' && (window as any).Konva) {
      ;(window as any).Konva.hitOnDragEnabled = true
    }

    touchStateRef.current = {
      lastDistance: null,
      lastCenter: null,
      isPinching: false,
      initialDistance: null,
      containerRect: null,
      gestureConfirmed: false,
    }
  }, [isMobile])

  // Setup and cleanup event listeners
  useEffect(() => {
    if (!isMobile || !enabled || !stageRef.current) return

    const container = stageRef.current.container()
    if (!container) return

    // Add touch event listeners with passive: false to allow preventDefault
    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: false })
    container.addEventListener('touchcancel', handleTouchCancel, { passive: false })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchCancel)

      // Clean up any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      // Clean up any pending pinch end timeout
      if (pinchEndTimeoutRef.current) {
        clearTimeout(pinchEndTimeoutRef.current)
      }
    }
  }, [enabled, stageRef, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, isMobile])

  return {
    /** Whether currently in a pinch gesture */
    isPinching: touchStateRef.current.isPinching,
    /** Ref to check if pinch was recently active (for tap suppression) */
    wasPinchingRef,
  }
}
