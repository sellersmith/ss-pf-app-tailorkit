/**
 * SVGEnvelopeTextWithEffects - Envelope Distortion Text Rendering
 *
 * Renders text that fills inside a closed shape using envelope distortion.
 * Text lines are scaled horizontally to match the shape's width at each Y level.
 *
 * @module components/canvas/elements/Text
 */

import { memo, useEffect, useMemo, useCallback, useRef, useState } from 'react'
import { Image, Group, Text } from 'react-konva'
import type Konva from 'konva'
import type { GroupConfig } from 'konva/lib/Group'
import type { FontLoader } from 'extensions/tailorkit-src/src/assets/utils/font-loader'
import type { EffectConfig } from '~/modules/TemplateEditor/elements/effects/types'
import type { Paint, StrokeConfig } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { useSVGTextEffects } from './hooks/useSVGTextEffects'
import { getCachePixelRatio } from './utils/effects'
import { createEnvelopeText, type EnvelopeTextOptions } from 'extensions/tailorkit-src/src/shared/libraries/svg'
import { scaleCustomPathToFit } from './utils/scaleCustomPathToFit'

export interface SVGEnvelopeTextWithEffectsProps extends Partial<GroupConfig> {
  // Required props
  width: number
  height: number
  content: string
  fontSize: number
  color: string
  fontLoader: FontLoader
  fillShapePathData: string

  // Metadata for shape scaling
  fillShapeMetadata?: {
    viewBoxWidth: number
    viewBoxHeight: number
  }

  // Fill shape vertical adjustment options
  /**
   * Vertical offset as percentage (-50 to +50)
   * Positive values move text down, negative move text up
   */
  fillShapeVerticalOffset?: number
  /**
   * Vertical scale factor (0.5 to 2.0)
   * Values > 1.0 stretch characters taller, < 1.0 compress them
   */
  fillShapeVerticalScale?: number
  /**
   * Horizontal offset as percentage (-50 to +50)
   * Positive values move text right, negative move text left
   */
  fillShapeHorizontalOffset?: number
  /**
   * Horizontal scale factor (0.5 to 2.0)
   * Values > 1.0 stretch characters wider, < 1.0 compress them
   */
  fillShapeHorizontalScale?: number
  /**
   * Character spacing adjustment (-50 to +50)
   * Negative values bring characters closer together, positive values spread them apart
   */
  fillShapeCharacterSpacing?: number

  // Font styling
  fontFamily?: string
  fontWeight?: string | number
  fontStyle?: string
  fontSrc?: string

  // Layout properties
  letterSpacing?: number
  lineHeight?: number

  // Text stroke (legacy - simple color)
  stroke?: string
  strokeWidth?: number
  // Paint-based stroke (supports solid, image, gradient)
  strokePaint?: Paint
  // Multiple strokes array (TextStudio-style wrapping)
  strokes?: StrokeConfig[]

  // Effects
  effects?: EffectConfig[]

  // Fill opacity (0-1)
  fillOpacity?: number

  // Paint fill (takes precedence over color when provided)
  fill?: Paint

  // Emoji font props
  emojiFontFamily?: string
  emojiFontSrc?: string

  // Legacy props
  pixelRatio?: number
}

