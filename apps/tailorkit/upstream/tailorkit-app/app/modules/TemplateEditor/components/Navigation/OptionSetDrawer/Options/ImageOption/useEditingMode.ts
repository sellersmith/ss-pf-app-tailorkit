/**
 * Hook for managing image option editing mode (sync vs individual).
 *
 * **Editing Modes:**
 * - **sync**: All image options share the same transform (default). Moving/resizing
 *   the layer affects how all options appear when selected.
 * - **individual**: Each image option can have its own transform. The layer transform
 *   only affects the currently selected option.
 *
 * **State captured when entering individual mode:**
 * - `originalBaseState`: Layer dimensions at mode entry (for reverting)
 * - `originalClipGroup`: Crop area at mode entry (for reverting)
 *
 * **Revert behavior:**
 * When switching from individual to sync mode with changes, a confirmation dialog
 * is shown. Reverting will restore all options to the originalBaseState and clear
 * all percentage-based transforms.
 *
 * @module useEditingMode
 */

import { useCallback, useState } from 'react'
import { syncClipGroupToAll } from '~/modules/TemplateEditor/elements/hooks/useSyncClipGroupOption'
import { syncOptionsToBase } from '~/modules/TemplateEditor/elements/hooks/useSyncImageOptionTransform'
import type { LayerDocument } from '~/models/Layer.server'
import type { TLayerStore } from '~/stores/modules/layer'
import { type IMAGE_OPTION_SET, type ImageDataOptionSet, type ImageOptionSet, type NodeImage } from '~/types/psd'

// --- Types ---

export interface UseEditingModeOptions {
  layerStore: TLayerStore
  optionSet: IMAGE_OPTION_SET
  files: ImageOptionSet[]
  optionSetDataKey: string
  isMaskOption: boolean
  onUpdateTransformerSelection: () => void
}

export interface UseEditingModeResult {
  confirmResetOpen: boolean
  setConfirmResetOpen: (open: boolean) => void
  hasDivergentTransforms: () => boolean
  autoSelectFirstOption: (updatedOptionSet: IMAGE_OPTION_SET) => void
  captureOriginalBaseState: () => {
    width: number
    height: number
    left: number
    top: number
    rotate: number
    imageSrc: string | undefined
  }
  toggleEditingMode: () => void
  revertTransformsAndSwitch: () => void
  cancelRevert: () => void
}

// --- Hook ---

/**
 * Hook for managing sync vs individual editing modes for image option sets.
 *
 * @param options - Configuration options for the hook
 * @param options.layerStore - The layer store instance for dispatching updates
 * @param options.optionSet - The current IMAGE_OPTION_SET being edited
 * @param options.files - Array of image options in the set
 * @param options.optionSetDataKey - Data key for the option set (e.g., 'files')
 * @param options.isMaskOption - Whether this is a mask option (skips transform checks)
 * @param options.onUpdateTransformerSelection - Callback to update transformer after mode change
 * @returns Object containing state and handlers for editing mode management
 *
 * @example
 * const {
 *   confirmResetOpen,
 *   toggleEditingMode,
 *   revertTransformsAndSwitch,
 *   cancelRevert
 * } = useEditingMode({
 *   layerStore,
 *   optionSet,
 *   files,
 *   optionSetDataKey: 'files',
 *   isMaskOption: false,
 *   onUpdateTransformerSelection: () => updateTransformer()
 * })
 */
