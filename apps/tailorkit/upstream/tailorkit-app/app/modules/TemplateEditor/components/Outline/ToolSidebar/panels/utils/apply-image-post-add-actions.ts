/**
 * Shared helper that applies pending post-add actions to an image layer.
 * Used by both ImageToolPanel and AIImageToolPanel after an image is added.
 *
 * Waits for auto-select (100ms in addElements) + render buffer, then applies
 * personalization settings (buyer/seller, upload, edit, AI effects, masks, etc.)
 * and opens the appropriate accordion (personalize-image or personalize-mask).
 */
import { ELayerType, EOptionSet, optionSetDataKeys } from '~/types/psd'
import { uuid } from '~/utils/uuid'
import { getClickedLayerStore } from '~/stores/modules/layer-store-selection'
import { findNearestAspectRatio } from 'extensions/tailorkit-src/src/shared/libraries/template/calculateLayerRatio'
import { getAvailableRatios, getMaskOptionsByRatio } from '~/bootstrap/constants/mask-option-sets'
import type { ImagePostAddAction } from '~/modules/TemplateEditor/components/Editor/utils/element-presets/types'
import type { TLayerStore } from '~/stores/modules/layer'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'

function applyPersonalizeImageAction(layerStore: TLayerStore, action: ImagePostAddAction) {
  const layerState = layerStore.getState()
  const { label, source, enableUpload, enableEditAll, required, enableAIEffects, aiEffectStyles, advancedOptionCount }
    = action.config

  const existingSettings = (layerState.settings || {}) as Record<string, unknown>
  const existingUploaderOpts = (existingSettings.imageUploaderOptions || {}) as Record<string, unknown>

  layerStore.dispatch({
    type: 'UPDATE_LAYER',
    payload: {
      state: {
        settings: {
          ...existingSettings,
          enableBuyerImage: source === 'buyer',
          enableSellerImage: source === 'seller',
          imageUploaderOptions: {
            ...existingUploaderOpts,
            ...(enableUpload !== undefined && { allowCustomerUploadImage: enableUpload }),
            ...(enableEditAll && {
              allowCustomerToEditImage: {
                allowTransform: true,
                allowRotate: true,
                allowZoom: true,
                allowRemoveBackground: true,
              },
            }),
            ...(required !== undefined && { required }),
            // AI effects for buyers
            ...(enableAIEffects && {
              allowCustomerGenerateImageWithAI: true,
              allowCustomerToUseQuickPrompts: true,
            }),
            ...(aiEffectStyles && { enabledQuickPrompts: aiEffectStyles }),
            // Advanced options: first 2 = reference image + quick prompts
            ...(advancedOptionCount !== undefined
              && advancedOptionCount >= 1 && { allowCustomerToUseReferenceImage: true }),
            ...(advancedOptionCount !== undefined
              && advancedOptionCount >= 2 && { allowCustomerToUseQuickPrompts: true }),
          },
        } as any,
      },
    },
  })

  // Set storefront label on the IMAGE_OPTION option set
  if (label) {
    const optionSetList = layerStore.getState().optionSet || []
    const imageOptionSet = optionSetList.find((os: any) => os.type === EOptionSet.IMAGE_OPTION)
    if (imageOptionSet) {
      layerStore.dispatch({
        type: 'UPDATE_OPTION_SET',
        payload: {
          optionSet: { ...imageOptionSet, label, labelOnStoreFront: label } as any,
          fromOption: imageOptionSet,
        },
      })
    }
  }

  // For seller's image: populate option set with current image as first
  // option and enable "New option set" editing state — matches the existing
  // AddOptionButtons.handleClick → buildDefaultOptionSetData flow.
  if (source === 'seller') {
    const currentState = layerStore.getState()
    const optionSets = currentState.optionSet || []
    const imgOptionSet = optionSets.find((os: any) => os.type === EOptionSet.IMAGE_OPTION)

    if (imgOptionSet) {
      const imgSrc
        = typeof currentState.image === 'string'
          ? (currentState.image as unknown as string)
          : (currentState.image as any)?.src
      const clipGroup = typeof currentState.image === 'string' ? undefined : (currentState.image as any)?.clipGroup
      const dataKey = optionSetDataKeys[EOptionSet.IMAGE_OPTION as keyof typeof optionSetDataKeys]

      const firstItem = imgSrc
        ? {
            _id: uuid(),
            name: currentState.label || 'Image',
            src: imgSrc,
            selecting: true,
            width: currentState.width,
            height: currentState.height,
            left: currentState.left,
            top: currentState.top,
            rotate: currentState.rotate,
            clipGroup,
          }
        : null

      layerStore.dispatch({
        type: 'UPDATE_OPTION_SET',
        payload: {
          optionSet: {
            ...imgOptionSet,
            _id: uuid(),
            data: firstItem ? { [dataKey]: [firstItem] } : { [dataKey]: [] },
          } as any,
          fromOption: imgOptionSet,
        },
      })
    }

    layerStore.dispatch({
      type: 'UPDATE_OPTION_SET_EDITING_STATE',
      payload: {
        optionSetType: EOptionSet.IMAGE_OPTION,
        editingState: {
          newOptionSetPressed: true,
          existOptionSetPressed: false,
          editMode: true,
        },
      },
    })
  }
}

