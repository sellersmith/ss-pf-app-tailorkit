/**
 * ClipGroup transform utilities for order print rendering
 * Handles decoding and scaling of inner image positioning
 */

/**
 * ClipGroup interface for inner image positioning
 */
export interface ClipGroup {
  absoluteX: number
  absoluteY: number
  absoluteWidth: number
  absoluteHeight: number
  rotation: number
}

/**
 * ClipGroupPct interface for percentage-based clipGroup (individual mode)
 */
export interface ClipGroupPct {
  absoluteXPct?: number
  absoluteYPct?: number
  absoluteWidthPct?: number
  absoluteHeightPct?: number
  rotationDelta?: number
}

/**
 * Decode clipGroup from percentages
 * @param clipGroupPct - ClipGroup percentage values
 * @param containerWidth - Width of the container (decoded option width)
 * @param containerHeight - Height of the container (decoded option height)
 * @param containerRotation - Rotation of the container (decoded option rotation)
 * @returns Decoded absolute clipGroup values
 */
export function decodeClipGroupFromPct(
  clipGroupPct: ClipGroupPct,
  containerWidth: number,
  containerHeight: number,
  containerRotation: number
): ClipGroup {
  return {
    absoluteX: (clipGroupPct.absoluteXPct ?? 0) * containerWidth,
    absoluteY: (clipGroupPct.absoluteYPct ?? 0) * containerHeight,
    absoluteWidth: (clipGroupPct.absoluteWidthPct ?? 1) * containerWidth,
    absoluteHeight: (clipGroupPct.absoluteHeightPct ?? 1) * containerHeight,
    rotation: containerRotation + (clipGroupPct.rotationDelta ?? 0),
  }
}

/**
 * Scale clipGroup dimensions by scale factors
 * @param clipGroup - ClipGroup to scale
 * @param scaleX - Horizontal scale factor
 * @param scaleY - Vertical scale factor
 * @returns Scaled clipGroup
 */
export function scaleClipGroup(clipGroup: ClipGroup, scaleX: number, scaleY: number): ClipGroup {
  return {
    absoluteX: clipGroup.absoluteX * scaleX,
    absoluteY: clipGroup.absoluteY * scaleY,
    absoluteWidth: clipGroup.absoluteWidth * scaleX,
    absoluteHeight: clipGroup.absoluteHeight * scaleY,
    rotation: clipGroup.rotation,
  }
}
