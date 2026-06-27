import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isMobile } from 'react-device-detect'
import type { Dimension, ViewPort } from '~/types/template'
import { calculateOnMoving, calculateOnZooming } from '~/utils/canvas/zoom'
import type Konva from 'konva'
import { usePinchZoom } from '~/components/canvas/hooks/usePinchZoom'
import { PinchZoomContext } from '~/components/canvas/hooks/PinchZoomContext'

/** Timeout duration for wheeling state reset in milliseconds */
const WHEELING_TIMEOUT = 50
/** Minimum percentage of template that must remain visible */
const VISIBLE_PERCENTAGE = 5
/** Speed factor for panning */
const SPEED_FACTOR = 0.8

/**
 * Props for the ZoomComponent
 * @interface IZoomComponentProps
 */
export interface IZoomComponentProps {
  /** Child elements to render within the zoom container */
  children: React.ReactNode
  /** Reference to the Konva Stage */
  stageRef: React.RefObject<Konva.Stage>
  /** Current viewport state (scale, position) */
  viewport: ViewPort
  /** Template dimension information */
  dimension: Dimension | null
  /** Speed factor for panning. Default is 0.8 */
  speedFactor?: number
  /** Whether the mode is currently grabbing */
  isGrabbing?: boolean
  /** Callback function to handle viewport changes */
  onWheel?: (_viewport: ViewPort) => void
}

/**
 * ZoomComponent handles zooming and panning interactions for the template editor
 * Maintains visibility constraints and smooth transitions during user interaction
 * @param {IZoomComponentProps} props - Component props
 * @returns {JSX.Element} Zoom container with managed interactions
 */
