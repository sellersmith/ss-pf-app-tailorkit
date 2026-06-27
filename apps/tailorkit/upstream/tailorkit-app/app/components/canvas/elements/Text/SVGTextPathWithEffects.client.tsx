/**
 * SVGTextPathWithEffects - Native SVG Filter-Based TextPath Effects
 *
 * Renders text along a path with advanced effects using native SVG filters.
 * SVG is rendered to an image and displayed as Konva.Image for canvas integration.
 *
 * Benefits:
 * - Native SVG filters work in Safari (unlike ctx.filter)
 * - No pixel manipulation artifacts
 * - GPU-accelerated filter rendering
 *
 * @module components/canvas/elements/Text
 */

import { memo, useEffect, useMemo, useCallback, useRef, useState } from 'react'
import { Image, Group, Text } from 'react-konva'
import type Konva from 'konva'
import type { GroupConfig } from 'konva/lib/Group'
import type { FontLoader } from 'extensions/tailorkit-src/src/assets/utils/font-loader'
import type { EffectConfig } from '~/modules/TemplateEditor/elements/effects/types'
import { renderSVGTextPathWithEffects } from 'extensions/tailorkit-src/src/shared/libraries/svg/svg-render-orchestrator'
import type { SVGTextPathConfig } from 'extensions/tailorkit-src/src/shared/libraries/svg/svg-text-path-creator'
import type { EffectsFilterConfig } from 'extensions/tailorkit-src/src/shared/libraries/svg/svg-filter-builder'
import type { Paint, StrokeConfig } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { strokePercentToPixels } from '~/modules/TemplateEditor/elements/effects/relative-shadow-utils'
import { useSVGTextEffects } from './hooks/useSVGTextEffects'
import { getCachePixelRatio } from './utils/effects'

export interface SVGTextPathWithEffectsProps extends Partial<GroupConfig> {
  // Required props
  width: number
  height: number
  content: string
  fontSize: number
  color: string
  fontLoader: FontLoader
  pathData: string

  // Font styling
  fontFamily?: string
  fontWeight?: string | number
  fontStyle?: string
  fontSrc?: string

  // Layout properties
  align?: 'left' | 'center' | 'right' | 'justify'
  letterSpacing?: number
  textBaseline?: CanvasTextBaseline

  // Text decoration
  textDecoration?: string

  // Text stroke (legacy - simple color)
  stroke?: string
  strokeWidth?: number
  // Paint-based stroke (supports solid, image, gradient)
  strokePaint?: Paint
  // Multiple strokes array (TextStudio-style wrapping)
  strokes?: StrokeConfig[]

  // Effects
  effects?: EffectConfig[]

  // Fill opacity (0-1) - for semi-transparent text with opaque shadows
  fillOpacity?: number

  // Paint fill (takes precedence over color when provided)
  fill?: Paint

  // Curve bend percentage for pattern bounds calculation (-100 to 100)
  curveBend?: number

  // Emoji font props
  emojiFontFamily?: string
  emojiFontSrc?: string

  // Legacy props (kept for compatibility)
  pixelRatio?: number
  /** @deprecated Legacy prop - no longer used */
  spriteRef?: never
}

/**
 * Map canvas textBaseline to SVG dominant-baseline
 */
function mapTextBaselineToSVG(textBaseline: CanvasTextBaseline): SVGTextPathConfig['textBaseline'] {
  switch (textBaseline) {
    case 'top':
      return 'hanging'
    case 'middle':
      return 'middle'
    case 'alphabetic':
    case 'bottom':
    default:
      return 'alphabetic'
  }
}