export function useEditingMode(options: UseEditingModeOptions): UseEditingModeResult {
  const { layerStore, optionSet, files, optionSetDataKey, isMaskOption, onUpdateTransformerSelection } = options

  const [confirmResetOpen, setConfirmResetOpen] = useState(false)

  /**
   * Detect if any image option has been individualized (has custom transforms).
   *
   * Checks both percentage-based transforms (widthPct, heightPct, etc.) and
   * absolute transform differences from the base layer state.
   *
   * @returns `true` if any option has divergent transforms that would be lost on revert
   */
  const hasDivergentTransforms = useCallback(() => {
    if (isMaskOption) return false

    const base = layerStore.getState()
    const baseTransform = {
      width: base.width || 0,
      height: base.height || 0,
      left: base.left || 0,
      top: base.top || 0,
      rotate: base.rotate || 0,
    }

    return files.some(file => {
      const { widthPct, heightPct, leftPct, topPct, rotateDelta, width, height, left, top, rotate } = file

      // Check for percentage-based individualization (relative transforms)
      const hasPercentageIndividualization = [
        { value: widthPct, expected: 1 },
        { value: heightPct, expected: 1 },
        { value: leftPct, expected: 0 },
        { value: topPct, expected: 0 },
        { value: rotateDelta, expected: 0 },
      ].some(({ value, expected }) => value !== undefined && value !== expected)

      // Check for absolute transform differences
      const hasAbsoluteDifferences = [
        { value: width, base: baseTransform.width },
        { value: height, base: baseTransform.height },
        { value: left, base: baseTransform.left },
        { value: top, base: baseTransform.top },
        { value: rotate, base: baseTransform.rotate },
      ].some(({ value, base }) => value !== undefined && value !== base)

      return hasPercentageIndividualization || hasAbsoluteDifferences
    })
  }, [files, isMaskOption, layerStore])

  /**
   * Auto-select the first option when entering individual mode.
   *
   * In individual mode, an option must be selected for transforms to be encoded.
   * This automatically selects the first option if none is currently selected.
   *
   * @param updatedOptionSet - The updated option set after mode change
   */
  const autoSelectFirstOption = useCallback(
    (updatedOptionSet: IMAGE_OPTION_SET) => {
      if (!isMaskOption && files.length > 0 && !files.some(f => f.selecting)) {
        const firstOption = files[0]
        setTimeout(() => {
          layerStore.dispatch({
            type: 'UPDATE_OPTION_SELECTING',
            payload: { optionSet: updatedOptionSet, _id: firstOption._id },
            skipTrace: true,
          })
        }, 0)
      }
    },
    [isMaskOption, files, layerStore]
  )

  /**
   * Capture the original layer state when entering individual mode.
   *
   * This snapshot is stored in the option set and used for:
   * - Reverting all options back to original state
   * - Calculating percentage-based transforms relative to original
   *
   * @returns Object with width, height, left, top, rotate, and imageSrc
   */
  const captureOriginalBaseState = useCallback(() => {
    const layerState = layerStore.getState()
    const image = layerState.image
    const imageSrc = image && typeof image === 'object' ? image.src : image
    return {
      width: layerState.width || 0,
      height: layerState.height || 0,
      left: layerState.left || 0,
      top: layerState.top || 0,
      rotate: layerState.rotate || 0,
      imageSrc, // Store original image source for restoration
    }
  }, [layerStore])

  /**
   * Toggle between sync and individual editing modes.
   *
   * **Sync → Individual:**
   * - Captures originalBaseState and originalClipGroup
   * - Auto-selects first option if none selected
   *
   * **Individual → Sync (with changes):**
   * - Shows confirmation dialog (sets confirmResetOpen = true)
   * - User must confirm via revertTransformsAndSwitch() or cancel via cancelRevert()
   *
   * **Individual → Sync (no changes):**
   * - Switches immediately without confirmation
   */
  const toggleEditingMode = useCallback(() => {
    const currentMode = optionSet?.editingMode || 'sync'
    const nextMode: 'sync' | 'individual' = currentMode === 'individual' ? 'sync' : 'individual'

    // Show confirmation when switching from individual to sync with changes
    if (currentMode === 'individual' && nextMode === 'sync' && hasDivergentTransforms()) {
      setConfirmResetOpen(true)
      return
    }

    // Capture originalClipGroup when entering individual mode
    const captureOriginalClipGroup = () => {
      const layerState = layerStore.getState()
      const image = layerState.image
      return image && typeof image === 'object' ? image.clipGroup : undefined
    }

    // Prepare option set update
    const updatedOptionSet = {
      ...optionSet,
      editingMode: nextMode,
      ...(currentMode === 'sync' && nextMode === 'individual'
        ? {
            originalBaseState: captureOriginalBaseState(),
            originalClipGroup: captureOriginalClipGroup(),
          }
        : {
            // Clear stale data when switching back to sync mode (no divergent transforms)
            // Use null instead of undefined so MongoDB actually clears the field
            originalBaseState: null,
            originalClipGroup: null,
          }),
      // Clear baseSnapshot from all files when switching to sync mode
      // Use null instead of undefined so MongoDB actually clears the field
      ...(nextMode === 'sync' && optionSet.data?.files
        ? {
            data: {
              ...optionSet.data,
              files: optionSet.data.files.map(f => ({
                ...f,
                baseSnapshot: null,
              })),
            },
          }
        : {}),
    }

    // Update the option set
    layerStore.dispatch({
      type: 'UPDATE_OPTION_SET',
      payload: { optionSet: updatedOptionSet },
      skipTrace: true,
    })

    // Auto-select first option when entering individual mode
    if (currentMode === 'sync' && nextMode === 'individual') {
      autoSelectFirstOption(updatedOptionSet)
    }
  }, [hasDivergentTransforms, layerStore, optionSet, captureOriginalBaseState, autoSelectFirstOption])

  /**
   * Revert all individualized transforms and switch back to sync mode.
   *
   * This function:
   * 1. Restores layer dimensions to originalBaseState
   * 2. Restores clipGroup to originalClipGroup
   * 3. Syncs all options to the base transform (clears percentages)
   * 4. Clears clipGroupPct from all options
   * 5. Switches editing mode to 'sync'
   * 6. Closes the confirmation dialog
   *
   * Called when user confirms reverting in the confirmation dialog.
   */
  const revertTransformsAndSwitch = useCallback(() => {
    const originalBaseState = optionSet?.originalBaseState
    const originalClipGroup = optionSet?.originalClipGroup

    // Get current layer state to determine base transform
    const currentLayerState = layerStore.getState()

    // Use originalBaseState if available, otherwise use current layer state
    const baseTransform = originalBaseState || {
      width: currentLayerState.width || 0,
      height: currentLayerState.height || 0,
      left: currentLayerState.left || 0,
      top: currentLayerState.top || 0,
      rotate: currentLayerState.rotate || 0,
    }

    // Sync all options to base transform (clears all percentage fields)
    let syncedFiles = syncOptionsToBase(files, baseTransform)

    // Sync clipGroup to all options (clears clipGroupPct)
    syncedFiles = syncClipGroupToAll(syncedFiles, originalClipGroup)

    // Prepare layer state update to restore original dimensions
    const layerStateUpdate: Partial<LayerDocument> = originalBaseState
      ? {
          width: originalBaseState.width,
          height: originalBaseState.height,
          left: originalBaseState.left,
          top: originalBaseState.top,
          rotate: originalBaseState.rotate,
        }
      : {}

    // Also restore original clipGroup if available
    if (originalClipGroup) {
      const currentImage = currentLayerState.image
      // Cast as NodeImage since we're merging clipGroup with existing image data
      layerStateUpdate.image = (
        currentImage && typeof currentImage === 'object'
          ? { ...(currentImage as NodeImage), clipGroup: originalClipGroup }
          : { clipGroup: originalClipGroup }
      ) as NodeImage
    }

    // Create updated option set with synced files
    // Use null instead of undefined so MongoDB actually clears the fields
    const updatedOptionSet = {
      ...optionSet,
      editingMode: 'sync' as const,
      originalBaseState: null,
      originalClipGroup: null,
      data: {
        ...(optionSet.data as ImageDataOptionSet),
        [optionSetDataKey]: syncedFiles,
      },
    }

    // Update layer and option set in a single dispatch
    layerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        state: {
          ...layerStateUpdate,
          optionSet: [...(currentLayerState.optionSet || []).filter(os => os._id !== optionSet._id), updatedOptionSet],
        },
      },
      skipTrace: true,
    })

    setConfirmResetOpen(false)
    onUpdateTransformerSelection()
  }, [files, layerStore, onUpdateTransformerSelection, optionSet, optionSetDataKey])

  const cancelRevert = useCallback(() => {
    setConfirmResetOpen(false)
  }, [])

  return {
    confirmResetOpen,
    setConfirmResetOpen,
    hasDivergentTransforms,
    autoSelectFirstOption,
    captureOriginalBaseState,
    toggleEditingMode,
    revertTransformsAndSwitch,
    cancelRevert,
  }
}
