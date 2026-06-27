/**
 * Helper functions for ImageOption items
 * Extracted to improve readability of the main component
 */

import type { ImageOptionSet, NodeImage } from '~/types/psd'
import type { LayerDocument } from '~/models/Layer.server'
import { evaluateImageOptionTransform } from '~/utils/image-option-transforms'

/** Type alias for overlay from ImageOptionSet */
type ImageOptionOverlay = ImageOptionSet['overlay']

/** Type alias for layer settings with overlay */
type LayerSettings = LayerDocument['settings']

// Types
export interface ClipGroup {
  absoluteX: number
  absoluteY: number
  absoluteWidth: number
  absoluteHeight: number
  rotation: number
}

export interface ClipGroupPct {
  absoluteXPct?: number
  absoluteYPct?: number
  absoluteWidthPct?: number
  absoluteHeightPct?: number
  rotationDelta?: number
}

export interface BaseTransform {
  width: number
  height: number
  left: number
  top: number
  rotate: number
}

export interface SelectedFile {
  _id: string
  src?: string
  width?: number
  height?: number
  left?: number
  top?: number
  rotate?: number
  widthPct?: number
  heightPct?: number
  leftPct?: number
  topPct?: number
  rotateDelta?: number
  baseSnapshot?: BaseTransform
  clipGroup?: ClipGroup
  clipGroupPct?: ClipGroupPct
  overlay?: any
}

/**
 * Check if a file has percentage-based transform values.
 *
 * In individual editing mode, transforms are stored as percentages relative to a base snapshot.
 * This allows transforms to scale proportionally when the base layer dimensions change.
 *
 * @param file - The selected file/option to check
 * @returns `true` if any percentage-based transform field is defined
 *
 * @example
 * hasPercentageTransform({ _id: '1' }) // false - no percentages
 * hasPercentageTransform({ _id: '1', widthPct: 1.5 }) // true - has width percentage
 */
export function hasPercentageTransform(file: SelectedFile): boolean {
  return (
    file.widthPct !== undefined
    || file.heightPct !== undefined
    || file.leftPct !== undefined
    || file.topPct !== undefined
    || file.rotateDelta !== undefined
  )
}

/**
 * Check if a clipGroup has percentage-based values.
 *
 * ClipGroup percentages store crop position relative to container dimensions,
 * allowing the crop to scale when the container is resized.
 *
 * @param clipGroupPct - The percentage-based clipGroup to check
 * @returns `true` if any percentage field is defined
 *
 * @example
 * hasClipGroupPercentages(undefined) // false
 * hasClipGroupPercentages({ absoluteXPct: 0.1 }) // true
 */
export function hasClipGroupPercentages(clipGroupPct?: ClipGroupPct): boolean {
  if (!clipGroupPct) return false
  return (
    clipGroupPct.absoluteXPct !== undefined
    || clipGroupPct.absoluteYPct !== undefined
    || clipGroupPct.absoluteWidthPct !== undefined
    || clipGroupPct.absoluteHeightPct !== undefined
    || clipGroupPct.rotationDelta !== undefined
  )
}

/**
 * Decode transform from percentages for individual mode.
 *
 * For unedited options (no percentages), falls back to stored values or originalBaseState.
 * For edited options, decodes percentages relative to baseSnapshot or originalBaseState.
 * Handles stale baseSnapshot detection when layer dimensions changed between save/reload.
 *
 * **Fallback Priority:**
 * 1. Stored absolute values (width, height, left, top, rotate)
 * 2. originalBaseState (captured when entering individual mode)
 * 3. currentLayerState (current layer dimensions)
 *
 * **Stale Detection:**
 * If baseSnapshot dimensions don't match originalBaseState, the snapshot is considered
 * stale (layer was resized externally) and originalBaseState is used instead.
 *
 * @param selectedFile - The image option to decode
 * @param originalBaseState - Base state captured when entering individual mode
 * @param currentLayerState - Current layer dimensions as final fallback
 * @returns Decoded absolute transform values (width, height, left, top, rotate)
 *
 * @example
 * // Unedited option - uses stored values
 * decodeIndividualTransform(
 *   { _id: '1', width: 100, height: 80 },
 *   { width: 200, height: 150, left: 0, top: 0, rotate: 0 },
 *   { width: 300, height: 200, left: 50, top: 60, rotate: 0 }
 * )
 * // Returns: { width: 100, height: 80, left: 0, top: 0, rotate: 0 }
 *
 * @example
 * // Edited option - decodes from percentages
 * decodeIndividualTransform(
 *   { _id: '1', widthPct: 1.5, baseSnapshot: { width: 100, height: 100, ... } },
 *   originalBaseState,
 *   currentLayerState
 * )
 * // Returns: { width: 150, ... } (100 * 1.5)
 */
