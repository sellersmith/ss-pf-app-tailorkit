/* eslint-disable max-lines */
import Konva from 'konva'
import {
  calculateCurveEquivalentRadius,
  calculateOptimalTextSize,
  calculateSafeRadius,
  generateTextPath,
  validateGeometryParams,
  type CircularTextOptions,
  type TextScalingOptions,
} from './index'
import type { DropShadowConfig, EffectConfig, InnerShadowConfig } from '../effects/types'
import { resolveEffectsToAbsolute } from '../effects/relative-shadow-utils'
import type { StrokeConfig } from '../../paint/stroke-types'
import type { Paint } from '../../paint/paint-types'
import type { LoadedImage } from '../../paint/paint-renderer'
import { loadPaintImages } from '../../paint/paint-image-loader'
// HOTFIX: Import vanilla effects for legacy rendering (remove after July 2026)
import {
  createDropShadowLayers,
  createDropShadowPathLayers,
  createInnerShadowLayers,
  createMainTextLayer,
  createMainTextPathLayer,
} from '../effects/vanilla-effects'
import {
  renderSVGTextWithEffects,
  renderSVGTextPathWithEffects,
  fetchCustomFontAsBase64,
  fetchGoogleFontCss,
  separateEffects,
  prepareTextColor,
  prepareEffectsConfig,
  type SVGTextConfig,
  type SVGTextPathConfig,
} from '../../svg'
import { createEnvelopeText } from '../../svg/svg-envelope-text-creator'
import { scaleCustomPathToFit } from './scale-custom-path'
import { fontStorefrontLoader } from '../../../components'

// =============================================================================
// HOTFIX: Text Layer Rendering Version Control (Time-boxed)
// Layers updated before this date use OLD vanilla Konva rendering
// Layers updated on/after this date use NEW SVG rendering
// TODO: Remove after 3-6 months (around July 2026)
// =============================================================================
const SVG_RENDERING_RELEASE_DATE = new Date('2025-12-26T00:00:00.000Z')

function shouldUseLegacyRendering(updatedAt?: string): boolean {
  if (!updatedAt) return true // Default to legacy for safety
  const layerDate = new Date(updatedAt)
  return layerDate < SVG_RENDERING_RELEASE_DATE
}

export type TextLayerProps = Konva.TextConfig & {
  autoFitToContainer?: boolean
  textShape?: 'none' | 'circle' | 'curve' | 'custom' | 'fill-shape'
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
  /** Character spacing adjustment for fill-shape (-50 to +50) */
  fillShapeCharacterSpacing?: number
  effects?: EffectConfig[]
  // HOTFIX: Layer updated timestamp for rendering version control (remove after July 2026)
  updatedAt?: string
  /** Multi-stroke array (TextStudio-style wrapping) */
  strokes?: StrokeConfig[]
  /** Paint-based fill (image/gradient fills) - takes precedence over fill string */
  paintFill?: Paint
  /** Fills array from admin - first fill is used if paintFill not provided */
  fills?: Paint[]
  /** Fill opacity (0-1), applied to text fill */
  fillOpacity?: number
  /** Custom font for emoji picker characters (PUA glyphs) */
  emojiFontFamily?: string
  /** URL to the emoji font file */
  emojiFontSrc?: string
}

/**
 * HOTFIX: Render text with OLD vanilla Konva effects
 * Uses native Konva shadow properties instead of SVG filters
 * TODO: Remove after July 2026
 */
