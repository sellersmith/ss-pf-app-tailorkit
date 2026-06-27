import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '~/libs/external-store'
import type { TLayerStore } from '~/stores/modules/layer'
import { type ImageSettings, type IMAGE_OPTION_SET, EOptionSet } from '~/types/psd'
import { TemplateEditorContext } from '~/modules/TemplateEditor/context'
import { getKeyError, OptionSetErrorKeys } from '~/modules/TemplateEditor/utilities/optionSet-fns'
import { OptionSetErrors } from '~/constants/errors'
import { DEFAULT_IMAGE_UPLOADER_OPTION_DATA } from '../../../constants/image'
import { subInspectorStoreActions } from '~/stores/canvas/subInspector'
import type { AllowCustomerToEditImageKey } from './BuyersActionPopover'

interface UseImageUploaderOptionsProps {
  layerStore: TLayerStore
  previewMode: boolean
  /**
   * Whether the current image is a vector (SVG) image.
   * When true, edit image options are not applicable.
   */
  isVectorImage?: boolean
}

/**
 * Custom hook that manages image uploader options state and handlers
 * Extracts all business logic from the ImageUploaderOption component
 *
 * Supports both raster and vector (SVG) image layers:
 * - Raster: All options available including edit image actions
 * - Vector: Edit image options are excluded (not applicable to SVG)
 */
