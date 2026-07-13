import { isJSON } from '../fns/is-json'
import { getImageUploadedClipGroup } from '../fns/get-fieldset-selector'
import { revaluateClipGroupWithOriginalLayerData } from '../utils/canvas'
import { getLayerByFieldset } from '../utils/query-layer'
import type { DisplayDataMap, MetaData } from '../utils/update-form-data'
import { addDisplayData, updateMetaData } from '../utils/update-form-data'
import type { TailorKitProductPersonalizer } from './product-personalizer'
import { isFieldSetHidden } from '../utils/fieldset'

/** Replace Private Use Area (U+E000–U+F8FF) characters with ★ for readable display in cart/checkout */
function sanitizePUAChars(text: string): string {
  return text.replace(/[\uE000-\uF8FF]/gu, '★')
}

/**
 * Handles processing of different option types from fieldsets
 */
export class OptionProcessor {
  /**
   * Process fieldset data to extract metadata and display data
   */
  static processFieldsetData(productPersonalizer: TailorKitProductPersonalizer) {
    const metaData: MetaData = {}
    const displayData: { [printAreaId: string]: DisplayDataMap } = {}
    const fieldsets = productPersonalizer.querySelectorAll('fieldset')

    fieldsets.forEach(fieldset => {
      const layerId = fieldset.getAttribute('data-layer-id')
      const printAreaId = fieldset.getAttribute('data-print-area-id')
      const isExistingPrintAreaAndLayer = printAreaId && layerId

      // Skip hidden option sets
      if (isFieldSetHidden(fieldset)) {
        if (isExistingPrintAreaAndLayer) {
          // Remove meta and display data if the option set is hidden
          if (metaData[printAreaId]) delete metaData[printAreaId][layerId]
          if (displayData[printAreaId]) delete displayData[printAreaId][layerId]
        }
        return
      }

      if (isExistingPrintAreaAndLayer) {
        OptionProcessor.processFieldsetOption(
          fieldset,
          metaData,
          displayData,
          productPersonalizer,
          printAreaId,
          layerId
        )
      } else if (printAreaId) {
        metaData[printAreaId] = {}
      }
    })

    return { metaData, displayData }
  }

  /**
   * Process a single fieldset option
   */
  private static processFieldsetOption(
    fieldset: Element,
    metaData: MetaData,
    displayData: { [printAreaId: string]: DisplayDataMap },
    productPersonalizer: TailorKitProductPersonalizer,
    printAreaId: string,
    layerId: string
  ) {
    const label = fieldset.getAttribute('data-label')
    const optionType = fieldset.getAttribute('data-option-type')

    const printAreaMetaData = metaData[printAreaId] || {}
    const printAreaDisplayData = displayData[printAreaId] || {}

    // Get ID of the selected option
    const selectedOption = fieldset.querySelector('.emtlkit--option-container.active input')
    const selectedOptionId = selectedOption?.getAttribute('data-id')

    // Initialize metadata and display data
    metaData[printAreaId] = { ...printAreaMetaData }
    displayData[printAreaId] = { ...printAreaDisplayData }

    const layerMetaData = isJSON(metaData[printAreaId][layerId])
      ? JSON.parse(metaData[printAreaId][layerId])
      : { selectedOptionId }

    const layerDisplayData = displayData[printAreaId][layerId] || []
    displayData[printAreaId][layerId] = [...layerDisplayData]

    // Process different option types
    OptionProcessor.processOptionByType(
      optionType,
      fieldset,
      metaData,
      displayData,
      productPersonalizer,
      printAreaId,
      layerId,
      layerMetaData,
      label
    )
  }

