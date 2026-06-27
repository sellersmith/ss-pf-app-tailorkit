import type Konva from 'konva'
import React, { Fragment, useCallback, useMemo, useRef } from 'react'
import { Group, Layer, Line, Rect, Text } from 'react-konva'
import { RULER_LINE_NAME } from '../constants'
import { estimateTextWidth } from './fns'
import { useCoordinateDisplay, useGuideInteraction, useGuideMovement, useRulerTicks } from './hooks'
import type { CanvasRulerProps, DraggedGuideState } from './types'
import { formatLengthUnit, lengthUnitToLengthUnit } from '~/utils/lengthUnitToPixels'
import { RULER_CONSTANTS } from './constants'

/**
 * RulerSystem Component for a scalable editor
 * Features:
 * - Horizontal and vertical rulers
 * - Scale with zoom
 * - Drag guides from rulers
 * - Update position when stage is panned
 */

const CanvasRuler: React.FC<CanvasRulerProps> = props => {
  const {
    id,
    layerPos,
    width: _width,
    height: _height,
    rulerThickness = 20,
    rulerColor = 'rgba(0, 100, 255)',
    displayTextColor = 'rgba(0, 100, 255)',
    scale = 1,
    stagePos = { x: 0, y: 0 },
    gridSize = 10,
    showRulers = true,
    guides,
    setGuides,
    measurementUnit = 'px',
    resolution = 300,
  } = props

  // Calculate absolute values
  const absoluteWidth = _width * scale
  const absoluteHeight = _height * scale
  const rulerSize = rulerThickness * scale
  const absoluteStagePos = useMemo(
    () => ({
      x: stagePos.x * scale,
      y: stagePos.y * scale,
    }),
    [stagePos, scale]
  )

  /** The dragging guide ref is used for rendering the dragging guide line */
  const draggingGuideRef = useRef<DraggedGuideState | null>(null)
  /** The dragging guide line ref */
  const draggingGuideLineRef = useRef<Konva.Line>(null)
  /** The group ref */
  const groupRef = useRef<Konva.Group>(null)
  /** Store mouse position */
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  /** Store mouse cursor style */
  const mouseCursorStyleRef = useRef<string>('default')

  /** The set cursor style callback */
  const setCursorStyle = useCallback((style: string) => {
    // Check if the style is different from the current style to reduce re-flows and repaints
    if (mouseCursorStyleRef.current !== style) {
      mouseCursorStyleRef.current = style
      document.body.style.cursor = style
    }
  }, [])

  const setDraggingGuide = useCallback((guide: DraggedGuideState | null) => {
    draggingGuideRef.current = guide
  }, [])

  const setMousePos = useCallback(
    (pos: { x: number; y: number }) => {
      if (draggingGuideLineRef.current) {
        draggingGuideLineRef.current.visible(true)
      }

      mousePosRef.current = pos
      if (draggingGuideLineRef.current && draggingGuideRef.current) {
        const isHorizontal = draggingGuideRef.current.isHorizontal
        if (isHorizontal) {
          draggingGuideLineRef.current.points([0, mousePosRef.current.y, absoluteWidth, mousePosRef.current.y])
        } else {
          draggingGuideLineRef.current.points([mousePosRef.current.x, 0, mousePosRef.current.x, absoluteHeight])
        }
      }
    },
    [absoluteHeight, absoluteWidth]
  )

  // Use custom hooks
  const { coordinateTextRef, updateCoordinateDisplay } = useCoordinateDisplay({
    scale,
    rulerSize,
    measurementUnit,
    resolution,
  })

  const { handleGuideMovement } = useGuideMovement({
    scale,
    absoluteStagePos,
    rulerSize,
    draggingGuideLineRef,
    draggingGuideRef,
    setDraggingGuide,
    updateCoordinateDisplay,
    setMousePos,
  })

  const { handleRulerDragEnd } = useGuideInteraction({
    guides,
    rulerSize,
    scale,
    setGuides,
    draggingGuideRef,
    draggingGuideLineRef,
    coordinateTextRef,
    setDraggingGuide,
    setCursorStyle,
  })

  const { horizontalTicks, verticalTicks } = useRulerTicks({
    absoluteWidth,
    absoluteHeight,
    scale,
    gridSize,
    absoluteStagePos,
    rulerSize,
  })

  // Handle dragging from rulers to create guides
  const handleRulerDragStart = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>, isHorizontal: boolean, createGuide: boolean = true): void => {
      const defaultGuideId = isHorizontal ? `h-${Date.now()}` : `v-${Date.now()}`
      const draggingGuideId = e.target.id() || defaultGuideId

      // Temporary hide current existing guide
      const lineGuide = groupRef.current?.getStage()?.findOne(`#${draggingGuideId}`)
      if (lineGuide) {
        lineGuide.visible(false)
      }

      const onMouseMoveGlobal = (evt: MouseEvent) => {
        const stage = e.target.getStage() as Konva.Stage
        if (!stage) return

        const point = stage.getPointerPosition()
        if (!point) return

        setCursorStyle(isHorizontal ? 'ns-resize' : 'ew-resize')

        handleGuideMovement({
          point,
          stage,
          isHorizontal,
          draggingGuideId,
        })
      }

      const onMouseUpGlobal = () => {
        if (lineGuide) {
          lineGuide.visible(true)
        }
        handleRulerDragEnd(createGuide ? undefined : { id: draggingGuideId })
        setCursorStyle('default')
        document.removeEventListener('mousemove', onMouseMoveGlobal)
        document.removeEventListener('mouseup', onMouseUpGlobal)
      }

      document.addEventListener('mousemove', onMouseMoveGlobal)
      document.addEventListener('mouseup', onMouseUpGlobal)
    },
    [handleGuideMovement, handleRulerDragEnd, setCursorStyle]
  )

  const tickFontSize = RULER_CONSTANTS.TICK_FONT_SIZE * scale
  const strokeWidth = RULER_CONSTANTS.RULER_STROKE_WIDTH * scale
  const hitStrokeWidth = RULER_CONSTANTS.RULER_HIT_STROKE_WIDTH * scale

  // Create a shared guide line props generator
  const getGuideLineProps = useCallback(
    (strokeWidth: number) => ({
      stroke: rulerColor,
      strokeWidth,
      hitStrokeWidth,
      opacity: RULER_CONSTANTS.GUIDE_OPACITY,
      onMouseOver: (e: Konva.KonvaEventObject<MouseEvent>) => {
        const line = e.target as Konva.Line
        line.strokeWidth(strokeWidth * 2)
        line.stroke(rulerColor)
        line.opacity(RULER_CONSTANTS.GUIDE_OPACITY_HOVER)
        line.getLayer()?.batchDraw()
      },
      onMouseOut: (e: Konva.KonvaEventObject<MouseEvent>) => {
        const line = e.target as Konva.Line
        line.strokeWidth(strokeWidth)
        line.stroke(rulerColor)
        line.opacity(RULER_CONSTANTS.GUIDE_OPACITY)
        line.getLayer()?.batchDraw()
      },
    }),
    [rulerColor, hitStrokeWidth]
  )

  // Do not render if rulers are hidden
  if (!showRulers) return null

  return (
    <Layer id={id} position={layerPos}>
      <Group ref={groupRef}>
        {/* Horizontal Ruler */}
        <Group>
          <Rect
            x={0}
            y={0}
            width={absoluteWidth}
            height={rulerSize}
            fill="#f0f0f0"
            stroke="#ddd"
            strokeWidth={strokeWidth}
            onMouseDown={e => handleRulerDragStart(e, true, true)}
            onMouseOver={() => !draggingGuideRef.current && setCursorStyle('ns-resize')}
            onMouseOut={() => !draggingGuideRef.current && setCursorStyle('default')}
          />

          {/* Ruler ticks */}
          {horizontalTicks.map((tick, i) => {
            const tickTextByUnit = lengthUnitToLengthUnit('px', measurementUnit, tick.position, resolution)
            const tickText = formatLengthUnit(tickTextByUnit, measurementUnit, 2).toString()

            return (
              <React.Fragment key={`h-tick-${i}`}>
                {tick.showLabel && (
                  <Fragment>
                    <Line
                      points={[tick.screenPos, rulerSize, tick.screenPos, rulerSize - tick.tickSize]}
                      stroke="#666"
                      strokeWidth={strokeWidth}
                    />
                    <Text
                      x={tick.screenPos}
                      y={rulerSize / 2}
                      text={tickText}
                      fontSize={tickFontSize}
                      fill={RULER_CONSTANTS.RULER_TICK_COLOR}
                      offsetX={estimateTextWidth(tickText, tickFontSize) / 2}
                      offsetY={tickFontSize / 2}
                      align="center"
                    />
                  </Fragment>
                )}
              </React.Fragment>
            )
          })}
        </Group>

        {/* Vertical Ruler */}
        <Group>
          <Rect
            x={0}
            y={0}
            width={rulerSize}
            height={absoluteHeight}
            fill="#f0f0f0"
            stroke="#ddd"
            strokeWidth={strokeWidth}
            onMouseDown={e => handleRulerDragStart(e, false, true)}
            onMouseOver={() => !draggingGuideRef.current && setCursorStyle('ew-resize')}
            onMouseOut={() => !draggingGuideRef.current && setCursorStyle('default')}
          />

          {/* Ruler ticks */}
          {verticalTicks.map((tick, i) => {
            const tickTextByUnit = lengthUnitToLengthUnit('px', measurementUnit, tick.position, resolution)
            const tickText = formatLengthUnit(tickTextByUnit, measurementUnit, 2).toString()

            return (
              <React.Fragment key={`v-tick-${i}`}>
                {tick.showLabel && (
                  <Fragment>
                    <Line
                      points={[rulerSize, tick.screenPos, rulerSize - tick.tickSize, tick.screenPos]}
                      stroke="#666"
                      strokeWidth={strokeWidth}
                    />
                    <Text
                      x={rulerSize / 2}
                      y={tick.screenPos}
                      text={tickText}
                      fontSize={tickFontSize}
                      fill={RULER_CONSTANTS.RULER_TICK_COLOR}
                      align="center"
                      verticalAlign="middle"
                      rotation={-90}
                      offsetX={estimateTextWidth(tickText, tickFontSize) / 2}
                      offsetY={tickFontSize / 2}
                    />
                  </Fragment>
                )}
              </React.Fragment>
            )
          })}
        </Group>

        {/* Ruler corner */}
        <Rect x={0} y={0} width={rulerSize} height={rulerSize} fill="#f0f0f0" stroke="#ddd" strokeWidth={strokeWidth} />

        {/* Coordinate display text with background */}
        <Group ref={coordinateTextRef} visible={false}>
          <Rect
            fill="#ffffff"
            stroke="#dddddd"
            strokeWidth={0.5 * scale}
            cornerRadius={2 * scale}
            shadowColor="rgba(0,0,0,0.1)"
            shadowBlur={2 * scale}
            shadowOffset={{ x: 0, y: 1 }}
            width={0}
            height={0}
          />
          <Text
            fontSize={10 * scale}
            fill={displayTextColor}
            opacity={0.9}
            align="center"
            verticalAlign="middle"
            text=""
          />
        </Group>
      </Group>

      {/* Guides */}
      <Group>
        {/* Horizontal guides */}
        {guides.horizontal.map(guide => (
          <Line
            key={guide.id}
            id={guide.id}
            name={RULER_LINE_NAME}
            points={[0, guide.position + absoluteStagePos.y, absoluteWidth, guide.position + absoluteStagePos.y]}
            {...getGuideLineProps(strokeWidth)}
            onMouseEnter={() => setCursorStyle('ns-resize')}
            onMouseLeave={() => setCursorStyle('default')}
            onMouseDown={e => handleRulerDragStart(e, true, false)}
          />
        ))}

        {/* Vertical guides */}
        {guides.vertical.map(guide => (
          <Line
            key={guide.id}
            id={guide.id}
            name={RULER_LINE_NAME}
            points={[guide.position + absoluteStagePos.x, 0, guide.position + absoluteStagePos.x, absoluteHeight]}
            {...getGuideLineProps(strokeWidth)}
            onMouseEnter={() => setCursorStyle('ew-resize')}
            onMouseLeave={() => setCursorStyle('default')}
            onMouseDown={e => handleRulerDragStart(e, false, false)}
          />
        ))}
      </Group>

      {/* Guide being dragged */}
      <Group>
        <Line ref={draggingGuideLineRef} visible={false} stroke={rulerColor} opacity={0.7} strokeWidth={strokeWidth} />
      </Group>
    </Layer>
  )
}

export default CanvasRuler
