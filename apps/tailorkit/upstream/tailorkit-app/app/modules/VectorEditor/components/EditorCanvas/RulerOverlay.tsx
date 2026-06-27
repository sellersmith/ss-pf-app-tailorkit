/**
 * RulerOverlay - Renders rulers at the top and left edges of the canvas
 *
 * Features:
 * - Tick marks at regular intervals based on zoom level
 * - Position labels at major ticks
 * - Mouse position indicator
 * - Drag-to-create guidelines
 */

import { useRef, useCallback, useState, useEffect } from 'react'
import type { Point, ViewBox, Guideline } from '../../types'
import { RULER_SIZE, RULER_MAJOR_TICK, RULER_MINOR_TICKS, EDIT_MODE_COLORS, GRID_SNAP_THRESHOLD } from '../../constants'
import { snapGuidelineToSelection } from '../../utils/snap'
import styles from './styles.module.css'

export interface RulerOverlayProps {
  /** Canvas dimensions */
  canvasSize: { width: number; height: number }
  /** Current viewport scale */
  scale: number
  /** Current viewport offset */
  offset: Point
  /** Current viewBox */
  viewBox: ViewBox
  /** Current mouse position in SVG coordinates (for indicator) */
  mousePosition: Point | null
  /** Callback when a new guideline should be created */
  onGuidelineCreate: (axis: 'x' | 'y', position: number) => string
  /** Existing guidelines (for visual feedback during drag) */
  guidelines: Guideline[]
  /** Selection bounds for snapping (optional) */
  selectionBounds?: { minX: number; minY: number; maxX: number; maxY: number } | null
}

interface DragState {
  /** Axis of the guideline being dragged */
  axis: 'x' | 'y'
  /** Current position in SVG coordinates */
  currentPosition: number
  /** Whether the guideline is currently snapped to selection */
  isSnapped: boolean
}

/**
 * RulerOverlay component
 *
 * Renders horizontal ruler at top and vertical ruler at left.
 * Handles drag interactions for creating guidelines.
 */
