/* eslint-disable max-len */
import type { TFunction } from 'i18next'
import { UncommonError } from '~/constants/errors'
import { OPTION_SET_ACTIONS } from '~/routes/api.option-sets/constants'
import { authenticatedFetch } from '~/shopify/fns.client'
import type { TLayerStore } from '~/stores/modules/layer'
import { getAllLayerStore } from '~/stores/modules/layer'
import { EOptionSet, type Layer, type OptionSet, type OptionSet as OptionSetType } from '~/types/psd'

export async function countOptionSetsUsed(optionSetId: string) {
  const optionSetsUsed = await authenticatedFetch(
    `/api/option-sets?action=${OPTION_SET_ACTIONS.FIND_LAYER_BEING_USED}`,
    {
      method: 'POST',
      body: JSON.stringify({
        optionSetId,
      }),
    }
  )

  return optionSetsUsed
}

/**
 * @description
 * Based on the mechanism: the option set can not have the same label, so we need to check the label first when duplicate/unsync the option sets.
 * This function is used to get the maximum number of option set labels.
 * @param {OptionSetType} optionSetBeingChecked    Option sets being checked.
 * @param {OptionSetType[]} optionSetList          All the option sets.
 */
export const getMaxLabelIsUsed = (optionSetBeingChecked: OptionSetType, optionSetList: OptionSetType[]) => {
  let max = 0

  // Find all the option sets that contain the label of this optionSet
  const optionSetHavingSelectedLabel = optionSetList.filter(optionSet =>
    optionSet?.label?.match(new RegExp(`^${optionSetBeingChecked?.label?.replace(/ \(\d+\)$/, '')}( \\(\\d+\\))?$`))
  )

  let tempMax = max

  // Get the greatest number in similar labels
  optionSetHavingSelectedLabel.forEach((item: any) => {
    const num = Number(item?.label?.replace(/^.+\((\d+)\)$/, '$1'))

    if (!isNaN(num) && num > tempMax) {
      tempMax = num
    }
  })

  max = Math.max(max, tempMax) + 1

  return max
}

/**
 * @description Sync option set for layer using same option set when this's updated on editor
 */
export const syncOptionSetForLayerUsing = (optionSet: OptionSet) => {
  const layerStores = getAllLayerStore()
  const { _id: currentOptionSetId } = optionSet

  layerStores.forEach(layerStore => {
    const { optionSet: layerOptionSet } = layerStore.getState()

    if (!layerOptionSet) return

    // Update all layer using this option set
    layerOptionSet.forEach(ot => {
      if (ot._id === currentOptionSetId) {
        layerStore.dispatch({
          type: 'UPDATE_OPTION_SET',
          payload: {
            optionSet,
          },
        })
      }
    })
  })
}

/**
 * Evaluate layer position after deleting all layout
 * @param layersBaseStore
 * @returns
 */
export const evaluateLayerPositionAfterDeletingAllLayout = (
  currentExtractedLayerStores: TLayerStore[],
  layerStoresToBeRemoved: TLayerStore[]
) => {
  const _extractedLayerStores = [...currentExtractedLayerStores] // Copy to avoid mutating the original

  ;[...layerStoresToBeRemoved].reverse().forEach(layerStore => {
    const layerState = layerStore.getState()

    const { parent } = layerState // Assuming each layer has an `id` and `parentId` field

    // Find the index of the parent layer if it exists in the extracted layers
    const parentIndex = _extractedLayerStores.findIndex(layer => layer.getState()._id === parent)

    if (parentIndex !== -1) {
      // Insert after the parent layer
      _extractedLayerStores.splice(parentIndex + 1, 0, layerStore)
    } else {
      // Remove parent id
      layerStore.dispatch({
        type: 'UPDATE_LAYER',
        payload: {
          state: {
            parent: '',
          },
        },
      })

      // Insert at the bottom if the parent does not exist
      _extractedLayerStores.push(layerStore)
    }
  })

  return _extractedLayerStores
}

export const parseFontFamily = (family: string) => {
  return family && family.replace(/["'\\]/g, '')
}

/**
 * Checks if a layer is inside a multilayout layer and returns the result along with the multilayout layer's _id
 * @param targetLayer - The layer to check
 * @param allLayers - Array of all layers in the template
 * @returns Object containing:
 *  - isLayerInsideMultiLayout: boolean indicating if the layer is inside any multilayout
 *  - multiLayoutLayerId: The _id of the containing multilayout layer (undefined if not found)
 */
export function checkLayerInsideMultiLayout(targetLayer: Layer | null, allLayers: Layer[]) {
  if (!targetLayer) {
    console.warn(UncommonError)
    return {
      isLayerInsideMultiLayout: false,
      multiLayoutLayerId: undefined,
    }
  }

  // Find all multilayout layers
  const multiLayoutLayers = allLayers.filter(layer => layer.type === 'multi-layout')

  // Find which multilayout contains our target layer
  const containingMultiLayout = multiLayoutLayers.find(multiLayoutLayer => {
    const multiLayoutOptionSet = multiLayoutLayer.optionSet?.find(opt => opt.type === EOptionSet.MULTI_LAYOUT_OPTION)

    if (!multiLayoutOptionSet?.data?.['multi_layout']?.layouts) {
      return false
    }

    return multiLayoutOptionSet?.data?.['multi_layout']?.layouts?.some(layout =>
      layout.layerIds.includes(targetLayer._id)
    )
  })

  const multiLayoutLayerId = containingMultiLayout?._id

  return {
    isLayerInsideMultiLayout: !!multiLayoutLayerId,
    multiLayoutLayerId,
  }
}

export const getDefaultStorefrontLabel = (args: {
  t: TFunction
  type: EOptionSet | 'custom'
  defaultStorefrontLabel?: string
}) => {
  const { t, type, defaultStorefrontLabel = '' } = args

  if (defaultStorefrontLabel) {
    return defaultStorefrontLabel
  }

  switch (type) {
    case EOptionSet.IMAGE_OPTION:
      return t('select-an-image')
    case EOptionSet.TEXT_OPTION:
      return t('select-a-message')
    case EOptionSet.COLOR_OPTION:
      return t('select-a-color')
    case EOptionSet.FONT_OPTION:
      return t('select-a-font')
    case EOptionSet.MASK_OPTION:
      return t('select-a-mask')
    case EOptionSet.MULTI_LAYOUT_OPTION:
      return t('select-a-layout')
    case EOptionSet.IMAGELESS_OPTION:
      return t('select-an-option')
    case 'custom':
      return t('enter-message')
    default:
      return t('customize-content')
  }
}

/**
 * Revert a layer's image.src to image.originalSrc if present and different.
 * Returns true if a revert occurred.
 */
export function revertLayerImageToOriginal(layerStore: TLayerStore): boolean {
  const state = layerStore.getState()
  const { image } = state
  if (image && typeof image === 'object' && image.originalSrc && image.src !== image.originalSrc) {
    layerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: {
        state: {
          image: {
            ...image,
            src: image.originalSrc,
          },
        },
      },
      skipTrace: true,
    })
    return true
  }
  return false
}
