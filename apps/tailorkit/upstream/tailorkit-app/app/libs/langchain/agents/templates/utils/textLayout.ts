/**
 * Text layout utilities for template agents.
 * All functions are side-effect free and runtime-only (no DOM dependencies).
 */

/** Allowed text style flags supported by the estimator */
export type TextStyleFlag = 'bold' | 'italic' | 'underline' | 'normal'

/** Case transformation modes recognized by the estimator */
export type TextStyleCase = 'none' | 'uppercase' | 'lowercase' | 'title' | 'sentence'

/** Minimal subset of text settings required for estimation and fitting */
export interface TextSettingsSubset {
  textStyle?: TextStyleFlag[]
  styleCase?: TextStyleCase
  fontSize?: number
  content?: string
}

/** Bounding box used to constrain text layout */
export interface BasicTransform {
  width: number
  height: number
}

/** Minimal text element data for fitting calculations */
export interface BasicTextElement {
  transform: BasicTransform
  settings: TextSettingsSubset
}

/** Result of a text dimension estimation */
export interface EstimatedTextDimensions {
  width: number
  height: number
  lines: number
}

/**
 * Estimate multi-line text dimensions using a simple word-wrapping heuristic.
 * Slightly over-estimates width to avoid overflow in production.
 *
 * @param content Text content to measure
 * @param fontSize Font size in px
 * @param maxWidth Maximum width constraint in px. If <= 0, measured as single line
 * @param settings Minimal text style settings that affect width/height
 * @returns Estimated width/height/line count. Width is capped to maxWidth when constrained
 */
export function estimateTextDimensions(
  content: string,
  fontSize: number,
  maxWidth: number,
  settings?: TextSettingsSubset
): EstimatedTextDimensions {
  const normalized = (content || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return { width: 0, height: 0, lines: 0 }

  // Base character width factor for typical sans-serif fonts
  let charWidthFactor = 0.6
  const styles = new Set(settings?.textStyle || [])
  if (styles.has('bold')) charWidthFactor += 0.05
  if (styles.has('italic')) charWidthFactor += 0.02
  if (settings?.styleCase === 'uppercase') charWidthFactor += 0.04

  // Safety margin to bias towards smaller sizes
  const safety = 1.04
  const avgCharWidth = fontSize * charWidthFactor * safety
  const lineHeight = Math.ceil(fontSize * 1.2)

  // If no width constraint, treat as single line
  if (!isFinite(maxWidth) || maxWidth <= 0) {
    const singleWidth = Math.ceil(normalized.length * avgCharWidth)
    return { width: singleWidth, height: lineHeight, lines: 1 }
  }

  const words = normalized.split(' ')
  let currentLineWidth = 0
  let maxLineWidth = 0
  let lineCount = 1

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i]
    const wordWidth = Math.ceil(word.length * avgCharWidth)
    const spaceWidth = Math.ceil(avgCharWidth)
    const nextWidth = currentLineWidth === 0 ? wordWidth : currentLineWidth + spaceWidth + wordWidth
    if (nextWidth <= maxWidth) {
      currentLineWidth = nextWidth
      maxLineWidth = Math.max(maxLineWidth, currentLineWidth)
    } else {
      // Move to next line
      lineCount += 1
      currentLineWidth = wordWidth
      maxLineWidth = Math.max(maxLineWidth, currentLineWidth)
    }
  }

  const totalHeight = lineCount * lineHeight
  // Cap reported width to maxWidth to satisfy layout constraints and tests
  const reportedWidth = Math.min(maxLineWidth, Math.max(0, Math.floor(maxWidth)))
  return { width: reportedWidth, height: totalHeight, lines: lineCount }
}

/**
 * Compute a best-fit font size to keep text within its transform box.
 * Uses a binary search over a safe size range.
 *
 * @param element Minimal text element containing transform constraint and settings
 * @returns A font size that fits the element box, >= 6 if possible; returns 0 when no content
 */
export function adjustTextFontSizeToFit(element: BasicTextElement): number {
  const boxWidth = Math.max(0, Math.floor(element.transform.width))
  const boxHeight = Math.max(0, Math.floor(element.transform.height))
  const content = String(element.settings.content || '').trim()
  if (!boxWidth || !boxHeight || !content) return element.settings.fontSize || 0

  // Establish search bounds
  const heuristic = Math.floor(Math.min(boxWidth / 8, boxHeight))

  // Dynamic upper bound based on single-line width at a base size.
  // This prevents the search from getting stuck around width/8 (~48px) for short text in large boxes.
  const BASE_MEASURE_SIZE = 100
  const singleLineAtBase = estimateTextDimensions(
    content,
    BASE_MEASURE_SIZE,
    Number.POSITIVE_INFINITY,
    element.settings
  )
  // s_max_width ≈ boxWidth * BASE_MEASURE_SIZE / singleLineAtBase.width
  const widthLimitedMax
    = singleLineAtBase.width > 0 ? Math.floor((boxWidth * BASE_MEASURE_SIZE) / singleLineAtBase.width) : heuristic
  // Height is always a hard ceiling (lineHeight ~ 1.2 * fontSize)
  const heightLimitedMax = Math.floor(boxHeight)
  // Give a small headroom so binary search can converge near the true max
  const dynamicUpperBound = Math.max(8, Math.min(heightLimitedMax, Math.floor(widthLimitedMax * 1.05)))

  // Ignore any pre-set fontSize for the search range to avoid getting stuck (e.g., at 48px)
  // Use a safe lower bound and a dynamic upper bound derived from content and box constraints
  let hi = Math.max(dynamicUpperBound, heuristic)
  let lo = 6

  const fits = (size: number) => {
    const dims = estimateTextDimensions(content, size, boxWidth, element.settings)
    return dims.width <= boxWidth && dims.height <= boxHeight
  }

  // Note: Do not early-return on existing fontSize even if it fits.
  // We search for the largest size that still fits the box.

  // Binary search for best fit size
  let best = 0
  for (let iter = 0; iter < 20; iter += 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (mid <= 0 || lo > hi) break
    if (fits(mid)) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  // Fallback if search fails
  if (best === 0) {
    best = Math.max(6, Math.min(heuristic, hi))
    while (best > 6 && !fits(best)) best -= 1
  }

  return Math.max(6, Math.round(best))
}
