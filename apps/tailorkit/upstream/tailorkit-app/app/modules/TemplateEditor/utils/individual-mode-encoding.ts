/**
 * Utility functions for encoding transforms in individual editing mode.
 * These functions handle the encoding of position and transform changes
 * into percentage-based values for image option sets.
 */

import { encodeClipGroupToPercentages } from '~/modules/TemplateEditor/elements/hooks/useSyncClipGroupOption'
import type { LayerDocument } from '~/models/Layer.server'
import type { IMAGE_OPTION_SET, ImageOptionSet, NodeImage, OptionSet } from '~/types/psd'
import { EOptionSet, FILE_OPTION_TYPE } from '~/types/psd'

// --- Types ---

/** Base transform snapshot for encoding calculations */
export interface BaseTransform {
  width: number
  height: number
  left: number
  top: number
  rotate: number
}

/** Parameters for encoding position changes (drag events) */
export interface PositionEncodingParams {
  /** New X position from drag event */
  newLeft: number
  /** New Y position from drag event */
  newTop: number
  /** Current layer state */
  state: LayerDocument
}

/** Parameters for encoding full transform changes */
export interface TransformEncodingParams {
  /** New rotation angle */
  newRotate: number
  /** New X position */
  newLeft: number
  /** New Y position */
  newTop: number
  /** New width */
  newWidth: number
  /** New height */
  newHeight: number
  /** Optional image patch with clipGroup updates */
  imagePatch: Partial<NodeImage> | undefined
  /** Current layer state */
  state: LayerDocument
}

/** Parameters for computing clipGroup patch when container dimensions change */
export interface ClipGroupPatchParams {
  /** Current clipGroup from the layer's image */
  currentClipGroup: NodeImage['clipGroup']
  /** Old layer width before transform */
  oldLayerWidth: number
  /** Old layer height before transform */
  oldLayerHeight: number
  /** New layer width after transform */
  newWidth: number
  /** New layer height after transform */
  newHeight: number
}

/** Result of encoding operations */
export interface EncodingResult {
  /** Updated option set array, or undefined if no update needed */
  optionSetPatch: OptionSet[] | undefined
  /** Whether the patch should be applied */
  shouldPatch: boolean
}

// --- Helper Functions ---

/**
 * Extract image option set data from layer state.
 *
 * Finds the image option set within the layer's optionSet array and extracts
 * its editing mode and files. Handles type narrowing for the discriminated union.
 *
 * @param state - Current layer document state
 * @returns Object containing:
 *   - `imageOptionSet`: The IMAGE_OPTION_SET or undefined if not found
 *   - `files`: Array of ImageOptionSet items (empty if no option set)
 *   - `editingMode`: Current editing mode ('sync' or 'individual')
 *   - `dataKey`: The data key constant for image options ('files')
 *
 * @internal
 */
function getImageOptionSetData(state: LayerDocument): {
  imageOptionSet: IMAGE_OPTION_SET | undefined
  files: ImageOptionSet[]
  editingMode: 'sync' | 'individual'
  dataKey: typeof FILE_OPTION_TYPE
} {
  const optionSets = state.optionSet as OptionSet[] | undefined
  const imageOptionSet = optionSets?.find(os => os.type === EOptionSet.IMAGE_OPTION) as IMAGE_OPTION_SET | undefined

  if (!imageOptionSet) {
    return {
      imageOptionSet: undefined,
      files: [],
      editingMode: 'sync',
      dataKey: FILE_OPTION_TYPE,
    }
  }

  const editingMode = imageOptionSet.editingMode || 'sync'
  const files: ImageOptionSet[] = imageOptionSet.data?.files || []

  return { imageOptionSet, files, editingMode, dataKey: FILE_OPTION_TYPE }
}

/**
 * Get the base transform for percentage encoding calculations.
 *
 * Uses a priority-based fallback system to find the appropriate base dimensions:
 * 1. **baseSnapshot** - Captured when the option was first edited
 * 2. **originalBaseState** - Captured when entering individual mode
 * 3. **fallbackBase** - Current layer dimensions as last resort
 *
 * @param file - The image option being encoded
 * @param originalBaseState - Base state from when individual mode was entered
 * @param fallbackBase - Fallback transform (usually current layer state)
 * @returns The base transform to use for encoding
 *
 * @internal
 */
function getBaseTransform(
  file: ImageOptionSet,
  originalBaseState: BaseTransform | undefined,
  fallbackBase: BaseTransform
): BaseTransform {
  return file.baseSnapshot || originalBaseState || fallbackBase
}

// --- Main Functions ---

