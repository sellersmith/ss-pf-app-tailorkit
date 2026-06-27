import Konva from 'konva'
import type { EffectConfig, DropShadowConfig, InnerShadowConfig } from '../effects/types'
import { resolveEffectsToAbsolute } from '../effects/relative-shadow-utils'
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
import {
  calculateCurveEquivalentRadius,
  calculateOptimalTextSize,
  calculateSafeRadius,
  generateTextPath,
  validateGeometryParams,
  type CircularTextOptions,
  type TextScalingOptions,
} from './index'

/**
 * Options for rendering a text layer
 */
export interface TextLayerOptions extends Konva.TextConfig {
  autoFitToContainer?: boolean
  textShape?: 'none' | 'circle' | 'curve'
  circleStartAngle?: number
  circleEndAngle?: number
  curvePeaks?: number
  curveBend?: number
  effects?: EffectConfig[]
}

/**
 * Dependencies required for rendering text layers
 */
export interface TextLayerDependencies {
  getTargetContainer: () => Konva.Container
  loadFont: (family: string, src?: string) => Promise<void>
}

/**
 * Render a text layer with optional effects, shapes, and auto-fitting.
 *
 * @param options - Text layer configuration
 * @param dependencies - Required dependencies
 * @returns Promise resolving to Konva.Text, Konva.TextPath, or Konva.Image
 */
export async function renderTextLayer(
  options: TextLayerOptions,
  dependencies: TextLayerDependencies
): Promise<Konva.Text | Konva.TextPath | Konva.Image> {
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
    curvePeaks,
    curveBend = 50,
    neonMode,
    neonIntensity,
    neonOffsetX,
    neonOffsetY,
    fill,
    stroke,
    strokeWidth,
    wrap = 'none',
    effects,
    align,
    verticalAlign,
    fontWeight,
    ...otherProps
  } = options

  const { getTargetContainer, loadFont } = dependencies

  // Extract transform-related props so they are applied on the container group only
  const {
    rotation: transformRotation,
    scaleX: transformScaleX,
    scaleY: transformScaleY,
    offsetX: transformOffsetX,
    offsetY: transformOffsetY,
    skewX: transformSkewX,
    skewY: transformSkewY,
  } = otherProps

  const targetContainer = getTargetContainer()
  const safeFontFamily = fontFamily || 'Arial'
  const safeWidth = width || 0
  const safeHeight = height || 0
  const textColor = (fill as string) || '#000000'

  // Load custom font if fontSrc is provided
  try {
    await loadFont(safeFontFamily, fontSrc)
  } catch (error) {
    console.error(`Failed to load font ${safeFontFamily}, falling back to system font:`, error)
  }

  // Calculate font size and prepare text
  const { calculatedFontSize, finalText } = calculateTextFontSize({
    text: text || '',
    width: safeWidth,
    height: safeHeight,
    fontSize,
    fontFamily: safeFontFamily,
    fontStyle,
    lineHeight,
    letterSpacing,
    padding,
    wrap,
    autoFitToContainer,
    textShape,
    circleStartAngle,
    circleEndAngle,
    curvePeaks,
    curveBend,
  })

  // Derive effects from legacy neon mode or use modern effects
  const derivedEffects = deriveEffectsFromLegacy({
    effects,
    neonMode,
    neonIntensity,
    neonOffsetX,
    neonOffsetY,
  })

  // Resolve relative effects to absolute values based on font size
  const resolvedEffects = resolveEffectsToAbsolute(derivedEffects, calculatedFontSize)
  const { dropShadows, innerShadows, hasEffects: hasEffectsFromShadows } = separateEffects(resolvedEffects)

  // Check if we have any effects that require SVG rendering (shadows or stroke)
  const hasEffects = hasEffectsFromShadows || !!(stroke && strokeWidth && strokeWidth > 0)

  // Prepare color for SVG (solid RGB when effects exist, filter handles opacity)
  const svgColor = prepareTextColor(textColor, hasEffects)

  // Get font base64 CSS for SVG embedding
  const fontBase64Css = await fetchFontForSvg({
    fontSrc,
    fontFamily: safeFontFamily,
    fontWeight,
    hasEffects,
    textShape,
  })

  // Effective stroke values (neon inverse mode swaps fill to stroke)
  const effectiveStroke = neonMode === 'inverse' ? (fill as string) : typeof stroke === 'string' ? stroke : undefined
  const effectiveStrokeWidth = strokeWidth || 0

  // Handle text shapes (circle, curve)
  if (textShape !== 'none') {
    const result = await renderTextPath({
      finalText,
      safeWidth,
      safeHeight,
      calculatedFontSize,
      safeFontFamily,
      fontWeight,
      fontStyle,
      fontBase64Css,
      svgColor,
      textColor,
      letterSpacing,
      textShape,
      circleStartAngle,
      circleEndAngle,
      curvePeaks,
      curveBend,
      dropShadows,
      innerShadows,
      effectiveStroke,
      effectiveStrokeWidth,
      x,
      y,
      padding,
      transformRotation,
      transformScaleX,
      transformScaleY,
      transformOffsetX,
      transformOffsetY,
      transformSkewX,
      transformSkewY,
      targetContainer,
    })

    if (result) {
      return result
    }
  }

  // Regular text rendering with effects
  if (hasEffects) {
    return renderTextWithEffects({
      finalText,
      safeWidth,
      safeHeight,
      calculatedFontSize,
      safeFontFamily,
      fontWeight,
      fontStyle,
      fontBase64Css,
      svgColor,
      textColor,
      letterSpacing,
      lineHeight,
      align,
      verticalAlign,
      wrap,
      padding,
      dropShadows,
      innerShadows,
      effectiveStroke,
      effectiveStrokeWidth,
      x,
      y,
      transformRotation,
      transformScaleX,
      transformScaleY,
      transformOffsetX,
      transformOffsetY,
      transformSkewX,
      transformSkewY,
      targetContainer,
    })
  }

  // Fast path: Basic text without effects - use native Konva.Text
  return renderBasicText({
    finalText,
    safeWidth,
    safeHeight,
    calculatedFontSize,
    safeFontFamily,
    fontStyle,
    textColor,
    effectiveStroke,
    effectiveStrokeWidth,
    letterSpacing,
    lineHeight,
    align,
    verticalAlign,
    wrap,
    x,
    y,
    padding,
    transformRotation,
    transformScaleX,
    transformScaleY,
    transformOffsetX,
    transformOffsetY,
    transformSkewX,
    transformSkewY,
    targetContainer,
  })
}