function renderTextWithVanillaEffects(
  targetContainer: Konva.Group | Konva.Layer,
  textConfig: Konva.TextConfig,
  dropShadows: DropShadowConfig[],
  innerShadows: InnerShadowConfig[],
  textColor: string,
  transformProps: Partial<Konva.NodeConfig>
): Konva.Group {
  // Create group exactly like old effectsGroup - spread transformProps which includes listening: false
  const group = new Konva.Group(transformProps)

  // Drop shadows (behind text)
  if (dropShadows.length > 0) {
    const layers = createDropShadowLayers(textConfig, dropShadows, textColor, 1, 1)
    layers.forEach(layer => group.add(layer))
  }

  // Inner shadows or main text
  if (innerShadows.length > 0) {
    const innerGroup = createInnerShadowLayers({ variant: 'text', config: textConfig }, innerShadows, textColor, 1, 1)
    group.add(innerGroup)
  } else {
    group.add(createMainTextLayer(textConfig, textColor))
  }

  targetContainer.add(group)
  return group
}

/**
 * HOTFIX: Render text path with OLD vanilla Konva effects
 * TODO: Remove after July 2026
 */
function renderTextPathWithVanillaEffects(
  targetContainer: Konva.Group | Konva.Layer,
  textPathConfig: {
    data: string
    text: string
    fontSize: number
    fontFamily?: string
    fontWeight?: string | number
    fontStyle?: string
    letterSpacing?: number
    textBaseline?: CanvasTextBaseline
    [key: string]: any
  },
  dropShadows: DropShadowConfig[],
  innerShadows: InnerShadowConfig[],
  textColor: string,
  transformProps: Partial<Konva.NodeConfig>,
  width: number
): Konva.Group {
  // Create group exactly like old effectsGroup - spread transformProps which includes listening: false
  const group = new Konva.Group(transformProps)

  // Drop shadows (behind text)
  if (dropShadows.length > 0) {
    const layers = createDropShadowPathLayers(textPathConfig, dropShadows, textColor, 1, 1)
    layers.forEach(layer => group.add(layer))
  }

  // Inner shadows or main text
  if (innerShadows.length > 0) {
    const innerGroup = createInnerShadowLayers(
      { variant: 'textPath', config: textPathConfig, width },
      innerShadows,
      textColor,
      1,
      1
    )
    group.add(innerGroup)
  } else {
    group.add(createMainTextPathLayer(textPathConfig, textColor))
  }

  targetContainer.add(group)
  return group
}

