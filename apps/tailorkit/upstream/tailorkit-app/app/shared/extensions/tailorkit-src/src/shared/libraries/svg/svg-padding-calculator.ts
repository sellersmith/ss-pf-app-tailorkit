/**
 * SVG Padding Calculator
 *
 * Calculates padding requirements for SVG text elements to prevent clipping.
 * Accounts for italic slant, descenders, ascenders, stroke width, and effects.
 *
 * @module shared/libraries/svg
 */

/**
 * Effect configuration for padding calculation
 */
export interface EffectForPadding {
  type: 'DROP_SHADOW' | 'INNER_SHADOW'
  visible?: boolean
  radius?: number
  offsetX?: number
  offsetY?: number
}

/**
 * Padding values for all four sides
 */
export interface PaddingValues {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * Calculate extra padding needed for italic text to prevent clipping.
 * Italic text slants to the right, so we need extra space on the right edge.
 * The slant is typically around 12-15 degrees (tan(12°) ≈ 0.21)
 *
 * @param fontSize - Font size in pixels
 * @param isItalic - Whether the text is italic
 * @returns Extra horizontal padding needed (right edge)
 */
export function calculateItalicPadding(fontSize: number, isItalic: boolean): number {
  if (!isItalic) return 0
  // Use a factor of ~0.3 to accommodate italic slant (roughly 14 degrees)
  return Math.ceil(fontSize * 0.3)
}

/**
 * Calculate extra vertical padding for text descenders (g, y, p, q, j).
 * Descenders typically extend about 20-25% below the baseline.
 * This prevents the bottom of text from being clipped.
 *
 * @param fontSize - Font size in pixels
 * @returns Extra vertical padding needed (bottom edge)
 */
export function calculateDescenderPadding(fontSize: number): number {
  // Use a factor of ~0.25 to accommodate descenders
  return Math.ceil(fontSize * 0.25)
}

/**
 * Calculate stroke padding (stroke is centered, so half extends outside)
 *
 * @param strokeWidth - Stroke width in pixels
 * @returns Extra padding needed for stroke
 */
export function calculateStrokePadding(strokeWidth: number): number {
  return strokeWidth > 0 ? Math.ceil(strokeWidth / 2) : 0
}

/**
 * Calculate dynamic padding for SVG text based on font metrics and effects.
 * This ensures text and its effects are never clipped.
 *
 * Components of padding:
 * 1. Base font metrics: ascenders (~30% fontSize) and descenders (~30% fontSize)
 * 2. Italic slant: ~tan(15°) * fontSize ≈ 0.27 * fontSize
 * 3. Drop shadow effects: blur * 2.5 (blur spread) + |offset| (shadow position)
 * 4. Stroke width: strokeWidth / 2 (stroke is centered)
 *
 * @param fontSize - The font size in pixels
 * @param isItalic - Whether the text is italic
 * @param effects - Array of effects (drop shadows extend bounds, inner shadows don't)
 * @param isTextPath - If true, returns uniform padding for all sides (text can curve any direction)
 * @param strokeWidth - Stroke width in pixels (default: 0)
 * @returns Padding values for all four sides
 */
export function calculateDynamicPadding(
  fontSize: number,
  isItalic: boolean,
  effects: EffectForPadding[] = [],
  isTextPath: boolean = false,
  strokeWidth: number = 0
): PaddingValues {
  // Base padding for font metrics
  // For text path, text can extend in any direction from the path
  const ascenderPadding = Math.ceil(fontSize * 0.3) // Space above baseline for tall letters
  const descenderPadding = Math.ceil(fontSize * 0.3) // Space below baseline for g, y, p, q, j

  // Italic slant padding (text leans right)
  const italicPadding = isItalic ? Math.ceil(fontSize * 0.3) : 0

  // Stroke padding (stroke is centered, so half extends outside)
  const strokePadding = calculateStrokePadding(strokeWidth)

  // Calculate maximum effect extension (only drop shadows extend bounds)
  let maxEffectLeft = 0
  let maxEffectRight = 0
  let maxEffectTop = 0
  let maxEffectBottom = 0

  const safeFactor = 2

  for (const effect of effects) {
    if (effect.visible === false) continue
    if (effect.type !== 'DROP_SHADOW') continue // Inner shadows don't extend bounds

    const blur = effect.radius || 0
    const offsetX = effect.offsetX || 0
    const offsetY = effect.offsetY || 0

    // Blur spreads outward by approximately blur * 2
    // Using 2.5 for safety margin
    const blurSpread = Math.ceil(blur * 2.5)

    // Calculate extension in each direction
    // Shadow extends in the direction of offset, plus blur spread in all directions
    const effectLeft = blurSpread + Math.max(0, -offsetX)
    const effectRight = blurSpread + Math.max(0, offsetX)
    const effectTop = blurSpread + Math.max(0, -offsetY)
    const effectBottom = blurSpread + Math.max(0, offsetY)

    maxEffectLeft = Math.max(maxEffectLeft, effectLeft)
    maxEffectRight = Math.max(maxEffectRight, effectRight)
    maxEffectTop = Math.max(maxEffectTop, effectTop)
    maxEffectBottom = Math.max(maxEffectBottom, effectBottom)
  }

  if (isTextPath) {
    // For text path, use uniform padding on all sides
    // Text can curve in any direction, so we need the maximum padding everywhere
    const uniformPadding
      = Math.max(
        ascenderPadding + maxEffectTop + strokePadding,
        descenderPadding + maxEffectBottom + strokePadding,
        italicPadding + maxEffectLeft + strokePadding,
        italicPadding + maxEffectRight + strokePadding,
        // Minimum padding to prevent clipping on curved paths
        Math.ceil(fontSize * 0.5) + strokePadding
      ) * safeFactor

    return {
      top: uniformPadding,
      right: uniformPadding,
      bottom: uniformPadding,
      left: uniformPadding,
    }
  }

  // For normal text, use directional padding (stroke extends in all directions)
  return {
    top: Math.max(ascenderPadding, maxEffectTop, strokePadding) * safeFactor,
    right: Math.max(italicPadding, maxEffectRight, strokePadding) * safeFactor,
    bottom: Math.max(descenderPadding, maxEffectBottom, strokePadding) * safeFactor,
    left: Math.max(maxEffectLeft, strokePadding) * safeFactor,
  }
}

/**
 * Calculate total padding needed for SVG text (for simple cases)
 *
 * @param fontSize - Font size in pixels
 * @param isItalic - Whether the text is italic
 * @param strokeWidth - Stroke width in pixels
 * @returns Total padding needed on all sides
 */
export function calculateSimplePadding(fontSize: number, isItalic: boolean, strokeWidth: number = 0): number {
  const italicPadding = calculateItalicPadding(fontSize, isItalic)
  const descenderPadding = calculateDescenderPadding(fontSize)
  const strokePadding = calculateStrokePadding(strokeWidth)

  return Math.max(italicPadding, descenderPadding, strokePadding) * 2
}