  /**
   * Process option based on its type
   */
  private static processOptionByType(
    optionType: string | null,
    fieldset: Element,
    metaData: MetaData,
    displayData: { [printAreaId: string]: DisplayDataMap },
    productPersonalizer: TailorKitProductPersonalizer,
    printAreaId: string,
    layerId: string,
    layerMetaData: any,
    label: string | null
  ) {
    switch (optionType) {
      case 'text_shape':
        OptionProcessor.processTextShapeOption(
          fieldset,
          metaData,
          displayData,
          printAreaId,
          layerId,
          layerMetaData,
          label
        )
        break

      case 'text_option':
      case 'text_customer':
        OptionProcessor.processTextOption(
          fieldset,
          metaData,
          displayData,
          printAreaId,
          layerId,
          layerMetaData,
          label,
          optionType
        )
        break

      case 'mask_option':
        OptionProcessor.processMaskOption(
          fieldset,
          metaData,
          displayData,
          printAreaId,
          layerId,
          layerMetaData,
          label,
          optionType
        )
        break

      case 'image_option':
        OptionProcessor.processImageOption(
          fieldset,
          metaData,
          displayData,
          productPersonalizer,
          printAreaId,
          layerId,
          layerMetaData,
          label,
          optionType
        )
        break

      case 'imageless_option':
        OptionProcessor.processImagelessOption(
          fieldset,
          metaData,
          displayData,
          printAreaId,
          layerId,
          layerMetaData,
          label,
          optionType
        )
        break

      case 'color_option':
        OptionProcessor.processColorOption(
          fieldset,
          metaData,
          displayData,
          printAreaId,
          layerId,
          layerMetaData,
          label,
          optionType
        )
        break

      case 'font_option':
        OptionProcessor.processFontOption(
          fieldset,
          metaData,
          displayData,
          printAreaId,
          layerId,
          layerMetaData,
          label,
          optionType
        )
        break

      case 'multi_layout_option':
        OptionProcessor.processMultiLayoutOption(
          fieldset,
          metaData,
          displayData,
          printAreaId,
          layerId,
          layerMetaData,
          label,
          optionType
        )
        break
    }
  }

  /**
   * Process text shape option
   */
  private static processTextShapeOption(
    fieldset: Element,
    metaData: MetaData,
    displayData: { [printAreaId: string]: DisplayDataMap },
    printAreaId: string,
    layerId: string,
    layerMetaData: any,
    label: string | null
  ) {
    const shape = fieldset.getAttribute('value') || ''

    updateMetaData({
      metaData,
      printAreaId,
      layerId,
      layerMetaData,
      newMetaData: {
        optionName: shape,
        shapeSettings: { shape },
      },
    })

    addDisplayData({ displayData, printAreaId, layerId, label, type: 'text_shape', value: shape })
  }

  /**
   * Process text option
   */
  private static processTextOption(
    fieldset: Element,
    metaData: MetaData,
    displayData: { [printAreaId: string]: DisplayDataMap },
    printAreaId: string,
    layerId: string,
    layerMetaData: any,
    label: string | null,
    optionType: string
  ) {
    const textContent = fieldset.getAttribute('value') || ''

    updateMetaData({
      metaData,
      printAreaId,
      layerId,
      layerMetaData,
      newMetaData: {
        settings: { content: textContent },
      },
    })

    addDisplayData({ displayData, printAreaId, layerId, label, type: optionType, value: sanitizePUAChars(textContent) })
  }

  /**
   * Process image option
   */
  private static processImageOption(
    fieldset: Element,
    metaData: MetaData,
    displayData: { [printAreaId: string]: DisplayDataMap },
    productPersonalizer: TailorKitProductPersonalizer,
    printAreaId: string,
    layerId: string,
    layerMetaData: any,
    label: string | null,
    optionType: string
  ) {
    const imageSrc = fieldset.getAttribute('value') || ''
    const imageName = fieldset.getAttribute('data-name') || ''
    const selectedOptionId = fieldset.getAttribute('data-option-id') || ''

    const { layer, optionSet } = getLayerByFieldset(productPersonalizer, fieldset as HTMLFieldSetElement)
    let clipGroup = getImageUploadedClipGroup(productPersonalizer, fieldset as HTMLFieldSetElement)

    if (clipGroup && layer?.ds) {
      clipGroup = revaluateClipGroupWithOriginalLayerData(layer.ds, clipGroup)
    }

    // Get overlay data from the selected image option (for VectorEditor-edited images)
    const selectedOption = optionSet?.ol?.find((opt: any) => opt.i === selectedOptionId)
    const overlay = selectedOption?.overlay

    updateMetaData({
      metaData,
      printAreaId,
      layerId,
      layerMetaData,
      newMetaData: {
        image: { ...(layerMetaData.image || {}), imageSrc, imageName, clipGroup, overlay },
      },
    })

    addDisplayData({ displayData, printAreaId, layerId, label, type: optionType, value: imageName })
  }