/**
 * Encode position changes from drag events into percentage-based values.
 *
 * Called during drag operations to update the selected option's position as percentages
 * relative to the base transform. Non-selected options remain unchanged.
 *
 * **When to use:**
 * - After a drag event (onDragEnd) in individual editing mode
 * - Only affects the currently selected image option
 *
 * **Encoding formula:**
 * - `leftPct = (newLeft - base.left) / base.width`
 * - `topPct = (newTop - base.top) / base.height`
 *
 * **Returns no patch when:**
 * - Not in individual editing mode
 * - No image option set exists
 * - No option is currently selected
 *
 * @param params - Position encoding parameters
 * @param params.newLeft - New X position from Konva drag event
 * @param params.newTop - New Y position from Konva drag event
 * @param params.state - Current layer state from store
 * @returns Encoding result with optionSetPatch if update needed
 *
 * @example
 * const result = encodeIndividualModePosition({
 *   newLeft: 70,
 *   newTop: 80,
 *   state: layerStore.getState()
 * })
 *
 * if (result.shouldPatch) {
 *   onChange({ optionSet: result.optionSetPatch })
 * }
 */
export function encodeIndividualModePosition(params: PositionEncodingParams): EncodingResult {
  const { newLeft, newTop, state } = params
  const { imageOptionSet, files, editingMode, dataKey } = getImageOptionSetData(state)

  // Not in individual mode or no image option set
  if (editingMode !== 'individual' || !imageOptionSet) {
    return { optionSetPatch: undefined, shouldPatch: false }
  }

  const selectedIndex = files.findIndex(f => f.selecting)

  // No selected option
  if (selectedIndex < 0) {
    return { optionSetPatch: undefined, shouldPatch: false }
  }

  const originalBaseState = imageOptionSet?.originalBaseState as BaseTransform | undefined
  const currentWidth = state.width || 0
  const currentHeight = state.height || 0
  const currentRotate = state.rotate || 0

  const updatedFiles = files.map((f, index) => {
    if (index !== selectedIndex) {
      return f // Non-selected options unchanged
    }

    // Selected option: update position and encode percentages
    const base = getBaseTransform(f, originalBaseState, {
      width: currentWidth,
      height: currentHeight,
      left: state.left || 0,
      top: state.top || 0,
      rotate: currentRotate,
    })

    const canEncode = base.width > 0 && base.height > 0
    const leftPct = canEncode ? (newLeft - base.left) / base.width : undefined
    const topPct = canEncode ? (newTop - base.top) / base.height : undefined

    return {
      ...f,
      baseSnapshot: base,
      ...(leftPct !== undefined ? { leftPct } : {}),
      ...(topPct !== undefined ? { topPct } : {}),
    }
  })

  const optionSets = state.optionSet as OptionSet[] | undefined
  const optionSetPatch = optionSets?.map(os =>
    os.type === EOptionSet.IMAGE_OPTION
      ? ({ ...os, data: { ...os.data, [dataKey]: updatedFiles } } as IMAGE_OPTION_SET)
      : os
  ) as OptionSet[] | undefined

  return { optionSetPatch, shouldPatch: true }
}

/**
 * Encode full transform changes into percentage-based values.
 *
 * Called after transform operations (resize, rotate) to encode all transform properties
 * as percentages relative to the base transform. Handles both layer transforms and
 * clipGroup (crop area) updates.
 *
 * **When to use:**
 * - After a transform event (onTransformEnd) in individual editing mode
 * - When user resizes, rotates, or moves the layer via transformer handles
 *
 * **Encoding formulas:**
 * - `widthPct = newWidth / base.width`
 * - `heightPct = newHeight / base.height`
 * - `leftPct = (newLeft - base.left) / base.width`
 * - `topPct = (newTop - base.top) / base.height`
 * - `rotateDelta = newRotate - base.rotate`
 *
 * **clipGroupPct encoding:**
 * If `imagePatch` contains a clipGroup, it's also encoded to percentages relative
 * to the new container dimensions for proportional scaling.
 *
 * **Returns no patch when:**
 * - Not in individual editing mode
 * - No image option set exists
 * - No option is currently selected (transforms still apply to layer, just not encoded)
 *
 * @param params - Transform encoding parameters
 * @param params.newRotate - New rotation angle in degrees
 * @param params.newLeft - New X position in pixels
 * @param params.newTop - New Y position in pixels
 * @param params.newWidth - New width in pixels
 * @param params.newHeight - New height in pixels
 * @param params.imagePatch - Optional image update with new clipGroup
 * @param params.state - Current layer state from store
 * @returns Encoding result with optionSetPatch if update needed
 *
 * @example
 * const result = encodeIndividualModeTransforms({
 *   newRotate: 30,
 *   newLeft: 70,
 *   newTop: 80,
 *   newWidth: 300,
 *   newHeight: 150,
 *   imagePatch: { clipGroup: { absoluteX: 10, ... } },
 *   state: layerStore.getState()
 * })
 *
 * if (result.shouldPatch) {
 *   onChange({ width, height, left, top, rotate, optionSet: result.optionSetPatch })
 * }
 */
