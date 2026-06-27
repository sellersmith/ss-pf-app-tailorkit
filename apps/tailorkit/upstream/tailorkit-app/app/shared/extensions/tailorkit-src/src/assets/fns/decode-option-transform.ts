/**
 * Decode percentage-based transforms to absolute values
 * Used by storefront to render image options in individual mode
 */

export interface PercentageTransform {
  widthPct?: number
  heightPct?: number
  leftPct?: number
  topPct?: number
  rotateDelta?: number
}

export interface BaseTransform {
  w: number
  h: number
  l: number
  t: number
  r: number
}

export interface DecodedTransform {
  w: number
  h: number
  l: number
  t: number
  r: number
}

export interface ClipGroupPct {
  absoluteXPct?: number
  absoluteYPct?: number
  absoluteWidthPct?: number
  absoluteHeightPct?: number
  rotationDelta?: number
}

export interface DecodedClipGroup {
  absoluteX: number
  absoluteY: number
  absoluteWidth: number
  absoluteHeight: number
  rotation: number
}

/**
 * Decode percentage transform to absolute values
 * @param pct - Percentage transform values (widthPct, heightPct, etc.)
 * @param base - Base transform to decode against (already scaled for storefront)
 * @returns Decoded absolute transform values
 */
export function decodeOptionTransform(pct: PercentageTransform | undefined, base: BaseTransform): DecodedTransform {
  if (!pct) {
    // No percentages = use base directly (unedited option)
    return { ...base }
  }

  return {
    w: pct.widthPct !== undefined ? pct.widthPct * base.w : base.w,
    h: pct.heightPct !== undefined ? pct.heightPct * base.h : base.h,
    l: pct.leftPct !== undefined ? base.l + pct.leftPct * base.w : base.l,
    t: pct.topPct !== undefined ? base.t + pct.topPct * base.h : base.t,
    r: pct.rotateDelta !== undefined ? base.r + pct.rotateDelta : base.r,
  }
}

/**
 * Decode clipGroup percentages to absolute values
 * @param clipGroupPct - ClipGroup percentage values
 * @param containerWidth - Width of the container (decoded option width)
 * @param containerHeight - Height of the container (decoded option height)
 * @param containerRotation - Rotation of the container (decoded option rotation)
 * @returns Decoded absolute clipGroup values, or null if no percentages
 */
export function decodeClipGroup(
  clipGroupPct: ClipGroupPct | undefined,
  containerWidth: number,
  containerHeight: number,
  containerRotation: number
): DecodedClipGroup | null {
  if (!clipGroupPct) return null

  return {
    absoluteX: (clipGroupPct.absoluteXPct ?? 0) * containerWidth,
    absoluteY: (clipGroupPct.absoluteYPct ?? 0) * containerHeight,
    absoluteWidth: (clipGroupPct.absoluteWidthPct ?? 1) * containerWidth,
    absoluteHeight: (clipGroupPct.absoluteHeightPct ?? 1) * containerHeight,
    rotation: containerRotation + (clipGroupPct.rotationDelta ?? 0),
  }
}
