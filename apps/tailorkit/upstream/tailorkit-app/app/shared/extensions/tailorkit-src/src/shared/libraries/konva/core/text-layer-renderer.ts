/**
 * Text Layer Renderer
 *
 * Handles text layer rendering for Konva canvas with support for:
 * - Basic text (native Konva.Text - fast path)
 * - Text with effects (SVG-based - rendered as Konva.Image)
 * - Text shapes (circle, curve - SVG path-based)
 *
 * Follows SOLID principles:
 * - SRP: Single responsibility for text rendering
 * - OCP: Can be extended for new text shapes without modification
 * - DIP: Depends on abstractions (IFontLoader, container function)
 *
 * @module shared/libraries/konva/core
 */

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
import type { TextLayerProps, TextLayerResult, TextLayerRendererDeps, IFontLoader } from './types'

/**
 * Prepared props after extracting and normalizing all values
 */
interface PreparedTextProps {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontSrc?: string
  padding: number
  lineHeight: number
  fontStyle?: string
  letterSpacing?: number
  autoFitToContainer: boolean
  textShape: 'none' | 'circle' | 'curve'
  circleStartAngle: number
  circleEndAngle: number
  curvePeaks?: number
  curveBend: number
  neonMode?: 'none' | 'glow' | 'inverse'
  neonIntensity?: number
  neonOffsetX?: number
  neonOffsetY?: number
  fill: string
  stroke?: string
  strokeWidth: number
  wrap: string
  effects?: EffectConfig[]
  align?: string
  verticalAlign?: string
  fontWeight?: string | number
  // Transform props
  rotation?: number
  scaleX?: number
  scaleY?: number
  offsetX?: number
  offsetY?: number
  skewX?: number
  skewY?: number
}

/**
 * Result of text size calculation
 */
interface TextSizeResult {
  fontSize: number
  text: string
}

/**
 * Result of effects resolution
 */
interface ResolvedEffects {
  derivedEffects: EffectConfig[]
  hasEffects: boolean
}

export class TextLayerRenderer {
  private fontLoader: IFontLoader
  private getTargetContainer: () => Konva.Container

  constructor(deps: TextLayerRendererDeps) {
    this.fontLoader = deps.fontLoader ?? fontStorefrontLoader
    this.getTargetContainer = deps.getTargetContainer
  }

  /**
   * Render a text layer to the canvas
   *
   * Three rendering paths based on configuration:
   * 1. Text shapes (circle/curve) -> SVG path-based -> Konva.Image
   * 2. Text with effects -> SVG filtered -> Konva.Image
   * 3. Basic text -> native Konva.Text (fast path)
   */
  public async render(props: TextLayerProps): Promise<TextLayerResult> {
    // 1. Extract and prepare props
    const preparedProps = this.prepareProps(props)

    // 2. Load custom font if needed
    await this.loadFont(preparedProps.fontFamily, preparedProps.fontSrc)

    // 3. Calculate font size (auto-fit or explicit)
    const { fontSize, text } = this.calculateTextSize(preparedProps)

    // 4. Resolve effects
    const { derivedEffects, hasEffects } = this.resolveEffects(preparedProps, fontSize)

    // 5. Get font CSS for SVG embedding if needed
    const fontBase64Css = await this.getFontCss(preparedProps, hasEffects)

    // 6. Choose rendering path
    if (preparedProps.textShape !== 'none') {
      return this.renderTextPath(preparedProps, fontSize, text, derivedEffects, fontBase64Css)
    }

    if (hasEffects) {
      return this.renderTextWithEffects(preparedProps, fontSize, text, derivedEffects, fontBase64Css)
    }

    return this.renderBasicText(preparedProps, fontSize, text)
  }

  /**
   * Extract and normalize all props with safe defaults
   */
  private prepareProps(props: TextLayerProps): PreparedTextProps {
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
      rotation,
      scaleX,
      scaleY,
      offsetX,
      offsetY,
      skewX,
      skewY,
    } = props

