/**
 * FilteredText Component
 *
 * Konva.Shape component that renders text with SVG filter support.
 * Uses a helper Konva.Text node for text measurement and rendering,
 * while applying SVG filters via canvas ctx.filter property.
 *
 * Benefits:
 * - All Konva.TextConfig props work automatically
 * - SVG filters are GPU-accelerated
 * - No rasterization/caching needed
 * - Vector-quality output like Figma
 *
 * @module components/canvas/elements/Text/effects
 */

import { memo, useMemo, useRef, useEffect, useCallback } from 'react'
import { Shape } from 'react-konva'
import Konva from 'konva'
import type { TextConfig } from 'konva/lib/shapes/Text'
import type { Context } from 'konva/lib/Context'

export interface FilteredTextProps extends Omit<TextConfig, 'text'> {
  /** Text content to render */
  text: string
  /** SVG filter ID to apply (from SVGFilterManager) */
  filterId?: string | null
  /** Fill color for the text */
  fill?: string
}

/**
 * FilteredText - Renders text with SVG filter effects
 *
 * Uses Konva.Shape with custom sceneFunc to:
 * 1. Apply SVG filter via ctx.filter = 'url(#filterId)'
 * 2. Render text using helper Konva.Text's internal rendering
 * 3. Reset filter after rendering
 *
 * The helper Konva.Text is not added to the layer - it's only used
 * for leveraging Konva's text measurement and rendering capabilities.
 */
function FilteredTextComponent(props: FilteredTextProps) {
  const {
    text,
    filterId,
    fill = '#000000',
    fontSize = 16,
    fontFamily = 'Arial',
    fontWeight,
    fontStyle,
    width,
    height,
    align,
    verticalAlign,
    lineHeight,
    letterSpacing,
    padding,
    wrap,
    ellipsis,
    stroke,
    strokeWidth,
    textDecoration,
    ...shapeProps
  } = props

  // Ref for the helper Konva.Text (not added to layer)
  const helperTextRef = useRef<Konva.Text | null>(null)

  // Create helper text once on mount - properties are updated via separate useEffect
  useEffect(() => {
    helperTextRef.current = new Konva.Text({
      text,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      fill,
      width,
      height,
      align,
      verticalAlign,
      lineHeight,
      letterSpacing,
      padding,
      wrap,
      ellipsis,
      stroke,
      strokeWidth,
      textDecoration,
    })

    return () => {
      if (helperTextRef.current) {
        helperTextRef.current.destroy()
        helperTextRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update helper text properties when props change
  useEffect(() => {
    const helperText = helperTextRef.current
    if (!helperText) return

    helperText.text(text)
    helperText.fontSize(fontSize)
    helperText.fontFamily(fontFamily)
    if (fontWeight !== undefined) helperText.fontVariant(String(fontWeight))
    if (fontStyle !== undefined) helperText.fontStyle(fontStyle)
    helperText.fill(fill)
    if (width !== undefined) helperText.width(width)
    if (height !== undefined) helperText.height(height)
    if (align !== undefined) helperText.align(align)
    if (verticalAlign !== undefined) helperText.verticalAlign(verticalAlign)
    if (lineHeight !== undefined) helperText.lineHeight(lineHeight)
    if (letterSpacing !== undefined) helperText.letterSpacing(letterSpacing)
    if (padding !== undefined) helperText.padding(padding)
    if (wrap !== undefined) helperText.wrap(wrap)
    if (ellipsis !== undefined) helperText.ellipsis(ellipsis)
    if (stroke !== undefined) helperText.stroke(stroke)
    if (strokeWidth !== undefined) helperText.strokeWidth(strokeWidth)
    if (textDecoration !== undefined) helperText.textDecoration(textDecoration)
  }, [
    text,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    fill,
    width,
    height,
    align,
    verticalAlign,
    lineHeight,
    letterSpacing,
    padding,
    wrap,
    ellipsis,
    stroke,
    strokeWidth,
    textDecoration,
  ])

  // Memoize sceneFunc to prevent unnecessary recreations
  const sceneFunc = useCallback(
    (context: Context) => {
      const helperText = helperTextRef.current
      if (!helperText) return

      const ctx = context._context as CanvasRenderingContext2D

      // Apply SVG filter if set
      if (filterId) {
        ctx.filter = `url(#${filterId})`
      }

      // Render text using Konva.Text's internal scene function
      // This leverages all of Konva's text layout, wrapping, and rendering
      helperText._sceneFunc(context)

      // Reset filter
      if (filterId) {
        ctx.filter = 'none'
      }
    },
    [filterId]
  )

  // Memoize hitFunc for consistent hit detection
  const hitFunc = useCallback((context: Context) => {
    const helperText = helperTextRef.current
    if (!helperText) return

    // Use Konva.Text's internal hit function for accurate hit detection
    helperText._hitFunc(context)
  }, [])

  // Calculate dimensions for the shape
  const dimensions = useMemo(() => {
    if (helperTextRef.current) {
      return {
        width: helperTextRef.current.width(),
        height: helperTextRef.current.height(),
      }
    }
    // Fallback estimation
    return {
      width: width || text.length * fontSize * 0.6,
      height: height || fontSize * 1.2,
    }
  }, [text, fontSize, width, height])

  return (
    <Shape
      {...shapeProps}
      width={dimensions.width}
      height={dimensions.height}
      sceneFunc={sceneFunc}
      hitFunc={hitFunc}
      listening={shapeProps.listening ?? true}
      perfectDrawEnabled={false}
    />
  )
}

export const FilteredText = memo(FilteredTextComponent)
