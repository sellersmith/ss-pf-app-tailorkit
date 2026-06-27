import type { ImageOptionSet } from '~/types/psd'

export type LayerTransform = {
  width: number
  height: number
  left: number
  top: number
  rotate: number
}

type ImageOptionWithPercentages = ImageOptionSet & {
  widthPct?: number
  heightPct?: number
  leftPct?: number
  topPct?: number
  rotateDelta?: number
}

/**
 * Synchronizes image options to match base layer in sync mode.
 * Clears all absolute and percentage fields - in sync mode, the layer is the source of truth.
 * This prevents stale data from persisting in the database when restoring to sync mode.
 */
export function syncOptionsToBase(files: ImageOptionSet[], _baseTransform: LayerTransform): ImageOptionSet[] {
  // Use null for baseSnapshot so MongoDB actually clears the field
  // Other fields use undefined as they are optional primitives
  return files.map(f => ({
    ...f,
    // Clear absolute fields - in sync mode, layer is the source of truth
    width: undefined,
    height: undefined,
    left: undefined,
    top: undefined,
    rotate: undefined,
    // Clear percentage fields in sync mode
    widthPct: undefined,
    heightPct: undefined,
    leftPct: undefined,
    topPct: undefined,
    rotateDelta: undefined,
    // Use null so MongoDB actually clears the field
    baseSnapshot: null,
    // Also clear clipGroup percentages in sync mode
    clipGroupPct: undefined,
    // Clear selection
    selecting: false,
  }))
}

/**
 * Recomputes absolute transforms from percentage values.
 * Used when container dimensions change in individual mode.
 */
export function recomputeFromPercentages(option: ImageOptionSet, baseTransform: LayerTransform): ImageOptionSet {
  const { widthPct, heightPct, leftPct, topPct, rotateDelta } = option as ImageOptionWithPercentages
  const hasPercentages
    = widthPct !== undefined
    || heightPct !== undefined
    || leftPct !== undefined
    || topPct !== undefined
    || rotateDelta !== undefined

  // If no percentages (unedited option): sync with layer, don't create percentages
  if (!hasPercentages) {
    return {
      ...option,
      width: baseTransform.width,
      height: baseTransform.height,
      left: baseTransform.left,
      top: baseTransform.top,
      rotate: baseTransform.rotate,
    }
  }

  // Recompute from percentages
  const nextWidth = widthPct !== undefined ? Math.max(0, widthPct * baseTransform.width) : option.width
  const nextHeight = heightPct !== undefined ? Math.max(0, heightPct * baseTransform.height) : option.height
  const nextLeft = leftPct !== undefined ? baseTransform.left + leftPct * baseTransform.width : option.left
  const nextTop = topPct !== undefined ? baseTransform.top + topPct * baseTransform.height : option.top
  const nextRotate = rotateDelta !== undefined ? baseTransform.rotate + rotateDelta : option.rotate

  return {
    ...option,
    ...(nextWidth !== undefined ? { width: nextWidth } : {}),
    ...(nextHeight !== undefined ? { height: nextHeight } : {}),
    ...(nextLeft !== undefined ? { left: nextLeft } : {}),
    ...(nextTop !== undefined ? { top: nextTop } : {}),
    ...(nextRotate !== undefined ? { rotate: nextRotate } : {}),
  }
}

/**
 * @deprecated This hook has been removed to avoid race conditions from useEffect.
 * Transform sync is now handled synchronously in:
 * - withInteractiveElement.client.tsx (onTransformEndHandler, onDragEndHandler)
 * - items.tsx (toggleEditingMode for mode switch)
 *
 * The helper functions syncOptionsToBase and recomputeFromPercentages are exported
 * for use in synchronous handlers.
 */
export default function useSyncImageOptionTransform(): void {
  // No-op: Transform sync is now handled synchronously at the source of changes
  // to avoid race conditions from reactive useEffect updates.
}
