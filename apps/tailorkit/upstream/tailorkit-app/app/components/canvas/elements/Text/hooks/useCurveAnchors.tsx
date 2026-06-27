import type Konva from 'konva'
import { useCallback, useMemo, useState } from 'react'
import { Circle, Line, Text } from 'react-konva'
import { TemplateEditorStore } from '~/stores/modules/template'
import { validateGeometryParams } from './utils'

interface CurveAnchorOptions {
  width: number
  height: number
  scale: number
  curveBend: number
  onChangeCurveBend?: (value: number) => void
}

interface CurveAnchorGeometry {
  centerX: number
  centerY: number
  anchorX: number
  anchorY: number
  lineWidth: number
  anchorSize: number
  anchorStrokeWidth: number
  dashArray: number[]
}

/**
 * Custom hook for curve anchor logic and rendering
 * Provides a Y-axis only draggable control for bend percentage
 */
export function useCurveAnchors({ width, height, scale, curveBend, onChangeCurveBend }: CurveAnchorOptions) {
  // Track dragging state to show/hide labels
  const [isDragging, setIsDragging] = useState(false)

  // Memoize anchor geometry calculations
  const anchorGeometry = useMemo<CurveAnchorGeometry>(() => {
    // Validate inputs and calculate safe geometry
    const { width: safeWidth, height: safeHeight } = validateGeometryParams({
      width,
      height,
    })

    const centerX = safeWidth / 2 // Anchor stays in center horizontally
    const centerY = safeHeight / 2 // Container center Y

    // Calculate anchor Y position based on bend percentage
    // When bend is 0%, anchor is at center (centerY)
    // When bend is ±100%, anchor is at top/bottom boundary (with margin)
    const margin = 5 // Small margin from edges for better UX
    const maxOffset = safeHeight / 2 - margin // Maximum offset from center, respecting margins
    const bendOffset = (curveBend / 100) * maxOffset
    const anchorY = Math.max(margin, Math.min(safeHeight - margin, centerY - bendOffset)) // Constrain to margins

    // Scale-based sizing (consistent with circle anchors)
    const lineWidth = 1 / scale
    const anchorSize = 8 / scale
    const anchorStrokeWidth = 2 / scale

    return {
      centerX,
      centerY,
      anchorX: centerX,
      anchorY,
      lineWidth,
      anchorSize,
      anchorStrokeWidth,
      dashArray: [3 / scale, 3 / scale],
    }
  }, [width, height, scale, curveBend])

  // Optimized drag handler with strict Y-axis constraint
  const handleBendAnchorDrag = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!onChangeCurveBend) return

      const { centerX, centerY } = anchorGeometry
      const anchorY = e.target.y()

      // IMMEDIATE CONSTRAINT: Lock X and constrain Y
      const margin = 5
      const minY = margin
      const maxY = height - margin
      const constrainedY = Math.max(minY, Math.min(maxY, anchorY))

      // Force position for Y-axis only movement within boundaries
      e.target.x(centerX) // Lock X to center
      e.target.y(constrainedY) // Constrain Y within bounds

      // Calculate bend percentage
      const maxOffset = height / 2 - margin
      const yOffset = centerY - constrainedY
      let newBend = (yOffset / maxOffset) * 100
      newBend = Math.max(-100, Math.min(100, newBend))

      // Update bend in state
      onChangeCurveBend(newBend)
    },
    [onChangeCurveBend, anchorGeometry, height]
  )

  // Anchor start/end drag handlers for TemplateEditorStore state management
  const handleAnchorDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    // Show labels during drag
    setIsDragging(true)

    // Change cursor to grabbing state during drag
    const stage = e.target.getStage()
    if (stage?.container()) {
      stage.container().style.cursor = 'grabbing'
    }

    TemplateEditorStore.dispatch({
      type: 'SET_ANCHOR_DRAGGING',
      payload: { isAnchorDragging: true },
      skipTrace: true, // Skip undo/redo tracking for UI state
    })
  }, [])

  const handleAnchorDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    // Hide labels after drag
    setIsDragging(false)

    // Reset cursor back to grab state after drag
    const stage = e.target.getStage()
    if (stage?.container()) {
      stage.container().style.cursor = 'grab'
    }

    // Wait for the anchor drag to complete before re-enabling parent group dragging
    setTimeout(() => {
      TemplateEditorStore.dispatch({
        type: 'SET_ANCHOR_DRAGGING',
        payload: { isAnchorDragging: false },
        skipTrace: true, // Skip undo/redo tracking for UI state
      })
    }, 100)
  }, [])

  // Generate anchor JSX
  const anchorsJSX = useMemo(() => {
    const { anchorX, anchorY, centerY, lineWidth, anchorSize, anchorStrokeWidth, dashArray } = anchorGeometry

    // Calculate label position (offset to the right of the anchor)
    const labelOffsetX = 20 / scale // Responsive offset based on scale
    const labelX = anchorX + labelOffsetX
    const labelY = anchorY

    // Text styling - use same color as anchor, larger font for consistency
    const textFontSize = Math.max(14, 16 / scale) // Larger font for better visibility
    const textFill = '#B37FEB' // Use anchor color (same as curve anchor)

    // Format bend percentage for display
    const bendText = `${Math.round(curveBend)}%`

    return (
      <>
        {/* Vertical guide line showing bend direction */}
        <Line
          points={[anchorX, 0, anchorX, height]} // Full height vertical line
          stroke="#B37FEB" // Purple - consistent with circle anchors
          strokeWidth={lineWidth}
          dash={dashArray}
          opacity={0.7} // Match circle anchor line opacity
          listening={false}
        />

        {/* Horizontal baseline reference */}
        <Line
          points={[0, centerY, width, centerY]} // Full width horizontal line at center
          stroke="#B37FEB" // Purple - consistent with circle anchors
          strokeWidth={lineWidth}
          dash={dashArray}
          opacity={0.5} // Slightly more subtle for baseline
          listening={false}
        />

        {/* Bend control anchor */}
        <Circle
          x={anchorX}
          y={anchorY}
          radius={anchorSize}
          fill="#B37FEB" // Purple - consistent with circle anchors
          stroke="#ffffff" // White - consistent with circle anchors
          strokeWidth={anchorStrokeWidth}
          draggable={true}
          cursor="grab"
          onDragStart={handleAnchorDragStart}
          onDragMove={handleBendAnchorDrag}
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
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
          listening={true}
        />

        {/* Bend percentage label - only show during dragging */}
        {isDragging && (
          <Text
            x={labelX}
            y={labelY}
            text={bendText}
            fontSize={textFontSize}
            fill={textFill}
            align="left"
            verticalAlign="middle"
            offsetY={textFontSize / 2} // Center the text vertically
            listening={false}
            opacity={1.0}
            fontStyle="bold" // Bold for better visibility
          />
        )}
      </>
    )
  }, [
    anchorGeometry,
    height,
    width,
    handleAnchorDragStart,
    handleBendAnchorDrag,
    handleAnchorDragEnd,
    scale,
    curveBend,
    isDragging, // Used to show/hide bend percentage label
  ])

  return {
    anchorsJSX,
    anchorGeometry,
  }
}
