/**
 * Helper functions for preparing image option individual mode data
 * Used when publishing integration to storefront
 */

// --- Interfaces ---

export interface PercentageTransform {
  widthPct?: number
  heightPct?: number
  leftPct?: number
  topPct?: number
  rotateDelta?: number
}

export interface BaseSnapshot {
  width: number
  height: number
  left: number
  top: number
  rotate: number
}

export interface ClipGroup {
  absoluteX?: number
  absoluteY?: number
  absoluteWidth?: number
  absoluteHeight?: number
  rotation?: number
}

export interface ClipGroupPct {
  absoluteXPct?: number
  absoluteYPct?: number
  absoluteWidthPct?: number
  absoluteHeightPct?: number
  rotationDelta?: number
}

export interface ScaledBase {
  w: number
  h: number
  l: number
  t: number
  r: number
}

// --- Helper Functions ---

/**
 * Check if option has percentage-based transform (edited in individual mode)
 */
export function hasPercentageTransform(pct: PercentageTransform): boolean {
  return (
    pct.widthPct !== undefined
    || pct.heightPct !== undefined
    || pct.leftPct !== undefined
    || pct.topPct !== undefined
    || pct.rotateDelta !== undefined
  )
}

/**
 * Compute base transform for image option (edited vs unedited have different fallback chains)
 */
export function computeImageOptionBase(
  isEdited: boolean,
  optionBaseSnapshot: BaseSnapshot | undefined,
  originalBaseState: BaseSnapshot | undefined,
  layer: { width?: number; height?: number; left?: number; top?: number; rotate?: number } | undefined
): ScaledBase {
  if (isEdited) {
    // Edited option: use the base that percentages were encoded against
    return {
      w: optionBaseSnapshot?.width ?? originalBaseState?.width ?? layer?.width ?? 0,
      h: optionBaseSnapshot?.height ?? originalBaseState?.height ?? layer?.height ?? 0,
      l: optionBaseSnapshot?.left ?? originalBaseState?.left ?? layer?.left ?? 0,
      t: optionBaseSnapshot?.top ?? originalBaseState?.top ?? layer?.top ?? 0,
      r: optionBaseSnapshot?.rotate ?? originalBaseState?.rotate ?? layer?.rotate ?? 0,
    }
  }

  // Unedited option: use originalBaseState first (consistent with admin behavior)
  return {
    w: originalBaseState?.width ?? layer?.width ?? 0,
    h: originalBaseState?.height ?? layer?.height ?? 0,
    l: originalBaseState?.left ?? layer?.left ?? 0,
    t: originalBaseState?.top ?? layer?.top ?? 0,
    r: originalBaseState?.rotate ?? layer?.rotate ?? 0,
  }
}

/**
 * Scale base transform for storefront decode
 */
export function scaleBase(base: ScaledBase, scale: { x: number; y: number }): ScaledBase {
  return {
    w: base.w * scale.x,
    h: base.h * scale.y,
    l: base.l * scale.x,
    t: base.t * scale.y,
    r: base.r, // rotation doesn't scale
  }
}

/**
 * Scale originalClipGroup for unedited options in individual mode
 */
export function scaleClipGroup(clipGroup: ClipGroup, scale: { x: number; y: number }): ClipGroup {
  return {
    absoluteX: (clipGroup.absoluteX ?? 0) * scale.x,
    absoluteY: (clipGroup.absoluteY ?? 0) * scale.y,
    absoluteWidth: (clipGroup.absoluteWidth ?? 0) * scale.x,
    absoluteHeight: (clipGroup.absoluteHeight ?? 0) * scale.y,
    rotation: clipGroup.rotation ?? 0,
  }
}

/**
 * Prepare image option with individual mode data (percentages + scaled base)
 */
export function prepareImageOptionIndividualData(
  base: Record<string, unknown>,
  optionData: {
    widthPct?: number
    heightPct?: number
    leftPct?: number
    topPct?: number
    rotateDelta?: number
    clipGroupPct?: ClipGroupPct
    baseSnapshot?: BaseSnapshot
  },
  optionSet: { originalBaseState?: BaseSnapshot; originalClipGroup?: ClipGroup } | undefined,
  layer: { width?: number; height?: number; left?: number; top?: number; rotate?: number } | undefined,
  scale: { x: number; y: number }
): Record<string, unknown> {
  const { widthPct, heightPct, leftPct, topPct, rotateDelta, clipGroupPct, baseSnapshot } = optionData
  const pct: PercentageTransform = { widthPct, heightPct, leftPct, topPct, rotateDelta }
  const isEdited = hasPercentageTransform(pct)

  // Compute base (different fallback for edited vs unedited)
  const rawBase = computeImageOptionBase(isEdited, baseSnapshot, optionSet?.originalBaseState, layer)
  base.base = scaleBase(rawBase, scale)

  // Add percentage data for edited options
  if (isEdited) {
    base.pct = pct
  }

  // Handle clipGroup
  if (clipGroupPct) {
    // Edited option with clipGroupPct: pass directly (storefront will decode)
    base.clipGroupPct = clipGroupPct
  } else if (optionSet?.originalClipGroup && !isEdited) {
    // Unedited option in individual mode: pass scaled originalClipGroup
    base.clipGroup = scaleClipGroup(optionSet.originalClipGroup, scale)
  }

  return base
}
