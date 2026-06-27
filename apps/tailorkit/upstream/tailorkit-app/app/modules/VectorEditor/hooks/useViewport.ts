/**
 * useViewport - Manages zoom and pan state for the canvas
 * Pan/zoom patterns aligned with MockupWizard/VectorWizard for consistent UX
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ParsedSvg, Point } from '../utils/svg'
import {
  MIN_SCALE,
  MAX_SCALE,
  ZOOM_FACTOR,
  DEFAULT_PADDING,
  TOOLBAR_PADDING,
  BOTTOM_PADDING,
  MAX_FIT_SCALE,
} from '../constants'

// Zoom sensitivity settings (aligned with MockupWizard)
const ZOOM_SPEED_FACTOR = 0.8 // Controls zoom sensitivity (MockupWizard uses 0.8)
const ZOOM_BASE_SENSITIVITY = 0.005 // Base zoom sensitivity multiplier
const MAX_ZOOM_SPEED = 25 // Maximum deltaY to prevent too fast zoom
const PAN_SPEED = 1.0 // Linear 1:1 pan mapping

interface UseViewportOptions {
  parsedSvg: ParsedSvg | null
  canvasSize: { width: number; height: number }
}

interface UseViewportReturn {
  scale: number
  offset: Point
  scaleRef: React.MutableRefObject<number>
  offsetRef: React.MutableRefObject<Point>
  screenToSvg: (screenX: number, screenY: number) => Point
  svgToScreen: (svgX: number, svgY: number) => Point
  setScale: (scale: number) => void
  setOffset: (offset: Point) => void
  commitViewport: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetViewport: () => void
  fitToView: () => void
  handleWheel: (e: React.WheelEvent, canvasRect: DOMRect) => void
  isInitialized: boolean
}

export function useViewport({ parsedSvg, canvasSize }: UseViewportOptions): UseViewportReturn {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const viewportInitializedRef = useRef(false)

  // Refs for real-time values during interactions (avoids re-renders)
  const scaleRef = useRef(scale)
  const offsetRef = useRef(offset)

  // Sync refs when state changes
  useEffect(() => {
    scaleRef.current = scale
    offsetRef.current = offset
  }, [scale, offset])

  // Fit SVG to canvas on initial mount only
  useEffect(() => {
    if (!parsedSvg || viewportInitializedRef.current) return
    if (canvasSize.width === 0 || canvasSize.height === 0) return

    const { viewBox } = parsedSvg
    const horizontalPadding = DEFAULT_PADDING
    const topPadding = TOOLBAR_PADDING // Extra space for toolbar overlay
    const bottomPadding = BOTTOM_PADDING // Extra space at bottom
    const verticalPadding = topPadding + bottomPadding

    const scaleX = (canvasSize.width - horizontalPadding * 2) / viewBox.width
    const scaleY = (canvasSize.height - verticalPadding) / viewBox.height
    const fitScale = Math.min(scaleX, scaleY, MAX_FIT_SCALE)

    // Center horizontally, but offset vertically to account for toolbar
    const verticalCenter = topPadding + (canvasSize.height - verticalPadding - viewBox.height * fitScale) / 2

    setScale(fitScale)
    setOffset({
      x: (canvasSize.width - viewBox.width * fitScale) / 2 - viewBox.x * fitScale,
      y: verticalCenter - viewBox.y * fitScale,
    })
    viewportInitializedRef.current = true
  }, [parsedSvg, canvasSize])

  // Transform screen coordinates to SVG coordinates (uses refs for stable identity)
  const screenToSvg = useCallback(
    (screenX: number, screenY: number): Point => ({
      x: (screenX - offsetRef.current.x) / scaleRef.current,
      y: (screenY - offsetRef.current.y) / scaleRef.current,
    }),
    [] // Empty deps - uses refs
  )

  // Transform SVG coordinates to screen coordinates (uses refs for stable identity)
  const svgToScreen = useCallback(
    (svgX: number, svgY: number): Point => ({
      x: svgX * scaleRef.current + offsetRef.current.x,
      y: svgY * scaleRef.current + offsetRef.current.y,
    }),
    [] // Empty deps - uses refs
  )

  // Commit viewport state (call at end of pan/zoom interaction)
  const commitViewport = useCallback(() => {
    setScale(scaleRef.current)
    setOffset({ ...offsetRef.current })
  }, [])

  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(MAX_SCALE, prev * ZOOM_FACTOR))
  }, [])

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(MIN_SCALE, prev / ZOOM_FACTOR))
  }, [])

  const fitToView = useCallback(() => {
    if (!parsedSvg) return

    const { viewBox } = parsedSvg
    const horizontalPadding = DEFAULT_PADDING
    const topPadding = TOOLBAR_PADDING // Extra space for toolbar overlay
    const bottomPadding = BOTTOM_PADDING // Extra space at bottom
    const verticalPadding = topPadding + bottomPadding

    const scaleX = (canvasSize.width - horizontalPadding * 2) / viewBox.width
    const scaleY = (canvasSize.height - verticalPadding) / viewBox.height
    const fitScale = Math.min(scaleX, scaleY, MAX_FIT_SCALE)

    // Center horizontally, but offset vertically to account for toolbar
    const verticalCenter = topPadding + (canvasSize.height - verticalPadding - viewBox.height * fitScale) / 2

    setScale(fitScale)
    setOffset({
      x: (canvasSize.width - viewBox.width * fitScale) / 2 - viewBox.x * fitScale,
      y: verticalCenter - viewBox.y * fitScale,
    })
  }, [parsedSvg, canvasSize])

  const resetViewport = useCallback(() => {
    viewportInitializedRef.current = false
    fitToView()
    viewportInitializedRef.current = true
  }, [fitToView])

  // Handle wheel: Ctrl + wheel = zoom, plain wheel = pan
  // Zoom calculation aligned with MockupWizard for consistent feel
  const handleWheel = useCallback(
    (e: React.WheelEvent, canvasRect: DOMRect) => {
      const isZooming = e.ctrlKey || e.metaKey

      if (isZooming) {
        // Ctrl/Cmd + wheel = zoom (using MockupWizard's continuous delta-based zoom)
        const mouseX = e.clientX - canvasRect.left
        const mouseY = e.clientY - canvasRect.top

        // Limit zoom speed to prevent too fast zooming (MockupWizard pattern)
        let deltaY = e.deltaY
        if (deltaY > MAX_ZOOM_SPEED) deltaY = MAX_ZOOM_SPEED
        else if (deltaY < -MAX_ZOOM_SPEED) deltaY = -MAX_ZOOM_SPEED

        // Calculate new scale using MockupWizard formula
        // newScale = oldScale - deltaY * oldScale * (0.005 * speedFactor)
        const newScale = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, scale - deltaY * scale * (ZOOM_BASE_SENSITIVITY * ZOOM_SPEED_FACTOR))
        )

        // Calculate zoom ratio for position adjustment
        const zoomRatio = newScale / scale - 1

        // Zoom toward mouse position (MockupWizard pattern)
        const newX = offset.x - (mouseX - offset.x) * zoomRatio
        const newY = offset.y - (mouseY - offset.y) * zoomRatio

        setScale(newScale)
        setOffset({ x: newX, y: newY })
      } else {
        // Plain wheel = pan (linear 1:1 mapping)
        const newX = offset.x - e.deltaX * PAN_SPEED
        const newY = offset.y - e.deltaY * PAN_SPEED
        setOffset({ x: newX, y: newY })
      }
    },
    [scale, offset]
  )

  return {
    scale,
    offset,
    scaleRef,
    offsetRef,
    screenToSvg,
    svgToScreen,
    setScale,
    setOffset,
    commitViewport,
    zoomIn,
    zoomOut,
    resetViewport,
    fitToView,
    handleWheel,
    isInitialized: viewportInitializedRef.current,
  }
}
