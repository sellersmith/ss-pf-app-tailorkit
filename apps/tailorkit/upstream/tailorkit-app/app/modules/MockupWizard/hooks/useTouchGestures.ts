import { useCallback, useRef, useEffect } from 'react'

interface TouchGestureHandlers {
  onPinchZoom?: (scaleDelta: number, centerX: number, centerY: number) => void
  onPan?: (deltaX: number, deltaY: number) => void
  onTap?: (x: number, y: number) => void
  onTapAndHold?: (x: number, y: number) => void
}

interface UseTouchGesturesOptions {
  enabled?: boolean
  tapHoldDelay?: number
  minPinchDistance?: number
  panThreshold?: number
}

export function useTouchGestures(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  handlers: TouchGestureHandlers,
  options: UseTouchGesturesOptions = {}
) {
  const { enabled = true, tapHoldDelay = 500, panThreshold = 10 } = options

  // Touch state refs
  const touchesRef = useRef<{ [key: number]: Touch }>({})
  const initialDistanceRef = useRef<number>(0)
  const initialCenterRef = useRef<{ x: number; y: number } | null>(null)
  const lastPanPositionRef = useRef<{ x: number; y: number } | null>(null)
  const tapHoldTimerRef = useRef<NodeJS.Timeout | null>(null)
  const hasPannedRef = useRef(false)
  const hasPinchedRef = useRef(false)

  // Helper function to get touch distance
  const getTouchDistance = useCallback((touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }, [])

  // Helper function to get touch center point
  const getTouchCenter = useCallback((touch1: Touch, touch2: Touch): { x: number; y: number } => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    }
  }, [])

  // Helper function to get canvas coordinates from touch
  const getTouchCanvasCoordinates = useCallback(
    (touch: Touch): { x: number; y: number } | null => {
      const canvas = canvasRef.current
      if (!canvas) return null

      const rect = canvas.getBoundingClientRect()
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    },
    [canvasRef]
  )

  // Clear tap and hold timer
  const clearTapHoldTimer = useCallback(() => {
    if (tapHoldTimerRef.current) {
      clearTimeout(tapHoldTimerRef.current)
      tapHoldTimerRef.current = null
    }
  }, [])

  // Handle touch start
  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!enabled) return

      event.preventDefault()

      // Store all current touches
      for (let i = 0; i < event.touches.length; i++) {
        const touch = event.touches[i]
        touchesRef.current[touch.identifier] = touch
      }

      const touchCount = Object.keys(touchesRef.current).length

      if (touchCount === 1) {
        // Single touch - potential tap or tap-and-hold
        const touch = Object.values(touchesRef.current)[0]
        const coords = getTouchCanvasCoordinates(touch)

        if (coords && handlers.onTapAndHold) {
          // Start tap-and-hold timer
          tapHoldTimerRef.current = setTimeout(() => {
            handlers.onTapAndHold!(coords.x, coords.y)
            tapHoldTimerRef.current = null
          }, tapHoldDelay)
        }

        // Initialize pan position for immediate response on first move
        lastPanPositionRef.current = { x: touch.clientX, y: touch.clientY }

        // Reset gesture flags
        hasPannedRef.current = false
        hasPinchedRef.current = false
      } else if (touchCount === 2) {
        // Two touches - potential pinch or pan
        clearTapHoldTimer()

        const touches = Object.values(touchesRef.current)
        if (touches.length >= 2) {
          const touch1 = touches[0]
          const touch2 = touches[1]

          initialDistanceRef.current = getTouchDistance(touch1, touch2)
          initialCenterRef.current = getTouchCenter(touch1, touch2)
          lastPanPositionRef.current = initialCenterRef.current
        }
      } else {
        // More than 2 touches - clear all timers and states
        clearTapHoldTimer()
      }
    },
    [enabled, handlers, getTouchCanvasCoordinates, getTouchDistance, getTouchCenter, clearTapHoldTimer, tapHoldDelay]
  )

  // Handle touch move
  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!enabled) return

      event.preventDefault()

      // Update stored touches
      for (let i = 0; i < event.touches.length; i++) {
        const touch = event.touches[i]
        touchesRef.current[touch.identifier] = touch
      }

      const touchCount = Object.keys(touchesRef.current).length

      if (touchCount === 1) {
        // Single touch movement - clear tap hold timer and potentially handle pan
        clearTapHoldTimer()

        const touch = Object.values(touchesRef.current)[0]
        if (!lastPanPositionRef.current) {
          // Fallback: initialize if somehow missed in touchstart
          lastPanPositionRef.current = { x: touch.clientX, y: touch.clientY }
          return
        }

        const deltaX = touch.clientX - lastPanPositionRef.current.x
        const deltaY = touch.clientY - lastPanPositionRef.current.y
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

        if (distance > panThreshold) {
          hasPannedRef.current = true
          // Only trigger pan if handler exists (can be disabled via undefined)
          if (handlers.onPan) {
            handlers.onPan(deltaX, deltaY)
          }
          lastPanPositionRef.current = { x: touch.clientX, y: touch.clientY }
        }
      } else if (touchCount === 2) {
        // Two touch movement - handle pinch zoom
        clearTapHoldTimer()

        const touches = Object.values(touchesRef.current)
        if (touches.length >= 2 && initialDistanceRef.current > 0 && initialCenterRef.current) {
          const touch1 = touches[0]
          const touch2 = touches[1]

          const currentDistance = getTouchDistance(touch1, touch2)
          const currentCenter = getTouchCenter(touch1, touch2)

          // Calculate scale delta
          const scaleDelta = currentDistance / initialDistanceRef.current

          if (Math.abs(scaleDelta - 1) > 0.05) {
            // Threshold to avoid micro-movements
            hasPinchedRef.current = true
            if (handlers.onPinchZoom) {
              const canvasCoords = getTouchCanvasCoordinates({
                clientX: currentCenter.x,
                clientY: currentCenter.y,
              } as Touch)

              if (canvasCoords) {
                handlers.onPinchZoom(scaleDelta, canvasCoords.x, canvasCoords.y)
              }
            }

            // Update initial distance for continuous pinching
            initialDistanceRef.current = currentDistance
          }

          // Handle two-finger pan
          if (lastPanPositionRef.current && !hasPinchedRef.current) {
            const deltaX = currentCenter.x - lastPanPositionRef.current.x
            const deltaY = currentCenter.y - lastPanPositionRef.current.y
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

            if (distance > panThreshold && handlers.onPan) {
              handlers.onPan(deltaX, deltaY)
            }
          }

          lastPanPositionRef.current = currentCenter
        }
      }
    },
    [enabled, handlers, getTouchDistance, getTouchCenter, getTouchCanvasCoordinates, clearTapHoldTimer, panThreshold]
  )

  // Handle touch end
  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (!enabled) return

      event.preventDefault()

      // Remove ended touches from our tracking
      const endedTouches = Array.from(event.changedTouches)
      endedTouches.forEach(touch => {
        delete touchesRef.current[touch.identifier]
      })

      const remainingTouchCount = Object.keys(touchesRef.current).length

      if (remainingTouchCount === 0) {
        // All touches ended
        if (!hasPannedRef.current && !hasPinchedRef.current && tapHoldTimerRef.current) {
          // It was a simple tap - clear timer and trigger tap
          clearTapHoldTimer()

          if (handlers.onTap && endedTouches.length === 1) {
            const coords = getTouchCanvasCoordinates(endedTouches[0])
            if (coords) {
              handlers.onTap(coords.x, coords.y)
            }
          }
        } else {
          clearTapHoldTimer()
        }

        // Reset all state
        initialDistanceRef.current = 0
        initialCenterRef.current = null
        lastPanPositionRef.current = null
        hasPannedRef.current = false
        hasPinchedRef.current = false
      } else if (remainingTouchCount === 1) {
        // One touch remaining - reset for potential single touch gestures
        const remainingTouch = Object.values(touchesRef.current)[0]
        lastPanPositionRef.current = { x: remainingTouch.clientX, y: remainingTouch.clientY }

        // Reset pinch state
        initialDistanceRef.current = 0
        initialCenterRef.current = null
      }
    },
    [enabled, handlers, getTouchCanvasCoordinates, clearTapHoldTimer]
  )

  // Handle touch cancel
  const handleTouchCancel = useCallback(
    (event: TouchEvent) => {
      if (!enabled) return

      // Clear all state on cancel
      touchesRef.current = {}
      initialDistanceRef.current = 0
      initialCenterRef.current = null
      lastPanPositionRef.current = null
      hasPannedRef.current = false
      hasPinchedRef.current = false
      clearTapHoldTimer()
    },
    [enabled, clearTapHoldTimer]
  )

  // Set up event listeners
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !enabled) return

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', handleTouchCancel, { passive: false })

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
      canvas.removeEventListener('touchcancel', handleTouchCancel)

      // Clear all touch state when listeners are re-registered (e.g., mode switch)
      // Without this, stale touch entries from a previous mode can persist and
      // cause single-finger drags to be misdetected as two-finger pinch-zoom
      touchesRef.current = {}
      initialDistanceRef.current = 0
      initialCenterRef.current = null
      lastPanPositionRef.current = null
      hasPannedRef.current = false
      hasPinchedRef.current = false
      clearTapHoldTimer()
    }
  }, [canvasRef, enabled, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, clearTapHoldTimer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTapHoldTimer()
    }
  }, [clearTapHoldTimer])

  return {
    // Expose some state for debugging or external use
    isActive: Object.keys(touchesRef.current).length > 0,
    touchCount: Object.keys(touchesRef.current).length,
  }
}
