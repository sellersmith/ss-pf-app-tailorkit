import { EMPTY_TAILORKIT_CONTAINER, INVALID_LAYER_ID } from '../constants/errors'
import type { Layer, ProductPersonalizerElementType } from '../type'
import { getLayerByFieldset } from '../utils/query-layer'
import { decodeOptionTransform, decodeClipGroup } from './decode-option-transform'

/** Interface for components that provide product personalizer data */
interface ProductPersonalizerProvider {
  productPersonalizer: ProductPersonalizerElementType
}

export enum OPTION_SELECTOR_KEYS {
  // Text element
  TEXT_BY_MERCHANT = 'text_option',
  TEXT_COLOR_OPTION = 'color_option',
  TEXT_FOR_CUSTOMER = 'text_customer',
  TEXT_SHAPE = 'text_shape',

  // Image element
  IMAGE_OPTION = 'image_option',
}

export type OptionsType = {
  [key in OPTION_SELECTOR_KEYS]?: { selector: HTMLFieldSetElement | null }
}

/**
 * @param props IFieldsetSelectorProps
 *
 * @description This function is served for getting selector ref for each fieldset
 * Each fieldset contains one input field like option set or option for customer to manage the form value easier
 */

interface IFieldsetSelectorProps {
  container?: HTMLElement
  layerId?: string
  printAreaId: string
}

export function getFieldsetSelector(props: IFieldsetSelectorProps) {
  const { container, layerId, printAreaId } = props
  // Define selector for each fieldset

  if (!container) {
    throw new Error(EMPTY_TAILORKIT_CONTAINER)
  }

  if (!layerId) {
    throw new Error(INVALID_LAYER_ID)
  }

  // Query fieldset with print area id and layer id because multiple print area can have same template
  const fieldsets = container.querySelectorAll(
    `fieldset[data-print-area-id="${printAreaId}"][data-layer-id="${layerId}"]`
  )

  const selectors: {
    [key in OPTION_SELECTOR_KEYS]?: { selector: Element | null }
  } = {}

  // Loop through fieldset to get each option selector
  ;[...fieldsets].forEach(fieldSet => {
    const optionType = fieldSet.getAttribute('data-option-type') as OPTION_SELECTOR_KEYS

    selectors[optionType] = {
      selector: fieldSet,
    }
  })

  return selectors
}

/**
 * @param instance - The instance of the product personalizer
 * @param fieldset - The fieldset element
 * @returns The clip group of the image option
 */
export function getImageUploadedClipGroup(instance: ProductPersonalizerProvider, fieldset: HTMLFieldSetElement) {
  const { optionSet } = getLayerByFieldset(instance, fieldset)

  const selectedOption = optionSet?.ol.find(option => option.i === fieldset.getAttribute('data-option-id'))
  const clipGroup = selectedOption?.clipGroup

  return clipGroup
}

/**
 * @param layer - The layer
 * @param fieldsetImageOption - The fieldset selector for image option
 * @returns The design state of the image option
 * @description This function is served for getting the design state of the image option
 * It will get the design state of the image option from the layer integration
 * If the image option is not selected, it will get the design state of the layer image
 * If the image option is selected, it will get the design state of the selected image option
 */
export function getImageDesignEvaluation(layer: Layer, fieldsetImageOption: HTMLFieldSetElement | null) {
  const layerImage = fieldsetImageOption ? fieldsetImageOption.getAttribute('value') || layer.u : layer.u

  const { ds, osl } = layer
  // Determine geometry from layer integrations (lis) instead of DOM data-* attributes
  let x = ds.l,
    y = ds.t,
    width = ds.w,
    height = ds.h,
    rotation = ds.r || 0

  const imageOptionSet = osl?.find((os: any) => os?.t === 'image_option')
  if (imageOptionSet) {
    // identify selected option by comparing value (src)
    const selectedValue = fieldsetImageOption ? fieldsetImageOption.getAttribute('value') : layerImage
    const selected = imageOptionSet.ol.find((o: any) => o.v === selectedValue)
    if (selected) {
      // NEW: Decode from percentages if available (new format)
      if (selected.base) {
        const decoded = decodeOptionTransform(selected.pct, selected.base)
        x = decoded.l
        y = decoded.t
        width = decoded.w
        height = decoded.h
        rotation = decoded.r
      } else if (selected.ds) {
        // Fallback for old format (backward compat during transition)
        x = selected.ds.l
        y = selected.ds.t
        width = selected.ds.w
        height = selected.ds.h
        rotation = selected.ds.r || 0
      }
    }
  }

  return {
    x,
    y,
    width,
    height,
    rotation,
  }
}

/**
 * @param layer - The layer
 * @param fieldsetImageOption - The fieldset selector for image option
 * @param containerDimensions - Container dimensions from decoded transform
 * @returns The decoded clip group of the image option, or null
 * @description Decode clipGroup from percentages if available (new format),
 * otherwise return clipGroup directly (old format / backward compat)
 */
export function getImageClipGroupEvaluation(
  layer: Layer,
  fieldsetImageOption: HTMLFieldSetElement | null,
  containerDimensions: { width: number; height: number; rotation: number }
): { absoluteX: number; absoluteY: number; absoluteWidth: number; absoluteHeight: number; rotation: number } | null {
  const layerImage = fieldsetImageOption ? fieldsetImageOption.getAttribute('value') || layer.u : layer.u

  const imageOptionSet = layer.osl?.find((os: any) => os?.t === 'image_option')
  if (imageOptionSet) {
    const selectedValue = fieldsetImageOption ? fieldsetImageOption.getAttribute('value') : layerImage
    const selected = imageOptionSet.ol.find((o: any) => o.v === selectedValue)

    if (selected) {
      // NEW: Decode clipGroup from percentages if available (new format)
      if (selected.clipGroupPct) {
        return decodeClipGroup(
          selected.clipGroupPct,
          containerDimensions.width,
          containerDimensions.height,
          containerDimensions.rotation
        )
      }

      if (selected.clipGroup) {
        // Fallback for old format (backward compat during transition)
        return selected.clipGroup
      }
    }
  }

  return null
}
