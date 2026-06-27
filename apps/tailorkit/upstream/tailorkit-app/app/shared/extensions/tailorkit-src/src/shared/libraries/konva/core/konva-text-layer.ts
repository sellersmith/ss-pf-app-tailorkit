import Konva from 'konva'
import { fontStorefrontLoader } from '../../../components'
import {
  calculateCurveEquivalentRadius,
  calculateOptimalTextSize,
  calculateSafeRadius,
  generateTextPath,
  validateGeometryParams,
  type CircularTextOptions,
  type TextScalingOptions,
} from '../text'
import type { EffectConfig } from '../effects/types'
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

export type TextLayerProps = Konva.TextConfig & {
  autoFitToContainer?: boolean
  textShape?: 'none' | 'circle' | 'curve'
  circleStartAngle?: number
  circleEndAngle?: number
  curvePeaks?: number
  curveBend?: number
  effects?: EffectConfig[]
}

export async function addTextLayer(
  targetContainer: Konva.Group | Konva.Layer,
  props: TextLayerProps
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
    } = props

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

    const safeFontFamily = fontFamily || 'Arial'
    const safeWidth = width || 0
    const safeHeight = height || 0
    const textColor = (fill as string) || '#000000'

    // Load custom font if fontSrc is provided
    try {
      await fontStorefrontLoader.loadFont(safeFontFamily, fontSrc)
    } catch (error) {
      console.error(`Failed to load font ${safeFontFamily}, falling back to system font:`, error)
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

    // Check if we have any effects that require SVG rendering (shadows or stroke)
    const hasEffects = hasEffectsFromShadows || !!(stroke && strokeWidth && strokeWidth > 0)

    // Prepare color for SVG (solid RGB when effects exist, filter handles opacity)
    const svgColor = prepareTextColor(textColor, hasEffects)

    // Get font base64 CSS for SVG embedding
    let fontBase64Css: string | null = null
    if (hasEffects || textShape !== 'none') {
      try {
        if (fontSrc) {
          fontBase64Css = await fetchCustomFontAsBase64(fontSrc, safeFontFamily)
        } else if (safeFontFamily !== 'Arial') {
          fontBase64Css = await fetchGoogleFontCss(safeFontFamily, String(fontWeight || 400))
        }
      } catch (error) {
        console.warn('Failed to fetch font for SVG embedding:', error)
      }
    }

    // Effective stroke values (neon inverse mode swaps fill to stroke)
    // SVG filters only support string stroke colors, not CanvasGradient
    const effectiveStroke = neonMode === 'inverse' ? (fill as string) : typeof stroke === 'string' ? stroke : undefined
    const effectiveStrokeWidth = strokeWidth || 0

    // Handle text shapes (circle, curve)
    if (textShape !== 'none') {
      const { textPath: pathData } = generateTextPath({
        width: safeWidth,
        height: safeHeight,
        fontSize: calculatedFontSize,
        textShape,
        circleStartAngle,
        circleEndAngle,
        curvePeaks,
        curveBend,
        fontFamily: safeFontFamily,
        color: textColor,
        align: 'center',
        verticalAlign: 'middle',
      })

      if (pathData) {
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
        }

        // Use shared utility for proper fill opacity handling
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
    }

    // Regular text rendering
    if (hasEffects) {
      // Use SVG-based rendering for text with effects
      const svgTextConfig: SVGTextConfig = {
        content: finalText,
        width: safeWidth,
        height: safeHeight,
        fontSize: calculatedFontSize,
        fontFamily: safeFontFamily,
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
      }

      // Use shared utility for proper fill opacity handling
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

    // Fast path: Basic text without effects - use native Konva.Text
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
