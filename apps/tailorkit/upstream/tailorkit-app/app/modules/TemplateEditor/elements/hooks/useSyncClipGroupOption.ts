import type { ImageOptionSet, NodeImage } from '~/types/psd'

type ClipGroup = NonNullable<NodeImage['clipGroup']>
type ClipGroupPct = NonNullable<ImageOptionSet['clipGroupPct']>

export type ContainerTransform = {
  width: number
  height: number
  rotate: number
}

/**
 * Encodes absolute clipGroup values to percentages relative to container dimensions.
 * Returns undefined if container dimensions are invalid (zero width/height) or clipGroup is undefined.
 *
 * @param clipGroup - Absolute clipGroup values to encode
 * @param containerTransform - Container dimensions and rotation
 * @param originalClipGroup - Original clipGroup for rotation delta calculation (optional)
 * @returns ClipGroupPct with percentage values, or undefined if encoding is not possible
 */
export function encodeClipGroupToPercentages(
  clipGroup: ClipGroup | undefined,
  containerTransform: ContainerTransform,
  originalClipGroup?: ClipGroup | undefined
): ClipGroupPct | undefined {
  const canEncode = containerTransform.width > 0 && containerTransform.height > 0

  if (!canEncode || !clipGroup) {
    return undefined
  }

  return {
    absoluteXPct: clipGroup.absoluteX / containerTransform.width,
    absoluteYPct: clipGroup.absoluteY / containerTransform.height,
    absoluteWidthPct: clipGroup.absoluteWidth / containerTransform.width,
    absoluteHeightPct: clipGroup.absoluteHeight / containerTransform.height,
    rotationDelta: clipGroup.rotation - containerTransform.rotate,
  }
}

/**
 * Decodes clipGroup percentages back to absolute values.
 *
 * @param clipGroupPct - Percentage-based clipGroup values
 * @param containerTransform - Container dimensions and rotation
 * @returns ClipGroup with absolute pixel values
 */
export function decodeClipGroupFromPercentages(
  clipGroupPct: ClipGroupPct,
  containerTransform: ContainerTransform
): ClipGroup {
  return {
    absoluteX: (clipGroupPct.absoluteXPct ?? 0) * containerTransform.width,
    absoluteY: (clipGroupPct.absoluteYPct ?? 0) * containerTransform.height,
    absoluteWidth: (clipGroupPct.absoluteWidthPct ?? 1) * containerTransform.width,
    absoluteHeight: (clipGroupPct.absoluteHeightPct ?? 1) * containerTransform.height,
    rotation: containerTransform.rotate + (clipGroupPct.rotationDelta ?? 0),
  }
}

/**
 * Synchronizes clipGroup to match base layer clipGroup in sync mode.
 * Clears clipGroupPct percentages since all options should have same clip position.
 */
export function syncClipGroupToAll(
  files: ImageOptionSet[],
  baseClipGroup: ClipGroup | undefined | null
): ImageOptionSet[] {
  // Convert null to undefined since clipGroup type doesn't allow null
  const normalizedClipGroup = baseClipGroup === null ? undefined : baseClipGroup
  return files.map(f => ({
    ...f,
    clipGroup: normalizedClipGroup,
    // Clear percentage fields in sync mode
    clipGroupPct: undefined,
  }))
}

/**
 * @deprecated This hook has been removed to avoid race conditions from useEffect.
 * ClipGroup sync is now handled synchronously in:
 * - withInteractiveElement.client.tsx (onTransformEndHandler for container resize)
 * - withInteractiveElement.client.tsx (onInnerTransform for inner image editing)
 * - items.tsx (toggleEditingMode for mode switch)
 *
 * The helper functions encodeClipGroupToPercentages, decodeClipGroupFromPercentages,
 * and syncClipGroupToAll are exported for use in synchronous handlers.
 */
export default function useSyncClipGroupOption(): void {
  // No-op: ClipGroup sync is now handled synchronously at the source of changes
  // to avoid race conditions from reactive useEffect updates.
}
