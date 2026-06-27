import type { Design } from '../type'
import type { KonvaEditorState } from '../handlers/event-handlers/image-editor/types/editor-types'

/**
 * Reevaluate the clip group with the original layer data
 * @param ds - The original layer data
 * @param clipGroup - The clip group
 * @returns The new clip group
 */
export function revaluateClipGroupWithOriginalLayerData(ds: Design, clipGroup: KonvaEditorState) {
  const { originalScaleX, originalScaleY } = ds

  const scaleX = originalScaleX || 1
  const scaleY = originalScaleY || 1

  // Divide the scale x and scale y for relative position
  const { absoluteWidth, absoluteHeight, absoluteX, absoluteY } = clipGroup

  const newClipGroup = {
    ...clipGroup,
    absoluteHeight: (absoluteHeight ?? 0) / scaleY,
    absoluteWidth: (absoluteWidth ?? 0) / scaleX,
    absoluteX: (absoluteX ?? 0) / scaleX,
    absoluteY: (absoluteY ?? 0) / scaleY,
  }

  return newClipGroup
}

// Re-export loadImage from paint-image-loader for backward compatibility
export { loadImage } from '../../shared/libraries/paint/paint-image-loader'