function SVGEnvelopeTextWithEffectsComponent(props: SVGEnvelopeTextWithEffectsProps) {
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
    lineHeight,
    stroke,
    strokeWidth,
    strokePaint,
    strokes,
    effects = [],
    fontLoader,
    fontSrc,
    fillShapePathData,
    fillShapeMetadata,
    fillShapeVerticalOffset = 0,
    fillShapeVerticalScale = 1.0,
    fillShapeHorizontalOffset = 0,
    fillShapeHorizontalScale = 1.0,
    fillShapeCharacterSpacing = 0,
    fillOpacity = 1,
    fill,
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
    // Legacy props
    pixelRatio: _pixelRatio,
    ...otherProps
  } = props

  // Render result stored in ref
  const renderResultRef = useRef<{
    image: HTMLImageElement | null
    padding: number
  }>({ image: null, padding: 0 })

  // Ref to Konva.Image node
  const imageRef = useRef<Konva.Image | null>(null)

  // State for first render
  const [, forceUpdate] = useState(false)

  // Use shared hook for font loading and effects
  const { isFontReady, isReady, error, dropShadows, rgbColor, getNextRenderId, fontBase64Css } = useSVGTextEffects({
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

  // Memoize envelope text options
  const envelopeOptions = useMemo<EnvelopeTextOptions>(
    () => ({
      text: content,
      fontSize,
      fontFamily: emojiFontFamily ? `'${fontFamily}', '${emojiFontFamily}'` : fontFamily,
      fontWeight,
      letterSpacing,
      lineHeight: lineHeight || fontSize * 1.2,
      fillColor: rgbColor || color,
      strokeColor: stroke,
      strokeWidth,
      fontBase64Css, // CRITICAL: Embed font for correct rendering when SVG is rasterized
      verticalOffset: fillShapeVerticalOffset,
      verticalScale: fillShapeVerticalScale,
      horizontalOffset: fillShapeHorizontalOffset,
      horizontalScale: fillShapeHorizontalScale,
      characterSpacing: fillShapeCharacterSpacing,
    }),
    [
      content,
      fontSize,
      fontFamily,
      fontWeight,
      letterSpacing,
      lineHeight,
      rgbColor,
      color,
      stroke,
      strokeWidth,
      fontBase64Css,
      fillShapeVerticalOffset,
      fillShapeVerticalScale,
      fillShapeHorizontalOffset,
      fillShapeHorizontalScale,
      fillShapeCharacterSpacing,
      emojiFontFamily,
    ]
  )

  // Scale the fill shape path to fit text layer dimensions
  const scaledFillShapePath = useMemo(() => {
    if (!fillShapePathData) return ''
    return scaleCustomPathToFit(fillShapePathData, width, height, fillShapeMetadata)
  }, [fillShapePathData, width, height, fillShapeMetadata])

  // Use text layer dimensions as viewBox (path is already scaled to fit)
  const viewBoxWidth = width
  const viewBoxHeight = height

  // Render SVG callback
  const renderSVG = useCallback(
    async (renderId: number) => {
      try {
        // Create envelope text
        const result = createEnvelopeText(scaledFillShapePath, envelopeOptions, viewBoxWidth, viewBoxHeight)

        if (!result) {
          return
        }

        // Create image from SVG
        const img = new window.Image()
        const svgBlob = new Blob([result.svg], { type: 'image/svg+xml;charset=utf-8' })
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

        // Always apply the update - latest render will naturally overwrite previous ones
        // (removed render ID check that was causing race condition issues)

        // Calculate padding for effects (drop shadows)
        const padding
          = dropShadows.length > 0
            ? Math.max(...dropShadows.map(s => Math.abs(s.radius) + Math.abs(s.offsetX) + Math.abs(s.offsetY)))
            : 0

        renderResultRef.current = {
          image: img,
          padding,
        }

        if (imageRef.current) {
          imageRef.current.clearCache()
          imageRef.current.image(img)
          imageRef.current.x(-padding)
          imageRef.current.y(-padding)
          imageRef.current.width(width + padding * 2)
          imageRef.current.height(height + padding * 2)
          imageRef.current.cache({ pixelRatio: getCachePixelRatio() })
          imageRef.current.getLayer()?.batchDraw()
        } else {
          forceUpdate(true)
        }
      } catch (err) {
        console.error('Error rendering envelope text:', err)
      }
    },
    [scaledFillShapePath, envelopeOptions, viewBoxWidth, viewBoxHeight, width, height, dropShadows]
  )

  // Render when config changes
  useEffect(() => {
    if (!isReady || !scaledFillShapePath) {
      return
    }

    const currentRenderId = getNextRenderId()
    renderSVG(currentRenderId)
  }, [isReady, getNextRenderId, renderSVG, scaledFillShapePath])

  // Error fallback
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

  // Don't render until font is loaded
  if (!isFontReady) return null
  if (!scaledFillShapePath) return null

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

SVGEnvelopeTextWithEffectsComponent.displayName = 'SVGEnvelopeTextWithEffects'

export const SVGEnvelopeTextWithEffects = memo(SVGEnvelopeTextWithEffectsComponent)