/**
 * Calculate optimal font size based on auto-fit settings
 */
function calculateTextFontSize(params: {
  text: string
  width: number
  height: number
  fontSize?: number
  fontFamily: string
  fontStyle?: string
  lineHeight: number
  letterSpacing?: number
  padding: number
  wrap: string
  autoFitToContainer: boolean
  textShape: string
  circleStartAngle: number
  circleEndAngle: number
  curvePeaks?: number
  curveBend: number
}): { calculatedFontSize: number; finalText: string } {
  const {
    text,
    width,
    height,
    fontSize,
    fontFamily,
    fontStyle,
    lineHeight,
    letterSpacing,
    padding,
    wrap,
    autoFitToContainer,
    textShape,
    circleStartAngle,
    circleEndAngle,
    curvePeaks,
    curveBend,
  } = params

  let calculatedFontSize = fontSize || 16
  let finalText = text

  if (autoFitToContainer) {
    let circularPathInfo: CircularTextOptions | undefined

    if (textShape === 'circle') {
      const { width: safeW, height: safeH } = validateGeometryParams({ width, height })
      const radius = calculateSafeRadius(safeW, safeH)
      circularPathInfo = { radius, startAngle: circleStartAngle, endAngle: circleEndAngle }
    }

    if (textShape === 'curve') {
      const equivalentRadius = calculateCurveEquivalentRadius(width, height, curvePeaks || 1, curveBend)
      circularPathInfo = { radius: equivalentRadius, startAngle: 0, endAngle: 2 * Math.PI }
    }

    const result = calculateOptimalTextSize({
      text,
      width,
      height,
      padding,
      maxFontSize: fontSize || 200,
      minFontSize: 1,
      fontFamily,
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

  return { calculatedFontSize, finalText }
}

/**
 * Derive effects from legacy neon mode or use modern effects array
 */
function deriveEffectsFromLegacy(params: {
  effects?: EffectConfig[]
  neonMode?: string
  neonIntensity?: number
  neonOffsetX?: number
  neonOffsetY?: number
}): EffectConfig[] {
  const { effects, neonMode, neonIntensity, neonOffsetX, neonOffsetY } = params

  if (Array.isArray(effects) && effects.length > 0) {
    return effects
  }

  if (neonMode && neonMode !== 'none') {
    const near = Math.max(2, Math.round((neonIntensity || 12) * 0.6))
    const far = Math.max(6, Math.round((neonIntensity || 12) * 1.6))
    return [
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

  return []
}

/**
 * Fetch font CSS for SVG embedding
 */
async function fetchFontForSvg(params: {
  fontSrc?: string
  fontFamily: string
  fontWeight?: string | number
  hasEffects: boolean
  textShape: string
}): Promise<string | null> {
  const { fontSrc, fontFamily, fontWeight, hasEffects, textShape } = params

  if (!hasEffects && textShape === 'none') {
    return null
  }

  try {
    if (fontSrc) {
      return await fetchCustomFontAsBase64(fontSrc, fontFamily)
    } else if (fontFamily !== 'Arial') {
      return await fetchGoogleFontCss(fontFamily, String(fontWeight || 400))
    }
  } catch (error) {
    console.warn('Failed to fetch font for SVG embedding:', error)
  }

  return null
}

/**
 * Render text along a path (circle or curve)
 */
async function renderTextPath(params: {
  finalText: string
  safeWidth: number
  safeHeight: number
  calculatedFontSize: number
  safeFontFamily: string
  fontWeight?: string | number
  fontStyle?: string
  fontBase64Css: string | null
  svgColor: string
  textColor: string
  letterSpacing?: number
  textShape: string
  circleStartAngle: number
  circleEndAngle: number
  curvePeaks?: number
  curveBend: number
  dropShadows: DropShadowConfig[]
  innerShadows: InnerShadowConfig[]
  effectiveStroke?: string
  effectiveStrokeWidth: number
  x?: number
  y?: number
  padding: number
  transformRotation?: number
  transformScaleX?: number
  transformScaleY?: number
  transformOffsetX?: number
  transformOffsetY?: number
  transformSkewX?: number
  transformSkewY?: number
  targetContainer: Konva.Container
}): Promise<Konva.Image | null> {
  const {
    finalText,
    safeWidth,
    safeHeight,
    calculatedFontSize,
    safeFontFamily,
    fontWeight,
    fontStyle,
    fontBase64Css,
    svgColor,
    textColor,
    letterSpacing,
    textShape,
    circleStartAngle,
    circleEndAngle,
    curvePeaks,
    curveBend,
    dropShadows,
    innerShadows,
    effectiveStroke,
    effectiveStrokeWidth,
    x,
    y,
    padding,
    transformRotation,
    transformScaleX,
    transformScaleY,
    transformOffsetX,
    transformOffsetY,
    transformSkewX,
    transformSkewY,
    targetContainer,
  } = params

  const { textPath: pathData } = generateTextPath({
    width: safeWidth,
    height: safeHeight,
    fontSize: calculatedFontSize,
    textShape: textShape as 'circle' | 'curve',
    circleStartAngle,
    circleEndAngle,
    curvePeaks,
    curveBend,
    fontFamily: safeFontFamily,
    color: textColor,
    align: 'center',
    verticalAlign: 'middle',
  })

  if (!pathData) {
    return null
  }

  // Use SVG-based rendering for text path
  const svgTextPathConfig: SVGTextPathConfig = {
    content: finalText,
    width: safeWidth,
    height: safeHeight,
    fontSize: calculatedFontSize,
    fontFamily: safeFontFamily,
    fontWeight,
    fontStyle,
    fontBase64Css,
    color: svgColor,
    letterSpacing: letterSpacing || 0,
    pathData,
    textBaseline: 'alphabetic',
    align: 'center',
    dropShadows,
    innerShadows,
    stroke: effectiveStroke,
    strokeWidth: effectiveStrokeWidth,
  }

  const effectsConfig = prepareEffectsConfig(dropShadows, innerShadows, textColor)
  const filterId = `text-path-${Date.now()}-${Math.random().toString(36).substring(7)}`
  const result = await renderSVGTextPathWithEffects({ config: svgTextPathConfig, effectsConfig, filterId })

  const imageNode = new Konva.Image({
    image: result.image,
    x: (x || 0) + padding - result.pathPadding,
    y: (y || 0) + padding - result.pathPadding,
    width: safeWidth + result.pathPadding * 2,
    height: safeHeight + result.pathPadding * 2,
    rotation: transformRotation,
    scaleX: transformScaleX,
    scaleY: transformScaleY,
    offsetX: transformOffsetX,
    offsetY: transformOffsetY,
    skewX: transformSkewX,
    skewY: transformSkewY,
    listening: false,
    perfectDrawEnabled: false,
  })

  targetContainer.add(imageNode)
  return imageNode
}

/**
 * Render text with SVG-based effects (shadows, stroke)
 */
async function renderTextWithEffects(params: {
  finalText: string
  safeWidth: number
  safeHeight: number
  calculatedFontSize: number
  safeFontFamily: string
  fontWeight?: string | number
  fontStyle?: string
  fontBase64Css: string | null
  svgColor: string
  textColor: string
  letterSpacing?: number
  lineHeight: number
  align?: string
  verticalAlign?: string
  wrap: string
  padding: number
  dropShadows: DropShadowConfig[]
  innerShadows: InnerShadowConfig[]
  effectiveStroke?: string
  effectiveStrokeWidth: number
  x?: number
  y?: number
  transformRotation?: number
  transformScaleX?: number
  transformScaleY?: number
  transformOffsetX?: number
  transformOffsetY?: number
  transformSkewX?: number
  transformSkewY?: number
  targetContainer: Konva.Container
}): Promise<Konva.Image> {
  const {
    finalText,
    safeWidth,
    safeHeight,
    calculatedFontSize,
    safeFontFamily,
    fontWeight,
    fontStyle,
    fontBase64Css,
    svgColor,
    textColor,
    letterSpacing,
    lineHeight,
    align,
    verticalAlign,
    wrap,
    padding,
    dropShadows,
    innerShadows,
    effectiveStroke,
    effectiveStrokeWidth,
    x,
    y,
    transformRotation,
    transformScaleX,
    transformScaleY,
    transformOffsetX,
    transformOffsetY,
    transformSkewX,
    transformSkewY,
    targetContainer,
  } = params

  const svgTextConfig: SVGTextConfig = {
    content: finalText,
    width: safeWidth,
    height: safeHeight,
    fontSize: calculatedFontSize,
    fontFamily: safeFontFamily,
    fontWeight,
    fontStyle,
    fontBase64Css,
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
  }

  const effectsConfig = prepareEffectsConfig(dropShadows, innerShadows, textColor)
  const filterId = `text-${Date.now()}-${Math.random().toString(36).substring(7)}`
  const result = await renderSVGTextWithEffects({ config: svgTextConfig, effectsConfig, filterId })

  const imageNode = new Konva.Image({
    image: result.image,
    x: (x || 0) - result.strokePadding,
    y: (y || 0) - result.strokePadding,
    width: safeWidth + result.italicPadding + result.strokePadding * 2,
    height: safeHeight + result.descenderPadding + result.strokePadding * 2,
    rotation: transformRotation,
    scaleX: transformScaleX,
    scaleY: transformScaleY,
    offsetX: transformOffsetX,
    offsetY: transformOffsetY,
    skewX: transformSkewX,
    skewY: transformSkewY,
    listening: false,
    perfectDrawEnabled: false,
  })

  targetContainer.add(imageNode)
  return imageNode
}

/**
 * Render basic text without effects using native Konva.Text
 */
function renderBasicText(params: {
  finalText: string
  safeWidth: number
  safeHeight: number
  calculatedFontSize: number
  safeFontFamily: string
  fontStyle?: string
  textColor: string
  effectiveStroke?: string
  effectiveStrokeWidth: number
  letterSpacing?: number
  lineHeight: number
  align?: string
  verticalAlign?: string
  wrap: string
  x?: number
  y?: number
  padding: number
  transformRotation?: number
  transformScaleX?: number
  transformScaleY?: number
  transformOffsetX?: number
  transformOffsetY?: number
  transformSkewX?: number
  transformSkewY?: number
  targetContainer: Konva.Container
}): Konva.Text {
  const {
    finalText,
    safeWidth,
    safeHeight,
    calculatedFontSize,
    safeFontFamily,
    fontStyle,
    textColor,
    effectiveStroke,
    effectiveStrokeWidth,
    letterSpacing,
    lineHeight,
    align,
    verticalAlign,
    wrap,
    x,
    y,
    padding,
    transformRotation,
    transformScaleX,
    transformScaleY,
    transformOffsetX,
    transformOffsetY,
    transformSkewX,
    transformSkewY,
    targetContainer,
  } = params

  const textNode = new Konva.Text({
    x: (x || 0) + padding,
    y: (y || 0) + padding,
    text: finalText,
    width: safeWidth,
    height: safeHeight,
    fontSize: calculatedFontSize,
    fontFamily: safeFontFamily,
    fontStyle,
    fill: textColor,
    stroke: effectiveStroke,
    strokeWidth: effectiveStrokeWidth,
    letterSpacing: letterSpacing ?? 0,
    lineHeight,
    align,
    verticalAlign,
    wrap,
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