  /**
   * Process mask option
   */
  private static processMaskOption(
    fieldset: Element,
    metaData: MetaData,
    displayData: { [printAreaId: string]: DisplayDataMap },
    printAreaId: string,
    layerId: string,
    layerMetaData: any,
    label: string | null,
    optionType: string
  ) {
    const maskSrc = fieldset.getAttribute('value') || ''
    const maskName = fieldset.getAttribute('data-name') || ''

    updateMetaData({
      metaData,
      printAreaId,
      layerId,
      layerMetaData,
      newMetaData: {
        image: { ...(layerMetaData.image || {}), maskSrc, maskName },
      },
    })

    addDisplayData({ displayData, printAreaId, layerId, label, type: optionType, value: maskName })
  }

  /**
   * Process imageless option
   */
  private static processImagelessOption(
    fieldset: Element,
    metaData: MetaData,
    displayData: { [printAreaId: string]: DisplayDataMap },
    printAreaId: string,
    layerId: string,
    layerMetaData: any,
    label: string | null,
    optionType: string
  ) {
    // Skip when no option is selected. Any imageless display style (checkbox, swatch,
    // dropdown) can legitimately have no selection when the merchant hasn't preset one,
    // so callers must not assume a default has been auto-picked.
    const selectedOptionId = fieldset.getAttribute('data-option-id') || ''
    if (!selectedOptionId) return

    const optionName = fieldset.getAttribute('data-name') || ''

    updateMetaData({
      metaData,
      printAreaId,
      layerId,
      layerMetaData,
      newMetaData: {
        option: { optionName },
        selectedOptionId,
      },
    })

    addDisplayData({ displayData, printAreaId, layerId, label, type: optionType, value: optionName })
  }

  /**
   * Process color option
   */
  private static processColorOption(
    fieldset: Element,
    metaData: MetaData,
    displayData: { [printAreaId: string]: DisplayDataMap },
    printAreaId: string,
    layerId: string,
    layerMetaData: any,
    label: string | null,
    optionType: string
  ) {
    const colorValue = fieldset.getAttribute('value') || ''
    const colorName = fieldset.getAttribute('data-name') || ''
    const settings = layerMetaData.settings || {}

    updateMetaData({
      metaData,
      printAreaId,
      layerId,
      layerMetaData,
      newMetaData: {
        settings: { ...settings, color: { colorValue, colorName } },
      },
    })

    addDisplayData({ displayData, printAreaId, layerId, label, type: optionType, value: colorName })
  }

  /**
   * Process font option
   */
  private static processFontOption(
    fieldset: Element,
    metaData: MetaData,
    displayData: { [printAreaId: string]: DisplayDataMap },
    printAreaId: string,
    layerId: string,
    layerMetaData: any,
    label: string | null,
    optionType: string
  ) {
    const family = fieldset.getAttribute('data-family') || ''
    const name = fieldset.getAttribute('data-name') || ''
    const src = fieldset.getAttribute('value') || ''
    const isDefault = fieldset.getAttribute('data-default') === 'true'
    const settings = layerMetaData.settings || {}

    updateMetaData({
      metaData,
      printAreaId,
      layerId,
      layerMetaData,
      newMetaData: {
        settings: { ...settings, fontFamily: { family, src, name, isDefault } },
      },
    })

    // Surface the selected font as a clean, human-readable line-item property (e.g. "Font: Bodoni"),
    // mirroring how processColorOption surfaces the colour. Uses `name` (merchant-editable option label)
    // first so the merchant controls what shows on the order page / confirmation email, falling back to
    // the raw font `family`. Ported from emtailorkit master 4a0b11388. Additive: metadata/print unchanged.
    addDisplayData({
      displayData,
      printAreaId,
      layerId,
      label,
      type: optionType,
      value: name || family || '--',
    })
  }

  /**
   * Process multi layout option
   */
  private static processMultiLayoutOption(
    fieldset: Element,
    metaData: MetaData,
    displayData: { [printAreaId: string]: DisplayDataMap },
    printAreaId: string,
    layerId: string,
    layerMetaData: any,
    label: string | null,
    optionType: string
  ) {
    const layoutSelected = fieldset.getAttribute('value') || ''
    const layoutName = fieldset.getAttribute('data-name') || ''

    updateMetaData({
      metaData,
      printAreaId,
      layerId,
      layerMetaData,
      newMetaData: {
        optionSet: [
          {
            type: 'multi_layout_option',
            data: { multi_layout: { layoutSelected } },
          },
        ],
      },
    })

    addDisplayData({ displayData, printAreaId, layerId, label, type: optionType, value: layoutName })
  }
}
