/**
 * useTouchGestures - Custom hook for mobile touch gesture detection
 * Handles pinch-zoom, long-press, and double-tap gestures
 */

import { useRef, useCallback, useState } from 'react'

export interface TouchGestureState {
  isPinching: boolean
  isLongPressing: boolean
  pinchScale: number
  pinchCenter: { x: number; y: number } | null
  longPressPosition: { x: number; y: number } | null
}

export interface TouchGestureHandlers {
  onPinchStart?: (center: { x: number; y: number }, initialDistance: number) => void
  onPinchMove?: (center: { x: number; y: number }, scale: number) => void
  onPinchEnd?: () => void
  onLongPress?: (position: { x: number; y: number }) => void
  onDoubleTap?: (position: { x: number; y: number }) => void
}

interface TouchState {
  startTime: number
  startPosition: { x: number; y: number }
  initialPinchDistance: number | null
  initialPinchCenter: { x: number; y: number } | null
  lastTapTime: number
  lastTapPosition: { x: number; y: number } | null
}

const LONG_PRESS_DURATION = 500 // ms
const DOUBLE_TAP_THRESHOLD = 300 // ms
const DOUBLE_TAP_DISTANCE = 30 // px
const PINCH_THRESHOLD = 10 // px minimum distance change to trigger pinch

/**
 * Calculate distance between two touch points
 */
function getTouchDistance(touches: React.TouchList): number {
  if (touches.length < 2) return 0
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate center point between two touches
 */
function getTouchCenter(touches: React.TouchList): { x: number; y: number } {
  if (touches.length < 2) {
    return { x: touches[0].clientX, y: touches[0].clientY }
  }
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  }
}

/**
 * Get coordinates from single touch event relative to element
 */
export function getTouchCoordinates(
  e: React.TouchEvent,
  rect: DOMRect
): { clientX: number; clientY: number; screenX: number; screenY: number } {
  const touch = e.touches[0] || e.changedTouches[0]
  return {
    clientX: touch.clientX,
    clientY: touch.clientY,
    screenX: touch.clientX - rect.left,
    screenY: touch.clientY - rect.top,
  }
}