export function decodeIndividualTransform(
  selectedFile: ImageOptionSet,
  originalBaseState: BaseTransform | undefined,
  currentLayerState: BaseTransform
): BaseTransform {
  if (!hasPercentageTransform(selectedFile)) {
    // Unedited option: use stored values or fallback chain
    return {
      width: selectedFile.width ?? originalBaseState?.width ?? currentLayerState.width,
      height: selectedFile.height ?? originalBaseState?.height ?? currentLayerState.height,
      left: selectedFile.left ?? originalBaseState?.left ?? currentLayerState.left,
      top: selectedFile.top ?? originalBaseState?.top ?? currentLayerState.top,
      rotate: selectedFile.rotate ?? originalBaseState?.rotate ?? currentLayerState.rotate,
    }
  }

  // Has percentages - decode using baseSnapshot
  const optionBaseSnapshot = selectedFile.baseSnapshot

  // Detect stale baseSnapshot (dimensions changed between save and reload)
  const isStale
    = optionBaseSnapshot
    && originalBaseState
    && (optionBaseSnapshot.width !== originalBaseState.width || optionBaseSnapshot.height !== originalBaseState.height)

  const effectiveBase = isStale ? undefined : optionBaseSnapshot

  const baseTransform = {
    width: effectiveBase?.width ?? originalBaseState?.width ?? currentLayerState.width,
    height: effectiveBase?.height ?? originalBaseState?.height ?? currentLayerState.height,
    left: effectiveBase?.left ?? originalBaseState?.left ?? currentLayerState.left,
    top: effectiveBase?.top ?? originalBaseState?.top ?? currentLayerState.top,
    rotate: effectiveBase?.rotate ?? originalBaseState?.rotate ?? currentLayerState.rotate,
  }

  return evaluateImageOptionTransform(selectedFile, baseTransform)
}

/**
 * Decode clipGroup from percentage values to absolute pixel values.
 *
 * ClipGroup defines the visible crop area within an image layer.
 * Percentages allow the crop to scale proportionally when the container resizes.
 *
 * **Calculation:**
 * - `absoluteX = absoluteXPct * containerWidth`
 * - `absoluteY = absoluteYPct * containerHeight`
 * - `absoluteWidth = absoluteWidthPct * containerWidth` (min 0)
 * - `absoluteHeight = absoluteHeightPct * containerHeight` (min 0)
 * - `rotation = containerRotate + rotationDelta`
 *
 * @param clipGroupPct - Percentage-based clipGroup values
 * @param containerWidth - Current container width in pixels
 * @param containerHeight - Current container height in pixels
 * @param containerRotate - Current container rotation in degrees
 * @param fallbackClipGroup - Optional fallback for undefined percentage fields
 * @returns Decoded absolute clipGroup values
 *
 * @example
 * decodeClipGroupFromPercentages(
 *   { absoluteXPct: 0.1, absoluteYPct: 0.2, absoluteWidthPct: 0.5, absoluteHeightPct: 0.6 },
 *   200, 100, 15
 * )
 * // Returns: { absoluteX: 20, absoluteY: 20, absoluteWidth: 100, absoluteHeight: 60, rotation: 15 }
 */