export function RulerOverlay({
  canvasSize,
  scale,
  offset,
  viewBox,
  mousePosition,
  onGuidelineCreate,
  selectionBounds,
}: RulerOverlayProps) {
  const horizontalRef = useRef<HTMLCanvasElement>(null)
  const verticalRef = useRef<HTMLCanvasElement>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)

  // Calculate tick interval based on zoom level
  const getTickInterval = useCallback(() => {
    const baseTick = RULER_MAJOR_TICK
    const pixelsPerTick = baseTick * scale

    // Adjust tick interval to keep labels readable
    if (pixelsPerTick < 30) {
      return baseTick * Math.ceil(30 / pixelsPerTick)
    }
    if (pixelsPerTick > 200) {
      return baseTick / Math.floor(pixelsPerTick / 100)
    }

    return baseTick
  }, [scale])

  // Render horizontal ruler
  const renderHorizontalRuler = useCallback(() => {
    const canvas = horizontalRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Ruler width matches its display width
    const rulerWidth = canvasSize.width - RULER_SIZE
    const tickInterval = getTickInterval()

    // Set canvas buffer size to match display size (accounting for device pixel ratio)
    const dpr = window.devicePixelRatio || 1
    canvas.width = rulerWidth * dpr
    canvas.height = RULER_SIZE * dpr
    ctx.scale(dpr, dpr)

    // Clear and fill background
    ctx.fillStyle = EDIT_MODE_COLORS.rulerBackground
    ctx.fillRect(0, 0, rulerWidth, RULER_SIZE)

    // Draw border
    ctx.strokeStyle = EDIT_MODE_COLORS.rulerBorder
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, RULER_SIZE - 0.5)
    ctx.lineTo(rulerWidth, RULER_SIZE - 0.5)
    ctx.stroke()

    // Calculate visible SVG range for the ruler area
    // The ruler starts at container position RULER_SIZE, so:
    // - Ruler position 0 = container position RULER_SIZE
    // - SVG x at ruler position 0 = (RULER_SIZE - offset.x) / scale
    const visibleMinX = (RULER_SIZE - offset.x) / scale
    const visibleMaxX = (RULER_SIZE + rulerWidth - offset.x) / scale

    // Draw ticks and labels
    ctx.fillStyle = EDIT_MODE_COLORS.rulerText
    ctx.strokeStyle = EDIT_MODE_COLORS.ruler
    ctx.font = '10px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const startTick = Math.floor(visibleMinX / tickInterval) * tickInterval
    const endTick = Math.ceil(visibleMaxX / tickInterval) * tickInterval

    for (let tick = startTick; tick <= endTick; tick += tickInterval) {
      // Convert SVG position to ruler canvas position
      // Container position = tick * scale + offset.x
      // Ruler canvas position = container position - RULER_SIZE
      const rulerX = tick * scale + offset.x - RULER_SIZE

      // Major tick
      ctx.beginPath()
      ctx.moveTo(rulerX, RULER_SIZE - 12)
      ctx.lineTo(rulerX, RULER_SIZE)
      ctx.stroke()

      // Label
      ctx.fillText(String(Math.round(tick)), rulerX, 2)

      // Minor ticks
      const minorInterval = tickInterval / RULER_MINOR_TICKS
      for (let i = 1; i < RULER_MINOR_TICKS; i++) {
        const minorTick = tick + i * minorInterval
        const minorRulerX = minorTick * scale + offset.x - RULER_SIZE
        ctx.beginPath()
        ctx.moveTo(minorRulerX, RULER_SIZE - 6)
        ctx.lineTo(minorRulerX, RULER_SIZE)
        ctx.stroke()
      }
    }

    // Draw mouse position indicator
    if (mousePosition) {
      const indicatorX = mousePosition.x * scale + offset.x - RULER_SIZE
      ctx.fillStyle = EDIT_MODE_COLORS.guideline
      ctx.beginPath()
      ctx.moveTo(indicatorX, RULER_SIZE)
      ctx.lineTo(indicatorX - 4, RULER_SIZE - 8)
      ctx.lineTo(indicatorX + 4, RULER_SIZE - 8)
      ctx.closePath()
      ctx.fill()
    }
  }, [canvasSize, scale, offset, mousePosition, getTickInterval])

  // Render vertical ruler
  const renderVerticalRuler = useCallback(() => {
    const canvas = verticalRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Ruler height matches its display height
    const rulerHeight = canvasSize.height - RULER_SIZE
    const tickInterval = getTickInterval()

    // Set canvas buffer size to match display size
    const dpr = window.devicePixelRatio || 1
    canvas.width = RULER_SIZE * dpr
    canvas.height = rulerHeight * dpr
    ctx.scale(dpr, dpr)

    // Clear and fill background
    ctx.fillStyle = EDIT_MODE_COLORS.rulerBackground
    ctx.fillRect(0, 0, RULER_SIZE, rulerHeight)

    // Draw border
    ctx.strokeStyle = EDIT_MODE_COLORS.rulerBorder
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(RULER_SIZE - 0.5, 0)
    ctx.lineTo(RULER_SIZE - 0.5, rulerHeight)
    ctx.stroke()

    // Calculate visible SVG range for the ruler area
    // The ruler starts at container position RULER_SIZE, so:
    // - Ruler position 0 = container position RULER_SIZE
    // - SVG y at ruler position 0 = (RULER_SIZE - offset.y) / scale
    const visibleMinY = (RULER_SIZE - offset.y) / scale
    const visibleMaxY = (RULER_SIZE + rulerHeight - offset.y) / scale

    // Draw ticks and labels
    ctx.fillStyle = EDIT_MODE_COLORS.rulerText
    ctx.strokeStyle = EDIT_MODE_COLORS.ruler
    ctx.font = '10px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'

    const startTick = Math.floor(visibleMinY / tickInterval) * tickInterval
    const endTick = Math.ceil(visibleMaxY / tickInterval) * tickInterval

    for (let tick = startTick; tick <= endTick; tick += tickInterval) {
      // Convert SVG position to ruler canvas position
      // Container position = tick * scale + offset.y
      // Ruler canvas position = container position - RULER_SIZE
      const rulerY = tick * scale + offset.y - RULER_SIZE

      // Major tick
      ctx.beginPath()
      ctx.moveTo(RULER_SIZE - 12, rulerY)
      ctx.lineTo(RULER_SIZE, rulerY)
      ctx.stroke()

      // Label (rotated)
      ctx.save()
      ctx.translate(10, rulerY)
      ctx.rotate(-Math.PI / 2)
      ctx.textAlign = 'center'
      ctx.fillText(String(Math.round(tick)), 0, 0)
      ctx.restore()

      // Minor ticks
      const minorInterval = tickInterval / RULER_MINOR_TICKS
      for (let i = 1; i < RULER_MINOR_TICKS; i++) {
        const minorTick = tick + i * minorInterval
        const minorRulerY = minorTick * scale + offset.y - RULER_SIZE
        ctx.beginPath()
        ctx.moveTo(RULER_SIZE - 6, minorRulerY)
        ctx.lineTo(RULER_SIZE, minorRulerY)
        ctx.stroke()
      }
    }

    // Draw mouse position indicator
    if (mousePosition) {
      const indicatorY = mousePosition.y * scale + offset.y - RULER_SIZE
      ctx.fillStyle = EDIT_MODE_COLORS.guideline
      ctx.beginPath()
      ctx.moveTo(RULER_SIZE, indicatorY)
      ctx.lineTo(RULER_SIZE - 8, indicatorY - 4)
      ctx.lineTo(RULER_SIZE - 8, indicatorY + 4)
      ctx.closePath()
      ctx.fill()
    }
  }, [canvasSize, scale, offset, mousePosition, getTickInterval])

  // Handle mouse down on horizontal ruler (start drag preview for horizontal guideline)
  // Horizontal ruler creates horizontal guidelines (same orientation as ruler)
  const handleHorizontalMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      // For horizontal guideline, we track Y position as user drags down from horizontal ruler
      // Initial Y position is at the ruler bottom edge (RULER_SIZE in container coords)
      const svgY = (RULER_SIZE - offset.y) / scale

      // Start drag preview - axis 'y' means horizontal line (constrains Y position)
      setDragState({ axis: 'y', currentPosition: svgY, isSnapped: false })
    },
    [offset.y, scale]
  )

  // Handle mouse down on vertical ruler (start drag preview for vertical guideline)
  // Vertical ruler creates vertical guidelines (same orientation as ruler)
  const handleVerticalMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      // For vertical guideline, we track X position as user drags right from vertical ruler
      // Initial X position is at the ruler right edge (RULER_SIZE in container coords)
      const svgX = (RULER_SIZE - offset.x) / scale

      // Start drag preview - axis 'x' means vertical line (constrains X position)
      setDragState({ axis: 'x', currentPosition: svgX, isSnapped: false })
    },
    [offset.x, scale]
  )

  // Handle touch start on horizontal ruler (for mobile guideline creation)
  const handleHorizontalTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (e.touches.length !== 1) return
      e.preventDefault()
      const svgY = (RULER_SIZE - offset.y) / scale
      setDragState({ axis: 'y', currentPosition: svgY, isSnapped: false })
    },
    [offset.y, scale]
  )

  // Handle touch start on vertical ruler (for mobile guideline creation)
  const handleVerticalTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (e.touches.length !== 1) return
      e.preventDefault()
      const svgX = (RULER_SIZE - offset.x) / scale
      setDragState({ axis: 'x', currentPosition: svgX, isSnapped: false })
    },
    [offset.x, scale]
  )

  // Store offset, scale, selection bounds, and viewBox in refs for use in global event handlers
  // This ensures we always have the latest values without recreating handlers
  const offsetRef = useRef(offset)
  const scaleRef = useRef(scale)
  const selectionBoundsRef = useRef(selectionBounds)
  const viewBoxRef = useRef(viewBox)
  useEffect(() => {
    offsetRef.current = offset
    scaleRef.current = scale
    selectionBoundsRef.current = selectionBounds
    viewBoxRef.current = viewBox
  }, [offset, scale, selectionBounds, viewBox])

  // Handle global mouse move during drag
  useEffect(() => {
    if (!dragState) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = horizontalRef.current?.parentElement
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const currentOffset = offsetRef.current
      const currentScale = scaleRef.current
      const currentSelectionBounds = selectionBoundsRef.current
      const currentViewBox = viewBoxRef.current

      if (dragState.axis === 'x') {
        // Vertical guideline - track X position
        // contentX is position relative to content area (starts at RULER_SIZE from container)
        const contentX = e.clientX - containerRect.left - RULER_SIZE
        // SVG position using same formula as tick drawing inverse:
        // tick drawing: rulerX = tick * scale + offset.x - RULER_SIZE
        // inverse: tick = (rulerX + RULER_SIZE - offset.x) / scale
        // contentX = rulerX (since ruler canvas is at content area origin)
        const svgX = (contentX + RULER_SIZE - currentOffset.x) / currentScale

        // Snap to selection bounds edges/center and viewport center
        const snapResult = snapGuidelineToSelection(
          svgX,
          'x',
          currentSelectionBounds ?? null,
          GRID_SNAP_THRESHOLD,
          currentScale,
          currentViewBox
        )
        setDragState({ axis: 'x', currentPosition: snapResult.value, isSnapped: snapResult.snapped })
      } else {
        // Horizontal guideline - track Y position
        const contentY = e.clientY - containerRect.top - RULER_SIZE
        const svgY = (contentY + RULER_SIZE - currentOffset.y) / currentScale

        // Snap to selection bounds edges/center and viewport center
        const snapResult = snapGuidelineToSelection(
          svgY,
          'y',
          currentSelectionBounds ?? null,
          GRID_SNAP_THRESHOLD,
          currentScale,
          currentViewBox
        )
        setDragState({ axis: 'y', currentPosition: snapResult.value, isSnapped: snapResult.snapped })
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragState) return

      const container = horizontalRef.current?.parentElement
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const currentOffset = offsetRef.current
      const currentScale = scaleRef.current
      const currentSelectionBounds = selectionBoundsRef.current
      const currentViewBox = viewBoxRef.current

      // Check if mouse is still in ruler area - if so, cancel creation
      const mouseX = e.clientX - containerRect.left
      const mouseY = e.clientY - containerRect.top

      // For horizontal guideline (axis 'y', created from horizontal ruler):
      // Cancel if mouse Y is still in the horizontal ruler area (y < RULER_SIZE)
      // For vertical guideline (axis 'x', created from vertical ruler):
      // Cancel if mouse X is still in the vertical ruler area (x < RULER_SIZE)
      const shouldCancel = dragState.axis === 'y' ? mouseY < RULER_SIZE : mouseX < RULER_SIZE

      if (shouldCancel) {
        // User dragged back to ruler - cancel guideline creation
        setDragState(null)
        return
      }

      // Calculate final SVG position using same formula as tick drawing inverse
      let finalPosition: number
      if (dragState.axis === 'x') {
        const contentX = e.clientX - containerRect.left - RULER_SIZE
        finalPosition = (contentX + RULER_SIZE - currentOffset.x) / currentScale

        // Snap to selection bounds edges/center and viewport center
        const snapResult = snapGuidelineToSelection(
          finalPosition,
          'x',
          currentSelectionBounds ?? null,
          GRID_SNAP_THRESHOLD,
          currentScale,
          currentViewBox
        )
        finalPosition = snapResult.value
      } else {
        const contentY = e.clientY - containerRect.top - RULER_SIZE
        finalPosition = (contentY + RULER_SIZE - currentOffset.y) / currentScale

        // Snap to selection bounds edges/center and viewport center
        const snapResult = snapGuidelineToSelection(
          finalPosition,
          'y',
          currentSelectionBounds ?? null,
          GRID_SNAP_THRESHOLD,
          currentScale,
          currentViewBox
        )
        finalPosition = snapResult.value
      }

      // Create guideline at final position
      onGuidelineCreate(dragState.axis, finalPosition)

      // Clear drag state
      setDragState(null)
    }

    // Handle touch move during drag (same logic as mouse move)
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      e.preventDefault()

      const touch = e.touches[0]
      const container = horizontalRef.current?.parentElement
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const currentOffset = offsetRef.current
      const currentScale = scaleRef.current
      const currentSelectionBounds = selectionBoundsRef.current
      const currentViewBox = viewBoxRef.current

      if (dragState.axis === 'x') {
        const contentX = touch.clientX - containerRect.left - RULER_SIZE
        const svgX = (contentX + RULER_SIZE - currentOffset.x) / currentScale

        const snapResult = snapGuidelineToSelection(
          svgX,
          'x',
          currentSelectionBounds ?? null,
          GRID_SNAP_THRESHOLD,
          currentScale,
          currentViewBox
        )
        setDragState({ axis: 'x', currentPosition: snapResult.value, isSnapped: snapResult.snapped })
      } else {
        const contentY = touch.clientY - containerRect.top - RULER_SIZE
        const svgY = (contentY + RULER_SIZE - currentOffset.y) / currentScale

        const snapResult = snapGuidelineToSelection(
          svgY,
          'y',
          currentSelectionBounds ?? null,
          GRID_SNAP_THRESHOLD,
          currentScale,
          currentViewBox
        )
        setDragState({ axis: 'y', currentPosition: snapResult.value, isSnapped: snapResult.snapped })
      }
    }

    // Handle touch end during drag (same logic as mouse up)
    const handleTouchEnd = (e: TouchEvent) => {
      if (!dragState) return

      // Use the last touch position from changedTouches
      const touch = e.changedTouches[0]
      if (!touch) {
        setDragState(null)
        return
      }

      const container = horizontalRef.current?.parentElement
      if (!container) {
        setDragState(null)
        return
      }

      const containerRect = container.getBoundingClientRect()
      const currentOffset = offsetRef.current
      const currentScale = scaleRef.current
      const currentSelectionBounds = selectionBoundsRef.current
      const currentViewBox = viewBoxRef.current

      // Check if touch is still in ruler area - if so, cancel creation
      const touchX = touch.clientX - containerRect.left
      const touchY = touch.clientY - containerRect.top

      const shouldCancel = dragState.axis === 'y' ? touchY < RULER_SIZE : touchX < RULER_SIZE

      if (shouldCancel) {
        setDragState(null)
        return
      }

      // Calculate final SVG position
      let finalPosition: number
      if (dragState.axis === 'x') {
        const contentX = touch.clientX - containerRect.left - RULER_SIZE
        finalPosition = (contentX + RULER_SIZE - currentOffset.x) / currentScale

        const snapResult = snapGuidelineToSelection(
          finalPosition,
          'x',
          currentSelectionBounds ?? null,
          GRID_SNAP_THRESHOLD,
          currentScale,
          currentViewBox
        )
        finalPosition = snapResult.value
      } else {
        const contentY = touch.clientY - containerRect.top - RULER_SIZE
        finalPosition = (contentY + RULER_SIZE - currentOffset.y) / currentScale

        const snapResult = snapGuidelineToSelection(
          finalPosition,
          'y',
          currentSelectionBounds ?? null,
          GRID_SNAP_THRESHOLD,
          currentScale,
          currentViewBox
        )
        finalPosition = snapResult.value
      }

      onGuidelineCreate(dragState.axis, finalPosition)
      setDragState(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [dragState, onGuidelineCreate])

  // Render rulers when dependencies change
  // Using useEffect would be cleaner but for simplicity, render on each call
  requestAnimationFrame(() => {
    renderHorizontalRuler()
    renderVerticalRuler()
  })

  return (
    <>
      {/* Horizontal ruler (top) - creates horizontal guidelines */}
      <canvas
        ref={horizontalRef}
        className={styles.horizontalRuler}
        style={{
          position: 'absolute',
          top: 0,
          left: RULER_SIZE,
          width: canvasSize.width - RULER_SIZE,
          height: RULER_SIZE,
          cursor: 'row-resize', // Vertical resize cursor for dragging down to create horizontal guideline
          zIndex: 10,
          touchAction: 'none', // Prevent browser handling of touch events
        }}
        onMouseDown={handleHorizontalMouseDown}
        onTouchStart={handleHorizontalTouchStart}
      />

      {/* Vertical ruler (left) - creates vertical guidelines */}
      <canvas
        ref={verticalRef}
        className={styles.verticalRuler}
        style={{
          position: 'absolute',
          top: RULER_SIZE,
          left: 0,
          width: RULER_SIZE,
          height: canvasSize.height - RULER_SIZE,
          cursor: 'col-resize', // Horizontal resize cursor for dragging right to create vertical guideline
          zIndex: 10,
          touchAction: 'none', // Prevent browser handling of touch events
        }}
        onMouseDown={handleVerticalMouseDown}
        onTouchStart={handleVerticalTouchStart}
      />

      {/* Corner square */}
      <div
        className={styles.rulerCorner}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: RULER_SIZE,
          height: RULER_SIZE,
          backgroundColor: EDIT_MODE_COLORS.rulerBackground,
          borderRight: `1px solid ${EDIT_MODE_COLORS.rulerBorder}`,
          borderBottom: `1px solid ${EDIT_MODE_COLORS.rulerBorder}`,
          zIndex: 11,
        }}
      />

      {/* Guideline preview during drag */}
      {dragState && (
        <div
          style={{
            position: 'absolute',
            ...(dragState.axis === 'x'
              ? {
                  // Vertical guideline preview - positioned in container coordinates
                  // Container position = svgX * scale + offset.x (same as GuidelinesOverlay)
                  left: dragState.currentPosition * scale + offset.x,
                  top: RULER_SIZE,
                  width: 2,
                  height: canvasSize.height - RULER_SIZE,
                }
              : {
                  // Horizontal guideline preview - positioned in container coordinates
                  left: RULER_SIZE,
                  top: dragState.currentPosition * scale + offset.y,
                  width: canvasSize.width - RULER_SIZE,
                  height: 2,
                }),
            // Use guideline color when snapped, drag color otherwise
            backgroundColor: dragState.isSnapped ? EDIT_MODE_COLORS.guideline : EDIT_MODE_COLORS.guidelineDrag,
            pointerEvents: 'none',
            zIndex: 15,
          }}
        />
      )}
    </>
  )
}

export default RulerOverlay
