import type { FontLoader } from 'extensions/tailorkit-src/src/assets/utils/font-loader'
import {
  calculateCurveEquivalentRadius,
  scaleCustomPathToFit,
} from 'extensions/tailorkit-src/src/shared/libraries/konva/text'
import { computeTextMeasurementPadding } from 'extensions/tailorkit-src/src/shared/libraries/konva/text/text-style-utils'
import type Konva from 'konva'
import type { TextConfig } from 'konva/lib/shapes/Text'
import type { ComponentProps } from 'react'
import { memo, useMemo } from 'react'
import type { Text } from 'react-konva'
import { Group, Path, Rect } from 'react-konva'
import { EDITOR_HELPER_NAME } from '~/components/canvas/constants'
import {
  DEFAULT_CIRCLE_END_ANGLE,
  DEFAULT_CIRCLE_START_ANGLE,
  DEFAULT_CURVE_BEND,
  DEFAULT_TEXT_AUTO_FIT_TO_CONTAINER,
} from '~/constants/inspector/text'
import type { EffectConfig } from '~/modules/TemplateEditor/elements/effects/types'
import type { TextSettings } from '~/types/psd'
import type { Paint, StrokeConfig } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import {
  useAutoTextScale,
  useCircleAnchors,
  useCurveAnchors,
  useKonvaTextSelectors,
  usePathGeometry,
  usePerformanceMonitoring,
  useTextEffectsRenderer,
} from './hooks'
import { calculateSafeRadius, validateGeometryParams } from './hooks/utils'
import { SVGTextWithEffects } from './SVGTextWithEffects.client'
import { SVGTextPathWithEffects } from './SVGTextPathWithEffects.client'
import { SVGEnvelopeTextWithEffects } from './SVGEnvelopeTextWithEffects.client'

interface KonvaTextPathProps extends Omit<ComponentProps<typeof Text>, 'fill'> {
  width: number
  height: number
  content: string
  style: Partial<Konva.TextConfig>
  textShape: TextSettings['textShape']
  circleStartAngle?: number
  circleEndAngle?: number
  circleInverted?: boolean
  curvePeaks?: number
  curveBend?: number
  /** Custom path data for 'custom' text shape (SVG d attribute) */
  customPathData?: string
  /** Metadata for custom path scaling */
  customPathMetadata?: {
    viewBoxWidth: number
    viewBoxHeight: number
  }
  /** Invert custom path direction (text flows in reverse when true) */
  customPathInverted?: boolean
  /** Fill shape path data for 'fill-shape' text shape (closed SVG path) */
  fillShapePathData?: string
  /** Metadata for fill shape scaling */
  fillShapeMetadata?: {
    viewBoxWidth: number
    viewBoxHeight: number
  }
  /** Vertical offset for fill-shape text positioning (-50 to +50 percent) */
  fillShapeVerticalOffset?: number
  /** Vertical scale factor for fill-shape character height (0.5 to 2.0) */
  fillShapeVerticalScale?: number
  /** Horizontal offset for fill-shape text positioning (-50 to +50 percent) */
  fillShapeHorizontalOffset?: number
  /** Horizontal scale factor for fill-shape character width (0.5 to 2.0) */
  fillShapeHorizontalScale?: number
  /** Character spacing adjustment (-50 to +50) */
  fillShapeCharacterSpacing?: number
  previewMode?: boolean
  spriteRef: React.RefObject<any>
  autoFitToContainer?: boolean
  fontLoader: FontLoader
  effects?: EffectConfig[]
  currentTextColor?: string
  /** Paint fill (takes precedence over color when provided) */
  fill?: Paint
  /** Paint stroke (supports solid, image, gradient) - legacy single stroke */
  strokePaint?: Paint
  /** Multiple strokes array (TextStudio-style wrapping) */
  strokes?: StrokeConfig[]
  onChangeCircleStartAngle?: (value: number) => void
  onChangeCircleEndAngle?: (value: number) => void
  onChangeCurveBend?: (value: number) => void
}