export function decodeClipGroupFromPercentages(
  clipGroupPct: ClipGroupPct,
  containerWidth: number,
  containerHeight: number,
  containerRotate: number,
  fallbackClipGroup?: ClipGroup
): ClipGroup {
  return {
    absoluteX:
      clipGroupPct.absoluteXPct !== undefined
        ? clipGroupPct.absoluteXPct * containerWidth
        : (fallbackClipGroup?.absoluteX ?? 0),
    absoluteY:
      clipGroupPct.absoluteYPct !== undefined
        ? clipGroupPct.absoluteYPct * containerHeight
        : (fallbackClipGroup?.absoluteY ?? 0),
    absoluteWidth:
      clipGroupPct.absoluteWidthPct !== undefined
        ? Math.max(0, clipGroupPct.absoluteWidthPct * containerWidth)
        : (fallbackClipGroup?.absoluteWidth ?? containerWidth),
    absoluteHeight:
      clipGroupPct.absoluteHeightPct !== undefined
        ? Math.max(0, clipGroupPct.absoluteHeightPct * containerHeight)
        : (fallbackClipGroup?.absoluteHeight ?? containerHeight),
    rotation:
      clipGroupPct.rotationDelta !== undefined
        ? containerRotate + clipGroupPct.rotationDelta
        : (fallbackClipGroup?.rotation ?? 0),
  }
}

/**
 * Scale an original clipGroup to match new container dimensions.
 *
 * When the container (layer) is resized, the clipGroup needs to scale proportionally
 * to maintain the same relative crop position and size.
 *
 * **Calculation:**
 * - `scaleX = containerWidth / originalBaseState.width`
 * - `scaleY = containerHeight / originalBaseState.height`
 * - All position/size values are multiplied by respective scale factors
 * - Rotation is preserved unchanged
 *
 * @param originalClipGroup - Original clipGroup values to scale
 * @param originalBaseState - Original container dimensions (for calculating scale)
 * @param containerWidth - New container width
 * @param containerHeight - New container height
 * @returns Scaled clipGroup with new absolute values
 *
 * @example
 * // Container doubled in size (200x100 -> 400x200)
 * scaleOriginalClipGroup(
 *   { absoluteX: 10, absoluteY: 20, absoluteWidth: 100, absoluteHeight: 50, rotation: 0 },
 *   { width: 200, height: 100, left: 0, top: 0, rotate: 0 },
 *   400, 200
 * )
 * // Returns: { absoluteX: 20, absoluteY: 40, absoluteWidth: 200, absoluteHeight: 100, rotation: 0 }
 */
export function scaleOriginalClipGroup(
  originalClipGroup: ClipGroup,
  originalBaseState: BaseTransform,
  containerWidth: number,
  containerHeight: number
): ClipGroup {
  const scaleX = containerWidth / originalBaseState.width
  const scaleY = containerHeight / originalBaseState.height

  return {
    absoluteX: (originalClipGroup.absoluteX ?? 0) * scaleX,
    absoluteY: (originalClipGroup.absoluteY ?? 0) * scaleY,
    absoluteWidth: (originalClipGroup.absoluteWidth ?? originalBaseState.width) * scaleX,
    absoluteHeight: (originalClipGroup.absoluteHeight ?? originalBaseState.height) * scaleY,
    rotation: originalClipGroup.rotation ?? 0,
  }
}

/**
 * Create default clipGroup that fills the container
 */
export function createDefaultClipGroup(containerWidth: number, containerHeight: number): ClipGroup {
  return {
    absoluteX: 0,
    absoluteY: 0,
    absoluteWidth: containerWidth,
    absoluteHeight: containerHeight,
    rotation: 0,
  }
}