/**
 * Apply personalize-mask action: finds nearest ratio for the layer,
 * looks up requested mask shapes (e.g. Circle, Heart) for that ratio,
 * populates the MASK_OPTION option set data, and sets editing state.
 */
function applyPersonalizeMaskAction(
  layerStore: TLayerStore,
  action: ImagePostAddAction,
  imageDimensions?: { width: number; height: number }
) {
  const { label, maskShapes } = action.config
  const layerState = layerStore.getState()

  // Priority: caller dimensions (IImageQuery) → store image → layer → default.
  // Caller dimensions fix the "1:1 on first upload" bug by providing actual image
  // size before the store is populated.
  const imageData = layerState.image as { width?: number; height?: number } | undefined
  const width = imageDimensions?.width || imageData?.width || layerState.width || 1
  const height = imageDimensions?.height || imageData?.height || layerState.height || 1

  // Find nearest aspect ratio for the layer dimensions
  const ratioOptions = getAvailableRatios().map(r => r.value)
  const nearestRatio = findNearestAspectRatio({ width, height }, ratioOptions)
  // Get all available masks for this ratio
  const masksForRatio = getMaskOptionsByRatio(nearestRatio.label)
  if (!masksForRatio.length) return

  // Find the requested shapes (e.g. Circle, Heart) and build mask items
  const requestedShapes = maskShapes || ['Circle']
  const ratioLabel = getAvailableRatios().find(r => r.value === nearestRatio.label)?.keyLabel || ''
  const maskItems = requestedShapes
    .map((shapeName, index) => {
      const maskShape = masksForRatio.find(m => m.name === shapeName)
      if (!maskShape) return null
      return {
        _id: uuid(),
        name: `${maskShape.name} (${ratioLabel})`,
        src: maskShape.src,
        selecting: index === 0, // First mask is selected by default
      }
    })
    .filter(Boolean)

  if (!maskItems.length) return

  // Get the MASK_OPTION option set
  const optionSets = layerStore.getState().optionSet || []
  const maskOptionSet = optionSets.find((os: any) => os.type === EOptionSet.MASK_OPTION)
  if (!maskOptionSet) return

  const dataKey = optionSetDataKeys[EOptionSet.MASK_OPTION as keyof typeof optionSetDataKeys]

  // Set storefront label on the mask option set
  if (label) {
    layerStore.dispatch({
      type: 'UPDATE_OPTION_SET',
      payload: {
        optionSet: {
          ...maskOptionSet,
          _id: uuid(),
          label,
          labelOnStoreFront: label,
          data: { [dataKey]: maskItems },
        } as any,
        fromOption: maskOptionSet,
      },
    })
  } else {
    layerStore.dispatch({
      type: 'UPDATE_OPTION_SET',
      payload: {
        optionSet: {
          ...maskOptionSet,
          _id: uuid(),
          data: { [dataKey]: maskItems },
        } as any,
        fromOption: maskOptionSet,
      },
    })
  }

  // Set editing state for the mask option set
  layerStore.dispatch({
    type: 'UPDATE_OPTION_SET_EDITING_STATE',
    payload: {
      optionSetType: EOptionSet.MASK_OPTION,
      editingState: {
        newOptionSetPressed: true,
        existOptionSetPressed: false,
        editMode: true,
      },
    },
  })
}