function KonvaTextPathComponent(props: KonvaTextPathProps) {
  const {
    width,
    height,
    content = '',
    style,
    textShape = 'none',
    circleStartAngle = DEFAULT_CIRCLE_START_ANGLE,
    circleEndAngle = DEFAULT_CIRCLE_END_ANGLE,
    circleInverted = false,
    curvePeaks,
    curveBend = DEFAULT_CURVE_BEND,
    customPathData,
    customPathMetadata,
    customPathInverted = false,
    fillShapePathData,
    fillShapeMetadata,
    fillShapeVerticalOffset,
    fillShapeVerticalScale,
    fillShapeHorizontalOffset,
    fillShapeHorizontalScale,
    fillShapeCharacterSpacing,
    previewMode = false,
    spriteRef,
    onReady,
    fontLoader,
    autoFitToContainer = DEFAULT_TEXT_AUTO_FIT_TO_CONTAINER,
    effects = [],
    // removed legacy currentTextColor (effectLayers no longer used)
    fill,
    strokePaint,
    strokes,
    onChangeCircleStartAngle,
    onChangeCircleEndAngle,
    onChangeCurveBend,
    draggable,
    ...otherProps
  } = props

  // Use custom hooks for optimized store subscriptions and performance monitoring
  const { isSelected, scale, isAnchorDragging } = useKonvaTextSelectors({
    componentId: otherProps.id as string,
  })

  // Performance monitoring for development
  usePerformanceMonitoring({
    componentName: 'KonvaTextPath',
    componentId: otherProps.id as string,
  })

  const {
    fontFamily = 'Arial',
    fontSrc,
    fontSize: maxFontSize = 16,
    color,
    align,
    verticalAlign,
    lineHeight,
    wrap,
    letterSpacing,
    textAlign,
    fontWeight,
    fontStyle,
    emojiFontFamily,
    emojiFontSrc,
    ...otherStylesProps
  } = style as Partial<Konva.TextConfig> & { emojiFontFamily?: string; emojiFontSrc?: string }

  // Shared text effects renderer lifecycle (font loading, transformer updates)
  const { isReady, keyTextControl } = useTextEffectsRenderer({
    fontFamily,
    fontSrc,
    fontLoader,
    effects,
    spriteRef,
  })

  // Use auto-scaling when autoFitToContainer is true
  const shouldAutoFit = autoFitToContainer

  // Calculate path info for auto-scaling when needed (circle or curve)
  const pathInfo = useMemo(() => {
    if (!shouldAutoFit) return undefined

    if (textShape === 'circle') {
      const { width: safeWidth, height: safeHeight } = validateGeometryParams({
        width,
        height,
      })
      const radius = calculateSafeRadius(safeWidth, safeHeight)

      return {
        radius,
        startAngle: circleStartAngle,
        endAngle: circleEndAngle,
      }
    }

    if (textShape === 'curve') {
      // Use shared utility to calculate equivalent radius for auto-scaling
      const equivalentRadius = calculateCurveEquivalentRadius(width, height, curvePeaks || 1, curveBend)

      return {
        radius: equivalentRadius,
        startAngle: 0,
        endAngle: 2 * Math.PI, // Full circle to use entire calculated path length
      }
    }

    return undefined
  }, [shouldAutoFit, textShape, width, height, circleStartAngle, circleEndAngle, curvePeaks, curveBend])

  // Get font size - either auto-scaled or fixed
  const { fontSize, textProps } = useAutoTextScale({
    text: content,
    width,
    height,
    // Use measurement-only padding so neon intensity (shadowBlur) doesn't shrink available area
    padding: useMemo(() => computeTextMeasurementPadding(otherStylesProps), [otherStylesProps]),
    // If not auto-fitting, set minFontSize=maxFontSize to force that exact size
    minFontSize: shouldAutoFit ? 1 : maxFontSize,
    maxFontSize: maxFontSize,
    lineHeight: lineHeight ?? 1.2,
    fontFamily: fontFamily || 'Arial',
    wrap: (wrap as 'none' | 'word' | 'char') ?? 'word',
    // debug: previewMode && autoFitToContainer,
    debug: false,
    debounceMs: previewMode ? 50 : 0,
    dependencies: [isReady, content, fontFamily, fontSrc, maxFontSize, width, height, lineHeight, wrap],
    circularPath: pathInfo,
    fontStyle,
    letterSpacing,
  })

  // Use custom hook for optimized path geometry calculations
  // Note: Path generator intelligently handles angle overlaps:
  // - Exact same angles (< 0.01 radians): Creates full circle for complete text path
  // - Small differences (0.01-0.1 radians): Creates minimum arc to ensure text visibility
  // - Visual feedback distinguishes between intentional full circles and accidental overlaps
  const { fullCirclePath, textPath } = usePathGeometry({
    width,
    height,
    fontSize: fontSize || 0,
    textShape,
    circleStartAngle,
    circleEndAngle,
    circleInverted,
    curvePeaks,
    curveBend,
    customPathData,
    customPathMetadata,
    customPathInverted,
    fontFamily: fontFamily || 'Arial',
    color: color || '#000000',
    align: align || 'center',
    verticalAlign: verticalAlign || 'middle',
  })

  // Use custom hook for circle anchor logic and rendering
  // Features: Interactive start/end angle controls with drag-only angle display (0-360°)
  // Labels positioned with safe distance from anchor edges to prevent overlap
  const { anchorsJSX: circleAnchorsJSX } = useCircleAnchors({
    width,
    height,
    scale,
    circleStartAngle,
    circleEndAngle,
    onChangeCircleStartAngle,
    onChangeCircleEndAngle,
  })

  // Use custom hook for curve anchor logic and rendering
  // Features: Interactive bend control with drag-only percentage display matching anchor color
  const { anchorsJSX: curveAnchorsJSX } = useCurveAnchors({
    width,
    height,
    scale,
    curveBend,
    onChangeCurveBend,
  })

  // Prepare text styles
  const textStyles = useMemo(() => {
    const styles: Partial<TextConfig> = {
      ...style,
      fontFamily: fontFamily,
      // If not auto-fitting, use the exact fontSize from settings
      fontSize: shouldAutoFit ? fontSize : maxFontSize,
      fill: color,
      align: align,
      verticalAlign,
      width,
      height,
      lineHeight,
      letterSpacing,
      textAlign,
      fontStyle,
      fontWeight,
      // Keep node padding in sync with measurement (ignore shadow to prevent layout jumps)
      padding: computeTextMeasurementPadding(otherStylesProps),
      // Only clip text horizontally, don't wrap to new lines
      wrap: (wrap as any) ?? 'word',
      // Allow text to overflow without ellipsis
      ellipsis: false,
    }

    return styles
  }, [
    style,
    fontFamily,
    shouldAutoFit,
    fontSize,
    maxFontSize,
    color,
    align,
    verticalAlign,
    width,
    height,
    lineHeight,
    letterSpacing,
    textAlign,
    fontStyle,
    fontWeight,
    otherStylesProps,
    wrap,
  ])

  // Note: Konva TextPath doesn't support startOffset prop!
  // Instead, we modify the path itself to start where we want text to begin
  const konvaTextProps = useMemo(() => {
    // Exclude shadow-related props; advanced effects are not applied on TextPath
    const { shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity, ...rest } = otherStylesProps as any

    return {
      ...textStyles,
      ...textProps,
      ...rest,
    }
  }, [textStyles, textProps, otherStylesProps])

  const elementCoordinate = useMemo(() => {
    return {
      x: otherProps.x,
      y: otherProps.y,
      rotation: otherProps.rotation,
    }
  }, [otherProps])

  // Calculate scaled fill shape path for visual feedback
  // This ensures the feedback path matches the actual text rendering
  const scaledFillShapePath = useMemo(() => {
    if (!fillShapePathData) return ''
    return scaleCustomPathToFit(fillShapePathData, width, height, fillShapeMetadata)
  }, [fillShapePathData, width, height, fillShapeMetadata])

  // keyTextControl from hook forces re-render after font load

  // Render fill-shape (envelope distortion) - special handling
  if (textShape === 'fill-shape' && fillShapePathData) {
    return (
      <Group>
        {/* Invisible background for reliable click detection */}
        <Rect
          ref={spriteRef as any}
          {...otherProps}
          {...elementCoordinate}
          width={width}
          height={height}
          listening={true}
          fill="rgba(0,0,0,0)"
          draggable={!isAnchorDragging && draggable}
          onDragEnd={!isAnchorDragging ? otherProps.onDragEnd : () => {}}
          onTransformEnd={!isAnchorDragging ? otherProps.onTransformEnd : () => {}}
          onDragMove={!isAnchorDragging ? otherProps.onDragMove : () => {}}
          onTransform={!isAnchorDragging ? otherProps.onTransform : () => {}}
        />

        {/* Fill shape visual feedback - only show when selected */}
        {/* Uses scaled path to match text rendering (fixes zoom/switch rendering issues) */}
        {!previewMode && scaledFillShapePath && (
          <Path
            {...elementCoordinate}
            name={EDITOR_HELPER_NAME}
            key={`fill-shape-path-${keyTextControl}-${width}-${height}`}
            data={scaledFillShapePath}
            stroke="#10b981"
            strokeWidth={2 / scale}
            dash={[3, 3]}
            fillEnabled={false}
            listening={false}
            fillAfterStrokeEnabled={true}
            opacity={isSelected ? 0.8 : 0}
          />
        )}

        {/* SVG-based envelope text rendering */}
        <SVGEnvelopeTextWithEffects
          key={`envelope-text-${keyTextControl}`}
          fillShapePathData={fillShapePathData}
          fillShapeMetadata={fillShapeMetadata}
          fillShapeVerticalOffset={fillShapeVerticalOffset}
          fillShapeVerticalScale={fillShapeVerticalScale}
          fillShapeHorizontalOffset={fillShapeHorizontalOffset}
          fillShapeHorizontalScale={fillShapeHorizontalScale}
          fillShapeCharacterSpacing={fillShapeCharacterSpacing}
          width={width}
          height={height}
          content={content}
          fontSize={shouldAutoFit ? fontSize : maxFontSize}
          fontFamily={fontFamily}
          fontWeight={fontWeight}
          fontStyle={fontStyle}
          color={color}
          letterSpacing={letterSpacing}
          lineHeight={lineHeight}
          effects={effects}
          fontLoader={fontLoader}
          fontSrc={fontSrc}
          emojiFontFamily={emojiFontFamily as string}
          emojiFontSrc={emojiFontSrc as string}
          fill={fill}
          strokePaint={strokePaint}
          strokes={strokes}
          x={otherProps.x}
          y={otherProps.y}
          rotation={otherProps.rotation}
          scaleX={otherProps.scaleX}
          scaleY={otherProps.scaleY}
          offsetX={otherProps.offsetX}
          offsetY={otherProps.offsetY}
          skewX={otherProps.skewX}
          skewY={otherProps.skewY}
          listening={false}
        />
      </Group>
    )
  }

  // Render text on path for shapes, advanced rendering for 'none'
  if (textShape !== 'none' && textPath) {
    return (
      <Group>
        {/* Invisible background for reliable click detection */}
        {/* @ts-ignore */}
        <Rect
          ref={spriteRef as any}
          {...otherProps}
          {...elementCoordinate}
          width={width}
          height={height}
          listening={true}
          fill="rgba(0,0,0,0)"
          draggable={!isAnchorDragging && draggable}
          onDragEnd={!isAnchorDragging ? otherProps.onDragEnd : () => {}}
          onTransformEnd={!isAnchorDragging ? otherProps.onTransformEnd : () => {}}
          onDragMove={!isAnchorDragging ? otherProps.onDragMove : () => {}}
          onTransform={!isAnchorDragging ? otherProps.onTransform : () => {}}
        />

        {/* Circle text anchors - only show when selected */}
        {textShape === 'circle' && !previewMode && (
          <>
            {/* Static circle path - shows full circle for reference when circle text shape is selected */}
            <Path
              {...elementCoordinate}
              name={EDITOR_HELPER_NAME}
              data={fullCirclePath}
              stroke="#234c93"
              strokeWidth={1 / scale}
              dash={[5, 5]}
              fillEnabled={false}
              listening={false}
              fillAfterStrokeEnabled={true}
              opacity={isSelected ? 0.7 : 0}
            />

            {/* Path stroke for visual boundary and transformer reference - shows exact text path */}
            <Path
              {...elementCoordinate}
              name={EDITOR_HELPER_NAME}
              key={`circle-path-${keyTextControl}`}
              data={textPath}
              stroke="#1c6ef1"
              strokeWidth={2 / scale}
              dash={[3, 3]}
              fillEnabled={false}
              listening={false}
              fillAfterStrokeEnabled={true}
              opacity={isSelected ? 0.8 : 0}
            />

            {isSelected && (
              <Group {...elementCoordinate} name={EDITOR_HELPER_NAME}>
                {circleAnchorsJSX}
              </Group>
            )}
          </>
        )}

        {/* Curve text anchors - only show when selected */}
        {textShape === 'curve' && !previewMode && (
          <>
            {/* Path stroke for visual boundary - shows exact curve path */}
            <Path
              {...elementCoordinate}
              name={EDITOR_HELPER_NAME}
              key={`curve-path-${keyTextControl}`}
              data={textPath}
              stroke="#1c6ef1"
              strokeWidth={2 / scale}
              dash={[3, 3]}
              fillEnabled={false}
              listening={false}
              fillAfterStrokeEnabled={true}
              opacity={isSelected ? 0.8 : 0}
            />

            {isSelected && (
              <Group {...elementCoordinate} name={EDITOR_HELPER_NAME}>
                {curveAnchorsJSX}
              </Group>
            )}
          </>
        )}

        {/* Custom path visual feedback - only show when selected */}
        {textShape === 'custom' && !previewMode && (
          <>
            {/* Path stroke for visual boundary - shows custom path */}
            <Path
              {...elementCoordinate}
              name={EDITOR_HELPER_NAME}
              key={`custom-path-${keyTextControl}`}
              data={textPath}
              stroke="#9333ea"
              strokeWidth={2 / scale}
              dash={[3, 3]}
              fillEnabled={false}
              listening={false}
              fillAfterStrokeEnabled={true}
              opacity={isSelected ? 0.8 : 0}
            />
          </>
        )}

        {/* SVG-based text path rendering for consistent output */}
        <SVGTextPathWithEffects
          key={`svg-text-path-${keyTextControl}`}
          pathData={textPath}
          width={width}
          height={height}
          content={content}
          {...konvaTextProps}
          color={color}
          effects={effects}
          fontLoader={fontLoader}
          fontSrc={fontSrc}
          emojiFontFamily={emojiFontFamily as string}
          emojiFontSrc={emojiFontSrc as string}
          textBaseline="bottom"
          // Paint fill (takes precedence over color)
          fill={fill}
          // Paint stroke (supports solid, image, gradient) - legacy
          strokePaint={strokePaint}
          // Multiple strokes array (TextStudio-style wrapping)
          strokes={strokes}
          // Curve bend for pattern bounds calculation
          curveBend={curveBend}
          // Pass through transform properties
          x={otherProps.x}
          y={otherProps.y}
          rotation={otherProps.rotation}
          scaleX={otherProps.scaleX}
          scaleY={otherProps.scaleY}
          offsetX={otherProps.offsetX}
          offsetY={otherProps.offsetY}
          skewX={otherProps.skewX}
          skewY={otherProps.skewY}
          listening={false}
        />
      </Group>
    )
  }

  // Default text rendering for 'none' shape - use advanced rendering
  return (
    <Group>
      {/* Invisible background for reliable click detection */}
      <Rect
        ref={spriteRef as any}
        {...otherProps}
        width={width}
        height={height}
        listening={true}
        fill="rgba(0,0,0,0)"
        clipFunc={null}
      />

      <SVGTextWithEffects
        width={width}
        height={height}
        content={content}
        fontSize={shouldAutoFit ? fontSize : maxFontSize}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        fontStyle={fontStyle}
        color={color}
        letterSpacing={letterSpacing}
        // Ensure layout props are forwarded so alignment works
        align={align as any}
        verticalAlign={verticalAlign as any}
        lineHeight={lineHeight}
        wrap={wrap as any}
        padding={computeTextMeasurementPadding(otherStylesProps)}
        effects={effects}
        fontLoader={fontLoader}
        fontSrc={fontSrc}
        // Paint fill (takes precedence over color)
        fill={fill}
        // Paint stroke (supports solid, image, gradient) - legacy
        strokePaint={strokePaint}
        // Multiple strokes array (TextStudio-style wrapping)
        strokes={strokes}
        // Pass through transform properties for proper rotation/scale handling
        x={otherProps.x}
        y={otherProps.y}
        rotation={otherProps.rotation}
        scaleX={otherProps.scaleX}
        scaleY={otherProps.scaleY}
        offsetX={otherProps.offsetX}
        offsetY={otherProps.offsetY}
        skewX={otherProps.skewX}
        skewY={otherProps.skewY}
        listening={false}
      />
    </Group>
  )
}

export const KonvaTextPath = memo(KonvaTextPathComponent)