/**
 * Compute the clipGroup for an individual mode option.
 *
 * This function determines the appropriate clipGroup (crop area) for an image option
 * in individual editing mode, using a priority-based fallback system.
 *
 * **Priority Order:**
 * 1. **Decode from percentages** - If `clipGroupPct` exists, decode to absolute values
 * 2. **Stored absolute clipGroup** - Use the option's saved clipGroup
 * 3. **Scale originalClipGroup** - Scale the original to match current container
 * 4. **Use originalClipGroup as-is** - When scaling isn't possible
 * 5. **Create default clipGroup** - Fill the entire container
 *
 * **Edge Cases:**
 * - Returns `undefined` if container has zero dimensions
 * - Returns `undefined` if percentages exist but container is invalid
 *
 * @param selectedFile - The selected image option
 * @param originalClipGroup - ClipGroup captured when entering individual mode
 * @param originalBaseState - Base state captured when entering individual mode
 * @param containerWidth - Current container width in pixels
 * @param containerHeight - Current container height in pixels
 * @param containerRotate - Current container rotation in degrees
 * @returns Computed clipGroup or undefined if cannot compute
 *
 * @example
 * // Priority 1: Decode from percentages
 * computeIndividualModeClipGroup(
 *   { _id: '1', clipGroupPct: { absoluteXPct: 0.1 } },
 *   undefined, undefined, 200, 100, 0
 * )
 * // Returns decoded clipGroup with absoluteX: 20
 *
 * @example
 * // Priority 5: Default clipGroup (no other data)
 * computeIndividualModeClipGroup(
 *   { _id: '1' },
 *   undefined, undefined, 200, 100, 0
 * )
 * // Returns: { absoluteX: 0, absoluteY: 0, absoluteWidth: 200, absoluteHeight: 100, rotation: 0 }
 */
export function computeIndividualModeClipGroup(
  selectedFile: SelectedFile,
  originalClipGroup: ClipGroup | undefined,
  originalBaseState: BaseTransform | undefined,
  containerWidth: number,
  containerHeight: number,
  containerRotate: number
): ClipGroup | undefined {
  const clipGroupPct = selectedFile.clipGroupPct

  // Priority 1: Decode from percentages
  if (hasClipGroupPercentages(clipGroupPct)) {
    if (containerWidth > 0 && containerHeight > 0) {
      return decodeClipGroupFromPercentages(
        clipGroupPct!,
        containerWidth,
        containerHeight,
        containerRotate,
        selectedFile.clipGroup
      )
    }
    return undefined
  }

  // Priority 2: Use stored absolute clipGroup
  if (selectedFile.clipGroup) {
    return selectedFile.clipGroup
  }

  // Priority 3: Scale originalClipGroup to current container
  if (originalClipGroup && originalBaseState && originalBaseState.width > 0 && originalBaseState.height > 0) {
    return scaleOriginalClipGroup(originalClipGroup, originalBaseState, containerWidth, containerHeight)
  }

  // Priority 4: Use originalClipGroup as-is
  if (originalClipGroup) {
    return originalClipGroup
  }

  // Priority 5: Create default clipGroup
  if (containerWidth > 0 && containerHeight > 0) {
    return createDefaultClipGroup(containerWidth, containerHeight)
  }

  return undefined
}

/**
 * Build an image update payload by merging current image data with new values.
 *
 * Creates a partial NodeImage object that can be used to update the layer's image.
 * Preserves existing image properties when merging with new src or clipGroup.
 *
 * **Behavior:**
 * - If `currentImage` is an object, spreads it and overrides with new values
 * - If only `src` provided, creates new object with src and clipGroup
 * - If only `clipGroup` provided, creates object with just clipGroup
 * - Returns `undefined` if no update data provided
 *
 * @param currentImage - Current image data (object or string URL)
 * @param src - New image source URL to set
 * @param clipGroup - New clipGroup (crop area) to set
 * @returns Partial NodeImage for layer update, or undefined if no changes
 *
 * @example
 * // Merge with existing image
 * buildImagePayload({ src: 'old.jpg', width: 100 }, 'new.jpg', undefined)
 * // Returns: { src: 'new.jpg', width: 100, clipGroup: undefined }
 *
 * @example
 * // Create new from scratch
 * buildImagePayload(undefined, 'image.jpg', { absoluteX: 0, ... })
 * // Returns: { src: 'image.jpg', clipGroup: { absoluteX: 0, ... } }
 */
