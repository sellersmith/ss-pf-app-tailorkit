import type { Layer } from '../../../type'
import { FontLoader } from '../../font-loader'

export interface FontOption {
  id: string
  value: string
  label: string
  isSelected: boolean
  fontFamily: string
  isDefault: boolean
  additionalPricing?: any
}

// Interface cho layer option
export interface LayerFontOption {
  v?: string // value
  l?: string // label
  s?: number // selected
  f?: string // font family
  [key: string]: any
}

export const fontStorefrontLoader = new FontLoader()

/**
 * Create content for font dropdown from layer data
 * @param layer Layer containing font options
 * @returns Object containing HTML content and title for popover
 */
export const getFontDropdownContent = async (wrapper: Element, layer: Layer): Promise<{ content: string }> => {
  const fontOptions = extractFontOptionsFromLayer(layer)
  const optionSet = getOptionSetFromLayer(layer)
  const fieldset = wrapper.closest('fieldset') as HTMLFieldSetElement
  const fontFamily = fieldset.getAttribute('data-family') || ''

  await Promise.all(
    fontOptions.map(async font => {
      await fontStorefrontLoader.loadFont(font.fontFamily, font.value)
    })
  )

  // Create HTML for options
  const optionsHtml = fontOptions
    .map(option => {
      const pricingAttr = option.additionalPricing
        ? `data-pricing='${JSON.stringify(option.additionalPricing).replace(/"/g, '&quot;')}'`
        : ''

      return `
        <div class="emtlkit--option-container ${option.fontFamily === fontFamily ? 'active' : ''}"
          value="${option.value}"
          data-label="${option.label}"
          data-default="${option.isDefault}"
          data-family="${option.fontFamily}"
          >
          <span style="font-family: '${option.fontFamily}'">${option.label || '--'}</span>
          ${option.isDefault && option.label ? `<span style="font-family: ''">(Default)</span>` : ''}
          <input
            type="radio"
            name="${layer.printAreaId} / ${optionSet?.i}"
            data-name="${option.label}"
            value="${option.value}"
            data-id="${option.id}"
            ${pricingAttr}
            ${option.isSelected ? 'checked' : ''}
          />
        </div>
      `
    })
    .join('')

  // Wrap in wrapper
  const content = `
    <div class="emtlkit--font-dropdown-content">
      ${optionsHtml}
    </div>
  `

  return {
    content,
  }
}

/**
 * Get font option set from layer
 * @param layer Layer containing font options
 * @returns Option set
 */
export const getOptionSetFromLayer = (layer: Layer) => {
  const fontOptionSet = layer.osl?.find(os => os?.t === 'font_option')
  return fontOptionSet
}

/**
 * Extract font options from layer
 * @param layer Layer containing font options
 * @returns Array of font options
 */
export const extractFontOptionsFromLayer = (layer: Layer): FontOption[] => {
  // Find font option set in layer
  const fontOptionSet = getOptionSetFromLayer(layer)

  if (!fontOptionSet || !fontOptionSet.ol) {
    return []
  }

  // const defaultFont = layer.s?.fontFamily

  // Map data from layer options to FontOption
  const fontOptions = fontOptionSet.ol.map((option: LayerFontOption) => {
    const font = JSON.parse(option.v || '{}')
    return {
      id: option.i,
      value: font.src || '',
      label: option.l || '',
      isSelected: option.s === 1,
      fontFamily: font.family || '',
      isDefault: false,
      additionalPricing: option.additionalPricing || font.additionalPricing,
    }
  })

  // if (defaultFont) {
  //   return [
  //     {
  //       id: defaultFont._id,
  //       value: defaultFont.src,
  //       label: defaultFont.family,
  //       isSelected: true,
  //       isDefault: true,
  //       fontFamily: defaultFont.family,
  //       additionalPricing: defaultFont.additionalPricing,
  //     },
  //     ...fontOptions,
  //   ]
  // }
  return fontOptions
}
