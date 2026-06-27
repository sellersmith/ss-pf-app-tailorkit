// Konva used via text-fit-engine
import { getTextMeasurer } from './text-fit-engine'
/**
 * Shared text scaling utility for optimal font size calculation
 * Used by both admin app and extensions
 */

/**
 * Interface for circular text path options
 */
export interface CircularTextOptions {
  /** Radius of the circle */
  radius: number
  /** Start angle in radians */
  startAngle: number
  /** End angle in radians */
  endAngle: number
}

/**
 * Interface for text scaling options
 */
export interface TextScalingOptions {
  /** Text content (string or array of lines) */
  text: string | string[]
  /** Container width */
  width: number
  /** Container height */
  height: number
  /** Padding around text (default: 0) */
  padding?: number
  /** Minimum font size (default: 1) */
  minFontSize?: number
  /** Maximum font size (default: 200) */
  maxFontSize?: number
  /** Preferred name for spacing between lines (default: 1.2). */
  lineHeight?: number
  /** Precision for font size calculation (default: 0.1) */
  precision?: number
  /** Font family (default: 'Arial') */
  fontFamily?: string
  /** Font style (default: '') */
  fontStyle?: string
  /** Text wrap mode. When 'word' or 'char', width constraint is handled via soft wrapping; scaling only ensures height fits. */
  wrap?: 'none' | 'word' | 'char'
  /** Circular text path options - when provided, calculates based on arc length instead of rectangular bounds */
  circularPath?: CircularTextOptions
  /** Enable verbose debug logs for scaling calculation */
  debug?: boolean
  /** Horizontal alignment for text (affects measurement minimally) */
  align?: 'left' | 'center' | 'right'
  /** Letter spacing used by Konva during wrapping */
  letterSpacing?: number
}

/**
 * Result of text scaling calculation
 */
export interface TextScalingResult {
  /** Calculated optimal font size */
  fontSize: number
  /** Text split into lines */
  textLines: string[]
  /** Additional text properties */
  textProps: {
    fontSize: number
    fontFamily: string
    text: string
    lineHeight: number
    fontStyle?: string
  }
}

/**
 * Process text into lines (handles both string and array input)
 */
export function processTextToLines(inputText: string | string[]): string[] {
  if (Array.isArray(inputText)) {
    return inputText
  }

  // Handle string with line breaks
  return inputText.split(/\r?\n/)
}

/**
 * Calculate the optimal font size that fits the text in the given dimensions
 */