export function encodeIndividualModeTransforms(params: TransformEncodingParams): EncodingResult {
  const { newRotate, newLeft, newTop, newWidth, newHeight, imagePatch, state } = params
  const { imageOptionSet, files, editingMode, dataKey } = getImageOptionSetData(state)

  // Not in individual mode or no image option set
  if (editingMode !== 'individual' || !imageOptionSet) {
    return { optionSetPatch: undefined, shouldPatch: false }
  }

  const selectedIndex = files.findIndex(f => f.selecting)

  // No selected option - no encoding needed (but still allow transform)
  if (selectedIndex < 0) {
    return { optionSetPatch: undefined, shouldPatch: false }
  }

  const originalBaseState = imageOptionSet?.originalBaseState as BaseTransform | undefined
  const oldLayerW = state.width || 1
  const oldLayerH = state.height || 1

  const updatedFiles = files.map((f, index) => {
    if (index !== selectedIndex) {
      // Non-selected options: Keep unchanged
      // Their percentages (if any) will be decoded correctly when selected
      // Unedited options will fall back to originalBaseState via decode-on-read
      return f
    }

    // Selected option: update with new transform and encode percentages
    const fallbackBase = {
      width: oldLayerW,
      height: oldLayerH,
      left: state.left || 0,
      top: state.top || 0,
      rotate: state.rotate || 0,
    }
    const base = getBaseTransform(f, originalBaseState, fallbackBase)
    const canEncode = base.width > 0 && base.height > 0

    const widthPct = canEncode ? newWidth / base.width : undefined
    const heightPct = canEncode ? newHeight / base.height : undefined
    const leftPct = canEncode ? (newLeft - base.left) / base.width : undefined
    const topPct = canEncode ? (newTop - base.top) / base.height : undefined
    const rotateDelta = newRotate - base.rotate

    let result: ImageOptionSet = {
      ...f,
      baseSnapshot: base,
      ...(widthPct !== undefined ? { widthPct } : {}),
      ...(heightPct !== undefined ? { heightPct } : {}),
      ...(leftPct !== undefined ? { leftPct } : {}),
      ...(topPct !== undefined ? { topPct } : {}),
      rotateDelta,
    }

    // Also update clipGroupPct if clipGroup present (only store percentage)
    if (imagePatch?.clipGroup) {
      const clipGroupPct = encodeClipGroupToPercentages(imagePatch.clipGroup, {
        width: newWidth,
        height: newHeight,
        rotate: newRotate,
      })
      result = { ...result, clipGroupPct }
    }

    return result
  })

  const optionSets = state.optionSet as OptionSet[] | undefined
  const optionSetPatch = optionSets?.map(os =>
    os.type === EOptionSet.IMAGE_OPTION
      ? ({ ...os, data: { ...os.data, [dataKey]: updatedFiles } } as IMAGE_OPTION_SET)
      : os
  ) as OptionSet[] | undefined

  return { optionSetPatch, shouldPatch: true }
}

/**
 * Scale clipGroup proportionally when container dimensions change.
 *
 * When the outer layer frame is resized, the clipGroup (visible crop area) needs to
 * scale proportionally to maintain the same relative crop position and size.
 *
 * **Use case:**
 * During transform operations, if the layer has a clipGroup (crop), this function
 * computes the new clipGroup dimensions that maintain the same relative position.
 *
 * **Calculation:**
 * - `scaleX = newWidth / oldLayerWidth`
 * - `scaleY = newHeight / oldLayerHeight`
 * - All clipGroup position/size values are multiplied by respective scale factors
 * - Rotation is preserved unchanged
 *
 * **Returns undefined when:**
 * - No clipGroup exists on the image
 *
 * @param params - ClipGroup patch parameters
 * @param params.currentClipGroup - Existing clipGroup from the layer's image
 * @param params.oldLayerWidth - Layer width before the transform
 * @param params.oldLayerHeight - Layer height before the transform
 * @param params.newWidth - New layer width after transform
 * @param params.newHeight - New layer height after transform
 * @returns Image patch with scaled clipGroup, or undefined if no clipGroup
 *
 * @example
 * // Layer doubled in size (200x100 -> 400x200)
 * const patch = computeClipGroupPatch({
 *   currentClipGroup: { absoluteX: 20, absoluteY: 10, absoluteWidth: 100, absoluteHeight: 50, rotation: 0 },
 *   oldLayerWidth: 200,
 *   oldLayerHeight: 100,
 *   newWidth: 400,
 *   newHeight: 200
 * })
 * // Returns: { clipGroup: { absoluteX: 40, absoluteY: 20, absoluteWidth: 200, absoluteHeight: 100, rotation: 0 } }
 */
export function computeClipGroupPatch(params: ClipGroupPatchParams): Partial<NodeImage> | undefined {
  const { currentClipGroup, oldLayerWidth, oldLayerHeight, newWidth, newHeight } = params

  if (!currentClipGroup) {
    return undefined
  }

  // Calculate scale factors for how much the layer changed
  const scaleX = newWidth / oldLayerWidth
  const scaleY = newHeight / oldLayerHeight

  // Scale the clipGroup proportionally to fit the new layer bounds
  const newClipW = currentClipGroup.absoluteWidth * scaleX
  const newClipH = currentClipGroup.absoluteHeight * scaleY
  const newClipX = (currentClipGroup.absoluteX || 0) * scaleX
  const newClipY = (currentClipGroup.absoluteY || 0) * scaleY

  return {
    clipGroup: {
      absoluteWidth: newClipW,
      absoluteHeight: newClipH,
      absoluteX: newClipX,
      absoluteY: newClipY,
      rotation: currentClipGroup.rotation || 0,
    },
  }
}