/**
 * Apply all post-add actions to a layer store and set the accordion tab.
 */
function applyActionsToStore(
  layerStore: TLayerStore,
  actions: ImagePostAddAction[],
  imageDimensions?: { width: number; height: number }
) {
  let lastActionType: string = 'personalize-image'

  for (const action of actions) {
    if (action.type === 'personalize-image') {
      applyPersonalizeImageAction(layerStore, action)
      lastActionType = 'personalize-image'
    } else if (action.type === 'personalize-mask') {
      applyPersonalizeMaskAction(layerStore, action, imageDimensions)
      lastActionType = 'personalize-mask'
    }
  }

  // Set the accordion tab in localStorage.
  // AccordionList with exclusiveOpen reads from localStorage on mount.
  const accordionId
    = lastActionType === 'personalize-mask' ? 'personalize-mask-inspector' : 'personalize-image-inspector'
  try {
    localStorage.setItem('accordion_group_image-inspector_open_id', JSON.stringify(accordionId))
  } catch {}
}

/**
 * Apply pending post-add actions to the newly created image layer.
 *
 * Preferred: pass `directLayerStore` (from extractedLayerStores[0] right
 * after addElements) to apply synchronously — avoids timing races.
 * Pass `imageDimensions` from the IImageQuery to ensure correct mask ratio
 * on first add (before the store is populated with image data).
 *
 * Fallback: when no store is passed, polls getClickedLayerStore() until
 * auto-select completes (100ms in addElements) + render buffer.
 */
export function applyImagePostAddActions(
  actions: ImagePostAddAction[],
  directLayerStore?: TLayerStore,
  imageDimensions?: { width: number; height: number }
) {
  // Direct mode: apply immediately when caller provides the store reference.
  // This runs before auto-select (+100ms), so the data is already populated
  // when the inspector AccordionList mounts and reads localStorage.
  if (directLayerStore) {
    applyActionsToStore(directLayerStore, actions, imageDimensions)

    // Navigate to layers listing after auto-select delay (+100ms in addElements).
    // This switches the sidebar from Image/AI-Image panel to the layer inspector,
    // which mounts with the correct accordion tab from localStorage.
    setTimeout(() => {
      Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_LAYER_TOOL_PANEL, {
        toolId: 'layers-listing',
      })
    }, 150)
    return
  }

  // Fallback polling mode: wait for auto-select to complete, then apply.
  const apply = (retries = 5) => {
    setTimeout(() => {
      const layerStore = getClickedLayerStore()
      if (!layerStore) {
        if (retries > 0) apply(retries - 1)
        return
      }
      const layerState = layerStore.getState()
      if (layerState.type !== ELayerType.IMAGE) {
        if (retries > 0) apply(retries - 1)
        return
      }

      applyActionsToStore(layerStore, actions)

      // Navigate to layers listing via Transmitter (bypasses clearAllSelectedLayerStores)
      // so the inspector mounts fresh and reads the pre-set localStorage accordion tab.
      Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_LAYER_TOOL_PANEL, {
        toolId: 'layers-listing',
      })
    }, 200)
  }
  apply()
}
