import type Konva from 'konva'
import { useCallback, useMemo } from 'react'
import { Circle, Line } from 'react-konva'
import { TemplateEditorStore } from '~/stores/modules/template'
import {
  calculateSafeRadius,
  snapAngleToIncrement,
  validateGeometryParams,
} from 'extensions/tailorkit-src/src/shared/libraries/konva/text'

interface CircleAnchorOptions {
  width: number
  height: number
  scale: number
  circleStartAngle: number
  circleEndAngle: number
  onChangeCircleStartAngle?: (value: number) => void
  onChangeCircleEndAngle?: (value: number) => void
  snapIncrement?: number // Snap increment in degrees (default: 15)
}

interface AnchorGeometry {
  centerX: number
  centerY: number
  textRadius: number
  startX: number
  startY: number
  endX: number
  endY: number
  lineWidth: number
  anchorSize: number
  anchorStrokeWidth: number
  dashArray: number[]
}

/**
 * Custom hook for circle anchor logic and rendering
 * Handles all anchor-related calculations, event handlers, and JSX generation
 */
export function useCircleAnchors({
  width,
  height,
  scale,
  circleStartAngle,
  circleEndAngle,
  onChangeCircleStartAngle,
  onChangeCircleEndAngle,
  snapIncrement = 15,
}: CircleAnchorOptions) {
  // Memoize anchor geometry calculations
  const anchorGeometry = useMemo<AnchorGeometry>(() => {
    // Validate inputs and calculate safe geometry
    const { width: safeWidth, height: safeHeight } = validateGeometryParams({
      width,
      height,
    })

    const centerX = safeWidth / 2
    const centerY = safeHeight / 2
    const textRadius = calculateSafeRadius(safeWidth, safeHeight)
    const anchorRadius = textRadius * 0.75 // Position anchors at 75% of text radius

    // Calculate anchor positions on radius lines (not on arc)
    const startX = centerX + anchorRadius * Math.cos(circleStartAngle)
    const startY = centerY + anchorRadius * Math.sin(circleStartAngle)
    const endX = centerX + anchorRadius * Math.cos(circleEndAngle)
    const endY = centerY + anchorRadius * Math.sin(circleEndAngle)

    // Scale-based sizing (like stroke rendering)
    const lineWidth = 1 / scale
    const anchorSize = 8 / scale
    const anchorStrokeWidth = 2 / scale

    return {
      centerX,
      centerY,
      textRadius,
      startX,
      startY,
      endX,
      endY,
      lineWidth,
      anchorSize,
      anchorStrokeWidth,
      dashArray: [3 / scale, 3 / scale],
    }
  }, [width, height, scale, circleStartAngle, circleEndAngle])

  // Optimized drag handlers with useCallback
  const handleStartAnchorDrag = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!onChangeCircleStartAngle) return

      const { centerX, centerY, textRadius } = anchorGeometry
      const anchorX = e.target.x()
      const anchorY = e.target.y()

      // Calculate distance from center - ignore very small movements near center
      const dx = anchorX - centerX
      const dy = anchorY - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Minimum distance threshold to avoid jittery behavior near center
      const minDistance = 10
      if (distance < minDistance) return

      // Calculate angle from center to drag position (allow free dragging)
      let angle = Math.atan2(dy, dx)

      // Apply angle snapping when shift is pressed
      angle = snapAngleToIncrement(angle, e.evt.shiftKey, snapIncrement)

      // Update angle in state
      onChangeCircleStartAngle(angle)

      // Snap anchor back to correct radius position for visual consistency
      const anchorRadius = textRadius * 0.75 // 75% for better accessibility
      const snapX = centerX + anchorRadius * Math.cos(angle)
      const snapY = centerY + anchorRadius * Math.sin(angle)
      e.target.x(snapX)
      e.target.y(snapY)
    },
    [onChangeCircleStartAngle, anchorGeometry, snapIncrement]
  )

  const handleEndAnchorDrag = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!onChangeCircleEndAngle) return

      const { centerX, centerY, textRadius } = anchorGeometry
      const anchorX = e.target.x()
      const anchorY = e.target.y()

      // Calculate distance from center - ignore very small movements near center
      const dx = anchorX - centerX
      const dy = anchorY - centerY
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Minimum distance threshold to avoid jittery behavior near center
      const minDistance = 10
      if (distance < minDistance) return

      // Calculate angle from center to drag position (allow free dragging)
      let angle = Math.atan2(dy, dx)

      // Apply angle snapping when shift is pressed
      angle = snapAngleToIncrement(angle, e.evt.shiftKey, snapIncrement)

      // Update angle in state
      onChangeCircleEndAngle(angle)

      // Snap anchor back to correct radius position for visual consistency
      const anchorRadius = textRadius * 0.75 // 75% for better accessibility
      const snapX = centerX + anchorRadius * Math.cos(angle)
      const snapY = centerY + anchorRadius * Math.sin(angle)
      e.target.x(snapX)
      e.target.y(snapY)
    },
    [onChangeCircleEndAngle, anchorGeometry, snapIncrement]
  )

  // Anchor drag start/end handlers to prevent parent drag events
  const handleAnchorDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    // Change cursor to grabbing state during drag
    const stage = e.target.getStage()
    if (stage?.container()) {
      stage.container().style.cursor = 'grabbing'
    }

    // Disable parent group dragging while anchor is being dragged
    TemplateEditorStore.dispatch({
      type: 'SET_ANCHOR_DRAGGING',
      payload: { isAnchorDragging: true },
      skipTrace: true, // Skip undo/redo tracking for UI state
    })
  }, [])

  const handleAnchorDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    // Reset cursor back to grab state after drag
    const stage = e.target.getStage()
    if (stage?.container()) {
      stage.container().style.cursor = 'grab'
    }

    // Wait for the anchor drag to complete before re-enabling parent group dragging
    setTimeout(() => {
      // Re-enable parent group dragging after anchor drag ends
      TemplateEditorStore.dispatch({
        type: 'SET_ANCHOR_DRAGGING',
        payload: { isAnchorDragging: false },
        skipTrace: true, // Skip undo/redo tracking for UI state
      })
    }, 100)
  }, [])

  // Memoize the complete anchor JSX
  const anchorsJSX = useMemo(() => {
    const {
      centerX,
      centerY,
      textRadius,
      startX,
      startY,
      endX,
      endY,
      lineWidth,
      anchorSize,
      anchorStrokeWidth,
      dashArray,
    } = anchorGeometry

    // Check if anchors are very close together (minimum arc span threshold)
    let arcSpan = circleEndAngle - circleStartAngle
    if (arcSpan < 0) arcSpan += 2 * Math.PI

    // Distinguish between intentional full circle and accidental overlap
    const isIntentionalFullCircle = Math.abs(arcSpan) < 0.01 || Math.abs(arcSpan - 2 * Math.PI) < 0.01
    const isAccidentalOverlap = arcSpan < 0.15 && arcSpan > 0.01 // Small but not exactly zero

    // Visual feedback colors and styles when anchors are overlapping (but not full circle)
    const anchorFill = isAccidentalOverlap ? '#FF6B6B' : '#B37FEB' // Red when overlapping, not full circle
    const lineStroke = isAccidentalOverlap ? '#FF6B6B' : '#B37FEB'
    const lineOpacity = isAccidentalOverlap ? 0.9 : 0.7 // More visible when overlapping

    return (
      <>
        {/* Range indicator lines - extend from center to text radius */}
        <Line
          points={[
            centerX,
            centerY,
            centerX + textRadius * Math.cos(circleStartAngle),
            centerY + textRadius * Math.sin(circleStartAngle),
          ]}
          stroke={lineStroke}
          strokeWidth={lineWidth}
          dash={dashArray}
          opacity={lineOpacity}
          listening={false}
        />
        <Line
          points={[
            centerX,
            centerY,
            centerX + textRadius * Math.cos(circleEndAngle),
            centerY + textRadius * Math.sin(circleEndAngle),
          ]}
          stroke={lineStroke}
          strokeWidth={lineWidth}
          dash={dashArray}
          opacity={lineOpacity}
          listening={false}
        />

        {/* Visual warning when anchors are overlapping (but not intentional full circle) */}
        {isAccidentalOverlap && (
          <Circle
            x={centerX}
            y={centerY}
            radius={textRadius * 0.15}
            fill="rgba(255, 107, 107, 0.2)"
            stroke="#FF6B6B"
            strokeWidth={lineWidth}
            dash={[2 / scale, 2 / scale]}
            listening={false}
            opacity={0.6}
          />
        )}

        {/* Visual confirmation when intentional full circle is active */}
        {isIntentionalFullCircle && (
          <Circle
            x={centerX}
            y={centerY}
            radius={textRadius * 0.1}
            fill="rgba(76, 175, 80, 0.2)"
            stroke="#4CAF50"
            strokeWidth={lineWidth}
            listening={false}
            opacity={0.8}
          />
        )}

        {/* Start angle anchor - positioned on radius line */}
        <Circle
          x={startX}
          y={startY}
          radius={anchorSize}
          fill={anchorFill}
          stroke="#ffffff"
          strokeWidth={anchorStrokeWidth}
          draggable={true}
          onDragStart={handleAnchorDragStart}
          onDragMove={handleStartAnchorDrag}
          onDragEnd={handleAnchorDragEnd}
          onMouseEnter={e => {
            const stage = e.target.getStage()
            if (stage?.container()) {
              stage.container().style.cursor = 'grab'
            }
          }}
          onMouseLeave={e => {
            const stage = e.target.getStage()
            if (stage?.container()) {
              stage.container().style.cursor = 'default'
            }
          }}
          listening={true}
        />

        {/* End angle anchor - positioned on radius line */}
        <Circle
          x={endX}
          y={endY}
          radius={anchorSize}
          fill={anchorFill}
          stroke="#ffffff"
          strokeWidth={anchorStrokeWidth}
          draggable={true}
          onDragStart={handleAnchorDragStart}
          onDragMove={handleEndAnchorDrag}
          onDragEnd={handleAnchorDragEnd}
          onMouseEnter={e => {
            const stage = e.target.getStage()
            if (stage?.container()) {
              stage.container().style.cursor = 'grab'
            }
          }}
          onMouseLeave={e => {
            const stage = e.target.getStage()
            if (stage?.container()) {
              stage.container().style.cursor = 'default'
            }
          }}
          listening={true}
        />
      </>
    )
  }, [
    anchorGeometry,
    circleStartAngle,
    circleEndAngle,
    handleAnchorDragStart,
    handleStartAnchorDrag,
    handleAnchorDragEnd,
    handleEndAnchorDrag,
    scale,
  ])

  return {
    anchorGeometry,
    anchorsJSX,
    snapIncrement,
    handlers: {
      handleStartAnchorDrag,
      handleEndAnchorDrag,
      handleAnchorDragStart,
      handleAnchorDragEnd,
    },
  }
}