export function ZoomComponent(props: IZoomComponentProps) {
  const { dimension, viewport, stageRef, speedFactor = SPEED_FACTOR, isGrabbing, onWheel } = props

  const parentRef = useRef<HTMLDivElement>(null)
  const [wheeling, setWheeling] = useState(false)
  const [isMouseDown, setIsMouseDown] = useState(false)
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null)

  /**
   * Checks if the given viewport maintains minimum template visibility
   * Ensures at least VISIBLE_PERCENTAGE (5%) of template remains visible
   * @param {ViewPort} newViewport - Viewport state to check
   * @returns {boolean} True if viewport maintains minimum visibility
   */
  const isWithinBounds = useCallback(
    (newViewport: ViewPort): boolean => {
      if (!dimension || !stageRef.current) return true

      const { left, top, scale } = newViewport
      const stage = stageRef.current

      const stageWidth = stage.width()
      const stageHeight = stage.height()

      const scaledWidth = dimension.width * scale
      const scaledHeight = dimension.height * scale

      // Calculate visible area percentages
      const visibleWidth = Math.min(stageWidth, scaledWidth + left) - Math.max(0, left)
      const visibleHeight = Math.min(stageHeight, scaledHeight + top) - Math.max(0, top)

      const visiblePercentageWidth = (visibleWidth / scaledWidth) * 100
      const visiblePercentageHeight = (visibleHeight / scaledHeight) * 100

      // At least 5% must be visible in both dimensions
      return visiblePercentageWidth >= VISIBLE_PERCENTAGE && visiblePercentageHeight >= VISIBLE_PERCENTAGE
    },
    [dimension, stageRef]
  )

  /**
   * Updates the viewport transform through the provided callback
   * @param {ViewPort} _viewport - New viewport state to apply
   */
  const updateTransform = useCallback(
    (_viewport: ViewPort) => {
      onWheel?.(_viewport)
    },
    [onWheel]
  )

  const pointerTimeoutRef = useRef<any>(null)
  const handleAnimationFrame = useRef<number | null>(null)

  /**
   * Updates viewport with animation frame synchronization
   * Prevents multiple updates within the same frame
   * @param {ViewPort} newViewport - New viewport state to apply
   */
  const updateWithAnimationFrame = useCallback(
    (newViewport: ViewPort) => {
      if (handleAnimationFrame.current) {
        cancelAnimationFrame(handleAnimationFrame.current)
      }
      handleAnimationFrame.current = requestAnimationFrame(() => {
        updateTransform(newViewport)
        handleAnimationFrame.current = null
      })
    },
    [updateTransform]
  )

  /**
   * Handles wheel events for both zooming and panning
   * Maintains visibility constraints and smooth transitions
   * @param {WheelEvent} e - Wheel event
   */
  const wheelEventHandler = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()

      const isZooming = e.ctrlKey || e.metaKey
      const { scale, left, top } = viewport

      if (!dimension) return
      if (!parentRef.current) return

      const moveableLayer = parentRef.current.querySelector('.moveable-layer') as HTMLDivElement | null

      if (pointerTimeoutRef.current) {
        clearTimeout(pointerTimeoutRef.current)
      }

      if (moveableLayer) {
        moveableLayer.style.pointerEvents = 'none'
      }

      if (!wheeling) {
        setWheeling(true)
        return
      }

      let _viewport: ViewPort

      if (isZooming) {
        _viewport = calculateOnZooming({ e, oldScale: scale, oldLeft: left, oldTop: top, speedFactor })
      } else {
        const deltaX = (e.altKey ? e.deltaY : e.deltaX) * speedFactor
        const deltaY = (e.altKey ? e.deltaX : e.deltaY) * speedFactor
        _viewport = calculateOnMoving(deltaX, deltaY, left, top, scale)
      }

      // Only check bounds if we're trying to move more than 95% of template out of view
      const isWithinStageViewport = isWithinBounds(_viewport)
      if (isWithinStageViewport) {
        updateWithAnimationFrame(_viewport)
      }

      pointerTimeoutRef.current = setTimeout(() => {
        if (moveableLayer) {
          moveableLayer.style.pointerEvents = 'auto'
        }
        setWheeling(false)
      }, WHEELING_TIMEOUT)
    },
    [viewport, dimension, wheeling, isWithinBounds, speedFactor, updateWithAnimationFrame]
  )

  /**
   * Handles the mouse down event when the Alt key is pressed.
   * Sets the mouse down state and records the initial mouse position.
   *
   * @param {MouseEvent} e - The mouse event.
   */
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (isGrabbing) {
        e.preventDefault()
        setIsMouseDown(true)
        lastMousePosRef.current = { x: e.clientX, y: e.clientY }
      }
    },
    [isGrabbing]
  )

  /**
   * Handles the mouse move event when the Alt key is pressed and the mouse is down.
   * Calculates the movement delta and updates the viewport accordingly.
   *
   * @param {MouseEvent} e - The mouse event.
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isGrabbing && isMouseDown && lastMousePosRef.current) {
        e.preventDefault()
        const deltaX = e.clientX - lastMousePosRef.current.x
        const deltaY = e.clientY - lastMousePosRef.current.y
        lastMousePosRef.current = { x: e.clientX, y: e.clientY }

        const _viewport = calculateOnMoving(
          -deltaX * speedFactor,
          -deltaY * speedFactor,
          viewport.left,
          viewport.top,
          viewport.scale
        )

        if (isWithinBounds(_viewport)) {
          updateWithAnimationFrame(_viewport)
        }
      }
    },
    [isGrabbing, isMouseDown, viewport, speedFactor, updateWithAnimationFrame, isWithinBounds]
  )

  /**
   * Handles the mouse up event.
   * Resets the mouse down state and clears the last mouse position.
   */
  const handleMouseUp = useCallback(() => {
    setIsMouseDown(false)
    lastMousePosRef.current = null
  }, [])

  // Handle mouse events for panning
  useEffect(() => {
    if (!parentRef.current) return

    const element = parentRef.current
    element.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      element.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp])

  // Set up wheel event listeners
  useEffect(() => {
    const parentCurrent = parentRef.current

    if (!parentCurrent) return

    parentCurrent.addEventListener('wheel', wheelEventHandler, {
      passive: false,
      capture: true,
    })

    return () => {
      parentCurrent.removeEventListener('wheel', wheelEventHandler, {
        capture: true,
      })
    }
  }, [wheelEventHandler])

  // Add pinch zoom for mobile/tablet devices
  const { wasPinchingRef } = usePinchZoom({
    stageRef,
    viewport,
    enabled: isMobile,
    onViewportChange: updateTransform,
    isWithinBounds,
  })

  // Memoize context value to avoid unnecessary re-renders
  const pinchZoomContextValue = useMemo(() => ({ wasPinchingRef }), [wasPinchingRef])

  const cursor = useMemo(() => {
    if (isGrabbing) {
      if (isMouseDown) {
        return 'grabbing'
      }
      return 'grab'
    }

    return ''
  }, [isGrabbing, isMouseDown])

  return (
    <PinchZoomContext.Provider value={pinchZoomContextValue}>
      <div
        id="zoom-component-container"
        style={{
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          cursor,
          touchAction: 'none', // Prevent browser pinch zoom
        }}
        ref={parentRef}
      >
        {props.children}
      </div>
    </PinchZoomContext.Provider>
  )
}