export function calculateOptimalTextSize(options: TextScalingOptions): TextScalingResult {
  const {
    text,
    width,
    height,
    padding = 0,
    minFontSize = 1,
    maxFontSize = 200,
    lineHeight = 1.2,
    precision = 0.1,
    fontFamily = 'Arial',
    fontStyle = '',
    wrap = 'none',
    circularPath,
    debug = false,
    align = 'left',
    letterSpacing = 0,
  } = options

  const log = (...args: unknown[]) => {
    if (debug) {
      // eslint-disable-next-line no-console
      console.debug('[TextScale]', ...args)
    }
  }

  // Try to compute a more accurate baseline height using canvas text metrics
  const computeBaselineHeight = (ctx: CanvasRenderingContext2D, sampleSize: number): number => {
    try {
      const sample = 'Mgjpqy' // includes ascenders and descenders
      const metrics = ctx.measureText(sample)
      const ascent = (metrics as any)?.actualBoundingBoxAscent
      const descent = (metrics as any)?.actualBoundingBoxDescent
      if (typeof ascent === 'number' && typeof descent === 'number') {
        return ascent + descent
      }
    } catch {}
    // Fallback to font size if metrics are not supported
    return sampleSize
  }

  if (!width || !height) {
    const lines = processTextToLines(text)
    return {
      fontSize: minFontSize,
      textLines: lines,
      textProps: {
        fontSize: minFontSize,
        fontFamily,
        text: Array.isArray(text) ? text.join('\n') : text,
        lineHeight,
        fontStyle: fontStyle || undefined,
      },
    }
  }

  // For wrapping modes, we will re-compute lines dynamically per candidate font size.
  // For none-wrapping, preserve explicit newlines only.
  const baseLines = processTextToLines(text)

  // Create a canvas for text measurement
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    console.error('Could not get 2D context from canvas')
    const lines = processTextToLines(text)
    const fallbackResult = {
      fontSize: minFontSize,
      textLines: lines,
      textProps: {
        fontSize: minFontSize,
        fontFamily,
        text: Array.isArray(text) ? text.join('\n') : text,
        lineHeight,
        fontStyle: fontStyle || undefined,
      },
    }
    return fallbackResult
  }

  // Calculate available space with padding
  let availableWidth = width - padding * 2
  const availableHeight = height - padding * 2
  log('options', {
    width,
    height,
    padding,
    minFontSize,
    maxFontSize,
    lineHeight,
    wrap,
    hasCircularPath: Boolean(circularPath),
    availableWidth,
    availableHeight,
  })

  // For circular text paths, use arc length instead of rectangular width
  if (circularPath) {
    const { radius, startAngle, endAngle } = circularPath

    // Calculate arc span with proper handling of near-full circles
    let arcSpan = endAngle - startAngle

    // Normalize angles to [0, 2π] range for more predictable calculations
    const normalizeAngle = (angle: number) => {
      while (angle < 0) angle += 2 * Math.PI
      while (angle >= 2 * Math.PI) angle -= 2 * Math.PI
      return angle
    }

    const normalizedStart = normalizeAngle(startAngle)
    const normalizedEnd = normalizeAngle(endAngle)

    // Recalculate arc span with normalized angles
    arcSpan = normalizedEnd - normalizedStart
    if (arcSpan <= 0) {
      arcSpan += 2 * Math.PI
    }

    // Handle very small gaps (< 0.1 radians ≈ 5.7°) as full circles
    // This prevents tiny gaps from making text invisible
    if (arcSpan < 0.1) {
      arcSpan = 2 * Math.PI // Treat as full circle
    }

    // Arc length = radius × angle (in radians)
    const arcLength = radius * arcSpan

    // Use arc length as available width, accounting for padding
    availableWidth = Math.max(arcLength - padding * 2, 1)
  }

  // Word/char wrapping helpers
  const wrapTextToLines = (ctx: CanvasRenderingContext2D, fullText: string, size: number): string[] => {
    const lines: string[] = []
    const content = fullText
    // Apply current font
    const fontString = fontStyle ? `${fontStyle} ${size}px ${fontFamily}` : `${size}px ${fontFamily}`
    ctx.font = fontString

    const maxWidth = availableWidth

    if (wrap === 'char') {
      let current = ''
      for (const ch of content) {
        const test = current + ch
        if (ctx.measureText(test).width > maxWidth && current !== '') {
          lines.push(current)
          current = ch
        } else {
          current = test
        }
      }
      if (current) lines.push(current)
      return lines
    }

    // Default to 'word' wrapping
    const words = content.split(/(\s+)/) // keep spaces as tokens to preserve spacing
    let current = ''
    for (const token of words) {
      const test = current + token
      if (token.trim() === '') {
        // whitespace token, safe to append
        current = test
        continue
      }
      if (ctx.measureText(test).width > maxWidth && current.trim() !== '') {
        lines.push(current.trimEnd())
        current = token
      } else {
        current = test
      }
    }
    if (current) lines.push(current.trimEnd())
    return lines
  }

  // Function to check if text fits the available space
  const textFits = (size: number): boolean => {
    // Set font for measurement
    const fontString = fontStyle ? `${fontStyle} ${size}px ${fontFamily}` : `${size}px ${fontFamily}`
    ctx.font = fontString

    // If using Konva wrapping, delegate measurement to Konva to avoid mismatches
    if (wrap !== 'none' && !circularPath) {
      const measurer = getTextMeasurer()
      const fullText = Array.isArray(text) ? text.join('\n') : text
      const padding = 0 // padding accounted in node and options.width reflects content box already
      const strokeWidth = 0 // stroke width expands client rect; if you want stricter fit, pass actual values from caller
      const shadowBlur = 0
      const shadowOffsetX = 0
      const shadowOffsetY = 0

      const measured = measurer.measure({
        text: fullText,
        width: Math.max(availableWidth, 1),
        lineHeight,
        wrap: wrap,
        fontFamily,
        fontStyle,
        fontSize: size,
        align,
        letterSpacing,
        padding,
        strokeWidth,
        shadowBlur,
        shadowOffsetX,
        shadowOffsetY,
      })

      log('check', {
        size,
        measuredHeight: measured.height,
        measuredWidth: measured.width,
        availableWidth,
        availableHeight,
      })

      if (measured.height > availableHeight) {
        log('fail:height', { size, totalHeight: measured.height, availableHeight })
        return false
      }
      return true
    }

    // Legacy non-wrapping measurement with canvas
    const linesForCheck: string[] = baseLines
    // Calculate total height with a more accurate baseline for the first line
    const lineGap = size * lineHeight // distance between baselines
    const baselineHeight = computeBaselineHeight(ctx, size)
    const totalHeight = baselineHeight + lineGap * (linesForCheck.length - 1)
    log('check', { size, lines: linesForCheck.length, lineGap, baselineHeight, totalHeight, availableHeight })

    if (totalHeight > availableHeight) {
      log('fail:height', { size, totalHeight, availableHeight })
      return false
    }

    // Ensure width fits on each non-wrapped line
    for (const line of linesForCheck) {
      if (ctx.measureText(line).width > availableWidth) {
        log('fail:width', { size, lineWidth: ctx.measureText(line).width, availableWidth, line })
        return false
      }
    }

    return true
  }

  // Binary search for the optimal font size with decimal precision
  let low = minFontSize
  let high = maxFontSize
  let bestSize = minFontSize

  while (high - low > precision) {
    const mid = (low + high) / 2

    if (textFits(mid)) {
      bestSize = mid
      low = mid
    } else {
      high = mid
    }
    log('search', { low, high, bestSize })
  }

  // Round to desired precision
  const finalFontSize = Math.floor(bestSize * (1 / precision)) / (1 / precision)

  return {
    fontSize: finalFontSize,
    // Recompute final lines for consumers (best-effort)
    textLines:
      wrap === 'none' || circularPath
        ? baseLines
        : (() => {
            // produce wrapped lines at final size for consumer convenience
            const fontString = fontStyle
              ? `${fontStyle} ${finalFontSize}px ${fontFamily}`
              : `${finalFontSize}px ${fontFamily}`
            ctx.font = fontString
            const fullText = Array.isArray(text) ? text.join('\n') : text
            const paragraphLines = fullText.split(/\r?\n/)
            const wrapped: string[] = []
            for (const paragraph of paragraphLines) {
              if (!paragraph) {
                wrapped.push('')
                continue
              }
              wrapped.push(...wrapTextToLines(ctx, paragraph, finalFontSize))
            }
            return wrapped
          })(),
    textProps: {
      fontSize: finalFontSize,
      fontFamily,
      text: Array.isArray(text) ? text.join('\n') : text,
      lineHeight,
      fontStyle: fontStyle || undefined,
    },
  }
}