function SVGTextPathWithEffectsComponent(props: SVGTextPathWithEffectsProps) {
  const {
    width,
    height,
    content = '',
    fontSize,
    fontFamily = 'Arial',
    fontWeight,
    fontStyle,
    color,
    letterSpacing = 0,
    textBaseline = 'bottom',
    textDecoration,
    stroke,
    strokeWidth,
    strokePaint,
    strokes,
    effects = [],
    fontLoader,
    fontSrc,
    pathData,
    fillOpacity = 1,
    fill,
    curveBend,
    emojiFontFamily,
    emojiFontSrc,
    // Transform props
    x = 0,
    y = 0,
    rotation = 0,
    scaleX = 1,
    scaleY = 1,
    offsetX,
    offsetY,
    skewX,
    skewY,
    // Layout props
    align,
    // Legacy props (extracted to keep otherProps clean)
    pixelRatio: _pixelRatio,
    spriteRef: _spriteRef,
    ...otherProps
  } = props

  // Render result stored in ref to avoid setState during rapid updates
  const renderResultRef = useRef<{
    image: HTMLImageElement | null
    padding: number
  }>({ image: null, padding: 0 })

  // Ref to Konva.Image node for direct updates (bypasses React render cycle)
  const imageRef = useRef<Konva.Image | null>(null)

  // State only for first render - triggers initial mount with image
  const [, forceUpdate] = useState(false)

  // Use shared hook for font loading, effects separation, color extraction, and paint loading
  const {
    isFontReady,
    isReady,
    error,
    fontBase64Css,
    dropShadows,
    innerShadows,
    rgbColor,
    combinedFillOpacity,
    hasEffects,
    renderIdRef,
    getNextRenderId,
    loadedImages,
  } = useSVGTextEffects({
    fontFamily,
    fontSrc,
    fontWeight,
    fontLoader,
    effects,
    color,
    fillOpacity,
    fontSize,
    fill,
    strokePaint,
    strokes,
    emojiFontFamily,
    emojiFontSrc,
  })

  // Map canvas textBaseline to SVG dominant-baseline
  const svgTextBaseline = useMemo(() => mapTextBaselineToSVG(textBaseline), [textBaseline])

  // Memoize SVG text path config
  const svgTextPathConfig = useMemo<SVGTextPathConfig>(
    () => ({
      content,
      width,
      height,
      fontSize,
      fontFamily: emojiFontFamily ? `'${fontFamily}', '${emojiFontFamily}'` : fontFamily,
      fontWeight,
      fontStyle,
      fontBase64Css,
      // CRITICAL: Use solid RGB color (no alpha) when filter is active
      // The filter's feComponentTransfer handles opacity independently from shadows
      color: hasEffects ? rgbColor : color,
      // Pass fill and loadedImages for Paint-based fills
      fill,
      loadedImages,
      letterSpacing,
      textDecoration,
      // When filter is active, don't set fillOpacity on text - filter handles it
      // When no filter, use the combined opacity (fillOpacity * colorAlpha)
      fillOpacity: hasEffects ? 1 : combinedFillOpacity,
      pathData,
      textBaseline: svgTextBaseline,
      align: align === 'justify' ? 'center' : align,
      // Pass effects for dynamic padding calculation (drop shadows extend bounds)
      effects: dropShadows,
      stroke,
      strokeWidth,
      // Pass shadow arrays for filter rendering
      dropShadows,
      innerShadows,
      // Curve bend for pattern bounds calculation
      curveBend,
    }),
    [
      content,
      width,
      height,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      fontBase64Css,
      hasEffects,
      rgbColor,
      color,
      fill,
      loadedImages,
      letterSpacing,
      textDecoration,
      combinedFillOpacity,
      pathData,
      svgTextBaseline,
      align,
      dropShadows,
      innerShadows,
      stroke,
      strokeWidth,
      curveBend,
      emojiFontFamily,
    ]
  )

  // Convert strokeWidth from percentage to pixels
  // strokeWidth is stored as 0-100 (percentage of fontSize)
  const resolvedStrokeWidth = useMemo(
    () => (strokeWidth ? strokePercentToPixels(strokeWidth, fontSize) : 0),
    [strokeWidth, fontSize]
  )

  // Memoize effects filter config
  const effectsConfig = useMemo<EffectsFilterConfig>(
    () => ({
      dropShadows,
      innerShadows,
      // Use combined opacity (fillOpacity * colorAlpha) for the filter
      fillOpacity: combinedFillOpacity,
      textColor: color,
      // Multiple strokes array (TextStudio-style wrapping) - takes precedence
      strokes: strokes && strokes.length > 0 ? strokes : undefined,
      // Paint-based stroke (if provided) - use resolved pixel width (legacy fallback)
      strokePaint:
        !strokes?.length && strokePaint && resolvedStrokeWidth
          ? { paint: strokePaint, width: resolvedStrokeWidth }
          : undefined,
      // Legacy stroke fallback (if no strokePaint) - use resolved pixel width
      stroke:
        !strokes?.length && !strokePaint && stroke && resolvedStrokeWidth
          ? { color: stroke, width: resolvedStrokeWidth }
          : undefined,
    }),
    [dropShadows, innerShadows, combinedFillOpacity, color, strokes, strokePaint, stroke, resolvedStrokeWidth]
  )

  // Render SVG callback
  const renderSVG = useCallback(
    async (renderId: number) => {
      try {
        const result = await renderSVGTextPathWithEffects({
          config: svgTextPathConfig,
          effectsConfig,
          filterId: `textpath-effects-${renderId}`,
          loadedImages,
        })

        // Only update if this is still the latest render
        if (renderId === renderIdRef.current) {
          renderResultRef.current = {
            image: result.image,
            padding: result.padding,
          }

          // Hybrid approach: state for first render, Konva native for updates
          if (imageRef.current) {
            // Subsequent renders: update Konva.Image directly (bypasses React)
            imageRef.current.clearCache()
            imageRef.current.image(result.image)
            imageRef.current.x(-result.padding)
            imageRef.current.y(-result.padding)
            imageRef.current.width(width + result.padding * 2)
            imageRef.current.height(height + result.padding * 2)
            imageRef.current.cache({ pixelRatio: getCachePixelRatio() })
            imageRef.current.getLayer()?.batchDraw()
          } else {
            // First render: trigger React re-render to mount the Image component
            forceUpdate(true)
          }
        }
      } catch (err) {
        console.error('Error rendering SVG text path:', err)
      }
    },
    [svgTextPathConfig, effectsConfig, renderIdRef, width, height, loadedImages]
  )

  // Render SVG to image when config changes
  useEffect(() => {
    if (!isReady || !pathData) return

    const currentRenderId = getNextRenderId()
    // Render immediately - SVG rendering is fast (~0-1ms)
    renderSVG(currentRenderId)
  }, [isReady, getNextRenderId, renderSVG, pathData])

  // Error fallback - show basic text when font loading fails
  if (error) {
    return (
      <Group
        x={x}
        y={y}
        rotation={rotation}
        scaleX={scaleX}
        scaleY={scaleY}
        offsetX={offsetX}
        offsetY={offsetY}
        skewX={skewX}
        skewY={skewY}
        {...otherProps}
      >
        <Text
          text={content}
          width={width}
          height={height}
          fontSize={fontSize}
          fontFamily="Arial"
          fill={color}
          listening={otherProps.listening ?? false}
        />
      </Group>
    )
  }

  // Don't render until font is loaded and pathData is available
  // Note: We intentionally DON'T block on isPaintLoading here.
  // This allows showing the previous rendered image while loading a new paint image,
  // preventing grey fallback flashes when replacing image fills.
  if (!isFontReady) return null
  if (!pathData) return null

  // Read directly from ref - image and padding always stay in sync
  const { image: displayImage, padding } = renderResultRef.current
  if (!displayImage) return null

  return (
    <Group
      x={x}
      y={y}
      rotation={rotation}
      scaleX={scaleX}
      scaleY={scaleY}
      offsetX={offsetX}
      offsetY={offsetY}
      skewX={skewX}
      skewY={skewY}
      {...otherProps}
    >
      <Image
        ref={node => {
          imageRef.current = node
          // Cache on first mount for improved transform performance
          if (node && !node.isCached()) {
            node.cache({ pixelRatio: getCachePixelRatio() })
          }
        }}
        image={displayImage}
        x={-padding}
        y={-padding}
        width={width + padding * 2}
        height={height + padding * 2}
        listening={otherProps.listening ?? false}
        perfectDrawEnabled={false}
      />
    </Group>
  )
}

SVGTextPathWithEffectsComponent.displayName = 'SVGTextPathWithEffects'

export const SVGTextPathWithEffects = memo(SVGTextPathWithEffectsComponent)