export function buildImagePayload(
  currentImage: NodeImage | string | undefined,
  src: string | undefined,
  clipGroup: ClipGroup | undefined
): Partial<NodeImage> | undefined {
  if (currentImage && typeof currentImage === 'object') {
    return {
      ...currentImage,
      ...(src ? { src } : {}),
      clipGroup,
    }
  }

  if (src) {
    return { src, clipGroup }
  }

  if (clipGroup) {
    return { clipGroup }
  }

  return undefined
}

/** Type for overlay data matching LayerDocument.settings.overlay */
type OverlayData = {
  overlaySvg: string
  editableSvg?: string
  overlayState?: unknown
  overlayMetadata?: unknown
}

/**
 * Build a settings update with overlay data from an image option.
 *
 * Handles merging overlay data from an image option into layer settings.
 * Validates that the overlay has the required `overlaySvg` field before setting.
 *
 * **Behavior:**
 * - If `selectedOverlay` has `overlaySvg`, merges it into settings
 * - If `selectedOverlay` is undefined but settings has overlay, clears it
 * - Returns `undefined` if no changes needed
 *
 * @param currentSettings - Current layer settings
 * @param selectedOverlay - Overlay data from the selected image option
 * @returns Updated settings or undefined if no changes
 *
 * @example
 * // Add overlay to settings
 * buildSettingsWithOverlay({ label: 'My Layer' }, { overlaySvg: '<svg>...</svg>' })
 * // Returns: { label: 'My Layer', overlay: { overlaySvg: '<svg>...</svg>', ... } }
 *
 * @example
 * // Clear existing overlay
 * buildSettingsWithOverlay({ overlay: {...} }, undefined)
 * // Returns: { overlay: undefined }
 */
export function buildSettingsWithOverlay(
  currentSettings: LayerSettings | undefined,
  selectedOverlay: ImageOptionOverlay | undefined
): LayerSettings | undefined {
  if (selectedOverlay && selectedOverlay.overlaySvg) {
    // Only set overlay if it has the required overlaySvg field
    const overlay: OverlayData = {
      overlaySvg: selectedOverlay.overlaySvg,
      editableSvg: selectedOverlay.editableSvg,
      overlayState: selectedOverlay.overlayState,
      overlayMetadata: selectedOverlay.overlayMetadata,
    }
    return { ...currentSettings, overlay }
  }

  if (currentSettings?.overlay) {
    return { ...currentSettings, overlay: undefined }
  }

  return undefined
}

/**
 * Check if an image option has custom transforms (has been edited in individual mode)
 * Returns true if any percentage value differs from the default (1.0 for size, 0 for position/rotation)
 * or if the option has custom clipGroup (crop position within mask)
 */
export function hasCustomTransform(option: ImageOptionSet): boolean {
  const { widthPct, heightPct, leftPct, topPct, rotateDelta, clipGroupPct } = option
  const hasCustomSize = (widthPct !== undefined && widthPct !== 1) || (heightPct !== undefined && heightPct !== 1)
  const hasCustomPosition = (leftPct !== undefined && leftPct !== 0) || (topPct !== undefined && topPct !== 0)
  const hasCustomRotation = rotateDelta !== undefined && rotateDelta !== 0

  // Check for custom clipGroup (crop position within mask)
  const hasCustomClipGroup
    = clipGroupPct !== undefined
    && (clipGroupPct.absoluteXPct !== undefined
      || clipGroupPct.absoluteYPct !== undefined
      || clipGroupPct.absoluteWidthPct !== undefined
      || clipGroupPct.absoluteHeightPct !== undefined
      || clipGroupPct.rotationDelta !== undefined)

  return hasCustomSize || hasCustomPosition || hasCustomRotation || hasCustomClipGroup
}