export default function useTouchGestures(handlers: TouchGestureHandlers = {}) {
  const { onPinchStart, onPinchMove, onPinchEnd, onLongPress, onDoubleTap } = handlers

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStateRef = useRef<TouchState>({
    startTime: 0,
    startPosition: { x: 0, y: 0 },
    initialPinchDistance: null,
    initialPinchCenter: null,
    lastTapTime: 0,
    lastTapPosition: null,
  })

  const [gestureState, setGestureState] = useState<TouchGestureState>({
    isPinching: false,
    isLongPressing: false,
    pinchScale: 1,
    pinchCenter: null,
    longPressPosition: null,
  })

  // Clear long press timer
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  // Handle touch start
  const handleTouchStart = useCallback(
    (e: React.TouchEvent, rect: DOMRect) => {
      const touches = e.touches
      const now = Date.now()
      const coords = getTouchCoordinates(e, rect)

      // Multi-touch: pinch gesture
      if (touches.length === 2) {
        clearLongPressTimer()
        const distance = getTouchDistance(touches)
        const center = getTouchCenter(touches)

        touchStateRef.current.initialPinchDistance = distance
        touchStateRef.current.initialPinchCenter = {
          x: center.x - rect.left,
          y: center.y - rect.top,
        }

        setGestureState(prev => ({
          ...prev,
          isPinching: true,
          pinchScale: 1,
          pinchCenter: touchStateRef.current.initialPinchCenter,
        }))

        onPinchStart?.(touchStateRef.current.initialPinchCenter!, distance)
        return { gesture: 'pinch-start' as const }
      }

      // Single touch
      touchStateRef.current.startTime = now
      touchStateRef.current.startPosition = { x: coords.screenX, y: coords.screenY }

      // Check for double tap
      const lastTap = touchStateRef.current.lastTapPosition
      if (
        lastTap
        && now - touchStateRef.current.lastTapTime < DOUBLE_TAP_THRESHOLD
        && Math.abs(coords.screenX - lastTap.x) < DOUBLE_TAP_DISTANCE
        && Math.abs(coords.screenY - lastTap.y) < DOUBLE_TAP_DISTANCE
      ) {
        clearLongPressTimer()
        touchStateRef.current.lastTapTime = 0
        touchStateRef.current.lastTapPosition = null
        onDoubleTap?.({ x: coords.screenX, y: coords.screenY })
        return { gesture: 'double-tap' as const, position: { x: coords.screenX, y: coords.screenY } }
      }

      // Start long press timer
      longPressTimerRef.current = setTimeout(() => {
        setGestureState(prev => ({
          ...prev,
          isLongPressing: true,
          longPressPosition: { x: coords.screenX, y: coords.screenY },
        }))
        onLongPress?.({ x: coords.screenX, y: coords.screenY })
      }, LONG_PRESS_DURATION)

      return { gesture: 'single-touch' as const }
    },
    [clearLongPressTimer, onPinchStart, onDoubleTap, onLongPress]
  )

  // Handle touch move
  const handleTouchMove = useCallback(
    (e: React.TouchEvent, rect: DOMRect) => {
      const touches = e.touches

      // Pinch gesture
      if (touches.length === 2 && touchStateRef.current.initialPinchDistance) {
        const distance = getTouchDistance(touches)
        const center = getTouchCenter(touches)
        const screenCenter = {
          x: center.x - rect.left,
          y: center.y - rect.top,
        }

        const scale = distance / touchStateRef.current.initialPinchDistance

        setGestureState(prev => ({
          ...prev,
          pinchScale: scale,
          pinchCenter: screenCenter,
        }))

        onPinchMove?.(screenCenter, scale)
        return { gesture: 'pinch-move' as const, scale }
      }

      // Single touch - check if moved beyond threshold (cancel long press)
      if (touches.length === 1) {
        const coords = getTouchCoordinates(e, rect)
        const startPos = touchStateRef.current.startPosition
        const moveDistance = Math.sqrt(
          Math.pow(coords.screenX - startPos.x, 2) + Math.pow(coords.screenY - startPos.y, 2)
        )

        // If moved significantly, cancel long press
        if (moveDistance > PINCH_THRESHOLD) {
          clearLongPressTimer()
          setGestureState(prev => ({
            ...prev,
            isLongPressing: false,
            longPressPosition: null,
          }))
        }

        return { gesture: 'single-move' as const, moved: moveDistance > PINCH_THRESHOLD }
      }

      return { gesture: 'none' as const }
    },
    [clearLongPressTimer, onPinchMove]
  )

  // Handle touch end
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent, rect: DOMRect) => {
      clearLongPressTimer()

      const now = Date.now()

      // End pinch gesture
      if (gestureState.isPinching) {
        setGestureState(prev => ({
          ...prev,
          isPinching: false,
          pinchScale: 1,
          pinchCenter: null,
        }))
        touchStateRef.current.initialPinchDistance = null
        touchStateRef.current.initialPinchCenter = null
        onPinchEnd?.()
        return { gesture: 'pinch-end' as const }
      }

      // End long press
      if (gestureState.isLongPressing) {
        setGestureState(prev => ({
          ...prev,
          isLongPressing: false,
          longPressPosition: null,
        }))
        return { gesture: 'long-press-end' as const }
      }

      // Record tap for double-tap detection
      const coords = getTouchCoordinates(e, rect)
      const touchDuration = now - touchStateRef.current.startTime
      const startPos = touchStateRef.current.startPosition
      const moveDistance = Math.sqrt(
        Math.pow(coords.screenX - startPos.x, 2) + Math.pow(coords.screenY - startPos.y, 2)
      )

      // Only count as tap if short duration and minimal movement
      if (touchDuration < LONG_PRESS_DURATION && moveDistance < PINCH_THRESHOLD) {
        touchStateRef.current.lastTapTime = now
        touchStateRef.current.lastTapPosition = { x: coords.screenX, y: coords.screenY }
        return { gesture: 'tap' as const, position: { x: coords.screenX, y: coords.screenY } }
      }

      return { gesture: 'none' as const }
    },
    [clearLongPressTimer, gestureState.isPinching, gestureState.isLongPressing, onPinchEnd]
  )

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    clearLongPressTimer()
    setGestureState({
      isPinching: false,
      isLongPressing: false,
      pinchScale: 1,
      pinchCenter: null,
      longPressPosition: null,
    })
  }, [clearLongPressTimer])

  return {
    gestureState,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    cleanup,
    getTouchCoordinates,
  }
}