    return {
      text: text || '',
      x: x || 0,
      y: y || 0,
      width: width || 0,
      height: height || 0,
      fontSize: fontSize || 16,
      fontFamily: fontFamily || 'Arial',
      fontSrc,
      padding,
      lineHeight,
      fontStyle,
      letterSpacing,
      autoFitToContainer,
      textShape,
      circleStartAngle,
      circleEndAngle,
      curvePeaks,
      curveBend,
      neonMode,
      neonIntensity,
      neonOffsetX,
      neonOffsetY,
      fill: (fill as string) || '#000000',
      stroke: typeof stroke === 'string' ? stroke : undefined,
      strokeWidth: strokeWidth || 0,
      wrap,
      effects,
      align,
      verticalAlign,
      fontWeight,
      rotation,
      scaleX,
      scaleY,
      offsetX,
      offsetY,
      skewX,
      skewY,
    }
  }

  /**
   * Load custom font if fontSrc is provided
   */
  private async loadFont(fontFamily: string, fontSrc?: string): Promise<void> {
    try {
      await this.fontLoader.loadFont(fontFamily, fontSrc)
    } catch (error) {
      console.error(`Failed to load font ${fontFamily}, falling back to system font:`, error)
    }
  }

  /**
   * Calculate font size with optional auto-fit to container
   */
  private calculateTextSize(props: PreparedTextProps): TextSizeResult {
    if (!props.autoFitToContainer) {
      return { fontSize: props.fontSize, text: props.text }
    }

    let circularPathInfo: CircularTextOptions | undefined

    if (props.textShape === 'circle') {
      const { width: safeW, height: safeH } = validateGeometryParams({
        width: props.width,
        height: props.height,
      })
      const radius = calculateSafeRadius(safeW, safeH)
      circularPathInfo = {
        radius,
        startAngle: props.circleStartAngle,
        endAngle: props.circleEndAngle,
      }
    }

    if (props.textShape === 'curve') {
      const equivalentRadius = calculateCurveEquivalentRadius(
        props.width,
        props.height,
        props.curvePeaks || 1,
        props.curveBend
      )
      circularPathInfo = { radius: equivalentRadius, startAngle: 0, endAngle: 2 * Math.PI }
    }

    const result = calculateOptimalTextSize({
      text: props.text,
      width: props.width,
      height: props.height,
      padding: props.padding,
      maxFontSize: props.fontSize || 200,
      minFontSize: 1,
      fontFamily: props.fontFamily,
      lineHeight: props.lineHeight,
      precision: 0.1,
      fontStyle: props.fontStyle,
      wrap: (props.wrap as TextScalingOptions['wrap']) || 'word',
      circularPath: circularPathInfo,
      letterSpacing: props.letterSpacing,
    })

    return {
      fontSize: result.fontSize,
      text: result.textProps.text,
    }
  }

  /**
   * Resolve effects from props (handle legacy neon mode)
   */
  private resolveEffects(props: PreparedTextProps, fontSize: number): ResolvedEffects {
    let derivedEffects: EffectConfig[] = []

    if (Array.isArray(props.effects) && props.effects.length > 0) {
      derivedEffects = props.effects
    } else if (props.neonMode && props.neonMode !== 'none') {
      // Convert legacy neon mode to effects
      const near = Math.max(2, Math.round((props.neonIntensity || 12) * 0.6))
      const far = Math.max(6, Math.round((props.neonIntensity || 12) * 1.6))
      derivedEffects = [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: 'currentColor',
          offsetX: props.neonOffsetX || 0,
          offsetY: props.neonOffsetY || 0,
          radius: near,
        },
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: 'currentColor',
          offsetX: props.neonOffsetX || 0,
          offsetY: props.neonOffsetY || 0,
          radius: far,
        },
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: 'rgb(255, 255, 255)',
          offsetX: props.neonOffsetX || 0,
          offsetY: props.neonOffsetY || 0,
          radius: 100,
        },
      ]
    }

    // Resolve relative effects to absolute values based on font size
    const resolvedEffects = resolveEffectsToAbsolute(derivedEffects, fontSize)
    const { hasEffects: hasEffectsFromShadows } = separateEffects(resolvedEffects)

    // Check if we have any effects that require SVG rendering (shadows or stroke)
    const hasEffects = hasEffectsFromShadows || !!(props.stroke && props.strokeWidth && props.strokeWidth > 0)

    return { derivedEffects: resolvedEffects, hasEffects }
  }

  /**
   * Get font CSS for SVG embedding
   */
  private async getFontCss(props: PreparedTextProps, hasEffects: boolean): Promise<string | null> {
    if (!hasEffects && props.textShape === 'none') {
      return null
    }

    try {
      if (props.fontSrc) {
        return await fetchCustomFontAsBase64(props.fontSrc, props.fontFamily)
      }
      if (props.fontFamily !== 'Arial') {
        return await fetchGoogleFontCss(props.fontFamily, String(props.fontWeight || 400))
      }
    } catch (error) {
      console.warn('Failed to fetch font for SVG embedding:', error)
    }

    return null
  }

  /**
   * Render text on a path (circle or curve)
   */
  private async renderTextPath(
    props: PreparedTextProps,
    fontSize: number,
    text: string,
    effects: EffectConfig[],
    fontBase64Css: string | null
  ): Promise<Konva.Image> {
    const { textPath: pathData } = generateTextPath({
      width: props.width,
      height: props.height,
      fontSize,
      textShape: props.textShape,
      circleStartAngle: props.circleStartAngle,
      circleEndAngle: props.circleEndAngle,
      curvePeaks: props.curvePeaks,
      curveBend: props.curveBend,
      fontFamily: props.fontFamily,
      color: props.fill,
      align: 'center',
      verticalAlign: 'middle',
    })

    const { dropShadows, innerShadows } = separateEffects(effects)
    const svgColor = prepareTextColor(props.fill, dropShadows.length > 0 || innerShadows.length > 0)

    // Effective stroke values (neon inverse mode swaps fill to stroke)
    const effectiveStroke = props.neonMode === 'inverse' ? props.fill : props.stroke
    const effectiveStrokeWidth = props.strokeWidth || 0

    const svgTextPathConfig: SVGTextPathConfig = {
      content: text,
      width: props.width,
      height: props.height,
      fontSize,
      fontFamily: props.fontFamily,
      fontWeight: props.fontWeight,
      fontStyle: props.fontStyle,
      fontBase64Css,
      color: svgColor,
      letterSpacing: props.letterSpacing || 0,
      pathData: pathData || '',
      textBaseline: 'alphabetic',
      align: 'center',
      dropShadows,
      innerShadows,
      stroke: effectiveStroke,
      strokeWidth: effectiveStrokeWidth,
    }

    const effectsConfig = prepareEffectsConfig(dropShadows, innerShadows, props.fill)
    const filterId = `text-path-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const result = await renderSVGTextPathWithEffects({ config: svgTextPathConfig, effectsConfig, filterId })

    const imageNode = new Konva.Image({
      image: result.image,
      x: props.x + props.padding - result.pathPadding,
      y: props.y + props.padding - result.pathPadding,
      width: props.width + result.pathPadding * 2,
      height: props.height + result.pathPadding * 2,
      rotation: props.rotation,
      scaleX: props.scaleX,
      scaleY: props.scaleY,
      offsetX: props.offsetX,
      offsetY: props.offsetY,
      skewX: props.skewX,
      skewY: props.skewY,
      listening: false,
      perfectDrawEnabled: false,
    })

    this.getTargetContainer().add(imageNode)
    return imageNode
  }

  /**
   * Render text with effects using SVG filters
   */
  private async renderTextWithEffects(
    props: PreparedTextProps,
    fontSize: number,
    text: string,
    effects: EffectConfig[],
    fontBase64Css: string | null
  ): Promise<Konva.Image> {
    const { dropShadows, innerShadows } = separateEffects(effects)
    const svgColor = prepareTextColor(props.fill, true)

    // Effective stroke values (neon inverse mode swaps fill to stroke)
    const effectiveStroke = props.neonMode === 'inverse' ? props.fill : props.stroke
    const effectiveStrokeWidth = props.strokeWidth || 0

    const svgTextConfig: SVGTextConfig = {
      content: text,
      width: props.width,
      height: props.height,
      fontSize,
      fontFamily: props.fontFamily,
      fontWeight: props.fontWeight,
      fontStyle: props.fontStyle,
      fontBase64Css,
      color: svgColor,
      letterSpacing: props.letterSpacing || 0,
      lineHeight: props.lineHeight,
      align: (props.align as 'left' | 'center' | 'right') || 'left',
      verticalAlign: (props.verticalAlign as 'top' | 'middle' | 'bottom') || 'top',
      wrap: props.wrap === 'none' ? 'none' : props.wrap === 'char' ? 'char' : 'word',
      padding: props.padding,
      dropShadows,
      innerShadows,
      stroke: effectiveStroke,
      strokeWidth: effectiveStrokeWidth,
    }

    const effectsConfig = prepareEffectsConfig(dropShadows, innerShadows, props.fill)
    const filterId = `text-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const result = await renderSVGTextWithEffects({ config: svgTextConfig, effectsConfig, filterId })

    const imageNode = new Konva.Image({
      image: result.image,
      x: props.x - result.strokePadding,
      y: props.y - result.strokePadding,
      width: props.width + result.italicPadding + result.strokePadding * 2,
      height: props.height + result.descenderPadding + result.strokePadding * 2,
      rotation: props.rotation,
      scaleX: props.scaleX,
      scaleY: props.scaleY,
      offsetX: props.offsetX,
      offsetY: props.offsetY,
      skewX: props.skewX,
      skewY: props.skewY,
      listening: false,
      perfectDrawEnabled: false,
    })

    this.getTargetContainer().add(imageNode)
    return imageNode
  }

  /**
   * Render basic text without effects (fast path)
   */
  private renderBasicText(props: PreparedTextProps, fontSize: number, text: string): Konva.Text {
    // Effective stroke values (neon inverse mode swaps fill to stroke)
    const effectiveStroke = props.neonMode === 'inverse' ? props.fill : props.stroke

    const textNode = new Konva.Text({
      x: props.x + props.padding,
      y: props.y + props.padding,
      text,
      width: props.width,
      height: props.height,
      fontSize,
      fontFamily: props.fontFamily,
      fontStyle: props.fontStyle,
      fill: props.fill,
      stroke: effectiveStroke,
      strokeWidth: props.strokeWidth,
      letterSpacing: props.letterSpacing ?? 0,
      lineHeight: props.lineHeight,
      align: props.align,
      verticalAlign: props.verticalAlign,
      wrap: props.wrap,
      rotation: props.rotation,
      scaleX: props.scaleX,
      scaleY: props.scaleY,
      offsetX: props.offsetX,
      offsetY: props.offsetY,
      skewX: props.skewX,
      skewY: props.skewY,
      fillAfterStrokeEnabled: true,
      listening: false,
      ellipsis: false,
    })

    this.getTargetContainer().add(textNode)
    return textNode
  }
}