export function useImageUploaderOptions({
  layerStore,
  previewMode,
  isVectorImage = false,
}: UseImageUploaderOptionsProps) {
  const { t } = useTranslation()
  const { setValidationErrors } = useContext(TemplateEditorContext)

  const layerId = useStore(layerStore, state => state._id)
  const layerSettings = useStore(layerStore, state => state.settings)
  const layerStoreState = useStore(layerStore, state => state)

  // Get image uploader options from layer settings with proper defaults
  const imageUploaderOptions = useMemo(() => {
    const settings = layerSettings as ImageSettings
    return settings?.imageUploaderOptions || DEFAULT_IMAGE_UPLOADER_OPTION_DATA
  }, [layerSettings])

  const {
    required,
    allowCustomerUploadImage,
    allowCustomerGenerateImageWithAI,
    allowCustomerToEditImage,
    allowCustomerToUseReferenceImage,
    allowCustomerToUseQuickPrompts,
    enabledQuickPrompts,
    autoRemoveSolidWhiteBackground,
  } = imageUploaderOptions

  // Popover state for Buyers' Action selector
  const [buyersActionPopoverActive, setBuyersActionPopoverActive] = useState(false)

  // Get image option set for validation only
  const optionSets = useMemo(() => layerStoreState.optionSet || [], [layerStoreState.optionSet])
  const imageOptionSet = useMemo(
    () => optionSets.find((optionSet): optionSet is IMAGE_OPTION_SET => optionSet.type === EOptionSet.IMAGE_OPTION),
    [optionSets]
  )

  // ============================================================================
  // Update function
  // ============================================================================

  const updateImageUploaderOptions = useCallback(
    (updates: Partial<NonNullable<ImageSettings['imageUploaderOptions']>>) => {
      if (previewMode) return

      const currentSettings = (layerSettings as ImageSettings) || {}
      const updatedImageUploaderOptions = {
        ...imageUploaderOptions,
        ...updates,
      }
      const updatedSettings: ImageSettings = {
        ...currentSettings,
        imageUploaderOptions: updatedImageUploaderOptions as ImageSettings['imageUploaderOptions'],
      }

      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            settings: updatedSettings,
          },
        },
      })
    },
    [layerStore, layerSettings, imageUploaderOptions, previewMode]
  )

  // ============================================================================
  // Main checkbox handlers
  // ============================================================================

  const handleAllowUploadChange = useCallback(
    (newChecked: boolean) => {
      if (newChecked) {
        updateImageUploaderOptions({ allowCustomerUploadImage: true })
      } else {
        // When disabling upload, also clear required if AI generation is also disabled
        const updates: Partial<NonNullable<ImageSettings['imageUploaderOptions']>> = {
          allowCustomerUploadImage: false,
        }
        if (!allowCustomerGenerateImageWithAI) {
          updates.required = false
        }
        updateImageUploaderOptions(updates)
      }
    },
    [updateImageUploaderOptions, allowCustomerGenerateImageWithAI]
  )

  const handleRequiredChange = useCallback(
    (newChecked: boolean) => {
      updateImageUploaderOptions({ required: newChecked })
    },
    [updateImageUploaderOptions]
  )

  const handleAllowGenerateWithAIChange = useCallback(
    (newChecked: boolean) => {
      if (newChecked) {
        updateImageUploaderOptions({
          allowCustomerGenerateImageWithAI: true,
          allowCustomerToUseReferenceImage: true,
          allowCustomerToUseQuickPrompts: true,
        })
      } else {
        // When disabling AI generation, also clear required if upload is also disabled
        const updates: Partial<NonNullable<ImageSettings['imageUploaderOptions']>> = {
          allowCustomerGenerateImageWithAI: false,
        }
        if (!allowCustomerUploadImage) {
          updates.required = false
        }
        updateImageUploaderOptions(updates)
      }
    },
    [updateImageUploaderOptions, allowCustomerUploadImage]
  )

  const handleAllowCustomerToUseReferenceImageChange = useCallback(
    (newChecked: boolean) => {
      updateImageUploaderOptions({ allowCustomerToUseReferenceImage: newChecked })
    },
    [updateImageUploaderOptions]
  )

  const handleAllowCustomerToUseQuickPromptsChange = useCallback(
    (newChecked: boolean) => {
      updateImageUploaderOptions({ allowCustomerToUseQuickPrompts: newChecked })
    },
    [updateImageUploaderOptions]
  )

  const handleAutoRemoveSolidBackgroundChange = useCallback(
    (newChecked: boolean) => {
      updateImageUploaderOptions({ autoRemoveSolidWhiteBackground: newChecked })
    },
    [updateImageUploaderOptions]
  )

  const handleAllowEditChange = useCallback(
    (newChecked: boolean) => {
      const editImageOptions = newChecked
        ? {
            allowTransform: true,
            allowRotate: true,
            allowZoom: true,
            allowRemoveBackground: true,
          }
        : {
            allowTransform: false,
            allowRotate: false,
            allowZoom: false,
            allowRemoveBackground: false,
          }

      updateImageUploaderOptions({
        allowCustomerToEditImage: editImageOptions,
      })
    },
    [updateImageUploaderOptions]
  )

  // ============================================================================
  // Inspector handlers (open sub-inspectors for preset selection)
  // ============================================================================

  const handleOpenQuickPromptInspector = useCallback(() => {
    subInspectorStoreActions.openSubInspector('styling-inspector', {
      enabledQuickPrompts,
      panel: 'quick-prompt-selector',
      title: t('enable-ai-effects-for-buyers'),
      onSelect: (names: string[]) => {
        updateImageUploaderOptions({ enabledQuickPrompts: names })
        // Keep SubInspectorStore in sync so the panel re-renders with updated selection
        subInspectorStoreActions.updateData({ enabledQuickPrompts: names })
      },
    })
  }, [enabledQuickPrompts, t, updateImageUploaderOptions])

  // ============================================================================
  // Buyers' Action popover handlers
  // ============================================================================

  const toggleBuyersActionPopover = useCallback(() => {
    setBuyersActionPopoverActive(active => !active)
  }, [])

  const closeBuyersActionPopover = useCallback(() => {
    setBuyersActionPopoverActive(false)
  }, [])

  const handleBuyersActionChange = useCallback(
    (actionKey: AllowCustomerToEditImageKey, checked: boolean) => {
      updateImageUploaderOptions({
        allowCustomerToEditImage: {
          ...allowCustomerToEditImage,
          [actionKey]: checked,
        },
      })
    },
    [allowCustomerToEditImage, updateImageUploaderOptions]
  )

  // ============================================================================
  // Computed values
  // ============================================================================

  const allowedCustomerToEditImage = useMemo(() => {
    if (!allowCustomerUploadImage && !allowCustomerGenerateImageWithAI) return false

    const { allowTransform, allowRotate, allowZoom, allowRemoveBackground } = allowCustomerToEditImage || {}

    return allowTransform || allowRotate || allowZoom || allowRemoveBackground
  }, [allowCustomerToEditImage, allowCustomerUploadImage, allowCustomerGenerateImageWithAI])

  const allowCustomersToEditImagesChecked = useMemo((): boolean | 'indeterminate' => {
    if (!allowCustomerToEditImage) return false

    const { allowTransform, allowRotate, allowZoom, allowRemoveBackground } = allowCustomerToEditImage

    if (!allowedCustomerToEditImage) return false

    return allowRemoveBackground && allowZoom && allowRotate && allowTransform ? true : 'indeterminate'
  }, [allowCustomerToEditImage, allowedCustomerToEditImage])

  // ============================================================================
  // Validation effect
  // ============================================================================

  const checkValidLayerData = useCallback(() => {
    // Get layer state to check for override
    const layerState = layerStore.getState()

    // Check layer override first, then fall back to optionSet label
    const storefrontLabel
      = layerState.settings?.storefrontOptionSetLabels?.[imageOptionSet?.type as string]
      || imageOptionSet?.labelOnStoreFront
    const hasStoreFrontLabel = Boolean(storefrontLabel)

    const hasImageUploaderOptionsEnabled = allowCustomerUploadImage || allowCustomerGenerateImageWithAI
    const hasOptionSetData
      = imageOptionSet
      && (imageOptionSet.label || (imageOptionSet.data?.files?.length && imageOptionSet.data.files.length > 0))
    const requiresStoreFrontLabel = hasImageUploaderOptionsEnabled || hasOptionSetData

    return requiresStoreFrontLabel ? hasStoreFrontLabel : true
  }, [layerStore, imageOptionSet, allowCustomerUploadImage, allowCustomerGenerateImageWithAI])

  useEffect(() => {
    if (!imageOptionSet) return

    const isValidLabelStoreFront = checkValidLayerData()
    const errorKey = getKeyError(imageOptionSet, OptionSetErrorKeys.LABEL_STORE_FRONT)

    setValidationErrors(layerId, errorKey, isValidLabelStoreFront ? null : OptionSetErrors.MISSING_STORE_FRONT_LABEL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkValidLayerData, imageOptionSet, layerId, previewMode])

  // ============================================================================
  // Return all values and handlers
  // ============================================================================

  return {
    // State
    required,
    allowCustomerUploadImage,
    allowCustomerGenerateImageWithAI,
    allowCustomerToEditImage,
    allowCustomerToUseReferenceImage,
    allowCustomerToUseQuickPrompts,
    enabledQuickPrompts,
    autoRemoveSolidWhiteBackground,
    buyersActionPopoverActive,

    // Context flags
    isVectorImage,
    previewMode,

    // Computed
    allowedCustomerToEditImage,
    allowCustomersToEditImagesChecked,

    // Handlers - main checkboxes
    handleRequiredChange,
    handleAllowUploadChange,
    handleAllowGenerateWithAIChange,
    handleAllowCustomerToUseReferenceImageChange,
    handleAllowCustomerToUseQuickPromptsChange,
    handleAutoRemoveSolidBackgroundChange,
    handleAllowEditChange,

    // Handlers - inspector openers
    handleOpenQuickPromptInspector,

    // Handlers - buyers action popover
    toggleBuyersActionPopover,
    closeBuyersActionPopover,
    handleBuyersActionChange,
  }
}