export async function addTextLayer(
  targetContainer: Konva.Group | Konva.Layer,
  props: TextLayerProps
): Promise<Konva.Text | Konva.TextPath | Konva.Image | Konva.Group> {
  // HOTFIX: Match original prop extraction pattern exactly (remove after July 2026)
  // Original code did NOT extract align, verticalAlign, fontWeight at top level
  // They stayed in otherProps → styleOtherProps → baseTextProps → restBaseTextProps
  const {
    text,
    x,
    y,
    width,
    height,
    fontSize,
    fontFamily,
    fontSrc,
    padding = 0,
    lineHeight = 1.2,
    fontStyle,
    letterSpacing,
    autoFitToContainer = false,
    textShape = 'none',
    circleStartAngle = 0,
    circleEndAngle = Math.PI * 2,
    circleInverted = false,
    curvePeaks,
    curveBend = 50,
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
    neonMode,
    neonIntensity,
    neonOffsetX,
    neonOffsetY,
    fill,
    stroke,
    strokeWidth,
    wrap = 'none',
    effects,
    textDecoration,
    // HOTFIX: Extract updatedAt for rendering version control (remove after July 2026)
    updatedAt,
    // NEW: Multi-stroke and paint fill support
    strokes,
    paintFill,
    fills, // Admin saves fills as array, extract first one
    fillOpacity = 1,
    emojiFontFamily,
    emojiFontSrc,
    ...otherProps
  } = props

  // Resolve paint fill: paintFill takes precedence, then fills[0]
  const resolvedPaintFill = paintFill ?? (Array.isArray(fills) && fills.length > 0 ? fills[0] : undefined)

  // Extract transform-related props, collect rest as styleOtherProps (matches original pattern)
  // styleOtherProps contains align, verticalAlign, fontWeight, and any other passed props
  const {
    rotation: transformRotation,
    scaleX: transformScaleX,
    scaleY: transformScaleY,
    offsetX: transformOffsetX,
    offsetY: transformOffsetY,
    skewX: transformSkewX,
    skewY: transformSkewY,
    ...styleOtherProps
  } = otherProps

  // Extract commonly used props from styleOtherProps for convenience
  const align = styleOtherProps.align as string | undefined
  const verticalAlign = styleOtherProps.verticalAlign as string | undefined
  const fontWeight = styleOtherProps.fontWeight as string | number | undefined

  const baseFontFamily = fontFamily || 'Arial'
  const safeWidth = width || 0
  const safeHeight = height || 0
  const textColor = (fill as string) || '#000000'

  // Load custom font if fontSrc is provided
  try {
    await fontStorefrontLoader.loadFont(baseFontFamily, fontSrc)
  } catch (error) {
    console.error(`Failed to load font ${baseFontFamily}, falling back to system font:`, error)
  }

  const safeFontFamily = baseFontFamily
  // For SVG rendering: composite font-family with emoji font fallback for PUA characters.
  // SVG-to-image is isolated from document.fonts, so emoji font must be embedded as base64
  // AND referenced in font-family fallback chain.
  const svgFontFamily = emojiFontFamily ? `'${baseFontFamily}', '${emojiFontFamily}'` : baseFontFamily
  // Also load emoji font for CSS/HTML rendering (input fields, emoji picker buttons)
  if (emojiFontFamily && emojiFontSrc) {
    try {
      await fontStorefrontLoader.loadFont(emojiFontFamily, emojiFontSrc)
    } catch (error) {
      console.error(`Failed to load emoji font ${emojiFontFamily}:`, error)
    }
  }

  // Calculate font size (auto-fit or explicit)
  let calculatedFontSize = fontSize || 16
  let finalText = text || ''

  if (autoFitToContainer) {
    let circularPathInfo: CircularTextOptions | undefined

    if (textShape === 'circle') {
      const { width: safeW, height: safeH } = validateGeometryParams({ width: safeWidth, height: safeHeight })
      const radius = calculateSafeRadius(safeW, safeH)
      circularPathInfo = { radius, startAngle: circleStartAngle, endAngle: circleEndAngle }
    }

    if (textShape === 'curve') {
      const equivalentRadius = calculateCurveEquivalentRadius(safeWidth, safeHeight, curvePeaks || 1, curveBend)
      circularPathInfo = { radius: equivalentRadius, startAngle: 0, endAngle: 2 * Math.PI }
    }

    const result = calculateOptimalTextSize({
      text: text || '',
      width: safeWidth,
      height: safeHeight,
      padding,
      maxFontSize: fontSize || 200,
      minFontSize: 1,
      fontFamily: safeFontFamily,
      lineHeight,
      precision: 0.1,
      fontStyle,
      wrap: (wrap as TextScalingOptions['wrap']) || 'word',
      circularPath: circularPathInfo,
      letterSpacing,
    })

    calculatedFontSize = result.fontSize
    finalText = result.textProps.text
  }

  // Handle effects pipeline (preferred) with backward neon compatibility
  let derivedEffects: EffectConfig[] = []

  if (Array.isArray(effects) && effects.length > 0) {
    derivedEffects = effects
  } else if (neonMode && neonMode !== 'none') {
    const near = Math.max(2, Math.round((neonIntensity || 12) * 0.6))
    const far = Math.max(6, Math.round((neonIntensity || 12) * 1.6))
    derivedEffects = [
      {
        type: 'DROP_SHADOW',
        visible: true,
        color: 'currentColor',
        offsetX: neonOffsetX || 0,
        offsetY: neonOffsetY || 0,
        radius: near,
      },
      {
        type: 'DROP_SHADOW',
        visible: true,
        color: 'currentColor',
        offsetX: neonOffsetX || 0,
        offsetY: neonOffsetY || 0,
        radius: far,
      },
      {
        type: 'INNER_SHADOW',
        visible: true,
        color: 'rgb(255, 255, 255)',
        offsetX: neonOffsetX || 0,
        offsetY: neonOffsetY || 0,
        radius: 100,
      },
    ]
  }

  // Resolve relative effects to absolute values based on font size, then separate by type
  const resolvedEffects = resolveEffectsToAbsolute(derivedEffects, calculatedFontSize)
  const { dropShadows, innerShadows, hasEffects: hasEffectsFromShadows } = separateEffects(resolvedEffects)

  // Check if we have visible strokes in the strokes array
  const hasStrokesArray = strokes?.some(s => s.visible !== false && s.weight > 0) ?? false

  // Check if we have any effects that require SVG rendering (shadows, stroke, strokes array, or paint fill)
  const hasLegacyStroke = !!(stroke && strokeWidth && strokeWidth > 0)
  const hasPaintFill = !!resolvedPaintFill
  const hasEffects = hasEffectsFromShadows || hasLegacyStroke || hasStrokesArray || hasPaintFill

  // HOTFIX: Check if we should use legacy vanilla Konva rendering (remove after July 2026)
  const useLegacyRendering = shouldUseLegacyRendering(updatedAt)

  // Load images for paint fills and strokes (only for new SVG rendering)
  let loadedImages: Map<string, LoadedImage> = new Map()
  if (!useLegacyRendering && (hasPaintFill || hasStrokesArray)) {
    loadedImages = await loadPaintImages(resolvedPaintFill, strokes)
  }

  // Prepare color for SVG (solid RGB when effects exist, filter handles opacity)
  const svgColor = prepareTextColor(textColor, hasEffects)

  // Get font base64 CSS for SVG embedding
  let fontBase64Css: string | null = null
  if (hasEffects || textShape !== 'none') {
    try {
      let baseCss: string | null = null
      if (fontSrc) {
        baseCss = await fetchCustomFontAsBase64(fontSrc, safeFontFamily)
      } else if (safeFontFamily !== 'Arial') {
        baseCss = await fetchGoogleFontCss(safeFontFamily, String(fontWeight || 400))
      }

      // Also fetch emoji font base64 for PUA character rendering in SVG
      let emojiFontCss: string | null = null
      if (emojiFontFamily && emojiFontSrc) {
        emojiFontCss = await fetchCustomFontAsBase64(emojiFontSrc, emojiFontFamily)
      }

      const parts = [baseCss, emojiFontCss].filter((s): s is string => s !== null)
      fontBase64Css = parts.length > 0 ? parts.join('\n') : null
    } catch (error) {
      console.warn('Failed to fetch font for SVG embedding:', error)
    }
  }

  // Effective stroke values (neon inverse mode swaps fill to stroke)
  // SVG filters only support string stroke colors, not CanvasGradient
  const effectiveStroke = neonMode === 'inverse' ? (fill as string) : typeof stroke === 'string' ? stroke : undefined
  const effectiveStrokeWidth = strokeWidth || 0

  // Handle fill-shape (envelope distortion) - special handling
  if (textShape === 'fill-shape' && fillShapePathData) {
    // Scale the fill shape path to fit text layer dimensions
    const scaledFillShapePath = scaleCustomPathToFit(fillShapePathData, safeWidth, safeHeight, fillShapeMetadata)

    // Use text layer dimensions as viewBox (path is already scaled to fit)
    const envelopeResult = createEnvelopeText(
      scaledFillShapePath,
      {
        text: finalText,
        fontSize: calculatedFontSize,
        fontFamily: svgFontFamily,
        fontWeight,
        letterSpacing: letterSpacing || 0,
        lineHeight,
        fillColor: textColor,
        strokeColor: effectiveStroke,
        strokeWidth: effectiveStrokeWidth,
        fontBase64Css, // CRITICAL: Embed font for correct rendering when SVG is rasterized
        verticalOffset: fillShapeVerticalOffset,
        verticalScale: fillShapeVerticalScale,
        horizontalOffset: fillShapeHorizontalOffset,
        horizontalScale: fillShapeHorizontalScale,
        characterSpacing: fillShapeCharacterSpacing,
      },
      safeWidth,
      safeHeight
    )

    if (envelopeResult) {
      // Create image from SVG
      const img = new Image()
      const svgBlob = new Blob([envelopeResult.svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          URL.revokeObjectURL(url)
          resolve()
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('Failed to load envelope text SVG'))
        }
        img.src = url
      })

      // Use Group wrapper for transforms
      const group = new Konva.Group({
        x: x || 0,
        y: y || 0,
        rotation: transformRotation,
        scaleX: transformScaleX,
        scaleY: transformScaleY,
        offsetX: transformOffsetX,
        offsetY: transformOffsetY,
        skewX: transformSkewX,
        skewY: transformSkewY,
        listening: false,
      })

      const imageNode = new Konva.Image({
        image: img,
        x: padding,
        y: padding,
        width: safeWidth,
        height: safeHeight,
        listening: false,
        perfectDrawEnabled: false,
      })

      group.add(imageNode)
      targetContainer.add(group)
      return group
    }
  }

  // Handle text shapes (circle, curve, custom) - fill-shape is handled above
  if (textShape !== 'none' && textShape !== 'fill-shape') {
    const { textPath: pathData } = generateTextPath({
      width: safeWidth,
      height: safeHeight,
      fontSize: calculatedFontSize,
      textShape: textShape as 'circle' | 'curve' | 'custom',
      circleStartAngle,
      circleEndAngle,
      circleInverted,
      curvePeaks,
      curveBend,
      customPathData,
      customPathMetadata,
      customPathInverted,
      fontFamily: safeFontFamily,
      color: textColor,
      align: 'center',
      verticalAlign: 'middle',
    })

    if (pathData) {
      // HOTFIX: Use legacy vanilla Konva rendering for text paths (remove after July 2026)
      if (useLegacyRendering && hasEffects) {
        // OLD CODE NOTE: For text paths, the old code used letterSpacing = 0 (not the 0.01 workaround)
        // The workaround was only in baseTextProps but textPathProps overwrote it with:
        // letterSpacing: styleOtherProps.letterSpacing || 0
        // Since letterSpacing is extracted from props, styleOtherProps.letterSpacing is undefined
        // So it becomes 0. We must match this exactly for backward compatibility.
        const textPathLetterSpacing = letterSpacing || 0

        // Build textPathProps matching the exact old structure from f5c7246d4^
        // Original pattern: restBaseTextProps (baseTextProps minus position/transforms)
        // baseTextProps included: ...styleOtherProps (which has align, verticalAlign, etc.)
        const textPathConfig = {
          // Style properties from old restBaseTextProps
          fontStyle,
          fontFamily: safeFontFamily,
          fill: textColor,
          stroke: effectiveStroke,
          strokeWidth: effectiveStrokeWidth,
          // Spread styleOtherProps to include align, verticalAlign, and any other props
          // This matches the original: ...restBaseTextProps which had ...styleOtherProps
          ...styleOtherProps,
          // Fixed properties
          fillAfterStrokeEnabled: true,
          listening: false,
          lineHeight,
          wrap,
          textDecoration,
          ellipsis: false,
          // TextPath-specific overrides (matching old textPathProps)
          data: pathData,
          text: finalText,
          fontSize: calculatedFontSize,
          letterSpacing: textPathLetterSpacing, // OLD: was 0, not 0.01 workaround
          textBaseline: 'bottom' as CanvasTextBaseline,
        }
        // Container group positioned at element location with transforms (matching old effectsGroup)
        const transformProps = {
          x: (x || 0) + padding,
          y: (y || 0) + padding,
          listening: false,
          rotation: transformRotation,
          scaleX: transformScaleX,
          scaleY: transformScaleY,
          offsetX: transformOffsetX,
          offsetY: transformOffsetY,
          skewX: transformSkewX,
          skewY: transformSkewY,
        }
        return renderTextPathWithVanillaEffects(
          targetContainer,
          textPathConfig,
          dropShadows,
          innerShadows,
          textColor,
          transformProps,
          safeWidth
        )
      }

      // Use SVG-based rendering for text path
      const svgTextPathConfig: SVGTextPathConfig = {
        content: finalText,
        width: safeWidth,
        height: safeHeight,
        fontSize: calculatedFontSize,
        fontFamily: svgFontFamily,
        fontWeight,
        fontStyle,
        fontBase64Css,
        // Use prepared color (solid RGB when effects exist)
        color: svgColor,
        letterSpacing: letterSpacing || 0,
        pathData,
        textBaseline: 'alphabetic',
        align: 'center',
        dropShadows,
        innerShadows,
        stroke: effectiveStroke,
        strokeWidth: effectiveStrokeWidth,
        textDecoration,
        // NEW: Paint-based fill and curve bend for expanded pattern bounds
        fill: resolvedPaintFill,
        fillOpacity,
        loadedImages,
        curveBend,
      }

      // Use shared utility for proper fill opacity handling (includes strokes)
      const effectsConfig = prepareEffectsConfig(dropShadows, innerShadows, textColor, fillOpacity, strokes)

      const filterId = `text-path-${Date.now()}-${Math.random().toString(36).substring(7)}`
      const result = await renderSVGTextPathWithEffects({
        config: svgTextPathConfig,
        effectsConfig,
        filterId,
        loadedImages,
      })

      // Use Group wrapper for transforms (matches admin SVGTextWithEffects pattern)
      // This ensures rotation pivot is correct relative to padded content
      const group = new Konva.Group({
        x: x || 0,
        y: y || 0,
        rotation: transformRotation,
        scaleX: transformScaleX,
        scaleY: transformScaleY,
        offsetX: transformOffsetX,
        offsetY: transformOffsetY,
        skewX: transformSkewX,
        skewY: transformSkewY,
        listening: false,
      })

      const imageNode = new Konva.Image({
        image: result.image,
        x: padding - result.padding,
        y: padding - result.padding,
        width: safeWidth + result.padding * 2,
        height: safeHeight + result.padding * 2,
        listening: false,
        perfectDrawEnabled: false,
      })

      group.add(imageNode)
      targetContainer.add(group)
      return group
    }
  }

  // Regular text rendering
  if (hasEffects) {
    // HOTFIX: Use legacy vanilla Konva rendering for regular text (remove after July 2026)
    if (useLegacyRendering) {
      // Apply letterSpacing=0.01 workaround when drop shadows exist and letterSpacing is 0
      // This fixes Konva's bug where letterSpacing=0 breaks shadow rendering
      const hasDropShadowsForText = dropShadows.length > 0
      const effectiveLetterSpacingForText = hasDropShadowsForText && !letterSpacing ? 0.01 : (letterSpacing ?? 0)

      // Build textConfig matching the exact old baseTextPropsWithoutTransform structure:
      // Original pattern: baseTextProps minus transforms, which included ...styleOtherProps
      const textConfig: Konva.TextConfig = {
        // Position relative to group (not absolute position)
        x: 0,
        y: 0,
        // Text content properties
        text: finalText,
        width: safeWidth,
        height: safeHeight,
        fontSize: calculatedFontSize,
        fontFamily: svgFontFamily,
        fontStyle,
        letterSpacing: effectiveLetterSpacingForText,
        // Fill and stroke
        fill: textColor,
        stroke: effectiveStroke,
        strokeWidth: effectiveStrokeWidth,
        // Spread styleOtherProps to include align, verticalAlign, and any other props
        // This matches the original: ...baseTextPropsWithoutTransform which had ...styleOtherProps
        ...styleOtherProps,
        // Fixed properties (override any from styleOtherProps)
        lineHeight,
        wrap,
        textDecoration,
        fillAfterStrokeEnabled: true,
        listening: false,
        ellipsis: false,
      }
      // Container group positioned at element location with transforms (matching old effectsGroup)
      const transformProps = {
        x: (x || 0) + padding,
        y: (y || 0) + padding,
        listening: false,
        rotation: transformRotation,
        scaleX: transformScaleX,
        scaleY: transformScaleY,
        offsetX: transformOffsetX,
        offsetY: transformOffsetY,
        skewX: transformSkewX,
        skewY: transformSkewY,
      }
      return renderTextWithVanillaEffects(
        targetContainer,
        textConfig,
        dropShadows,
        innerShadows,
        textColor,
        transformProps
      )
    }

    // Use SVG-based rendering for text with effects
    const svgTextConfig: SVGTextConfig = {
      content: finalText,
      width: safeWidth,
      height: safeHeight,
      fontSize: calculatedFontSize,
      fontFamily: svgFontFamily,
      fontWeight,
      fontStyle,
      fontBase64Css,
      // Use prepared color (solid RGB when effects exist)
      color: svgColor,
      letterSpacing: letterSpacing || 0,
      lineHeight,
      align: (align as 'left' | 'center' | 'right') || 'left',
      verticalAlign: (verticalAlign as 'top' | 'middle' | 'bottom') || 'top',
      wrap: wrap === 'none' ? 'none' : wrap === 'char' ? 'char' : 'word',
      padding,
      dropShadows,
      innerShadows,
      stroke: effectiveStroke,
      strokeWidth: effectiveStrokeWidth,
      // NEW: Paint-based fill and fill opacity
      fill: resolvedPaintFill,
      fillOpacity,
      loadedImages,
      textDecoration,
    }

    // Use shared utility for proper fill opacity handling (includes strokes)
    const effectsConfig = prepareEffectsConfig(dropShadows, innerShadows, textColor, fillOpacity, strokes)

    const filterId = `text-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const result = await renderSVGTextWithEffects({ config: svgTextConfig, effectsConfig, filterId, loadedImages })

    // Use Group wrapper for transforms (matches admin SVGTextWithEffects pattern)
    // This ensures rotation pivot is correct relative to padded content
    const group = new Konva.Group({
      x: x || 0,
      y: y || 0,
      rotation: transformRotation,
      scaleX: transformScaleX,
      scaleY: transformScaleY,
      offsetX: transformOffsetX,
      offsetY: transformOffsetY,
      skewX: transformSkewX,
      skewY: transformSkewY,
      listening: false,
    })

    const imageNode = new Konva.Image({
      image: result.image,
      x: -result.leftPadding,
      y: -result.topPadding,
      width: safeWidth + result.leftPadding + result.rightPadding,
      height: safeHeight + result.topPadding + result.bottomPadding,
      listening: false,
      perfectDrawEnabled: false,
    })

    group.add(imageNode)
    targetContainer.add(group)
    return group
  }

  // Fast path: Basic text without effects - use native Konva.Text
  // Use svgFontFamily (composite with emoji font fallback) so PUA chars render via Canvas 2D fallback
  const textNode = new Konva.Text({
    x: (x || 0) + padding,
    y: (y || 0) + padding,
    text: finalText,
    width: safeWidth,
    height: safeHeight,
    fontSize: calculatedFontSize,
    fontFamily: svgFontFamily,
    fontStyle,
    fill: textColor,
    stroke: effectiveStroke,
    strokeWidth: effectiveStrokeWidth,
    letterSpacing: letterSpacing ?? 0,
    lineHeight,
    align,
    verticalAlign,
    wrap,
    textDecoration,
    rotation: transformRotation,
    scaleX: transformScaleX,
    scaleY: transformScaleY,
    offsetX: transformOffsetX,
    offsetY: transformOffsetY,
    skewX: transformSkewX,
    skewY: transformSkewY,
    fillAfterStrokeEnabled: true,
    listening: false,
    ellipsis: false,
  })

  targetContainer.add(textNode)
  return textNode
}
